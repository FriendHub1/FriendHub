-- XOXO Avenue: proposed BETA design only. DO NOT RUN IN PRODUCTION.
-- Existing direct_message_reports remains unchanged.
-- This migration deliberately does not create a public INSERT policy.
-- Review against actual table definitions, roles, and moderator access first.
create table if not exists public.xoxo_conversation_reports_beta (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id),
 other_user_id uuid not null references auth.users(id),
 reason_code smallint not null check (reason_code between 0 and 5),
 details text not null default '' check (char_length(details) <= 2000),
 status text not null default 'pending' check (status in ('pending','reviewed','resolved','dismissed')),
 created_at timestamptz not null default now(),
 constraint xoxo_conversation_reports_beta_not_self check (reporter_id <> other_user_id)
);
create table if not exists public.xoxo_conversation_report_evidence_beta (
 report_id uuid not null references public.xoxo_conversation_reports_beta(id) on delete cascade,
 message_id uuid not null references public.direct_messages(id),
 primary key (report_id,message_id)
);
alter table public.xoxo_conversation_reports_beta enable row level security;
alter table public.xoxo_conversation_report_evidence_beta enable row level security;
-- No user-facing policies yet: deny by default. A vetted authenticated RPC
-- must verify auth.uid(), both conversation participants, each selected message,
-- cleared-message visibility, evidence count (1..20), and abuse rate limits.
-- Moderation reads must require existing server-verified admin + PIN controls.
-- Snapshot retention/deletion and messages deleted later need explicit design.
