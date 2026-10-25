-- XOXO Avenue: proposed BETA schema for conversation reports.
-- REVIEW ONLY. DO NOT RUN IN PRODUCTION WITHOUT EXPLICIT APPROVAL.
-- Existing direct_message_reports and admin moderation remain unchanged.
--
-- Important: evidence points to selected IDs; no message content is copied.
-- Deleting a DM must not be blocked by report evidence. The nullable FK is
-- ON DELETE SET NULL; selected_message_id preserves just the UUID provenance.
-- Admin UI must show "evidence unavailable" if the source message is gone.
--
-- Pending privacy decision: retention and account deletion handling.

begin;

create table if not exists public.xoxo_conversation_reports_beta (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  other_user_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  reason_code smallint not null check (reason_code between 0 and 5),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'pending'
    check (status in ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  constraint xoxo_conversation_reports_beta_not_self
    check (reporter_id <> other_user_id),
  constraint xoxo_conversation_reports_beta_request_unique
    unique (reporter_id,idempotency_key)
);

create index if not exists xoxo_conversation_reports_beta_rate_limit_idx
  on public.xoxo_conversation_reports_beta(reporter_id,created_at desc);

create table if not exists public.xoxo_conversation_report_evidence_beta (
  report_id uuid not null references public.xoxo_conversation_reports_beta(id)
    on delete cascade,
  selected_message_id uuid not null,
  message_id uuid references public.direct_messages(id) on delete set null,
  primary key (report_id,selected_message_id),
  constraint xoxo_conversation_report_evidence_beta_id_matches
    check (message_id is null or message_id=selected_message_id)
);

alter table public.xoxo_conversation_reports_beta enable row level security;
alter table public.xoxo_conversation_report_evidence_beta enable row level security;

-- Defense in depth: deny direct use of these tables to ordinary browser users.
-- The future, narrowly-scoped reviewed RPC must perform all authorization and
-- atomic writes, deriving reporter from auth.uid() and checking selected DMs.
revoke all on public.xoxo_conversation_reports_beta from anon, authenticated;
revoke all on public.xoxo_conversation_report_evidence_beta from anon, authenticated;

-- Explicitly NO direct INSERT/SELECT policies for ordinary users.
-- Admin metadata reads use a dedicated admin-verified RPC. Admin opens full
-- conversations only via the pre-existing audited PIN-gated DM viewer.

commit;
