DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
  ) THEN
    CREATE EXTENSION "uuid-ossp";
  END IF;
END$$;


--1. CORE TABLES
-----------------

-- 1.1 stores every message (duplicates included)
CREATE TABLE IF NOT EXISTS messages (
  id                 BIGSERIAL PRIMARY KEY,
  unique_identifier  TEXT        NOT NULL,  -- usually ItemId-TransactionNumber
  item_id            TEXT        NOT NULL,
  location           TEXT        NOT NULL,
  quantity           INTEGER     NOT NULL CHECK (quantity >= 0),
  transaction_dt     TIMESTAMPTZ NOT NULL,
  transaction_no     TEXT        NOT NULL,
  pubsub_message_id  TEXT,                 -- actual Pub/Sub messageId if available
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_duplicate       BOOLEAN     NOT NULL DEFAULT FALSE
);

-- 1.2 one row per logical message, for counting
CREATE TABLE IF NOT EXISTS message_identity (
  unique_identifier  TEXT PRIMARY KEY,
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count         INTEGER      NOT NULL DEFAULT 1
);

-- 1.3 optional audit / debugging
CREATE TABLE IF NOT EXISTS message_ingest_log (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  consumer_run  TEXT   NOT NULL,                -- e.g. ISO timestamp or run id
  note          TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 2. INDEXES for UI filters/sorting
-------------------------------------
CREATE INDEX IF NOT EXISTS ix_messages_transaction_dt ON messages (transaction_dt DESC);
CREATE INDEX IF NOT EXISTS ix_messages_location       ON messages (location);
CREATE INDEX IF NOT EXISTS ix_messages_transaction_no ON messages (transaction_no);

-- 3. DUPLICATE HANDLING 
-- Every insert into messages will update/insert into message_identity
------------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_seen_count() RETURNS TRIGGER AS $$
BEGIN
  -- try to bump existing
  UPDATE message_identity
     SET seen_count = seen_count + 1
   WHERE unique_identifier = NEW.unique_identifier;

  -- if no row was updated, we haven't seen this identifier yet
  IF NOT FOUND THEN
    INSERT INTO message_identity (unique_identifier) VALUES (NEW.unique_identifier);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- re-create trigger safely
DROP TRIGGER IF EXISTS trg_bump_seen_count ON messages;
CREATE TRIGGER trg_bump_seen_count
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION bump_seen_count();


-- 4. TEST DATA (to prove duplicates are detected)
-- TC01: first insert
--------------------------------------------------
INSERT INTO messages (
  unique_identifier,
  item_id,
  location,
  quantity,
  transaction_dt,
  transaction_no,
  pubsub_message_id
) VALUES (
  'ITEM100-TXN001',
  'ITEM100',
  'ATL01',
  5,
  now(),
  'TXN001',
  'gcp-msg-1'
);


-- TC02: same logical message again (simulate redelivery)
----------------------------------------------------------
INSERT INTO messages (
  unique_identifier,
  item_id,
  location,
  quantity,
  transaction_dt,
  transaction_no,
  pubsub_message_id
) VALUES (
  'ITEM100-TXN001',
  'ITEM100',
  'ATL01',
  5,
  now(),
  'TXN001',
  'gcp-msg-1-redelivery'
);

-- TC03: different message to show normal behavior
--------------------------------------------------
INSERT INTO messages (
  unique_identifier,
  item_id,
  location,
  quantity,
  transaction_dt,
  transaction_no,
  pubsub_message_id
) VALUES (
  'ITEM200-TXN002',
  'ITEM200',
  'DAL02',
  3,
  now(),
  'TXN002',
  'gcp-msg-2'
);

-- 5. VERIFICATION QUERIES
---------------------------------------------------------------

-- VQ1: show original + duplicate
SELECT id,
       unique_identifier,
       item_id,
       location,
       quantity,
       transaction_dt,
       transaction_no,
       is_duplicate,
       received_at
FROM messages
WHERE unique_identifier = 'ITEM100-TXN001'
ORDER BY received_at;

-- VQ2: confirm seen_count = 2 for the duplicated message
SELECT unique_identifier,
       first_seen_at,
       seen_count
FROM message_identity
WHERE unique_identifier = 'ITEM100-TXN001';

-- VQ3: data-quality check (should return 0 rows)
SELECT *
FROM messages
WHERE item_id IS NULL
   OR location IS NULL
   OR transaction_dt IS NULL
   OR transaction_no IS NULL;
