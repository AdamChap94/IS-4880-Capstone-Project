import os, json, threading, collections, time, sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import pubsub_v1
from google.api_core.exceptions import GoogleAPICallError

# --- If you chose the INLINE JSON method (Option B), uncomment next block ---
# if "GOOGLE_APPLICATION_CREDENTIALS_JSON" in os.environ:
#     _path = "/tmp/gcp-sa.json"
#     with open(_path, "w") as _f:
#         _f.write(os.environ["GOOGLE_APPLICATION_CREDENTIALS_JSON"])
#     os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _path

# --- Config via env ---
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "").strip()
TOPIC_ID = os.environ.get("PUBSUB_TOPIC", "app-messages").strip()
SUB_PULL_ID = os.environ.get("PUBSUB_SUBSCRIPTION_PULL", "app-sub-pull").strip()

def die(msg):
    print(f"[FATAL] {msg}", file=sys.stderr, flush=True)
    # exit only if running as main (gunicorn imports module, so don't kill master)
    # We'll just raise to surface the problem in logs.
    raise RuntimeError(msg)

if not PROJECT_ID:
    die("GCP_PROJECT_ID is missing. Set it in Render backend Environment.")

print(f"[BOOT] PROJECT_ID={PROJECT_ID} TOPIC_ID={TOPIC_ID} SUB_PULL_ID={SUB_PULL_ID}", flush=True)
print(f"[BOOT] GOOGLE_APPLICATION_CREDENTIALS={os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}", flush=True)

app = Flask(__name__)
CORS(app)  # TODO: restrict in prod

try:
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
    print(f"[BOOT] topic_path={topic_path}", flush=True)
except Exception as e:
    die(f"Failed to init PublisherClient/topic_path: {e!r}")

# In-memory ring buffer for UI (POC-friendly)
RECENT = collections.deque(maxlen=200)

@app.route("/healthz")
def healthz():
    return "ok", 200

@app.route("/debug/env")
def debug_env():
    return jsonify({
        "PROJECT_ID": PROJECT_ID,
        "TOPIC_ID": TOPIC_ID,
        "SUB_PULL_ID": SUB_PULL_ID,
        "GOOGLE_APPLICATION_CREDENTIALS": os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        "recent_len": len(RECENT),
    }), 200

@app.route("/publish", methods=["POST"])
def publish():
    payload = request.get_json(silent=True) or {}
    msg = (payload.get("message") or "").strip()
    attrs = payload.get("attributes") or {}
    if not msg:
        return jsonify({"error": "message is required"}), 400
    try:
        future = publisher.publish(
            topic_path, msg.encode("utf-8"),
            **{k: str(v) for k, v in attrs.items()}
        )
        # Give it a bit more time in low-power envs
        msg_id = future.result(timeout=20)
        return jsonify({"status": "published", "messageId": msg_id}), 200
    except Exception as e:
        print(f"[ERROR] publish failed: {e!r}", flush=True)
        return jsonify({"error": "publish failed", "details": str(e)}), 500

@app.route("/messages", methods=["GET"])
def messages():
    # newest first
    return jsonify(list(RECENT)[::-1]), 200

def start_streaming_pull():
    try:
        subscriber = pubsub_v1.SubscriberClient()
        sub_path = subscriber.subscription_path(PROJECT_ID, SUB_PULL_ID)
        print(f"[PULL] starting streaming pull on {sub_path}", flush=True)

        def callback(message: pubsub_v1.subscriber.message.Message):
            try:
                data = message.data.decode("utf-8")
                RECENT.append({
                    "data": data,
                    "attributes": dict(message.attributes or {}),
                    "messageId": message.message_id,
                    "publishTime": str(message.publish_time),
                })
                message.ack()
            except Exception as e:
                print(f"[PULL] callback error: {e!r}", flush=True)
                message.nack()

        future = subscriber.subscribe(sub_path, callback=callback)

        def _watch():
            try:
                future.result()
            except Exception as e:
                print(f"[PULL] streaming future died: {e!r}", flush=True)
        t = threading.Thread(target=_watch, daemon=True)
        t.start()
        print("[PULL] thread started", flush=True)
    except Exception as e:
        print(f"[PULL] failed to start: {e!r}", flush=True)

# Kick off the pull worker (consider 1 worker during bring-up)
start_streaming_pull()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

@app.route("/_debug/pull_once")
def debug_pull_once():
    from google.cloud import pubsub_v1
    sub = pubsub_v1.SubscriberClient()
    sub_path = sub.subscription_path(PROJECT_ID, SUB_PULL_ID)
    resp = sub.pull(subscription=sub_path, max_messages=5, retry=None, timeout=10)
    out = []
    for rm in resp.received_messages:
        m = rm.message
        out.append({"data": m.data.decode("utf-8"), "attributes": dict(m.attributes)})
    # ack what we pulled so they don’t loop forever
    if resp.received_messages:
        sub.acknowledge(subscription=sub_path, ack_ids=[rm.ack_id for rm in resp.received_messages])
    return {"pulled": out}, 200


