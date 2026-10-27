# XOXO Streaks — BETA

Branch: `feature/xoxo-streaks-beta`

## Current implementation package

- `xoxo-streaks.js`: localized chat-card UI using the authenticated Supabase client and a server RPC.
- `xoxo-streaks-schema.sql`: proposed database migration; **not applied to Supabase**.
- Supported locales: `en`, `es`, `pt-BR`, `de`, `nb`, `pl`, `fr`, `cs`, `sv`, `it`.

## Rules

- A streak day counts only when both participants send at least one ordinary, persistent DM that UTC day.
- Whispers and timed/once-view media do not count.
- A streak remains active if the last mutual day was today or yesterday; it resets after a full UTC day without mutual activity.
- Milestones: 3, 7, 14, 30, and 100 days.
- The browser cannot write or forge streak totals. Counts come from the server RPC.
- The database table stores only pair IDs, date and per-person activity booleans—never message text.
- Table access is revoked from browser roles; only the authorized RPC returns the streak for the signed-in participant and requested peer.
- This package is not yet wired into `index.html`, and the SQL has not been run against Supabase. Do not call it launched until integration, security review and end-to-end tests pass.
