import os, json, threading, collections, sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import pubsub_v1
from google.api_core.exceptions import NotFound
from google.oauth2 import service_account
import time
from google.oauth2 import service_account


# -----------------------------
# Config via env
# -----------------------------
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "").strip()
TOPIC_ID = os.environ.get("PUBSUB_TOPIC", "app-messages").strip()
SUB_PULL_ID = os.environ.get("PUBSUB_SUBSCRIPTION_PULL", "app-sub-pull-test").strip()
USE_SYNC_POLL = os.environ.get("USE_SYNC_POLL", "0") == "1"
_LAST_PULL_AT = 0 
CREDS_PATH = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
if not CREDS_PATH:
    raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS env var not set")

CREDS = service_account.Credentials.from_service_account_file(CREDS_PATH)

def start_sync_poll_loop():
    """
    Very robust background loop that periodically pulls messages and acks them.
    Use this if streaming pull is flaky on your host.
    """
    sub = pubsub_v1.SubscriberClient(credentials=CREDS)
    sub_path = sub.subscription_path(PROJECT_ID, SUB_PULL_ID)
    print(f"[SYNC] starting sync poll loop on {sub_path}", flush=True)

    def _loop():
        global _LAST_PULL_AT
        while True:
            try:
                resp = sub.pull(
                    request={"subscription": sub_path, "max_messages": 10},
                    retry=None,
                    timeout=10,  # wait up to 10s for messages
                )
                if resp.received_messages:
                    ack_ids = []
                    for rm in resp.received_messages:
                        m = rm.message
                        item = {
                            "data": m.data.decode("utf-8"),
                            "attributes": dict(m.attributes or {}),
                            "messageId": m.message_id,
                            "publishTime": str(m.publish_time),
                        }
                        RECENT.append(item)
                        ack_ids.append(rm.ack_id)
                    sub.acknowledge(request={"subscription": sub_path, "ack_ids": ack_ids})
                    _LAST_PULL_AT = int(time.time())
                    print(f"[SYNC] pulled {len(ack_ids)} msg(s), recent_len={len(RECENT)}", flush=True)
                else:
                    # No messages in this cycle; short sleep to avoid hot loop
                    time.sleep(1)
            except Exception as e:
                # Network timeouts, EOFs, etc. are normal on shared hosts—just keep going
                print(f"[SYNC] poll error: {e!r}", flush=True)
                time.sleep(2)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    print("[SYNC] thread started", flush=True)


def die(msg: str):
    print(f"[FATAL] {msg}", file=sys.stderr, flush=True)
    raise RuntimeError(msg)

if not PROJECT_ID:
    die("GCP_PROJECT_ID is missing. Set it in Render backend Environment.")

print(f"[BOOT] PROJECT_ID={PROJECT_ID} TOPIC_ID={TOPIC_ID} SUB_PULL_ID={SUB_PULL_ID}", flush=True)
print(f"[BOOT] GOOGLE_APPLICATION_CREDENTIALS={os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}", flush=True)

try:
    with open(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"), "r") as f:
        info = json.load(f)
        print(f"[BOOT] SERVICE_ACCOUNT_EMAIL={info.get('client_email')}", flush=True)
except Exception as e:
    print(f"[BOOT] could not read SA file: {e!r}", flush=True)
def start_sync_poll():
    from time import sleep
    from google.cloud import pubsub_v1
    client = pubsub_v1.SubscriberClient()
    sub_path = client.subscription_path(PROJECT_ID, SUB_PULL_ID)
    print(f"[PULL_SYNC] loop start on {sub_path}", flush=True)

    while True:
        try:
            resp = client.pull(subscription=sub_path, max_messages=10, retry=None, timeout=20)
            if resp.received_messages:
                ack_ids = []
                for rm in resp.received_messages:
                    m = rm.message
                    item = {
                        "data": m.data.decode("utf-8"),
                        "attributes": dict(m.attributes or {}),
                        "messageId": m.message_id,
                        "publishTime": str(m.publish_time),
                    }
                    RECENT.append(item)
                    ack_ids.append(rm.ack_id)
                    print(f"[PULL_SYNC] {item}", flush=True)
                client.acknowledge(subscription=sub_path, ack_ids=ack_ids)
        except Exception as e:
            print(f"[PULL_SYNC] error: {e!r}", flush=True)
            sleep(2)
        else:
            sleep(1)

# Flask
app = Flask(__name__)
CORS(app)  # TODO: restrict in prod

# Publisher + topic path
try:
    publisher = pubsub_v1.PublisherClient(credentials=CREDS)
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
    print(f"[BOOT] topic_path={topic_path}", flush=True)
    # Verify topic exists (helps catch wrong project/topic)
    admin_pub = pubsub_v1.PublisherClient()
    admin_pub.get_topic(request={"topic": topic_path})
    print(f"[BOOT] Verified topic exists: {topic_path}", flush=True)
except NotFound:
    print(f"[BOOT] TOPIC NOT FOUND: {topic_path}", flush=True)
except Exception as e:
    die(f"Failed to init PublisherClient/topic_path: {e!r}")

# In-memory ring buffer for UI (POC-friendly)
RECENT = collections.deque(maxlen=200)
RECENT_LOCK = threading.Lock()

# Keep globals so they don't get GC'd
SUBSCRIBER = pubsub_v1.SubscriberClient(credentials=CREDS)
SUB_FUTURE = None

# -----------------------------
# Routes
# -----------------------------
@app.route("/")
def index():
    return "backend is running", 200

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

@app.route("/_debug/state")
def debug_state():
    return jsonify({
        "project": PROJECT_ID,
        "topic": TOPIC_ID,
        "subscription": SUB_PULL_ID,
        "recent_len": len(RECENT),
    }), 200

@app.route("/_debug/publish")
def debug_publish():
    from time import time
    msg = f"debug-{int(time())}"
    try:
        f = publisher.publish(topic_path, msg.encode("utf-8"), source="backend-debug")
        msg_id = f.result(timeout=20)
        return {"messageId": msg_id, "data": msg}, 200
    except Exception as e:
        return {"error": "publish failed", "details": str(e)}, 500

@app.route("/_debug/pull_once")
def debug_pull_once():
    # Pull a few messages immediately and append them to RECENT
    try:
        sub = pubsub_v1.SubscriberClient()
        sub_path = sub.subscription_path(PROJECT_ID, SUB_PULL_ID)
        resp = sub.pull(subscription=sub_path, max_messages=5, retry=None, timeout=30)
        out = []
        for rm in resp.received_messages:
            m = rm.message
            item = {
                "data": m.data.decode("utf-8"),
                "attributes": dict(m.attributes or {}),
                "messageId": m.message_id,
                "publishTime": str(m.publish_time),
            }
            out.append(item)
            RECENT.append(item)
        if resp.received_messages:
            sub.acknowledge(subscription=sub_path, ack_ids=[rm.ack_id for rm in resp.received_messages])
        return {"pulled": out, "recent_len": len(RECENT)}, 200
    except NotFound:
        return {"error": "subscription not found", "subscription": SUB_PULL_ID}, 404
    except Exception as e:
        return {"error": "pull_once failed", "details": str(e)}, 500

@app.route("/publish", methods=["POST"])
def publish_route():
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
        msg_id = future.result(timeout=20)
        return jsonify({"status": "published", "messageId": msg_id}), 200
    except Exception as e:
        print(f"[ERROR] publish failed: {e!r}", flush=True)
        return jsonify({"error": "publish failed", "details": str(e)}), 500

@app.route("/messages", methods=["GET"])
def messages():
    # newest first
    return jsonify(list(RECENT)[::-1]), 200
@app.route("/_debug/subscription")
def debug_subscription():
    from flask import jsonify
    from google.cloud import pubsub_v1
    sc = pubsub_v1.SubscriberClient()
    sub_path = sc.subscription_path(PROJECT_ID, SUB_PULL_ID)
    try:
        s = sc.get_subscription(request={"subscription": sub_path})
        return jsonify({
            "subscription": SUB_PULL_ID,
            "full_path": sub_path,
            "topic": s.topic,
            "filter": getattr(s, "filter", ""),
            "ack_deadline_seconds": s.ack_deadline_seconds,
            "message_retention_duration": str(getattr(s, "message_retention_duration", "")),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e), "subscription": SUB_PULL_ID}), 500

@app.route("/_debug/iam")
def debug_iam():
    perms = ["pubsub.subscriptions.consume", "pubsub.subscriptions.get"]
    resource = f"projects/{PROJECT_ID}/subscriptions/{SUB_PULL_ID}"
    try:
        sub = pubsub_v1.SubscriberClient(credentials=CREDS)
        resp = sub.test_iam_permissions(request={"resource": resource, "permissions": perms})
        return {"resource": resource, "asked": perms, "granted": list(resp.permissions)}, 200
    except Exception as e:
        return {"resource": resource, "asked": perms, "error": str(e)}, 500



# -----------------------------
# Streaming pull
# -----------------------------
# -----------------------------
# Streaming pull (thread-safe + restart loop)
# -----------------------------
def start_streaming_pull():
    global SUBSCRIBER, SUB_FUTURE

    def run_pull():
        global SUBSCRIBER, SUB_FUTURE
        while True:
            try:
                SUBSCRIBER = pubsub_v1.SubscriberClient()
                sub_path = SUBSCRIBER.subscription_path(PROJECT_ID, SUB_PULL_ID)
                print(f"[PULL] Connecting to {sub_path}", flush=True)

                try:
                    sub_info = SUBSCRIBER.get_subscription(request={"subscription": sub_path})
                    print(f"[PULL] Verified subscription; topic={sub_info.topic}", flush=True)
                except NotFound:
                    print(f"[PULL] SUB NOT FOUND: {sub_path}", flush=True)

                def callback(message):
                    try:
                        data = message.data.decode("utf-8")
                        item = {
                            "data": data,
                            "attributes": dict(message.attributes or {}),
                            "messageId": message.message_id,
                            "publishTime": str(message.publish_time),
                        }
                        with RECENT_LOCK:
                            RECENT.append(item)

                        print(f"[PULL] ✅ {item}", flush=True)
                        message.ack()
                    except Exception as e:
                        print(f"[PULL] ❌ callback error: {e}", flush=True)
                        message.nack()

                SUB_FUTURE = SUBSCRIBER.subscribe(sub_path, callback=callback)
                print("[PULL] Listening...", flush=True)
                SUB_FUTURE.result()
            except Exception as e:
                print(f"[PULL] ⚠️ Stream error, restarting: {e}", flush=True)
                time.sleep(2)

    threading.Thread(target=run_pull, daemon=True).start()



# Kick off the pull worker (run with Gunicorn --workers=1 while debugging)
if USE_SYNC_POLL:
    start_sync_poll()
else:
    start_streaming_pull()


# Local dev only
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
