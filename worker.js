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
          "Accept-Profile": "public",
          "Content-Profile": "public",
        },
        body: JSON.stringify({
          target_user_id: userId,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "XOXO profile RPC failed:",
        response.status,
        await response.text()
      );
      return null;
    }

    const rows = await response.json();

    if (!Array.isArray(rows) || !rows.length) {
      console.error(
        "XOXO profile RPC returned no profile:",
        userId
      );
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error(
      "XOXO profile RPC error:",
      error
    );
    return null;
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

  if (
    photo.startsWith("https://") ||
    photo.startsWith("http://")
  ) {
    return photo;
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
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
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
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
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

/*
 * ==========================================
 * SUPPORT EMAIL API
 * ==========================================
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function getAuthenticatedUser(request) {
  const authorization = request.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function getAuthUserById(userId, env) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    }
  );

  if (!response.ok) {
    console.error(
      "XOXO support auth user lookup failed:",
      response.status,
      await response.text()
    );
    return null;
  }

  return response.json();
}

async function getSupportCase(caseId, env) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/support_cases?id=eq.${encodeURIComponent(caseId)}&select=id,case_number,user_id,status`,
    {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Accept-Profile": "public",
      },
    }
  );

  if (!response.ok) {
    console.error(
      "XOXO support case lookup failed:",
      response.status,
      await response.text()
    );
    return null;
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function sendResendEmail(env, payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    console.error(
      "XOXO Resend email failed:",
      response.status,
      data
    );
    return { ok: false, status: response.status };
  }

  return { ok: true, data };
}

async function handleSupportEmail(request, env) {
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405
    );
  }

  if (!env.RESEND_API_KEY || !env.SUPABASE_SECRET_KEY) {
    console.error("XOXO support email secrets are missing");
    return jsonResponse(
      { ok: false, error: "Server configuration error" },
      500
    );
  }

  const signedInUser = await getAuthenticatedUser(request);

  if (!signedInUser?.id) {
    return jsonResponse(
      { ok: false, error: "Unauthorized" },
      401
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid JSON" },
      400
    );
  }

  const caseId = String(body?.case_id || "").trim();
  const emailType = String(body?.type || "confirmation").trim();

  if (!caseId) {
    return jsonResponse(
      { ok: false, error: "Missing case_id" },
      400
    );
  }

  if (emailType !== "confirmation") {
    return jsonResponse(
      { ok: false, error: "Unsupported email type" },
      400
    );
  }

  const supportCase = await getSupportCase(caseId, env);

  if (!supportCase) {
    return jsonResponse(
      { ok: false, error: "Support case not found" },
      404
    );
  }

  /*
   * For this first endpoint, only the owner of the case
   * can request its confirmation email.
   */
  if (supportCase.user_id !== signedInUser.id) {
    return jsonResponse(
      { ok: false, error: "Forbidden" },
      403
    );
  }

  const authUser = await getAuthUserById(
    supportCase.user_id,
    env
  );

  const recipient = String(authUser?.email || "").trim();

  if (!recipient) {
    return jsonResponse(
      { ok: false, error: "User email not found" },
      404
    );
  }

  const caseNumber = String(supportCase.case_number);

  const subject =
    `[##${caseNumber}##] - Message received!`;

  const textBody = [
    "# This is an automated message. Please do not reply #",
    "",
    "Hey there,",
    "",
    "Thanks for reaching out! 🙂",
    "",
    `This is to confirm we received your message. Your support case number is #${caseNumber}.`,
    "",
    "We'll get back to you as soon as possible.",
    "",
    "Warmly,",
    "XOXO Avenue Support 💜",
  ].join("\n");

  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
      <p style="font-weight:700;"># This is an automated message. Please do not reply #</p>
      <p>Hey there,</p>
      <p>Thanks for reaching out! 🙂</p>
      <p>
        This is to confirm we received your message.
        Your support case number is <strong>#${escapeHtml(caseNumber)}</strong>.
      </p>
      <p>We'll get back to you as soon as possible.</p>
      <p>
        Warmly,<br>
        <strong>XOXO Avenue Support 💜</strong>
      </p>
    </div>
  `;

  const result = await sendResendEmail(env, {
    from: "XOXO Avenue Support <support@xoxoavenue.com>",
    to: [recipient],
    reply_to: "xoxoavenuesupport@gmail.com",
    subject,
    text: textBody,
    html: htmlBody,
  });

  if (!result.ok) {
    return jsonResponse(
      { ok: false, error: "Email delivery failed" },
      502
    );
  }

  return jsonResponse({
    ok: true,
    case_number: supportCase.case_number,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
     * ==========================================
     * SUPPORT EMAIL API
     * ==========================================
     */

    if (url.pathname === "/api/support-email") {
      return handleSupportEmail(request, env);
    }

    /*
     * ==========================================
     * PUBLIC PROFILE IMAGE
     * ==========================================
     */

    const imageMatch = url.pathname.match(
      /^\/profile-preview-image\/([0-9a-fA-F-]+)$/
    );

    if (imageMatch) {
      const userId =
        decodeURIComponent(imageMatch[1]);

      return serveProfileImage(userId);
    }

    /*
     * ==========================================
     * NORMAL PAGE
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
     * LOAD PUBLIC PROFILE
     * ==========================================
     */

    const profile =
      await getPublicProfile(profileId);

    if (!profile) {
      const response =
        await env.ASSETS.fetch(request);

      const headers =
        new Headers(response.headers);

      headers.set(
        "X-XOXO-Worker",
        "profile-not-found"
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    /*
     * ==========================================
     * LOAD XOXO INDEX
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
     * DYNAMIC PROFILE METADATA
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
     * OPEN GRAPH / SOCIAL PREVIEW
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
