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

  for (const line of lines) {
    const trimmed = line.trim();

    /* Gmail / common mail-client reply separators. */
    if (
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

    /* A quoted block means the previous conversation begins here. */
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
  env
) {
  const payload = {
    case_id: supportCase.id,
    sender_id: senderId,
    sender_type: senderType,
    message: message,
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
    return {
      ok: false,
      status: response.status,
      error: responseText,
    };
  }

  return {
    ok: true,
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
      env
    );

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

    htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;">
  <p style="font-weight:700;">
    # This is an automated message. Please do not reply #
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
    We'll get back to you as soon as possible.
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
 * MAIN WORKER
 * ==========================================
 */

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

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
