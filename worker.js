const SUPABASE_URL = "https://cxosofpxfmjkrhfabrqc.supabase.co";
const SUPABASE_KEY = "sb_publishable_TPezCBhcWobUpElquePVwg_WamONWCM";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getPublicProfile(userId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_public_profile`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_user_id: userId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `SUPABASE_RPC_${response.status}: ${errorText}`
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error(
        `SUPABASE_RPC_EMPTY: No public profile returned for ${userId}`
      );
    }

    return rows[0];
  } catch (error) {
    console.error("XOXO profile RPC error:", error);
    throw error;
  }
}

function makeDescription(profile) {
  const bio = String(profile?.bio || "").trim();

  if (bio) {
    return bio.slice(0, 180);
  }

  const lookingFor = String(
    profile?.looking_for || ""
  ).trim();

  if (lookingFor) {
    return `Looking for ${lookingFor} on XOXO Avenue.`;
  }

  return "Meet people, make friends, and discover communities on XOXO Avenue.";
}

function getProfileImageUrl(profile, origin, userId) {
  const photo = String(
    profile?.profile_photo || ""
  ).trim();

  if (photo.startsWith("data:image/")) {
    return `${origin}/profile-preview-image/${encodeURIComponent(
      userId
    )}`;
  }

  if (photo) {
    try {
      return new URL(photo, origin).href;
    } catch (_) {}
  }

  return `${origin}/xoxoavenue-social.png`;
}

function decodeBase64Image(dataUrl) {
  const match = String(dataUrl || "").match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    return null;
  }

  try {
    const contentType = match[1];
    const base64 = match[2].replace(/\s/g, "");
    const binary = atob(base64);

    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return {
      contentType,
      bytes,
    };
  } catch (error) {
    console.error(
      "XOXO base64 image decode failed:",
      error
    );

    return null;
  }
}

async function serveProfileImage(userId) {
  const profile = await getPublicProfile(userId);

  if (!profile) {
    return new Response(
      "Profile image not found",
      {
        status: 404,
        headers: {
          "X-XOXO-Worker":
            "profile-image-profile-not-found",
        },
      }
    );
  }

  const photo = String(
    profile.profile_photo || ""
  ).trim();

  if (
    photo.startsWith("https://") ||
    photo.startsWith("http://")
  ) {
    return Response.redirect(photo, 302);
  }

  const decoded = decodeBase64Image(photo);

  if (!decoded) {
    return new Response(
      "Profile image not available",
      {
        status: 404,
        headers: {
          "X-XOXO-Worker":
            "profile-image-invalid",
        },
      }
    );
  }

  return new Response(decoded.bytes, {
    status: 200,
    headers: {
      "Content-Type": decoded.contentType,
      "Cache-Control":
        "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-XOXO-Worker": "profile-image",
    },
  });
}

function injectPreview(response, metadata) {
  return new HTMLRewriter()

    .on("title", {
      text(text) {
        text.replace(metadata.title);
      },
    })

    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute(
          "content",
          metadata.description
        );
      },
    })

    .on("head", {
      element(element) {
        element.append(
          `
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(
            metadata.title
          )}">
<meta property="og:description" content="${escapeHtml(
            metadata.description
          )}">
<meta property="og:image" content="${escapeHtml(
            metadata.image
          )}">
<meta property="og:image:secure_url" content="${escapeHtml(
            metadata.image
          )}">
<meta property="og:image:alt" content="${escapeHtml(
            metadata.title
          )}">
<meta property="og:url" content="${escapeHtml(
            metadata.url
          )}">
<meta property="og:site_name" content="XOXO Avenue">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(
            metadata.title
          )}">
<meta name="twitter:description" content="${escapeHtml(
            metadata.description
          )}">
<meta name="twitter:image" content="${escapeHtml(
            metadata.image
          )}">
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

    /*
     * ==========================================
     * PROFILE IMAGE ENDPOINT
     * ==========================================
     */

    const imageMatch = url.pathname.match(
      /^\/profile-preview-image\/([0-9a-fA-F-]+)$/
    );

    if (imageMatch) {
      const userId =
        decodeURIComponent(imageMatch[1]);

      try {
        return await serveProfileImage(userId);
      } catch (error) {
        return new Response(
          String(
            error?.message ||
              error ||
              "Unknown profile image error"
          ),
          {
            status: 500,
            headers: {
              "Content-Type":
                "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "X-XOXO-Worker":
                "profile-image-debug-error",
            },
          }
        );
      }
    }

    /*
     * ==========================================
     * NORMAL XOXO PAGE
     * ==========================================
     */

    const profileId =
      url.searchParams.get("profile");

    if (!profileId) {
      const response =
        await env.ASSETS.fetch(request);

      const headers =
        new Headers(response.headers);

      headers.set(
        "X-XOXO-Worker",
        "normal-page"
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    /*
     * ==========================================
     * SHARED PROFILE — DEBUG MODE
     * ==========================================
     */

    let profile;

    try {
      profile =
        await getPublicProfile(profileId);
    } catch (error) {
      /*
       * TEMPORARY:
       * Return the exact Supabase error directly.
       *
       * Once we find the problem, this debug
       * response will be removed.
       */
      return new Response(
        String(
          error?.message ||
            error ||
            "Unknown Supabase profile error"
        ),
        {
          status: 500,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-XOXO-Worker":
              "supabase-debug-error",
          },
        }
      );
    }

    /*
     * ==========================================
     * FETCH XOXO INDEX
     * ==========================================
     */

    const indexRequest = new Request(
      `${url.origin}/`,
      request
    );

    const assetResponse =
      await env.ASSETS.fetch(indexRequest);

    const contentType =
      assetResponse.headers.get(
        "content-type"
      ) || "";

    if (!contentType.includes("text/html")) {
      const headers =
        new Headers(assetResponse.headers);

      headers.set(
        "X-XOXO-Worker",
        "profile-non-html"
      );

      return new Response(
        assetResponse.body,
        {
          status: assetResponse.status,
          statusText:
            assetResponse.statusText,
          headers,
        }
      );
    }

    /*
     * ==========================================
     * BUILD DYNAMIC PROFILE METADATA
     * ==========================================
     */

    const username = String(
      profile.username || "@XOXOAvenue"
    ).trim();

    const metadata = {
      title:
        `${username} · XOXO Avenue`,

      description:
        makeDescription(profile),

      image:
        getProfileImageUrl(
          profile,
          url.origin,
          profileId
        ),

      url:
        `${url.origin}/?profile=${encodeURIComponent(
          profileId
        )}`,
    };

    /*
     * ==========================================
     * INJECT OPEN GRAPH TAGS
     * ==========================================
     */

    const transformed =
      injectPreview(
        assetResponse,
        metadata
      );

    const headers =
      new Headers(transformed.headers);

    headers.set(
      "Cache-Control",
      "public, max-age=60"
    );

    headers.set(
      "X-XOXO-Worker",
      "profile-preview"
    );

    return new Response(
      transformed.body,
      {
        status: transformed.status,
        statusText:
          transformed.statusText,
        headers,
      }
    );
  },
};
