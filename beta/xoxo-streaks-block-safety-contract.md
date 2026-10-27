# XOXO Streaks BETA — block safety contract

## Purpose

Document the release gate for blocked conversations without guessing the production block schema.

## Rule

A streak may only be displayed when the canonical chat host has already determined that the conversation is currently visible and permitted. The Streaks BETA host must never independently infer a block state from an assumed table, RPC, CSS state, or client-side flag.

## Required integration

The host must receive a canonical `isConversationVisible` / equivalent decision from the existing chat flow, or an equivalent server-authoritative permission result. If that decision is false, the streak mount is cleared and no streak RPC is requested.

## Forbidden shortcuts

- Do not query an assumed `blocks`, `blocked_users`, or `user_blocks` table.
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

This contract is documentation/test guidance only. It does not change production behavior or Supabase.
