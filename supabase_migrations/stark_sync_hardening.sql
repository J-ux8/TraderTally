-- ============================================================================
-- PRODUCTION GRADE: SUPABASE TABLES HARDENING (V2 SCHEMA)
-- ============================================================================
-- 
-- DESCRIPTION:
-- Ensures that the cloud Supabase tables (transactions, debts, categories)
-- match the local SQLite V2 schema to prevent "Sync Push Aborted" errors.
--
-- ============================================================================

DO $$ 
BEGIN
    -- 1. HARDEN TRANSACTIONS TABLE
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        -- Add missing columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='sync_version') THEN
            ALTER TABLE public.transactions ADD COLUMN sync_version INTEGER DEFAULT 1;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='deleted_at') THEN
            ALTER TABLE public.transactions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='is_synced') THEN
            ALTER TABLE public.transactions ADD COLUMN is_synced INTEGER DEFAULT 1;
        END IF;

        -- Ensure timestamp defaults
        ALTER TABLE public.transactions ALTER COLUMN created_at SET DEFAULT now();
        ALTER TABLE public.transactions ALTER COLUMN updated_at SET DEFAULT now();
        
        -- Fix "deleted" legacy column if it exists (migrate data if needed)
        -- We won't drop it yet, just make it optional to prevent crashes
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='deleted') THEN
            ALTER TABLE public.transactions ALTER COLUMN deleted DROP NOT NULL;
        END IF;
    END IF;

    -- 2. HARDEN DEBTS TABLE
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'debts') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='sync_version') THEN
            ALTER TABLE public.debts ADD COLUMN sync_version INTEGER DEFAULT 1;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='deleted_at') THEN
            ALTER TABLE public.debts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='is_synced') THEN
            ALTER TABLE public.debts ADD COLUMN is_synced INTEGER DEFAULT 1;
        END IF;

        ALTER TABLE public.debts ALTER COLUMN created_at SET DEFAULT now();
        ALTER TABLE public.debts ALTER COLUMN updated_at SET DEFAULT now();
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='deleted') THEN
            ALTER TABLE public.debts ALTER COLUMN deleted DROP NOT NULL;
        END IF;
    END IF;

    -- 3. HARDEN CATEGORIES TABLE (Final Check)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sync_version') THEN
            ALTER TABLE public.categories ADD COLUMN sync_version INTEGER DEFAULT 1;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='deleted_at') THEN
            ALTER TABLE public.categories ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='deleted') THEN
            ALTER TABLE public.categories ALTER COLUMN deleted DROP NOT NULL;
        END IF;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Schema hardening encountered minor issues: %', SQLERRM;
END $$;
