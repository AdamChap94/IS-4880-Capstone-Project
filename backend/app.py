import os, json, threading, collections
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import pubsub_v1

# --- Config via env ---
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
TOPIC_ID = os.environ.get("PUBSUB_TOPIC", "app-messages")
SUB_PULL_ID = os.environ.get("PUBSUB_SUBSCRIPTION_PULL", "app-sub-pull")
# GOOGLE_APPLICATION_CREDENTIALS must point to the service account key file on Render (see below)

app = Flask(__name__)
CORS(app)  # In prod, consider restricting origins

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

# In-memory ring buffer for UI (POC-friendly)
RECENT = collections.deque(maxlen=200)

@app.route("/healthz")
def healthz():
    return "ok", 200

@app.route("/publish", methods=["POST"])
def publish():
    payload = request.get_json(silent=True) or {}
    msg = (payload.get("message") or "").strip()
    attrs = payload.get("attributes") or {}
    if not msg:
        return jsonify({"error": "message is required"}), 400
    future = publisher.publish(topic_path, msg.encode("utf-8"),
                               **{k: str(v) for k, v in attrs.items()})
    msg_id = future.result(timeout=10)
    return jsonify({"status": "published", "messageId": msg_id}), 200

@app.route("/messages", methods=["GET"])
def messages():
    # newest first
    return jsonify(list(RECENT)[::-1]), 200

def start_streaming_pull():
    subscriber = pubsub_v1.SubscriberClient()
    sub_path = subscriber.subscription_path(PROJECT_ID, SUB_PULL_ID)

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
        except Exception:
            message.nack()

    future = subscriber.subscribe(sub_path, callback=callback)
    t = threading.Thread(target=lambda: future.result(), daemon=True)
    t.start()

# Kick off the pull worker
start_streaming_pull()

if __name__ == "__main__":
    # Local dev only
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
