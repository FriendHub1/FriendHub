const SUPABASE_URL = "https://cxosofpxfmjkrhfabrqc.supabase.co";
const SUPABASE_KEY = "sb_publishable_TPezCBhcWobUpElquePVwg_WamONWCM";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(value, origin) {
  const raw = String(value ?? "").trim();
  if (!raw) return `${origin}/xoxoavenue-social.png`;
  try {
    return new URL(raw, origin).href;
  } catch {
    return `${origin}/xoxoavenue-social.png`;
  }
}

async function getPublicProfile(userId) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/friendhub_public_profiles`);
  url.searchParams.set(
    "select",
    "user_id,username,country,languages,interests,looking_for,profile_photo,bio"
  );
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    console.error("Supabase profile preview lookup failed:", response.status);
    return null;
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function makeDescription(profile) {
  const bio = String(profile?.bio || "").trim();
  if (bio) return bio.slice(0, 180);

  const lookingFor = String(profile?.looking_for || "").trim();
  if (lookingFor) return `Looking for ${lookingFor} on XOXO Avenue.`;

  return "Meet people, make friends, and discover communities on XOXO Avenue.";
}

function injectPreview(response, metadata) {
  return new HTMLRewriter()
    .on("title", {
      text(element) {
        element.replace(metadata.title, { html: false });
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute("content", metadata.description);
      },
    })
    .on("head", {
      element(element) {
        element.append(
          `
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(metadata.title)}">
<meta property="og:description" content="${escapeHtml(metadata.description)}">
<meta property="og:image" content="${escapeHtml(metadata.image)}">
<meta property="og:url" content="${escapeHtml(metadata.url)}">
<meta property="og:site_name" content="XOXO Avenue">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(metadata.title)}">
<meta name="twitter:description" content="${escapeHtml(metadata.description)}">
<meta name="twitter:image" content="${escapeHtml(metadata.image)}">
`,
          { html: true }
        );
      },
    })
    .transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profile");

    // Normal XOXO Avenue requests continue to the existing static assets.
    if (!profileId) {
      return env.ASSETS.fetch(request);
    }

    const assetResponse = await env.ASSETS.fetch(request);

    // Only transform an HTML response.
    const contentType = assetResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return assetResponse;
    }

    const profile = await getPublicProfile(profileId);

    if (!profile) {
      return assetResponse;
    }

    const username = String(profile.username || "@XOXOAvenue").trim();
    const metadata = {
      title: `${username} · XOXO Avenue`,
      description: makeDescription(profile),
      image: absoluteUrl(profile.profile_photo, url.origin),
      url: url.href,
    };

    const transformed = injectPreview(assetResponse, metadata);

    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "public, max-age=60");
    headers.set("Vary", "Accept");

    return new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers,
    });
  },
};
