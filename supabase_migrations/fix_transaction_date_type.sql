-- Migration to fix transaction_date column type
-- From DATE (date only) to TIMESTAMPTZ (date + time + timezone)

ALTER TABLE transactions 
ALTER COLUMN transaction_date TYPE TIMESTAMPTZ 
USING (transaction_date::text::timestamptz);
