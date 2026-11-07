// XOXO Reveal BETA — private image transport, NOT deployed.
// Adapts the authenticated Edge range endpoint to the bounded image loader.
// Never logs tokens or constructs public Storage URLs.
export function createRevealRangeTransport({ endpoint, getAccessToken, fetchImpl = fetch }) {
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) throw new TypeError("HTTPS endpoint required");
  if (typeof getAccessToken !== "function" || typeof fetchImpl !== "function") throw new TypeError("Missing transport dependency");
  return async function requestRange({revealId,sessionId,start,end}) {
    if (!revealId || !sessionId || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start<0 || end<start || end-start>=1024*1024) throw new TypeError("Invalid range");
    const token=await getAccessToken();
    if (typeof token!=="string" || !token) throw new Error("Authentication required");
    const url=new URL(endpoint);
    url.searchParams.set("reveal_id",revealId);
    url.searchParams.set("session_id",sessionId);
    const response=await fetchImpl(url.toString(),{
      method:"GET",headers:{Authorization:`Bearer ${token}`,Range:`bytes=${start}-${end}`},
      cache:"no-store",redirect:"error",credentials:"omit"
    });
    if(response.status!==206) throw new Error(`Media unavailable (${response.status})`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    const contentRange=response.headers.get("content-range");
    if(bytes.length!==end-start+1 || !contentRange) throw new Error("Invalid media range response");
    return {status:response.status,bytes,contentRange};
  };
}
// The server must validate recipient, session and expiry for EACH range.
// Browser CORS preflight for Authorization/Range must be handled by Edge.
// The existing draft Edge endpoint lacks a working OPTIONS handler;
// this transport is not production-ready until that is fixed and tested.
