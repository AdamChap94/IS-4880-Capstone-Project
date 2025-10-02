INSERT INTO messages (unique_identifier, item_id, location, quantity, transaction_dt, transaction_no)
VALUES ('ITEM100-TXN001','ITEM100','ATL01',5, now(), 'TXN001');

-- Simulate a duplicate
INSERT INTO messages (unique_identifier, item_id, location, quantity, transaction_dt, transaction_no)
VALUES ('ITEM100-TXN001','ITEM100','ATL01',5, now(), 'TXN001');

SELECT unique_identifier, is_duplicate, received_at
FROM messages
WHERE unique_identifier='ITEM100-TXN001'
ORDER BY received_at;
