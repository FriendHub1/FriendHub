// XOXO Reveal cleanup worker — DRY RUN BY DEFAULT, NOT DEPLOYED.
// Requires a separately configured server environment; never ship service role
// credentials to the browser. This code is intentionally NOT scheduled.
// Usage in a secured server runtime: runRevealCleanup({supabase, dryRun:true}).
// Enable deletion only after the Reveal delivery/session semantics are reviewed.

export async function runRevealCleanup({ supabase, dryRun = true, limit = 50, now = new Date() }) {
  if (!supabase) throw new Error("Server-side Supabase client required");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid batch limit");
  const cutoff = now.toISOString();
  const { data, error } = await supabase
    .from("xoxo_reveals")
    .select("id,object_path,expires_at,mode,consumed_at")
    .not("expires_at", "is", null)
    .lte("expires_at", cutoff)
    .neq("mode", "keep")
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = (data || []).filter(r => r.object_path && r.expires_at && Date.parse(r.expires_at) <= now.getTime());
  if (dryRun) return { dryRun: true, eligible: rows.length, ids: rows.map(r => r.id) };

  // Guard: avoid deleting an object if a live session might still hold access.
  // Production rollout requires an atomic claim/lease and deletion audit log.
  throw new Error("Deletion disabled until session-aware cleanup is implemented and approved.");
}
