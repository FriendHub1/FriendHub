-- Isolated PostgreSQL smoke test. CI database only.
-- No Supabase schema, no production data, no REVIEW_ONLY migrations.
DO $$
BEGIN
 IF current_database() <> 'xoxo_reveal_test_ci' THEN
  RAISE EXCEPTION 'Refusing non-isolated database';
 END IF;
 IF current_user <> 'xoxo_test' THEN
  RAISE EXCEPTION 'Refusing unexpected database role';
 END IF;
END $$;
BEGIN;
CREATE TEMP TABLE xoxo_reveal_claim_smoke (
 sender_id text NOT NULL,
 request_key text NOT NULL,
 fingerprint text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 UNIQUE(sender_id,request_key)
) ON COMMIT DROP;
INSERT INTO xoxo_reveal_claim_smoke(sender_id,request_key,fingerprint)
 VALUES('sender-a','retry-001',repeat('a',64));
INSERT INTO xoxo_reveal_claim_smoke(sender_id,request_key,fingerprint)
 VALUES('sender-a','retry-001',repeat('a',64))
 ON CONFLICT(sender_id,request_key) DO NOTHING;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM xoxo_reveal_claim_smoke;
 IF n <> 1 THEN RAISE EXCEPTION 'Duplicate attempt inserted'; END IF;
END $$;
ROLLBACK;
-- This only verifies local PostgreSQL and unique-key behavior. It does not
-- validate production claim/finalize functions or Storage consistency.
