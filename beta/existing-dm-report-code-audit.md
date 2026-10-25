# Verified current DM report and admin moderation paths (2026-10-24)

Source: `index.html` on this BETA branch (Git blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97`), inspected without modifying it.

## Existing report form (do not replace accidentally)
- DOM: `xoxoDmReportOverlay`, `xoxoDmReportForm`, `xoxoDmReportReason`, `xoxoDmReportDetails`, `xoxoDmReportSubmit`.
- `window.openXoxoDmReport(messageId)` permits reporting a **received** DM found in `window.__xoxoCurrentDmMessages`.
- Existing submit inserts into `supabaseClient.from('direct_message_reports')` with `message_id`, `reporter_id`, `reason`, `details`.
- Existing reasons: `harassment`, `spam`, `inappropriate`, `threats`, `other`; existing detail limit 1000 characters.
- Existing form uses a two-step confirmation and catches duplicate error `23505`.
- **This is a one-message report, not a 1–20-message conversation report.** Do not redirect it to an uninstalled BETA RPC.

## Existing admin
- Existing read-only full DM moderation viewer uses `xmm-conversation-list`, `xmm-message-list` and `xmm-admin-message` classes.
- Site owner confirms the admin already sees full DM conversations. Preserve that viewer; do not build a second one.
- Actual server authorization and the report queue loader still need detailed tracing before any UI integration.

## Compatibility decisions
1. Keep the existing `direct_message_reports` path working unchanged.
2. Introduce conversation reporting as a separate action that eventually calls `submitConversationReportBeta`; do not silently change existing one-message report semantics.
3. Explicitly map the six new BETA reason codes to labels; do **not** assume they map one-to-one to the five legacy reasons.
4. The new conversation report should link the existing admin conversation viewer by participant IDs, without exposing full conversations through a public report API.
5. The BETA transport cannot persist until the audited `xoxo_submit_conversation_report_beta` RPC exists.
6. No UI/SQL/production changes without the separate integration and security checks.

## Progress honesty
Confirmed existing code and identified the exact legacy insertion path. This audit is not a completed feature or passing test suite.
