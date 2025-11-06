
-- 1. CORE TABLES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id                 BIGSERIAL PRIMARY KEY,
  unique_identifier  TEXT        NOT NULL,
  item_id            TEXT        NOT NULL,
  location           TEXT        NOT NULL,
  quantity           INTEGER     NOT NULL CHECK (quantity >= 0),
  transaction_dt     TIMESTAMPTZ NOT NULL,
  transaction_no     TEXT        NOT NULL,
  pubsub_message_id  TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_duplicate       BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS message_identity (
  unique_identifier  TEXT PRIMARY KEY,
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count         INTEGER      NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS message_ingest_log (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  consumer_run  TEXT   NOT NULL,
  note          TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 2. INDEXES
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_messages_transaction_dt ON messages (transaction_dt DESC);
CREATE INDEX IF NOT EXISTS ix_messages_location       ON messages (location);
CREATE INDEX IF NOT EXISTS ix_messages_transaction_no ON messages (transaction_no);


-- 3. DUPLICATE HANDLING
------------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_seen_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_identity
     SET seen_count = seen_count + 1
   WHERE unique_identifier = NEW.unique_identifier;

  IF NOT FOUND THEN
    INSERT INTO message_identity (unique_identifier) VALUES (NEW.unique_identifier);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_seen_count ON messages;
CREATE TRIGGER trg_bump_seen_count
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION bump_seen_count();


-- 4. TEST DATA (same as local)
------------------------------------------------------------

-- first message
INSERT INTO messages (
  unique_identifier, item_id, location, quantity,
  transaction_dt, transaction_no, pubsub_message_id
) VALUES (
  'ITEM100-TXN001', 'ITEM100', 'ATL01', 5,
  now(), 'TXN001', 'gcp-msg-1'
);

-- duplicate message
INSERT INTO messages (
  unique_identifier, item_id, location, quantity,
  transaction_dt, transaction_no, pubsub_message_id
) VALUES (
  'ITEM100-TXN001', 'ITEM100', 'ATL01', 5,
  now(), 'TXN001', 'gcp-msg-1-redelivery'
);

-- different message
INSERT INTO messages (
  unique_identifier, item_id, location, quantity,
  transaction_dt, transaction_no, pubsub_message_id
) VALUES (
  'ITEM200-TXN002', 'ITEM200', 'DAL02', 3,
  now(), 'TXN002', 'gcp-msg-2'
);

-- 5. VERIFICATION
------------------------------------------------------------

-- check duplicates
SELECT id,
       unique_identifier,
       is_duplicate,
       received_at
FROM messages
WHERE unique_identifier = 'ITEM100-TXN001'
ORDER BY received_at;

-- check identity table
SELECT unique_identifier,
       seen_count
FROM message_identity
WHERE unique_identifier = 'ITEM100-TXN001';
