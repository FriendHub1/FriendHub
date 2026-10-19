-- XOXO Reveal BETA: disposable PostgreSQL transactional fixture.
-- NOT the production schema; validates SQL uniqueness and rollback behavior.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'xoxo_reveal_test_ci' OR current_user <> 'xoxo_test'
 THEN RAISE EXCEPTION 'Refusing unsafe PostgreSQL target'; END IF;
END $guard$;
BEGIN;
CREATE TEMP TABLE attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sender text NOT NULL,
 request_key text NOT NULL,
 fingerprint text NOT NULL,
 state text NOT NULL DEFAULT 'pending',
 owner_token text NOT NULL,
 reveal_id text,
 dm_id text,
 UNIQUE(sender,request_key)
) ON COMMIT DROP;
CREATE TEMP TABLE reveals (
 id text PRIMARY KEY,
 attempt_id bigint UNIQUE NOT NULL REFERENCES attempts(id),
 sender text NOT NULL,
 recipient text NOT NULL,
 dm_id text NOT NULL UNIQUE
) ON COMMIT DROP;
-- First claimant receives ownership. Repeated key cannot insert again.
INSERT INTO attempts(sender,request_key,fingerprint,owner_token)
VALUES('alice','request-001',repeat('a',64),'token-1')
ON CONFLICT(sender,request_key) DO NOTHING;
INSERT INTO attempts(sender,request_key,fingerprint,owner_token)
VALUES('alice','request-001',repeat('a',64),'token-2')
ON CONFLICT(sender,request_key) DO NOTHING;
DO $check$
BEGIN
 IF (SELECT count(*) FROM attempts) <> 1 THEN
  RAISE EXCEPTION 'Duplicate claim created'; END IF;
 IF (SELECT owner_token FROM attempts) <> 'token-1' THEN
  RAISE EXCEPTION 'Claim owner replaced'; END IF;
END $check$;
-- Different sender may independently use the same request key.
INSERT INTO attempts(sender,request_key,fingerprint,owner_token)
VALUES('bob','request-001',repeat('b',64),'token-3');
INSERT INTO reveals(id,attempt_id,sender,recipient,dm_id)
SELECT 'reveal-1',id,'alice','carol','dm-1' FROM attempts WHERE sender='alice';
-- Only matching owner and sender can finalize.
UPDATE attempts SET state='completed',reveal_id='reveal-1',dm_id='dm-1'
WHERE sender='alice' AND request_key='request-001'
 AND owner_token='token-1' AND state='pending'
 AND EXISTS (SELECT 1 FROM reveals r WHERE r.attempt_id=attempts.id
 AND r.id='reveal-1' AND r.sender=attempts.sender AND r.dm_id='dm-1');
DO $check$
BEGIN
 IF (SELECT state FROM attempts WHERE sender='alice') <> 'completed'
 THEN RAISE EXCEPTION 'Valid owner could not finalize'; END IF;
 IF (SELECT state FROM attempts WHERE sender='bob') <> 'pending'
 THEN RAISE EXCEPTION 'Other sender unexpectedly finalized'; END IF;
END $check$;
-- A stale token must not change completed result.
UPDATE attempts SET reveal_id='forged'
WHERE sender='alice' AND owner_token='stale-token' AND state='pending';
DO $check$
BEGIN
 IF (SELECT reveal_id FROM attempts WHERE sender='alice') <> 'reveal-1'
 THEN RAISE EXCEPTION 'Stale owner modified result'; END IF;
END $check$;
ROLLBACK;
-- Entire fixture is rolled back; never touches real Reveal tables.
