# XOXO Reveal — verified Supabase audit (2026-10-19)

Read-only review of production project `cxosofpxfmjkrhfabrqc`. **No database changes made.**

## Existing schema
`public.direct_messages` already contains `id`, `sender_id`, `recipient_id`, `content`, `attachment_path`, `attachment_type`, `media_view_mode`, `media_view_seconds`, `media_opened_at`, `media_opened_by` and other DM fields.

Existing bucket `dm-media` is private, with 100 MiB limit and image/video/audio MIME types.

## Current security finding — must fix before enabling Reveal
Storage SELECT policy `DM media participants can view` invokes `public.can_view_dm_media(name)`.

Current function definition:
```sql
CREATE OR REPLACE FUNCTION public.can_view_dm_media(object_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.direct_messages dm
   WHERE dm.attachment_path = object_name
     AND (dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid())
 );
$function$;
```

This function **does not check** `media_view_mode`, `media_view_seconds`, `media_opened_at`, or recipient-specific one-time state. Thus simply closing a browser viewer does not revoke authenticated storage access for a DM participant. Also review signed URL lifetimes and any cached media.

DM SELECT policy allows sender/recipient. DM INSERT checks sender identity, existing DM/acceptance, blocks, and Secret Letters matching conditions. DM UPDATE has separate sender edit and recipient read policies; new Reveal logic must not trust direct client UPDATE for open-once transitions.

## Next safe implementation
- Audit existing media-open RPCs, signed URL issuance, storage policy behavior and frontend viewer before changing anything.
- Prefer a server-side atomic `open_reveal` RPC or Edge Function that verifies recipient and enforces one-time/expiry.
- Ensure storage SELECT authorization is aligned with expiry, including direct authenticated download and any signed URL.
- Do not assume that a short browser countdown guarantees revocation.
- Use two non-admin test accounts and verify normal DM attachments are unaffected.

**No migrations, policies, Edge Functions or live frontend changed.** This is a security review and implementation gate.
