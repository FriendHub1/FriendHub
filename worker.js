const SUPABASE_URL = "https://cxosofpxfmjkrhfabrqc.supabase.co";
const SUPABASE_KEY = "sb_publishable_TPezCBhcWobUpElquePVwg_WamONWCM";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/*
 * ==========================================
 * PUBLIC PROFILE
 * ==========================================
 */

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
          Accept: "application/json",
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

function getProfileImageUrl(
  profile,
  origin,
  userId
) {
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

    const bytes = new Uint8Array(
      binary.length
    );

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] =
        binary.charCodeAt(i);
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
  const profile =
    await getPublicProfile(userId);

  if (!profile) {
    return new Response(
      "Profile image not found",
      {
        status: 404,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control":
            "no-store",
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
    return Response.redirect(
      photo,
      302
    );
  }

  const decoded =
    decodeBase64Image(photo);

  if (!decoded) {
    return new Response(
      "Profile image not available",
      {
        status: 404,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control":
            "no-store",
          "X-XOXO-Worker":
            "profile-image-invalid",
        },
      }
    );
  }

  return new Response(
    decoded.bytes,
    {
      status: 200,
      headers: {
        "Content-Type":
          decoded.contentType,
        "Cache-Control":
          "public, max-age=3600",
        "X-Content-Type-Options":
          "nosniff",
        "X-XOXO-Worker":
          "profile-image",
      },
    }
  );
}

function injectPreview(
  response,
  metadata
) {
  return new HTMLRewriter()

    .on("title", {
      text(text) {
        text.replace(
          metadata.title
        );
      },
    })

    .on(
      'meta[name="description"]',
      {
        element(element) {
          element.setAttribute(
            "content",
            metadata.description
          );
        },
      }
    )

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
          {
            html: true,
          }
        );
      },
    })

    .transform(response);
}

/*
 * ==========================================
 * GENERAL JSON RESPONSE
 * ==========================================
 */

function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    }
  );
}

/*
 * ==========================================
 * AUTHENTICATION
 * ==========================================
 */

async function getAuthenticatedUser(
  request
) {
  const authorization =
    request.headers.get(
      "Authorization"
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey:
            SUPABASE_KEY,
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function getAuthUserById(
  userId,
  env
) {
  const response =
    await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(
        userId
      )}`,
      {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,
          Authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,
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

/*
 * ==========================================
 * SUPPORT CASE
 * ==========================================
 */

async function getSupportCase(
  caseId,
  env
) {
  const response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/support_cases?id=eq.${encodeURIComponent(
        caseId
      )}&select=id,case_number,user_id,status`,
      {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,
          Authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,
          "Accept-Profile":
            "public",
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

  const rows =
    await response.json();

  return Array.isArray(rows) &&
    rows.length
    ? rows[0]
    : null;
}

async function getSupportCaseByNumber(
  caseNumber,
  env
) {
  const response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/support_cases?case_number=eq.${encodeURIComponent(
        caseNumber
      )}&select=id,case_number,user_id,status`,
      {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,
          Authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,
          "Accept-Profile":
            "public",
        },
      }
    );

  if (!response.ok) {
    console.error(
      "XOXO support case number lookup failed:",
      response.status,
      await response.text()
    );

    return null;
  }

  const rows =
    await response.json();

  return Array.isArray(rows) &&
    rows.length
    ? rows[0]
    : null;
}

/*
 * ==========================================
 * RESEND OUTGOING EMAIL
 * ==========================================
 */

async function sendResendEmail(
  env,
  payload
) {
  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(
            payload
          ),
      }
    );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    console.error(
      "XOXO Resend email failed:",
      response.status,
      data
    );

    return {
      ok: false,
      status:
        response.status,
    };
  }

  return {
    ok: true,
    data,
  };
}

/*
 * ==========================================
 * RESEND INBOUND EMAIL
 * ==========================================
 */

async function getReceivedEmail(
  emailId,
  env
) {
  const response =
    await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(
        emailId
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${env.RESEND_INBOUND_API_KEY}`,
          Accept:
            "application/json",
        },
      }
    );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    console.error(
      "XOXO received email lookup failed:",
      response.status,
      data
    );

    return null;
  }

  return data;
}

/*
 * ==========================================
 * WEBHOOK SIGNATURE
 * ==========================================
 */

function decodeBase64(
  value
) {
  try {
    const normalized =
      String(value || "")
        .replace(
          /-/g,
          "+"
        )
        .replace(
          /_/g,
          "/"
        );

    const padded =
      normalized +
      "=".repeat(
        (4 -
          (normalized.length %
            4)) %
          4
      );

    const binary =
      atob(padded);

    const bytes =
      new Uint8Array(
        binary.length
      );

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] =
        binary.charCodeAt(
          i
        );
    }

    return bytes;
  } catch {
    return null;
  }
}

async function verifyResendWebhook(
  rawBody,
  request,
  env
) {
  const secret =
    String(
      env.RESEND_WEBHOOK_SECRET ||
        ""
    ).trim();

  const svixId =
    String(
      request.headers.get(
        "svix-id"
      ) || ""
    ).trim();

  const svixTimestamp =
    String(
      request.headers.get(
        "svix-timestamp"
      ) || ""
    ).trim();

  const svixSignature =
    String(
      request.headers.get(
        "svix-signature"
      ) || ""
    ).trim();

  if (
    !secret ||
    !svixId ||
    !svixTimestamp ||
    !svixSignature
  ) {
    return false;
  }

  const timestampNumber =
    Number(
      svixTimestamp
    );

  if (
    !Number.isFinite(
      timestampNumber
    ) ||
    Math.abs(
      Date.now() / 1000 -
        timestampNumber
    ) > 300
  ) {
    return false;
  }

  const secretValue =
    secret.startsWith(
      "whsec_"
    )
      ? secret.slice(6)
      : secret;

  const secretBytes =
    decodeBase64(
      secretValue
    );

  if (!secretBytes) {
    return false;
  }

  const signedContent =
    `${svixId}.${svixTimestamp}.${rawBody}`;

  const key =
    await crypto.subtle.importKey(
      "raw",
      secretBytes,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["verify"]
    );

  const data =
    new TextEncoder().encode(
      signedContent
    );

  const signatures =
    svixSignature
      .split(" ")
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);

  for (
    const item of signatures
  ) {
    const parts =
      item.split(",");

    if (
      parts.length !== 2 ||
      parts[0] !== "v1"
    ) {
      continue;
    }

    const signatureBytes =
      decodeBase64(
        parts[1]
      );

    if (!signatureBytes) {
      continue;
    }

    const valid =
      await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        data
      );

    if (valid) {
      return true;
    }
  }

  return false;
}

/*
 * ==========================================
 * EMAIL HELPERS
 * ==========================================
 */

function extractEmailAddress(
  value
) {
  const text =
    String(value || "")
      .trim();

  const match =
    text.match(
      /<([^<>@\s]+@[^<>@\s]+)>/
    );

  if (match) {
    return match[1]
      .toLowerCase();
  }

  const direct =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

  return direct
    ? direct[0].toLowerCase()
    : "";
}

function getCaseNumberFromInbound(
  event
) {
  const recipients =
    Array.isArray(
      event?.data?.to
    )
      ? event.data.to
      : event?.data?.to
        ? [event.data.to]
        : [];

  for (
    const recipient of recipients
  ) {
    const address =
      extractEmailAddress(
        recipient
      );

    const match =
      address.match(
        /^case-(\d+)@reply\.xoxoavenue\.com$/i
      );

    if (match) {
      return match[1];
    }
  }

  const subject =
    String(
      event?.data?.subject ||
        ""
    );

  const subjectMatch =
    subject.match(
      /\[##(\d+)##\]/
    );

  return subjectMatch
    ? subjectMatch[1]
    : null;
}

/*
 * ==========================================
 * CLEAN QUOTED EMAIL REPLIES
 * ==========================================
 */

function cleanInboundEmailReply(value) {
  let text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!text) {
    return "";
  }

  const lines = text.split("\n");
  const kept = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const nextTrimmed =
      i + 1 < lines.length
        ? lines[i + 1].trim()
        : "";

    /*
     * Gmail sometimes wraps its quoted-reply separator:
     * "On Tue, ... <support@...>"
     * "wrote:"
     */
    /*
     * Gmail may split the quoted header across several lines.
     * Once a line begins with "On " in an email reply, the
     * previous conversation starts there, so discard it and
     * everything after it.
     */
    const gmailWrappedSeparator =
      /^On\s+/i.test(trimmed) ||
      /^El\s+/i.test(trimmed);

    if (
      gmailWrappedSeparator ||
      /^On .+ wrote:\s*$/i.test(trimmed) ||
      /^El .+ escribió:\s*$/i.test(trimmed) ||
      /^Le .+ a écrit\s*:\s*$/i.test(trimmed) ||
      /^Am .+ schrieb .+:\s*$/i.test(trimmed) ||
      /^Em .+ escreveu:\s*$/i.test(trimmed) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed) ||
      /^-{2,}\s*Mensaje original\s*-{2,}$/i.test(trimmed) ||
      /^From:\s.+/i.test(trimmed) ||
      /^De:\s.+/i.test(trimmed)
    ) {
      break;
    }

    if (/^>/.test(trimmed)) {
      break;
    }

    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/*
 * ==========================================
 * SAVE INBOUND SUPPORT MESSAGE
 * ==========================================
 */

async function insertInboundSupportMessage(
  supportCase,
  senderId,
  senderType,
  message,
  inboundEmailId,
  env
) {
  const payload = {
    case_id: supportCase.id,
    sender_id: senderId,
    sender_type: senderType,
    message: message,
    inbound_email_id: inboundEmailId,
  };

  console.log(
    "XOXO attempting support_messages insert:",
    JSON.stringify(payload)
  );

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/support_messages`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Content-Profile": "public",
        "Accept-Profile": "public",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }
  );

  const responseText = await response.text();

  console.log(
    "XOXO support_messages response:",
    response.status,
    responseText
  );

  if (!response.ok) {
    if (
      response.status === 409 &&
      responseText.includes("23505") &&
      responseText.includes("inbound_email_id")
    ) {
      return {
        ok: true,
        duplicate: true,
        status: response.status,
        error: null,
      };
    }

    return {
      ok: false,
      duplicate: false,
      status: response.status,
      error: responseText,
    };
  }

  return {
    ok: true,
    duplicate: false,
    status: response.status,
    error: null,
  };
}

/*
 * ==========================================
 * INBOUND SUPPORT EMAIL
 * ==========================================
 */

async function handleSupportEmailInbound(
  request,
  env
) {
  if (
    request.method !==
    "POST"
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Method not allowed",
      },
      405
    );
  }

  if (
    !env.RESEND_WEBHOOK_SECRET ||
    !env.RESEND_INBOUND_API_KEY ||
    !env.SUPABASE_SECRET_KEY ||
    !env.RESEND_API_KEY
  ) {
    console.error(
      "XOXO inbound email secrets are missing"
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Server configuration error",
      },
      500
    );
  }

  /*
   * Read raw webhook body.
   */

  const rawBody =
    await request.text();

  /*
   * Verify Resend/Svix signature.
   */

  let verified =
    false;

  try {
    verified =
      await verifyResendWebhook(
        rawBody,
        request,
        env
      );
  } catch (error) {
    console.error(
      "XOXO Resend webhook verification error:",
      error
    );
  }

  if (!verified) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Invalid webhook signature",
      },
      400
    );
  }

  /*
   * Parse webhook.
   */

  let event;

  try {
    event =
      JSON.parse(
        rawBody
      );
  } catch {
    return jsonResponse(
      {
        ok: false,
        error:
          "Invalid JSON",
      },
      400
    );
  }

  /*
   * Ignore other Resend events.
   */

  if (
    event?.type !==
    "email.received"
  ) {
    return jsonResponse({
      ok: true,
      ignored: true,
    });
  }

  /*
   * Get received email ID.
   */

  const emailId =
    String(
      event?.data?.email_id ||
        ""
    ).trim();

  if (!emailId) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Missing received email ID",
      },
      400
    );
  }

  /*
   * Determine case number.
   */

  const caseNumber =
    getCaseNumberFromInbound(
      event
    );

  if (!caseNumber) {
    console.error(
      "XOXO could not determine support case:",
      event?.data?.to,
      event?.data?.subject
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Support case could not be determined",
      },
      400
    );
  }

  /*
   * Find support case.
   */

  const supportCase =
    await getSupportCaseByNumber(
      caseNumber,
      env
    );

  if (!supportCase) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Support case not found",
      },
      404
    );
  }

  /*
   * Retrieve complete email from Resend.
   */

  const receivedEmail =
    await getReceivedEmail(
      emailId,
      env
    );

  if (!receivedEmail) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Could not retrieve received email",
      },
      502
    );
  }

  /*
   * Determine sender.
   */

  const sender =
    extractEmailAddress(
      receivedEmail.from ||
        event?.data?.from
    );

  if (!sender) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Sender email not found",
      },
      400
    );
  }

  /*
   * Confirm the sender owns this case.
   */

  const authUser =
    await getAuthUserById(
      supportCase.user_id,
      env
    );

  const expectedEmail =
    String(
      authUser?.email ||
        ""
    )
      .trim()
      .toLowerCase();

  const XOXO_SUPPORT_GMAIL =
    "xoxoavenuesupport@gmail.com";
  const XOXO_ADMIN_USER_ID =
    "d9ea1914-fdba-465c-9700-5e640ff48763";

  const isAdminSender =
    sender === XOXO_SUPPORT_GMAIL;
  const isUserSender =
    Boolean(expectedEmail) &&
    sender === expectedEmail;

  if (!isAdminSender && !isUserSender) {
    console.error(
      "XOXO inbound sender mismatch:",
      { sender, expectedEmail, caseNumber }
    );
    return jsonResponse(
      {
        ok: false,
        error:
          "Sender does not belong to support case",
      },
      403
    );
  }

  /*
   * Extract message body.
   */

  let message =
    String(
      receivedEmail.text ||
        receivedEmail.text_body ||
        ""
    ).trim();

  /*
   * If plain text is unavailable,
   * use HTML as fallback.
   */

  if (!message) {
    message =
      String(
        receivedEmail.html ||
          ""
      ).trim();
  }

  if (!message) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Received email has no readable content",
      },
      400
    );
  }

  /*
   * Remove Gmail/mail-client quoted history so only
   * the newly written reply is saved and forwarded.
   */

  const cleanedMessage =
    cleanInboundEmailReply(
      message
    );

  if (cleanedMessage) {
    message =
      cleanedMessage;
  }

  /*
   * Save the reply inside the support case.
   */

  const inboundSenderId =
    isAdminSender
      ? XOXO_ADMIN_USER_ID
      : supportCase.user_id;
  const inboundSenderType =
    isAdminSender ? "admin" : "user";

  const inserted =
    await insertInboundSupportMessage(
      supportCase,
      inboundSenderId,
      inboundSenderType,
      message,
      emailId,
      env
    );

  if (inserted.duplicate) {
    return jsonResponse({
      ok: true,
      received: true,
      verified: true,
      processing: false,
      duplicate: true,
      case_number: supportCase.case_number,
    });
  }

  if (!inserted.ok) {
    return jsonResponse(
      {
        ok: false,
        error: "Could not save support message",
        supabase_status: inserted.status,
        supabase_error: inserted.error,
      },
      500
    );
  }

  /*
   * Official support Gmail reply:
   * save as Admin, forward to the case owner,
   * and do not notify support Gmail again.
   */
  if (isAdminSender) {
    const recipient =
      String(authUser?.email || "").trim();

    if (!recipient) {
      console.error("Admin Gmail reply saved but user email was not found");
      return jsonResponse({
        ok: true,
        received: true,
        verified: true,
        processing: true,
        case_number: supportCase.case_number,
        message_saved: true,
        sender_type: "admin",
        user_email_sent: false,
      });
    }

    const adminReplySubject =
      `[##${caseNumber}##] - XOXO Avenue Support replied`;
    const adminReplyText = [
      `XOXO Avenue Support replied to your case #${caseNumber}:`,
      "",
      message,
      "",
      "Warmly,",
      "XOXO Avenue Support 💜",
    ].join("\n");

    const adminReplyHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
  <p>XOXO Avenue Support replied to your case <strong>#${escapeHtml(caseNumber)}</strong>:</p>
  <div style="white-space:pre-wrap;margin:20px 0;padding:16px;background:#f6f4ff;border-radius:12px;">${escapeHtml(message)}</div>
  <p>Warmly,<br><strong>XOXO Avenue Support 💜</strong></p>
</div>`;

    const userEmail = await sendResendEmail(env, {
      from: "XOXO Avenue Support <support@xoxoavenue.com>",
      to: [recipient],
      reply_to: `case-${caseNumber}@reply.xoxoavenue.com`,
      subject: adminReplySubject,
      text: adminReplyText,
      html: adminReplyHtml,
    });

    if (!userEmail.ok) {
      console.error("Admin Gmail reply saved but user email failed");
    }

    return jsonResponse({
      ok: true,
      received: true,
      verified: true,
      processing: true,
      case_number: supportCase.case_number,
      message_saved: true,
      sender_type: "admin",
      user_email_sent: userEmail.ok,
    });
  }

  /*
   * Send notification to official
   * XOXO Avenue Support Gmail.
   */

  const notificationSubject =
    `[##${caseNumber}##] - User replied to XOXO Avenue Support`;

  const notificationText =
    [
      `A user replied to support case #${caseNumber}.`,
      "",
      `From: ${sender}`,
      "",
      message,
      "",
      `Case: #${caseNumber}`,
    ].join("\n");

  const notificationHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:650px;margin:0 auto;">
  <h2>XOXO Avenue Support</h2>

  <p>
    A user replied to support case
    <strong>#${escapeHtml(
      caseNumber
    )}</strong>.
  </p>

  <p>
    <strong>From:</strong>
    ${escapeHtml(sender)}
  </p>

  <div style="white-space:pre-wrap;margin:20px 0;padding:16px;background:#f6f4ff;border-radius:12px;">
${escapeHtml(message)}
  </div>

  <p>
    <strong>Case:</strong>
    #${escapeHtml(
      caseNumber
    )}
  </p>
</div>
`;

  const notification =
    await sendResendEmail(
      env,
      {
        from:
          "XOXO Avenue Support <support@xoxoavenue.com>",
        to: [
          "xoxoavenuesupport@gmail.com",
        ],
        reply_to:
          `case-${caseNumber}@reply.xoxoavenue.com`,
        subject:
          notificationSubject,
        text:
          notificationText,
        html:
          notificationHtml,
      }
    );

  if (!notification.ok) {
    console.error(
      "XOXO support notification email failed"
    );
  }

  /*
   * Respond successfully to Resend.
   */

  return jsonResponse({
    ok: true,
    received: true,
    verified: true,
    processing: true,
    case_number:
      supportCase.case_number,
    message_saved: true,
    support_notification_sent:
      notification.ok,
  });
}

/*
 * ==========================================
 * OUTGOING SUPPORT EMAIL
 * ==========================================
 */

async function handleSupportEmail(
  request,
  env
) {
  if (
    request.method !==
    "POST"
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Method not allowed",
      },
      405
    );
  }

  if (
    !env.RESEND_API_KEY ||
    !env.SUPABASE_SECRET_KEY
  ) {
    console.error(
      "XOXO support email secrets are missing"
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Server configuration error",
      },
      500
    );
  }

  const signedInUser =
    await getAuthenticatedUser(
      request
    );

  if (!signedInUser?.id) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Unauthorized",
      },
      401
    );
  }

  let body;

  try {
    body =
      await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error:
          "Invalid JSON",
      },
      400
    );
  }

  const caseId =
    String(
      body?.case_id ||
        ""
    ).trim();

  const emailType =
    String(
      body?.type ||
        "confirmation"
    ).trim();

  if (!caseId) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Missing case_id",
      },
      400
    );
  }

  if (
    ![
      "confirmation",
      "admin_reply",
    ].includes(
      emailType
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Unsupported email type",
      },
      400
    );
  }

  const supportCase =
    await getSupportCase(
      caseId,
      env
    );

  if (!supportCase) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Support case not found",
      },
      404
    );
  }

  const XOXO_ADMIN_USER_ID =
    "d9ea1914-fdba-465c-9700-5e640ff48763";

  if (
    emailType ===
    "confirmation"
  ) {
    if (
      supportCase.user_id !==
      signedInUser.id
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Forbidden",
        },
        403
      );
    }
  }

  if (
    emailType ===
    "admin_reply"
  ) {
    if (
      signedInUser.id !==
      XOXO_ADMIN_USER_ID
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Forbidden",
        },
        403
      );
    }
  }

  const authUser =
    await getAuthUserById(
      supportCase.user_id,
      env
    );

  const recipient =
    String(
      authUser?.email ||
        ""
    ).trim();

  if (!recipient) {
    return jsonResponse(
      {
        ok: false,
        error:
          "User email not found",
      },
      404
    );
  }

  const caseNumber =
    String(
      supportCase.case_number
    );

  let subject;
  let textBody;
  let htmlBody;

  if (
    emailType ===
    "admin_reply"
  ) {
    const message =
      String(
        body?.message ||
          ""
      ).trim();

    if (!message) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing message",
        },
        400
      );
    }

    if (
      message.length >
      5000
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Message is too long",
        },
        400
      );
    }

    subject =
      `[##${caseNumber}##] - XOXO Avenue Support replied`;

    textBody =
      [
        `XOXO Avenue Support replied to your case #${caseNumber}:`,
        "",
        message,
        "",
        "Warmly,",
        "XOXO Avenue Support 💜",
      ].join("\n");

    htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
  <p>
    XOXO Avenue Support replied to your case
    <strong>#${escapeHtml(
      caseNumber
    )}</strong>:
  </p>

  <div style="white-space:pre-wrap;margin:20px 0;padding:16px;background:#f6f4ff;border-radius:12px;">
${escapeHtml(message)}
  </div>

  <p>
    Warmly,<br>
    <strong>XOXO Avenue Support 💜</strong>
  </p>
</div>
`;
  } else {
    subject =
      `[##${caseNumber}##] - Message received!`;

    textBody =
      [
        "# This is an automated confirmation #",
        "",
        "Hey there,",
        "",
        "Thanks for reaching out! 🙂",
        "",
        `This is to confirm we received your message. Your support case number is #${caseNumber}.`,
        "",
        "We'll get back to you as soon as possible. You can reply directly to this email at any time to continue your conversation with XOXO Avenue Support. You can reply directly to this email at any time to continue your conversation with XOXO Avenue Support.",
        "",
        "Warmly,",
        "XOXO Avenue Support 💜",
      ].join("\n");

    htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
  <p style="font-weight:700;">
    # This is an automated confirmation #
  </p>

  <p>Hey there,</p>

  <p>Thanks for reaching out! 🙂</p>

  <p>
    This is to confirm we received your message.
    Your support case number is
    <strong>#${escapeHtml(
      caseNumber
    )}</strong>.
  </p>

  <p>
    We'll get back to you as soon as possible. You can reply directly to this email at any time to continue your conversation with XOXO Avenue Support.
  </p>

  <p>
    Warmly,<br>
    <strong>XOXO Avenue Support 💜</strong>
  </p>
</div>
`;
  }

  /*
   * IMPORTANT:
   * Each admin reply uses a case-specific
   * Reply-To address.
   */

  const result =
    await sendResendEmail(
      env,
      {
        from:
          "XOXO Avenue Support <support@xoxoavenue.com>",

        to: [
          recipient,
        ],

        reply_to:
          `case-${caseNumber}@reply.xoxoavenue.com`,

        subject,
        text:
          textBody,
        html:
          htmlBody,
      }
    );

  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Email delivery failed",
      },
      502
    );
  }

  return jsonResponse({
    ok: true,
    case_number:
      supportCase.case_number,
  });
}

/*
 * ==========================================
 * PRESENCE LOCATION
 * ==========================================
 */

async function handlePresenceLocation(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!env.SUPABASE_SECRET_KEY) {
    console.error("XOXO presence location: SUPABASE_SECRET_KEY is missing");
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500);
  }

  const signedInUser = await getAuthenticatedUser(request);

  if (!signedInUser?.id) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const countryCode = String(
    request.cf?.country || request.headers.get("CF-IPCountry") || ""
  ).trim().toUpperCase();

  let countryName = "";

  if (/^[A-Z]{2}$/.test(countryCode)) {
    try {
      countryName =
        new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || "";
    } catch (error) {
      console.error("XOXO country name lookup failed:", error);
    }
  }

  const ipAddress = String(
    request.headers.get("CF-Connecting-IP") || ""
  ).trim();

  const payload = {
    user_id: signedInUser.id,
    last_active_at: new Date().toISOString(),
    country_code: countryCode || null,
    country_name: countryName || null,
    ip_address: ipAddress || null,
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Content-Profile": "public",
        "Accept-Profile": "public",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    console.error(
      "XOXO presence location update failed:",
      response.status,
      await response.text()
    );

    return jsonResponse({ ok: false, error: "Presence update failed" }, 502);
  }

  return jsonResponse({
    ok: true,
    country_code: countryCode || null,
    country_name: countryName || null,
  });
}

/*
 * ==========================================
 * NEW PROFILE EMAIL NOTIFICATION
 * ==========================================
 */

async function handleNewProfileNotification(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!env.RESEND_API_KEY || !env.PROFILE_WEBHOOK_SECRET) {
    console.error("XOXO new profile notification secrets are missing");
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500);
  }

  const providedSecret = String(
    request.headers.get("X-XOXO-Webhook-Secret") || ""
  ).trim();
  const expectedSecret = String(env.PROFILE_WEBHOOK_SECRET || "").trim();

  if (!providedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const record = body?.record || body?.new || {};
  const username = String(record?.username || "").trim();
  const userId = String(record?.user_id || record?.id || "").trim();

  if (!username) {
    return jsonResponse({ ok: true, ignored: true, reason: "Profile has no username" });
  }

  let memberEmail = "";
  if (userId && env.SUPABASE_SECRET_KEY) {
    const authUser = await getAuthUserById(userId, env);
    memberEmail = String(authUser?.email || "").trim();
  }

  const displayUsername = username.startsWith("@") ? username : `@${username}`;
  const subject = `🎉 New XOXO Avenue member: ${displayUsername}`;
  const textBody = [
    "A new member completed their XOXO Avenue profile.",
    "",
    `Username: ${displayUsername}`,
    memberEmail ? `Email: ${memberEmail}` : "Email: Not available",
    "",
    "XOXO Avenue 💜",
  ].join("\n");

  const htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
  <h2>🎉 New XOXO Avenue member</h2>
  <p>A new member completed their XOXO Avenue profile.</p>
  <p><strong>Username:</strong> ${escapeHtml(displayUsername)}</p>
  <p><strong>Email:</strong> ${escapeHtml(memberEmail || "Not available")}</p>
  <p>XOXO Avenue 💜</p>
</div>`;

  const result = await sendResendEmail(env, {
    from: "XOXO Avenue Support <support@xoxoavenue.com>",
    to: ["xoxoavenuesupport@gmail.com"],
    subject,
    text: textBody,
    html: htmlBody,
  });

  if (!result.ok) {
    return jsonResponse({ ok: false, error: "Email delivery failed" }, 502);
  }

  return jsonResponse({ ok: true, notification_sent: true });
}


/*
 * ==========================================
 * INCOMPLETE PROFILE REMINDER
 * ==========================================
 */

async function handleProfileReminders(env) {
  if (!env.RESEND_API_KEY || !env.SUPABASE_SECRET_KEY) {
    console.error("XOXO profile reminder secrets are missing");
    return { ok: false, error: "Server configuration error" };
  }

  const pendingResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_pending_profile_reminders`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        "Content-Profile": "public",
      },
      body: "{}",
    }
  );

  if (!pendingResponse.ok) {
    console.error(
      "XOXO pending profile reminders lookup failed:",
      pendingResponse.status,
      await pendingResponse.text()
    );
    return { ok: false, error: "Reminder lookup failed" };
  }

  const pending = await pendingResponse.json();

  if (!Array.isArray(pending) || !pending.length) {
    return { ok: true, checked: 0, sent: 0 };
  }

  let sent = 0;

  for (const member of pending) {
    const userId = String(member?.user_id || "").trim();
    const recipient = String(member?.email || "").trim();

    if (!userId || !recipient) continue;

    const subject =
      "Complete your XOXO Avenue profile 💜 | Completa tu perfil";

    const textBody = [
      "Hi! 👋",
      "",
      "Your XOXO Avenue account is ready, but your profile is still waiting for you.",
      "",
      "Complete your profile so you can start discovering people and communities on XOXO Avenue.",
      "",
      "💜 Complete My Profile:",
      "https://xoxoavenue.com/",
      "",
      "See you there!",
      "XOXO Avenue 💜",
      "",
      "----------------------------------------",
      "",
      "¡Hola! 👋",
      "",
      "Tu cuenta de XOXO Avenue está lista, pero todavía falta completar tu perfil.",
      "",
      "Completa tu perfil para que puedas comenzar a descubrir personas y comunidades en XOXO Avenue.",
      "",
      "💜 Completar mi perfil:",
      "https://xoxoavenue.com/",
      "",
      "¡Nos vemos allí!",
      "XOXO Avenue 💜",
    ].join("\n");

    const htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
  <div style="padding:24px;border:1px solid #ece8ff;border-radius:18px;">
    <h2 style="margin-top:0;">Hi! 👋</h2>
    <p>Your XOXO Avenue account is ready, but your profile is still waiting for you.</p>
    <p>Complete your profile so you can start discovering people and communities on XOXO Avenue.</p>
    <p style="margin:24px 0;">
      <a href="https://xoxoavenue.com/" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#6c5ce7;color:#ffffff;text-decoration:none;font-weight:700;">💜 Complete My Profile</a>
    </p>
    <p>See you there!<br><strong>XOXO Avenue 💜</strong></p>

    <hr style="border:0;border-top:1px solid #ece8ff;margin:30px 0;">

    <h2>¡Hola! 👋</h2>
    <p>Tu cuenta de XOXO Avenue está lista, pero todavía falta completar tu perfil.</p>
    <p>Completa tu perfil para que puedas comenzar a descubrir personas y comunidades en XOXO Avenue.</p>
    <p style="margin:24px 0;">
      <a href="https://xoxoavenue.com/" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#6c5ce7;color:#ffffff;text-decoration:none;font-weight:700;">💜 Completar mi perfil</a>
    </p>
    <p>¡Nos vemos allí!<br><strong>XOXO Avenue 💜</strong></p>
  </div>
</div>`;

    // Reserve this user's one-time reminder atomically before contacting Resend.
    // Both automatic and manual reminders must use this same Supabase RPC.
    const claimResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/claim_profile_reminder`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Accept-Profile": "public",
          "Content-Profile": "public",
        },
        body: JSON.stringify({ p_user_id: userId, p_source: "automatic" }),
      }
    );
    if (!claimResponse.ok) {
      console.error("XOXO reminder claim failed:", userId, claimResponse.status);
      continue; // Never send if the reservation could not be verified.
    }
    const claimed = await claimResponse.json();
    if (claimed !== true) continue; // Already reserved or sent.

    const emailResult = await sendResendEmail(env, {
      from: "XOXO Avenue <support@xoxoavenue.com>",
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (!emailResult.ok) {
      console.error("XOXO profile reminder email failed for user:", userId);
      continue;
    }

    const markResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_reminder_emails?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Content-Profile": "public",
          "Accept-Profile": "public",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          sent_at: new Date().toISOString(),
        }),
      }
    );

    if (!markResponse.ok) {
      console.error(
        "XOXO profile reminder sent but could not be recorded:",
        userId,
        markResponse.status,
        await markResponse.text()
      );
      continue;
    }

    sent += 1;
  }

  return { ok: true, checked: pending.length, sent };
}


/*
 * ==========================================
 * DELETE ACCOUNT
 * ==========================================
 */

const XOXO_DELETE_CODE_TTL_MINUTES = 10;
const XOXO_DELETE_CODE_COOLDOWN_SECONDS = 90;

function xoxoServiceHeaders(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": "public",
    "Content-Profile": "public",
    ...extra,
  };
}

async function xoxoDeletionCodeHash(userId, code, env) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SUPABASE_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`xoxo-delete-v1:${userId}:${code}`)
  ));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function xoxoDeletionRpc(env, name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: xoxoServiceHeaders(env),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(`XOXO deletion RPC ${name} failed:`, response.status, await response.text());
    return { ok: false, value: null };
  }
  return { ok: true, value: await response.json() };
}

async function handleRequestDeletionCode(request, env) {
  if (request.method !== "POST") return jsonResponse({ok:false,error:"Method not allowed"},405);
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return jsonResponse({ok:false,error:"Server configuration error"},500);
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return jsonResponse({ok:false,error:"Unauthorized"},401);
  if (!user.email || !user.email_confirmed_at) return jsonResponse({ok:false,error:"Confirm your email before requesting account deletion"},403);

  const query = new URLSearchParams({user_id:`eq.${user.id}`,select:"created_at"});
  const priorResponse = await fetch(`${SUPABASE_URL}/rest/v1/xoxo_account_deletion_codes?${query}`, {
    headers: xoxoServiceHeaders(env),
  });
  if (!priorResponse.ok) return jsonResponse({ok:false,error:"Could not check verification status"},502);
  const priorRows = await priorResponse.json();
  const lastRequest = Date.parse(priorRows?.[0]?.created_at || "");
  if (Number.isFinite(lastRequest) && Date.now() - lastRequest < XOXO_DELETE_CODE_COOLDOWN_SECONDS * 1000) {
    return jsonResponse({ok:false,error:"Please wait before requesting another code",retry_after_seconds:Math.ceil((XOXO_DELETE_CODE_COOLDOWN_SECONDS*1000-(Date.now()-lastRequest))/1000)},429);
  }

  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const code = String(bytes[0] % 1000000).padStart(6,"0");
  const codeHash = await xoxoDeletionCodeHash(user.id,code,env);
  const now = new Date();
  const expiresAt = new Date(now.getTime()+XOXO_DELETE_CODE_TTL_MINUTES*60000);
  const store = await fetch(`${SUPABASE_URL}/rest/v1/xoxo_account_deletion_codes?on_conflict=user_id`, {
    method:"POST",
    headers:xoxoServiceHeaders(env,{Prefer:"resolution=merge-duplicates,return=minimal"}),
    body:JSON.stringify({user_id:user.id,code_hash:codeHash,expires_at:expiresAt.toISOString(),attempts:0,verified_at:null,created_at:now.toISOString()}),
  });
  if (!store.ok) {
    console.error("XOXO deletion code storage failed:",store.status,await store.text());
    return jsonResponse({ok:false,error:"Could not prepare verification code"},502);
  }

  const subject="Confirm account deletion | Confirma la eliminación de tu cuenta 💜";
  const plain=[
    "XOXO Avenue account deletion verification", "", `Your verification code is: ${code}`,
    "It expires in 10 minutes. If you did not request this, ignore this email.",
    "", "XOXO Avenue 💜", "", "------------------------------", "",
    "Verificación para eliminar tu cuenta de XOXO Avenue", "", `Tu código de verificación es: ${code}`,
    "Caduca en 10 minutos. Si no solicitaste esto, ignora este correo.","", "XOXO Avenue 💜"
  ].join("\n");
  const html=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#20202a;line-height:1.6;padding:24px;border:1px solid #eee7ff;border-radius:16px"><h2>Confirm account deletion 💜</h2><p>Use this code to confirm your request to permanently delete your XOXO Avenue account:</p><p style="font-size:34px;letter-spacing:7px;font-weight:700;text-align:center;color:#6c5ce7">${code}</p><p>This code expires in 10 minutes. If you did not request this, ignore this email.</p><hr style="border:0;border-top:1px solid #eee7ff;margin:28px 0"><h2>Confirma la eliminación de tu cuenta 💜</h2><p>Utiliza este código para confirmar tu solicitud de eliminar permanentemente tu cuenta de XOXO Avenue:</p><p style="font-size:34px;letter-spacing:7px;font-weight:700;text-align:center;color:#6c5ce7">${code}</p><p>El código caduca en 10 minutos. Si no solicitaste esto, ignora este correo.</p><p><strong>XOXO Avenue 💜</strong></p></div>`;
  const sent=await sendResendEmail(env,{from:"XOXO Avenue <support@xoxoavenue.com>",to:[user.email],subject,text:plain,html});
  if (!sent.ok) return jsonResponse({ok:false,error:"Could not send verification email. Please try again later"},502);
  return jsonResponse({ok:true,code_sent:true,expires_in_seconds:600});
}

async function handleVerifyDeletionCode(request,env) {
  if (request.method!=="POST") return jsonResponse({ok:false,error:"Method not allowed"},405);
  if (!env.SUPABASE_SECRET_KEY) return jsonResponse({ok:false,error:"Server configuration error"},500);
  const user=await getAuthenticatedUser(request);
  if (!user?.id) return jsonResponse({ok:false,error:"Unauthorized"},401);
  let payload;
  try { payload=await request.json(); } catch {return jsonResponse({ok:false,error:"Invalid JSON"},400);}
  const code=String(payload?.code||"").trim();
  if (!/^\d{6}$/.test(code)) return jsonResponse({ok:false,error:"Enter the 6-digit code"},400);
  const hash=await xoxoDeletionCodeHash(user.id,code,env);
  const verified=await xoxoDeletionRpc(env,"xoxo_verify_account_deletion_code",{p_user_id:user.id,p_code_hash:hash});
  if (!verified.ok) return jsonResponse({ok:false,error:"Verification unavailable"},502);
  if (verified.value!==true) return jsonResponse({ok:false,error:"Incorrect, expired or already used code"},400);
  return jsonResponse({ok:true,verified:true});
}

async function handleDeleteAccount(request, env) {
  if (request.method !== "POST") return jsonResponse({ok:false,error:"Method not allowed"},405);
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return jsonResponse({ok:false,error:"Server configuration error"},500);
  const signedInUser=await getAuthenticatedUser(request);
  if (!signedInUser?.id) return jsonResponse({ok:false,error:"Unauthorized"},401);
  const userId=String(signedInUser.id).trim();
  const recipient=String(signedInUser.email||"").trim();

  // Fail closed: a verified, unexpired code is mandatory; consume once.
  const claim=await xoxoDeletionRpc(env,"xoxo_consume_account_deletion_code",{p_user_id:userId});
  if (!claim.ok) return jsonResponse({ok:false,error:"Could not validate email verification"},502);
  if (claim.value!==true) return jsonResponse({ok:false,error:"Verify the email code before deleting your account"},403);

  const cleanupResponse=await fetch(`${SUPABASE_URL}/rest/v1/rpc/xoxo_delete_account_data`,{
    method:"POST",headers:xoxoServiceHeaders(env),body:JSON.stringify({p_user_id:userId})
  });
  if (!cleanupResponse.ok) {
    const cleanupError=await cleanupResponse.text();
    console.error("XOXO delete account cleanup failed:",cleanupResponse.status,cleanupError);
    const adminProtected=cleanupError.includes("Administrator accounts cannot be deleted here");
    return jsonResponse({ok:false,error:adminProtected?"Administrator accounts cannot be deleted here":"Account data cleanup failed"},adminProtected?403:500);
  }
  const deleteAuthResponse=await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{
    method:"DELETE",headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`}
  });
  if (!deleteAuthResponse.ok) {
    console.error("XOXO Auth user deletion failed:",deleteAuthResponse.status,await deleteAuthResponse.text());
    return jsonResponse({ok:false,error:"Account deletion failed"},500);
  }
  let farewellEmailSent=false;
  if (recipient) {
    const subject="Your XOXO Avenue account has been deleted 💜 | Tu cuenta ha sido eliminada";
    const textBody=["Hi!","","Your XOXO Avenue account has been successfully deleted.","Thank you for being part of our community.","If you ever decide to come back, you'll always be welcome at XOXO Avenue. 💜","","Take care,","XOXO Avenue 💜","","----------------------------------------","","¡Hola!","","Tu cuenta de XOXO Avenue ha sido eliminada correctamente.","Gracias por haber formado parte de nuestra comunidad.","Si algún día decides regresar, siempre serás bienvenido/a a XOXO Avenue. 💜","","Cuídate,","XOXO Avenue 💜"].join("\n");
    const htmlBody=`<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;"><div style="padding:24px;border:1px solid #ece8ff;border-radius:18px;"><h2>Your XOXO Avenue account has been deleted 💜</h2><p>Your XOXO Avenue account has been successfully deleted.</p><p>Thank you for being part of our community.</p><p>If you ever decide to come back, you'll always be welcome at XOXO Avenue. 💜</p><p>Take care,<br><strong>XOXO Avenue 💜</strong></p><hr style="border:0;border-top:1px solid #ece8ff;margin:30px 0;"><h2>Tu cuenta de XOXO Avenue ha sido eliminada 💜</h2><p>Tu cuenta de XOXO Avenue ha sido eliminada correctamente.</p><p>Gracias por haber formado parte de nuestra comunidad.</p><p>Si algún día decides regresar, siempre serás bienvenido/a a XOXO Avenue. 💜</p><p>Cuídate,<br><strong>XOXO Avenue 💜</strong></p></div></div>`;
    const emailResult=await sendResendEmail(env,{from:"XOXO Avenue <support@xoxoavenue.com>",to:[recipient],subject,text:textBody,html:htmlBody});
    farewellEmailSent=emailResult.ok;
  }
  return jsonResponse({ok:true,deleted:true,farewell_email_sent:farewellEmailSent});
}


/*
 * ==========================================
 * ACTIVITY EMAILS - ALL VERIFIED USERS
 * ==========================================
 * Sending stays OFF until presence heartbeats have been deployed
 * and XOXO_ACTIVITY_EMAILS_ENABLED is explicitly set to "true".
 */
const XOXO_ACTIVITY_COOLDOWN_MS = 30 * 60 * 1000;
const XOXO_OFFLINE_AFTER_MS = 3 * 60 * 1000;
const XOXO_ACTIVITY_BATCH_SIZE = 30;

async function xoxoRestGet(env, table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: xoxoServiceHeaders(env),
  });
  if (!r.ok) throw new Error(`${table} lookup failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function xoxoMarkActivityDone(env, id, emailSent = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/xoxo_email_notification_queue?id=eq.${encodeURIComponent(id)}&processed_at=is.null`, {
    method: 'PATCH',
    headers: xoxoServiceHeaders(env, {Prefer: 'return=minimal'}),
    body: JSON.stringify(emailSent ? {processed_at: new Date().toISOString(), sent_at: new Date().toISOString()} : {processed_at: new Date().toISOString()}),
  });
  if (!r.ok) throw new Error(`Notification mark failed: ${r.status}`);
}

async function handleActivityPresenceHeartbeat(request, env) {
  if (request.method !== 'POST') return jsonResponse({ok:false,error:'Method not allowed'},405);
  if (!env.SUPABASE_SECRET_KEY) return jsonResponse({ok:false,error:'Server configuration error'},500);
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return jsonResponse({ok:false,error:'Unauthorized'},401);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`, {
    method:'POST',
    headers:xoxoServiceHeaders(env, {Prefer:'resolution=merge-duplicates,return=minimal'}),
    body:JSON.stringify({user_id:user.id,last_active_at:new Date().toISOString()}),
  });
  if (!r.ok) {
    console.error('XOXO activity heartbeat failed',r.status,await r.text());
    return jsonResponse({ok:false,error:'Presence update failed'},502);
  }
  return jsonResponse({ok:true});
}

function xoxoActivityEmailCopy(type) {
  const copy = {
    message: ['💬 New message on XOXO Avenue', 'You have a new private message.', 'Tienes un nuevo mensaje privado.'],
    like: ['❤️ New like on XOXO Avenue', 'Someone liked your post.', 'Alguien dio Me gusta a tu publicación.'],
    comment: ['💭 New comment on XOXO Avenue', 'Someone commented on your post.', 'Alguien comentó tu publicación.'],
    follow: ['👥 New follower on XOXO Avenue', 'Someone started following you.', 'Alguien comenzó a seguirte.'],
  };
  return copy[type] || null;
}

async function handleActivityEmailQueue(env) {
  // Explicit opt-in at deployment level. No emails until heartbeat support
  // is installed on the site and this flag is enabled intentionally.
  if (env.XOXO_ACTIVITY_EMAILS_ENABLED !== 'true') return {ok:true,disabled:true};
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return {ok:false,error:'Missing configuration'};

  const rows = await xoxoRestGet(env,'xoxo_email_notification_queue',
    `select=id,recipient_id,actor_id,notification_type,created_at&processed_at=is.null&order=created_at.asc&limit=${XOXO_ACTIVITY_BATCH_SIZE}`);
  let sent=0, skipped=0;
  for (const item of rows) {
    try {
      const typeCopy = xoxoActivityEmailCopy(item.notification_type);
      if (!typeCopy || !item.recipient_id) {
        await xoxoMarkActivityDone(env,item.id); skipped++; continue;
      }
      const userId = encodeURIComponent(item.recipient_id);
      const [prefs,presence,recent] = await Promise.all([
        xoxoRestGet(env,'xoxo_email_notification_preferences',`select=email_enabled&user_id=eq.${userId}&limit=1`),
        xoxoRestGet(env,'user_presence',`select=last_active_at&user_id=eq.${userId}&limit=1`),
        xoxoRestGet(env,'xoxo_email_notification_queue',`select=id&recipient_id=eq.${userId}&sent_at=gte.${encodeURIComponent(new Date(Date.now()-XOXO_ACTIVITY_COOLDOWN_MS).toISOString())}&limit=1`),
      ]);
      if (prefs[0]?.email_enabled === false || recent.length) {
        await xoxoMarkActivityDone(env,item.id); skipped++; continue;
      }
      // Fail closed when presence is missing or invalid. Never guess offline.
      const lastActive=Date.parse(presence[0]?.last_active_at || '');
      if (!Number.isFinite(lastActive)) {
        // Leave queued for later; do not send until a heartbeat exists.
        continue;
      }
      if (Date.now()-lastActive < XOXO_OFFLINE_AFTER_MS) {
        // Keep the notification pending while the recipient is online.
        // A later scheduled run can send it after the offline threshold.
        continue;
      }
      const authUser = await getAuthUserById(item.recipient_id,env);
      if (!authUser?.email || !authUser.email_confirmed_at) {
        await xoxoMarkActivityDone(env,item.id); skipped++; continue;
      }
      const [subject,en,es]=typeCopy;
      const textBody=`${en}\n\n${es}\n\nOpen XOXO Avenue / Abrir XOXO Avenue:\nhttps://xoxoavenue.com/\n\nXOXO Avenue 💜`;
      const htmlBody=`<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:560px;margin:auto"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(en)}</p><p>${escapeHtml(es)}</p><p><a href="https://xoxoavenue.com/">Open XOXO Avenue / Abrir XOXO Avenue</a></p><p>XOXO Avenue 💜</p></div>`;
      const result=await sendResendEmail(env,{
        from:'XOXO Avenue <support@xoxoavenue.com>',to:[authUser.email],subject,text:textBody,html:htmlBody,
      });
      if (!result.ok) {
        console.error('XOXO activity email send failed',item.id);
        continue;
      }
      await xoxoMarkActivityDone(env,item.id,true);
      sent++;
    } catch (err) {
      console.error('XOXO activity email processing failed',item.id,String(err));
    }
  }
  return {ok:true,checked:rows.length,sent,skipped};
}


/*
 * ==========================================
 * ADMIN EMAIL CENTER - VERIFIED RECIPIENTS
 * Read-only. No email sending.
 * ==========================================
 */
async function handleAdminEmailRecipients(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const adminId = "d9ea1914-fdba-465c-9700-5e640ff48763";
  const user = await getAuthenticatedUser(request);
  if (!user?.id) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (user.id !== adminId) {
    return jsonResponse({ ok: false, error: "Forbidden" }, 403);
  }

  // Forward the verified user's own JWT. Do NOT use the service-role
  // secret here: the SQL function checks auth.uid() for admin identity.
  const authorization = request.headers.get("Authorization") || "";
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/xoxo_admin_email_recipients`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: authorization,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        "Content-Profile": "public",
      },
      body: "{}",
    }
  );

  if (!response.ok) {
    console.error("XOXO Email Center recipient lookup failed", response.status);
    return jsonResponse({ ok: false, error: "Could not load recipients" }, 502);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    return jsonResponse({ ok: false, error: "Invalid recipient response" }, 502);
  }

  return jsonResponse({
    ok: true,
    recipients: rows.map(row => ({
      user_id: row.user_id,
      username: row.username,
      email: row.email,
      email_verified: row.email_verified === true,
      profile_completed: row.profile_completed === true,
    })),
  });
}

/*
 * ==========================================
 * MAIN WORKER
 * ==========================================
 */

export default {
  async scheduled(controller, env, ctx) {
    // Keep existing profile reminders on the original hourly schedule only.
    if (controller.cron === "0 * * * *") {
      ctx.waitUntil(handleProfileReminders(env));
      return;
    }

    // Queue processing is disabled unless the deployment flag is explicitly enabled
    // and XOXO_ACTIVITY_EMAILS_ENABLED is explicitly enabled.
    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(handleActivityEmailQueue(env));
      return;
    }
  },

  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

    if (url.pathname === "/api/admin-email-recipients") {
      return handleAdminEmailRecipients(request, env);
    }

    if (url.pathname === "/api/activity-presence-heartbeat") {
      return handleActivityPresenceHeartbeat(request, env);
    }


    /*
     * XML SITEMAP
     * Public entry point for Google Search Console.
     */

    if (url.pathname === "/sitemap.xml") {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://xoxoavenue.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

      return new Response(sitemap, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "X-XOXO-Worker": "sitemap",
        },
      });
    }


    /*
     * DELETE ACCOUNT
     */

    if (url.pathname === "/api/delete-account/request-code") {
      return handleRequestDeletionCode(request, env);
    }
    if (url.pathname === "/api/delete-account/verify-code") {
      return handleVerifyDeletionCode(request, env);
    }

    if (
      url.pathname ===
        "/api/delete-account"
    ) {
      return handleDeleteAccount(
        request,
        env
      );
    }

    /*
     * PRESENCE LOCATION
     */

    if (
      url.pathname ===
        "/api/presence-location"
    ) {
      return handlePresenceLocation(
        request,
        env
      );
    }

    /*
     * NEW PROFILE EMAIL NOTIFICATION
     */

    if (
      url.pathname ===
        "/api/new-profile-notification"
    ) {
      return handleNewProfileNotification(
        request,
        env
      );
    }

    /*
     * SUPPORT EMAIL API
     */

    if (
      url.pathname ===
      "/api/support-email"
    ) {
      return handleSupportEmail(
        request,
        env
      );
    }

    /*
     * INBOUND SUPPORT EMAIL WEBHOOK
     */

    if (
      url.pathname ===
      "/api/support-email-inbound"
    ) {
      return handleSupportEmailInbound(
        request,
        env
      );
    }

    /*
     * PUBLIC PROFILE IMAGE
     */

    const imageMatch =
      url.pathname.match(
        /^\/profile-preview-image\/([0-9a-fA-F-]+)$/
      );

    if (imageMatch) {
      const userId =
        decodeURIComponent(
          imageMatch[1]
        );

      return serveProfileImage(
        userId
      );
    }

    /*
     * NORMAL PAGE
     */

    const profileId =
      url.searchParams.get(
        "profile"
      );

    if (!profileId) {
      const response =
        await env.ASSETS.fetch(
          request
        );

      const headers =
        new Headers(
          response.headers
        );

      headers.set(
        "X-XOXO-Worker",
        "normal-page"
      );

      return new Response(
        response.body,
        {
          status:
            response.status,
          statusText:
            response.statusText,
          headers,
        }
      );
    }

    /*
     * LOAD PUBLIC PROFILE
     */

    const profile =
      await getPublicProfile(
        profileId
      );

    if (!profile) {
      const response =
        await env.ASSETS.fetch(
          request
        );

      const headers =
        new Headers(
          response.headers
        );

      headers.set(
        "X-XOXO-Worker",
        "profile-not-found"
      );

      return new Response(
        response.body,
        {
          status:
            response.status,
          statusText:
            response.statusText,
          headers,
        }
      );
    }

    /*
     * LOAD XOXO INDEX
     */

    const indexRequest =
      new Request(
        `${url.origin}/`,
        request
      );

    const assetResponse =
      await env.ASSETS.fetch(
        indexRequest
      );

    const contentType =
      assetResponse.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "text/html"
      )
    ) {
      const headers =
        new Headers(
          assetResponse.headers
        );

      headers.set(
        "X-XOXO-Worker",
        "profile-non-html"
      );

      return new Response(
        assetResponse.body,
        {
          status:
            assetResponse.status,
          statusText:
            assetResponse.statusText,
          headers,
        }
      );
    }

    /*
     * DYNAMIC PROFILE METADATA
     */

    const username =
      String(
        profile.username ||
          "@XOXOAvenue"
      ).trim();

    const metadata = {
      title:
        `${username} · XOXO Avenue`,

      description:
        makeDescription(
          profile
        ),

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
     * OPEN GRAPH / SOCIAL PREVIEW
     */

    const transformed =
      injectPreview(
        assetResponse,
        metadata
      );

    const headers =
      new Headers(
        transformed.headers
      );

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
        status:
          transformed.status,
        statusText:
          transformed.statusText,
        headers,
      }
    );
  },
};
