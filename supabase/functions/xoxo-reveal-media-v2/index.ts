// XOXO Reveal BETA — RANGE-AWARE MEDIA PROXY V2 (NOT DEPLOYED)
// This version avoids downloading a full video for each byte-range request.
// Requires the draft xoxo_reveals schema, authenticated session claims and
// private xoxo-reveal Storage bucket. Review before deployment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { revealCors, revealPreflight } from "./cors.mjs";

const noStore = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" };
const reply = (status: number, error: string, cors: Record<string,string> = {}) => new Response(JSON.stringify({ error }), {
  status, headers: { ...noStore, ...cors, "content-type": "application/json" }
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RANGE = 1024 * 1024; // 1 MiB per request to bound transfer.
const validRange = (value: string) => {
  const m = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!m) return false;
  const start = Number(m[1]), end = m[2] ? Number(m[2]) : start + MAX_RANGE - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && end >= start && end - start < MAX_RANGE;
};

Deno.serve(async req => {
  const allowed = Deno.env.get("XOXO_REVEAL_ALLOWED_ORIGIN");
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return revealPreflight(origin, allowed);
  const cors = revealCors(origin, allowed);
  if (!cors) return reply(403, "Origin denied");
  if (req.method !== "GET") return reply(405, "Method not allowed", cors);
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return reply(401, "Authentication required", cors);
  const u = new URL(req.url);
  const id = u.searchParams.get("reveal_id") || "";
  const session = u.searchParams.get("session_id") || "";
  if (!uuid.test(id) || !uuid.test(session)) return reply(400, "Invalid IDs", cors);

  // Always request bounded ranges; full-object downloads are disabled.
  const range = req.headers.get("range");
  if (!range || !validRange(range)) return reply(416, "Request a byte range up to 1 MiB", cors);

  const base = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !anon || !secret) return reply(503, "Not configured", cors);
  const publicClient = createClient(base, anon, { auth: { persistSession: false } });
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  const { data: identity, error: authError } = await publicClient.auth.getUser(jwt);
  if (authError || !identity.user) return reply(401, "Invalid session", cors);

  const admin = createClient(base, secret, { auth: { persistSession: false } });
  const { data: reveal, error } = await admin.from("xoxo_reveals")
    .select("id,recipient_id,sender_id,dm_id,object_path,media_type,open_session_id,session_expires_at,expires_at")
    .eq("id", id).maybeSingle();
  if (error || !reveal || reveal.recipient_id !== identity.user.id ||
      reveal.open_session_id !== session) return reply(403, "Reveal unavailable", cors);
  const expires = Date.parse(reveal.session_expires_at || "");
  if (!Number.isFinite(expires) || expires <= Date.now() ||
      (reveal.expires_at && Date.parse(reveal.expires_at) <= Date.now())) return reply(410, "Reveal expired", cors);
  if (!reveal.dm_id) return reply(403, "Reveal unavailable", cors);
  const { data: dm } = await admin.from("direct_messages").select("id")
    .eq("id", reveal.dm_id).eq("sender_id", reveal.sender_id)
    .eq("recipient_id", reveal.recipient_id).maybeSingle();
  if (!dm) return reply(403, "Reveal unavailable", cors);

  // Fetch exact bytes directly from private Storage REST API, not SDK .download().
  // Do not use createSignedUrl; never send the service-role key to the client.
  const objectUrl = base.replace(/\/$/, "") + "/storage/v1/object/authenticated/xoxo-reveal/" +
    reveal.object_path.split("/").map(encodeURIComponent).join("/");
  const storageResponse = await fetch(objectUrl, {
    headers: { authorization: `Bearer ${secret}`, apikey: secret, range },
    redirect: "error"
  });
  if (storageResponse.status !== 206 || !storageResponse.body ||
      !storageResponse.headers.get("content-range")) {
    await storageResponse.body?.cancel();
    return reply(502, "Storage range delivery unavailable", cors);
  }
  const contentLength = Number(storageResponse.headers.get("content-length"));
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_RANGE) {
    await storageResponse.body.cancel();
    return reply(502, "Invalid upstream range", cors);
  }
  if (Date.now() >= expires) {
    await storageResponse.body.cancel();
    return reply(410, "Reveal expired", cors);
  }

  const headers = new Headers({...noStore,...cors});
  headers.set("content-type", reveal.media_type === "image" ? "image/webp" :
    (storageResponse.headers.get("content-type") || "video/mp4"));
  headers.set("content-range", storageResponse.headers.get("content-range")!);
  headers.set("content-length", String(contentLength));
  headers.set("accept-ranges", "bytes");
  headers.set("vary", "authorization, origin");
  if (origin === allowed) {
    headers.set("access-control-allow-origin", allowed);
    headers.set("access-control-expose-headers", "content-range, content-length, accept-ranges");
  }
  // The upstream body is streamed; it is not buffered into a full video Blob.
  // Already-sent bytes cannot be recalled if the session expires mid-response.
  return new Response(storageResponse.body, { status: 206, headers });
});
