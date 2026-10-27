# XOXO Streaks BETA — block safety contract

## Purpose

Document the release gate for blocked conversations without guessing the production block schema.

## Rule

A streak may only be displayed when the canonical chat host has already determined that the conversation is currently visible and permitted. The Streaks BETA host must never independently infer a block state from an assumed table, RPC, CSS state, or client-side flag.

## Required integration

The host must receive a canonical `isConversationVisible` / equivalent decision from the existing chat flow, or an equivalent server-authoritative permission result. If that decision is false, the streak mount is cleared and no streak RPC is requested.

The current fail-closed adapter expects `window.xoxoIsConversationVisible(me, other) === true`. This is a temporary client contract boundary, not a claim that the production chat implements that function. The live database inspection confirmed the real `public.user_blocks(blocker_id, blocked_id)` relation and the exact bidirectional block predicate used by the existing direct-message INSERT policy. The proposed streak RPC now independently rejects blocks in either direction and requires an extant ordinary persistent DM between the two participants. The host remains hidden unless its visibility hook is explicitly supplied; do not add a permissive fallback.

## Audit result (2026-10-27)

- Confirmed the Streaks host checks the current account, selected DM peer, visible chat container, Supabase client, and admin exclusion.
- Confirmed it fails closed if the canonical permission hook is absent or does not return literal `true`.
- Read-only inspection of the live `pg_policies` catalog confirmed the DM INSERT policy checks `public.user_blocks` in both directions. The table columns were verified from `information_schema.columns`; no message contents or user rows were queried.
- No production code or Supabase schema was changed during this audit.

## Forbidden shortcuts

- Do not infer alternative block tables or RPCs; use the verified `public.user_blocks` schema and bidirectional predicate.
- Do not treat a hidden DOM element as proof that a block does or does not exist.
- Do not rely on client-local block state as the security boundary.
- Do not apply the streak SQL to production until the exact block policy has been identified and tested.

## Test cases before release

1. User A blocks User B: no streak is requested or displayed.
2. User B blocks User A: no streak is requested or displayed.
3. Existing streak becomes blocked: card disappears on context refresh.
4. Unblocked conversation becomes visible again: streak may refresh normally.
5. Switching from a blocked conversation to an allowed conversation cannot paint stale streak data.
6. Admin view remains excluded.

## Current status

This contract is documentation/test guidance only. It does not change production behavior or Supabase. The feature is not release-ready until the canonical permission decision is wired into the real chat flow and verified with authenticated accounts.
