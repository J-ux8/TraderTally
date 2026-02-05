-- Add client_id column for idempotent upserts from clients
ALTER TABLE transactions ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_client_id_idx ON transactions (client_id);

ALTER TABLE debts ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS debts_client_id_idx ON debts (client_id);

ALTER TABLE categories ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS categories_client_id_idx ON categories (client_id);
