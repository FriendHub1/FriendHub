// XOXO Reveal beta CORS policy. No wildcard origins or credentials.
export const revealCors = (origin, allowed) => {
  if (!allowed || !origin || origin !== allowed) return null;
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, range, apikey, x-client-info",
    "access-control-expose-headers": "content-range, content-length, accept-ranges",
    "access-control-max-age": "600",
    "vary": "origin"
  };
};
export function revealPreflight(origin, allowed) {
  const headers = revealCors(origin, allowed);
  if (!headers) return new Response(null, {status:403,headers:{"cache-control":"no-store"}});
  return new Response(null,{status:204,headers});
}
