import os, json, threading, collections, sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import pubsub_v1
from google.api_core.exceptions import NotFound
from google.oauth2 import service_account
import time
from google.oauth2 import service_account
from collections import deque
import threading
from datetime import datetime, timezone

# -----------------------------
# Config via env
# -----------------------------
PROJECT_ID = os.environ.get("PROJECT_ID", "").strip()
TOPIC_ID = os.environ.get("TOPIC_ID", "app-messages").strip()
SUB_PULL_ID = os.environ.get("SUB_PULL_ID", "app-sub-pull-test").strip()
USE_SYNC_POLL = os.environ.get("USE_SYNC_POLL", "0") == "1"
_LAST_PULL_AT = 0 
CREDS_PATH = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
if not CREDS_PATH:
    raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS env var not set")

CREDS = service_account.Credentials.from_service_account_file(CREDS_PATH)

# === Cloud SQL setup ===
from google.cloud.sql.connector import Connector, IPTypes
from sqlalchemy import create_engine, text
import os

DB_INSTANCE = os.getenv("DB_INSTANCE")
DB_NAME     = os.getenv("DB_NAME", "appdb")
DB_USER     = os.getenv("DB_USER", "appuser")
DB_PASS     = os.getenv("DB_PASS")

connector = Connector()

def getconn():
    return connector.connect(
        DB_INSTANCE,
        "pg8000",
        user=DB_USER,
        password=DB_PASS,
        db=DB_NAME,
        ip_type=IPTypes.PUBLIC  # Cloud SQL public IP
    )

engine = create_engine(
    "postgresql+pg8000://",
    creator=getconn,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_timeout=30,
)
# Create messages table if it doesn't exist
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS messages (
            id BIGSERIAL PRIMARY KEY,
            client_message_id TEXT,
            pubsub_message_id TEXT,
            data TEXT NOT NULL,
            source TEXT,
            attributes JSONB,
            publish_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_duplicate BOOLEAN NOT NULL DEFAULT FALSE
        );
    """))
    # helpful index for lookups by client_message_id
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_messages_client_message_id
        ON messages(client_message_id);
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_messages_publish_time
        ON messages(publish_time DESC);
    """))



def start_sync_poll_loop():
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
                    timeout=10,
                )
                # mark that we attempted a pull (even if empty)
                _LAST_PULL_AT = int(time.time())

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
                        with RECENT_LOCK:
                            RECENT.append(item)
                        ack_ids.append(rm.ack_id)
                    sub.acknowledge(request={"subscription": sub_path, "ack_ids": ack_ids})
                    print(f"[SYNC] pulled {len(ack_ids)} msg(s), recent_len={len(RECENT)}", flush=True)
                else:
                    print("[SYNC] no messages in this cycle", flush=True)
                    time.sleep(1)
            except Exception as e:
                print(f"[SYNC] poll error: {e!r}", flush=True)
                time.sleep(2)

    threading.Thread(target=_loop, daemon=True).start()
    print("[SYNC] thread started", flush=True)

def die(msg: str):
    print(f"[FATAL] {msg}", file=sys.stderr, flush=True)
    raise RuntimeError(msg)

if not PROJECT_ID:
    die("PROJECT_ID is missing. Set it in Render backend Environment.")

print(f"[BOOT] PROJECT_ID={PROJECT_ID} TOPIC_ID={TOPIC_ID} SUB_PULL_ID={SUB_PULL_ID}", flush=True)
print(f"[BOOT] GOOGLE_APPLICATION_CREDENTIALS={os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}", flush=True)

try:
    with open(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"), "r") as f:
        info = json.load(f)
        print(f"[BOOT] SERVICE_ACCOUNT_EMAIL={info.get('client_email')}", flush=True)
except Exception as e:
    print(f"[BOOT] could not read SA file: {e!r}", flush=True)

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

# Flask
app = Flask(__name__)
CORS(app)  # TODO: restrict in prod

# Publisher + topic path
try:
    publisher = pubsub_v1.PublisherClient(credentials=CREDS)
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
    print(f"[BOOT] topic_path={topic_path}", flush=True)
    # Verify topic exists (helps catch wrong project/topic)
    admin_pub = pubsub_v1.PublisherClient(credentials=CREDS)
    admin_pub.get_topic(request={"topic": topic_path})
    print(f"[BOOT] Verified topic exists: {topic_path}", flush=True)
except NotFound:
    print(f"[BOOT] TOPIC NOT FOUND: {topic_path}", flush=True)
except Exception as e:
    die(f"Failed to init PublisherClient/topic_path: {e!r}")

# In-memory ring buffer for UI (POC-friendly)
RECENT = collections.deque(maxlen=2000)
RECENT_LOCK = threading.Lock()
# --- Puller thread guards ---
SYNC_THREAD_STARTED = False


# Keep globals so they don't get GC'd
SUBSCRIBER = pubsub_v1.SubscriberClient(credentials=CREDS)
SUB_FUTURE = None

from better_profanity import profanity
import regex as re, unicodedata as ud

# --- profanity helpers (inline) ---
profanity.load_censor_words()
_extra = [w.strip() for w in os.getenv("PROFANITY_EXTRA_WORDS","").split(",") if w.strip()]
_white = [w.strip() for w in os.getenv("PROFANITY_WHITELIST","").split(",") if w.strip()]
if _extra: profanity.add_censor_words(_extra)
for w in _white: profanity.remove_word(w)

def _norm(t: str) -> str:
    t = ud.normalize("NFKC", t)
    t = re.sub(r"[@4]", "a", t, flags=re.I)
    t = re.sub(r"[!1]", "i", t, flags=re.I)
    t = re.sub(r"[$5]", "s", t, flags=re.I)
    t = re.sub(r"(.)\1{2,}", r"\1\1", t)
    return t

def contains_bad(t: str) -> bool:
    return profanity.contains_profanity(_norm(t))

def mask_text(t: str) -> str:
    return profanity.censor(_norm(t), censor_char="*")


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
        "use_sync_poll": USE_SYNC_POLL,
        "recent_len": len(RECENT),
        "last_pull_at": _LAST_PULL_AT,
        "topic": TOPIC_ID,
        "subscription": SUB_PULL_ID,
        "project": PROJECT_ID,
    }), 200

@app.route("/_debug/subscription_info")
def debug_subscription_info():
    try:
        sub = pubsub_v1.SubscriberClient(credentials=CREDS)
        sub_path = sub.subscription_path(PROJECT_ID, SUB_PULL_ID)
        info = sub.get_subscription(request={"subscription": sub_path})
        return {
            "subscription": SUB_PULL_ID,
            "topic": info.topic,
            "filter": getattr(info, "filter", ""),
            "ack_deadline_seconds": info.ack_deadline_seconds,
            "retain_acked_messages": info.retain_acked_messages,
            "detached": getattr(info, "detached", False),
        }, 200
    except Exception as e:
        return {"error": str(e)}, 500


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
        sub = pubsub_v1.SubscriberClient(credentials=CREDS)
        sub_path = sub.subscription_path(PROJECT_ID, SUB_PULL_ID)
        resp = sub.pull(subscription=sub_path, max_messages=5, retry=None, timeout=120)
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
    raw = (payload.get("data") or payload.get("message") or "").strip()
    attrs = payload.get("attributes") or {}
    if not raw:
        return jsonify({"error": "message is required"}), 400

    # client-provided dedupe key (from the Sender page input)
    client_id = (attrs.get("messageId") or "").strip() or None
    source = (attrs.get("source") or "").strip() or None

    # profanity handling
    flagged = contains_bad(raw)
    to_send = mask_text(raw) if flagged else raw

    # publish to Pub/Sub (also pass through attributes for traceability)
    pub_attrs = {k: str(v) for k, v in attrs.items()}
    future = publisher.publish(
        topic_path,
        to_send.encode("utf-8"),
        **pub_attrs,
    )
    pubsub_id = future.result(timeout=20)

    # persist to Postgres, upsert on client_message_id so duplicates flip the flag
    try:
        with engine.begin() as conn:
            if client_id:
                result = conn.execute(text("""
                    INSERT INTO messages (
                        client_message_id, pubsub_message_id, data, source, attributes, publish_time, is_duplicate
                    )
                    VALUES (
                        :client_message_id, :pubsub_message_id, :data, :source, CAST(:attributes AS JSONB), NOW(), FALSE
                    )
                    ON CONFLICT (client_message_id)
                    DO UPDATE SET
                        is_duplicate = TRUE,
                        publish_time = EXCLUDED.publish_time
                    RETURNING id, is_duplicate
                """), {
                    "client_message_id": client_id,
                    "pubsub_message_id": pubsub_id,
                    "data": to_send,
                    "source": source,
                    "attributes": json.dumps(attrs),
                })
            else:
                # no client_id provided → insert normally (no dedupe)
                result = conn.execute(text("""
                    INSERT INTO messages (
                        client_message_id, pubsub_message_id, data, source, attributes, publish_time, is_duplicate
                    )
                    VALUES (
                        NULL, :pubsub_message_id, :data, :source, CAST(:attributes AS JSONB), NOW(), FALSE
                    )
                    RETURNING id, is_duplicate
                """), {
                    "pubsub_message_id": pubsub_id,
                    "data": to_send,
                    "source": source,
                    "attributes": json.dumps(attrs),
                })

            row = result.first()
            row_id = row.id if row else None
            is_dup = bool(row.is_duplicate) if row else False

        return jsonify({
            "ok": True,
            "flagged": flagged,
            "pubsub_message_id": pubsub_id,   # assigned by Pub/Sub
            "client_message_id": client_id,   # your dedupe key
            "row_id": row_id,
            "is_duplicate": is_dup,
            "data": to_send
        }), 200

    except Exception as e:
        app.logger.exception("DB insert/upsert failed")
        return jsonify({"error": "db_error", "detail": str(e)}), 500






# helper if your datetime-local is missing seconds
def _parse_dt(val: str):
    """
    Parse HTML datetime-local (e.g. '2025-11-13T23:09' or '2025-11-13T23:09:57')
    into a Python datetime.
    """
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        # try without seconds
        try:
            return datetime.strptime(val, "%Y-%m-%dT%H:%M")
        except ValueError:
            return None


@app.get("/api/messages")
def list_messages():
    msg_id = request.args.get("messageId", "").strip()
    source = request.args.get("source", "").strip()
    start  = request.args.get("start", "").strip()
    end    = request.args.get("end", "").strip()
    dup    = request.args.get("is_duplicate", "").strip().lower()
    text_q = request.args.get("text", "").strip()  # NEW: message text search

    # pagination
    try:
        page = int(request.args.get("page", "1"))
    except ValueError:
        page = 1
    try:
        limit = int(request.args.get("limit", "10"))
    except ValueError:
        limit = 10

    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 10
    offset = (page - 1) * limit

    # --- build WHERE clauses dynamically ---
    where = []
    params: dict[str, object] = {}

    if msg_id:
        # ✅ exact match on client_message_id
        where.append("client_message_id = :msg_id")
        params["msg_id"] = msg_id
    else:
        # ✅ only use source filter when we're NOT searching by ID
        if source:
            where.append("source = :source")
            params["source"] = source

    # ✅ NEW: case-insensitive partial search on message body
    if text_q:
        # e.g. text="chi" matches "chicken", "Chili", etc.
        where.append("data ILIKE :text_q")
        params["text_q"] = f"%{text_q}%"
if start:
    # treat start as a calendar date (inclusive)
    where.append("publish_time::date >= :start")
    params["start"] = start

if end:
    # treat end as a calendar date (inclusive)
    where.append("publish_time::date <= :end")
    params["end"] = end


    if dup in ("true", "false"):
        where.append("is_duplicate = :dup")
        params["dup"] = (dup == "true")

    where_sql = ""
    if where:
        where_sql = "WHERE " + " AND ".join(where)

    query_items = f"""
        SELECT
            id,
            client_message_id,
            data,
            source,
            publish_time,
            is_duplicate
        FROM messages
        {where_sql}
        ORDER BY publish_time DESC
        LIMIT :limit OFFSET :offset
    """

    query_count = f"""
        SELECT COUNT(*)
        FROM messages
        {where_sql}
    """

    params["limit"] = limit
    params["offset"] = offset

    with engine.begin() as conn:
        rows = conn.execute(text(query_items), params).fetchall()
        total = conn.execute(text(query_count), params).scalar() or 0

    # Shape rows for your React table
    items = []
    for r in rows:
        items.append({
            "id": r.id,
            # frontend expects "messageId" – use client_message_id
            "messageId": getattr(r, "client_message_id", None),
            "data": r.data,
            "source": r.source,
            "publishTime": r.publish_time.isoformat() if r.publish_time else None,
            "is_duplicate": bool(r.is_duplicate),
        })

    return jsonify({"items": items, "total": total})





# --- background poll launcher (ensures thread only starts once) ---
from flask import current_app
import threading

def _start_bg_threads():
    app = current_app
    # Prevent multiple threads if Flask reloads workers
    if not app.config.get("SYNC_POLL_STARTED", False):
        t = threading.Thread(
            target=start_sync_poll_loop,  # your function that loops pulling Pub/Sub
            name="sync-poll",
            daemon=True
        )
        t.start()
        app.config["SYNC_POLL_STARTED"] = True

# Temporary alias for legacy call names (safe)
def start_sync_poll():
    return start_sync_poll_loop()

# Register hook (Flask 2.0 doesn't have before_first_request for async workers)
@app.before_request
def _ensure_thread():
    _start_bg_threads()


 # Handy: see which PID is serving you (helps confirm single-process RECENT)
@app.route("/_debug/pid")
def debug_pid():
    return jsonify({
        "pid": os.getpid(),
        "recent_len": len(RECENT),
        "use_sync_poll": USE_SYNC_POLL,
    }), 200
       


def debug_subscription():
    from flask import jsonify
    from google.cloud import pubsub_v1
    sc = pubsub_v1.SubscriberClient(credentials=CREDS)
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

@app.route("/_debug/pull_long")
def debug_pull_long():
    try:
        sub = pubsub_v1.SubscriberClient(credentials=CREDS)
        sub_path = sub.subscription_path(PROJECT_ID, SUB_PULL_ID)
        print(f"[PULL_LONG] pulling for 60s on {sub_path}", flush=True)

        deadline = time.time() + 60
        total = 0
        while time.time() < deadline:
            resp = sub.pull(
                request={"subscription": sub_path, "max_messages": 10},
                retry=None,
                timeout=10,
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
                    with RECENT_LOCK:
                        RECENT.append(item)
                # ack everything we got in this batch
                    ack_ids.append(rm.ack_id)
                sub.acknowledge(request={"subscription": sub_path, "ack_ids": ack_ids})
                total += len(ack_ids)
                print(f"[PULL_LONG] acked {len(ack_ids)} (total {total}), recent_len={len(RECENT)}", flush=True)
            else:
                print("[PULL_LONG] no messages, waiting...", flush=True)
                time.sleep(2)

        return {"pulled_total": total, "recent_len": len(RECENT)}, 200
    except Exception as e:
        return {"error": str(e)}, 500

@app.route("/_debug/whoami")
def debug_whoami():
    # helps confirm single-process, single-worker behavior
    return {
        "pid": os.getpid(),
        "thread_count": threading.active_count(),
        "use_sync_poll": bool(int(os.environ.get("USE_SYNC_POLL", "1"))),
    }, 200

@app.route("/_debug/messages_debug")
def messages_debug():
    # ALWAYS read under the same lock used by the poller
    try:
        items = []
        with RECENT_LOCK:
            items = list(RECENT)
        return {
            "len": len(items),
            "items_preview": items[-5:],  # last 5 (oldest→newest inside preview)
        }, 200
    except Exception as e:
        return {"error": str(e)}, 500
  
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
                SUBSCRIBER = pubsub_v1.SubscriberClient(credentials=CREDS)
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








# Local dev only
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
