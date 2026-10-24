// XOXO Reveal BETA — private media delivery endpoint (NOT DEPLOYED).
// Requires an audited session-claim RPC and private xoxo-reveal bucket.
// This endpoint intentionally does not issue signed URLs or return object paths.
// Deployment requires integration testing, rate limiting, and moderation review.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "GET") return json(405, "Method not allowed");
  const origin = req.headers.get("origin");
  const allowedOrigin = Deno.env.get("XOXO_REVEAL_ALLOWED_ORIGIN");
  if (!allowedOrigin || (origin && origin !== allowedOrigin)) return json(403, "Origin not allowed");
  // Origin is not an authentication mechanism; JWT is mandatory.
  const bearer = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(bearer)) return json(401, "Authentication required");
  const jwt = bearer.replace(/^Bearer\s+/i, "").trim();
  const url = new URL(req.url);
  const revealId = url.searchParams.get("reveal_id") || "";
  const sessionId = url.searchParams.get("session_id") || "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(revealId) || !uuid.test(sessionId)) return json(400, "Invalid request");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json(503, "Not configured");

  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !auth.user) return json(401, "Invalid session");

  // Server-only credentials never leave this Edge Function.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: reveal, error } = await admin.from("xoxo_reveals")
    .select("id,recipient_id,object_path,media_type,mode,open_session_id,session_expires_at,expires_at,dm_id,sender_id")
    .eq("id", revealId).maybeSingle();
  if (error || !reveal || reveal.recipient_id !== auth.user.id || reveal.open_session_id !== sessionId)
    return json(403, "Reveal unavailable");
  const now = Date.now();
  if (!reveal.session_expires_at || Date.parse(reveal.session_expires_at) <= now ||
      (reveal.expires_at && Date.parse(reveal.expires_at) <= now))
    return json(410, "Reveal expired");

  // Require the linked DM still exists and matches both participants.
  if (!reveal.dm_id) return json(403, "Reveal unavailable");
  const { data: dm } = await admin.from("direct_messages")
    .select("id").eq("id", reveal.dm_id).eq("sender_id", reveal.sender_id)
    .eq("recipient_id", reveal.recipient_id).maybeSingle();
  if (!dm) return json(403, "Reveal unavailable");

  // No direct Storage SELECT policy for users. Proxy download is checked per request.
  const { data: file, error: downloadError } = await admin.storage
    .from("xoxo-reveal").download(reveal.object_path);
  if (downloadError || !file) return json(404, "Media unavailable");
  if (file.size > 15 * 1024 * 1024) return json(413, "Media too large");

  // Recheck expiry after storage fetch; do not start response if session expired.
  if (Date.parse(reveal.session_expires_at) <= Date.now() ||
      (reveal.expires_at && Date.parse(reveal.expires_at) <= Date.now()))
    return json(410, "Reveal expired");

  const mime = reveal.media_type === "image" ? (file.type.startsWith("image/") ? file.type : "image/webp")
    : (file.type.startsWith("video/") ? file.type : "video/mp4");
  const headers = new Headers({
    "content-type": mime,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
    "accept-ranges": "bytes",
    "vary": "authorization, origin",
  });
  if (origin === allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-expose-headers", "content-range, accept-ranges, content-length");
  }
  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416, headers: { "content-range": `bytes */${file.size}` } });
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : file.size - 1;
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!suffix || !Number.isSafeInteger(suffix)) return json(416, "Invalid range");
      start = Math.max(0, file.size - suffix); end = file.size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size)
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${file.size}` } });
    end = Math.min(end, file.size - 1);
    headers.set("content-range", `bytes ${start}-${end}/${file.size}`);
    headers.set("content-length", String(end - start + 1));
    return new Response(file.slice(start, end + 1), { status: 206, headers });
  }
  headers.set("content-length", String(file.size));
  return new Response(file, { status: 200, headers });
});
