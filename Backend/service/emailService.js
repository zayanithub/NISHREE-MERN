import { Resend } from "resend";

const RESEND_API_URL = "https://api.resend.com";
const EMAIL_REQUEST_TIMEOUT_MS = 10_000;
const MAX_EMAIL_CONTENT_LENGTH = 1_000_000;
const EMAIL_PATTERN = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

const createEmailError = (message, code, statusCode, retryable = false) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.retryable = retryable;
  return error;
};

const isValidEmailAddress = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  EMAIL_PATTERN.test(value);

export const isTransactionalEmailConfigured = () => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return Boolean(
    typeof apiKey === "string" &&
      /^re_[A-Za-z0-9_-]+$/.test(apiKey) &&
      !/^re_your_new_api_key$/i.test(apiKey) &&
      isValidEmailAddress(process.env.EMAIL_FROM)
  );
};

export const getEmailDeliveryErrorDetails = (error) => ({
  code:
    typeof error?.code === "string" && /^[A-Z0-9_]+$/i.test(error.code)
      ? error.code
      : "EMAIL_DELIVERY_FAILED",
  category: error?.outcomeUnknown
    ? "outcome_unknown"
    : (error?.providerStatusCode ?? error?.statusCode) === 401 ||
        (error?.providerStatusCode ?? error?.statusCode) === 403
      ? "configuration"
      : (error?.providerStatusCode ?? error?.statusCode) === 429
        ? "rate_limit"
        : (error?.providerStatusCode ?? error?.statusCode) >= 500
          ? "provider"
          : error?.statusCode
            ? "request"
            : "network",
  ...(Number.isInteger(error?.statusCode)
    ? { statusCode: error.statusCode }
    : {}),
  ...(Number.isInteger(error?.providerStatusCode)
    ? { providerStatusCode: error.providerStatusCode }
    : {}),
  retryable: error?.retryable === true,
  outcomeUnknown: error?.outcomeUnknown === true,
});

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const safeLogoUrl = () => {
  if (!process.env.MAIL_LOGO_URL) return "";
  const logoUrl = new URL(process.env.MAIL_LOGO_URL);
  if (!["https:", "http:"].includes(logoUrl.protocol)) {
    throw new Error("MAIL_LOGO_URL must use HTTP or HTTPS.");
  }
  return logoUrl.toString();
};

export const renderBrandedEmail = ({
  title,
  body,
  preheader = "",
  otp = "",
  actionUrl = "",
  actionLabel = "View details",
}) => {
  const logoUrl = safeLogoUrl();
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replaceAll("\n", "<br>");
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Nishree Attire" width="54" height="54" style="display:block;margin:0 auto 10px;border-radius:8px;">`
    : "";
  const otpBlock = otp
    ? `<tr><td style="padding:4px 0 22px;"><div style="padding:20px 12px;border:1px solid #ead9c6;border-radius:10px;background:#fff9f4;text-align:center;"><span style="display:block;color:#786d66;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Your verification code</span><strong style="display:block;margin-top:8px;color:#4a1028;font-family:Arial,sans-serif;font-size:32px;letter-spacing:9px;">${escapeHtml(otp)}</strong><span style="display:block;margin-top:8px;color:#786d66;font-size:12px;">Valid for 10 minutes</span></div></td></tr>`
    : "";
  const action = actionUrl
    ? `<tr><td style="padding:8px 0 24px;text-align:center;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 24px;border-radius:5px;background:#4a1028;color:#fff9f4;font-size:13px;font-weight:bold;text-decoration:none;">${escapeHtml(actionLabel)}</a></td></tr>`
    : "";
  const supportEmail = process.env.SUPPORT_EMAIL || "";

  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>',
    '<body style="margin:0;padding:0;background:#f8e8e5;font-family:Arial,Helvetica,sans-serif;color:#282329;">',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8e8e5;padding:28px 12px;"><tr><td align="center">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border:1px solid #ead9c6;border-radius:12px;background:#fffdfb;overflow:hidden;">',
    '<tr><td style="padding:25px 20px;background:#4a1028;text-align:center;">',
    logo,
    '<span style="display:block;color:#fff9f4;font-family:Georgia,serif;font-size:19px;letter-spacing:4px;">NISHREE ATTIRE</span>',
    '<span style="display:block;margin-top:7px;color:#e7c995;font-size:9px;letter-spacing:2px;">ELEGANCE IN EVERY THREAD</span>',
    '</td></tr><tr><td style="padding:30px 32px 8px;">',
    `<h1 style="margin:0 0 16px;color:#4a1028;font-family:Georgia,serif;font-size:25px;font-weight:normal;line-height:1.3;">${safeTitle}</h1>`,
    `<p style="margin:0 0 22px;color:#554b48;font-size:14px;line-height:1.8;">${safeBody}</p>`,
    '</td></tr>',
    otpBlock,
    action,
    '<tr><td style="padding:0 32px 26px;"><p style="margin:0;color:#786d66;font-size:12px;line-height:1.7;">If you did not request this, you can ignore this message. For your security, never share a verification code with anyone.</p></td></tr>',
    `<tr><td style="padding:18px 24px;border-top:1px solid #ead9c6;background:#fff9f4;text-align:center;color:#786d66;font-size:11px;line-height:1.7;">Nishree Attire · Crafted for your moments${supportEmail ? `<br>Support: ${escapeHtml(supportEmail)}` : ""}</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join("");
};

export const sendVerificationCodeEmail = async ({
  to,
  otp,
  purpose,
  challengeId,
  otpHash,
  subject,
  title,
  preheader,
  body,
  text,
}) =>
  sendTransactionalEmail({
    to,
    subject,
    text,
    idempotencyKey: ["otp", purpose, challengeId, otpHash].join("-"),
    html: renderBrandedEmail({
      title,
      preheader,
      body,
      otp,
    }),
  });

export const sendTransactionalEmail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
  idempotencyKey,
}) => {
  if (
    !isValidEmailAddress(to) ||
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.length > 255 ||
    /[\r\n]/.test(subject) ||
    (typeof text !== "string" && typeof html !== "string") ||
    (text !== undefined &&
      (typeof text !== "string" ||
        !text.trim() ||
        text.length > MAX_EMAIL_CONTENT_LENGTH)) ||
    (html !== undefined &&
      (typeof html !== "string" ||
        !html.trim() ||
        html.length > MAX_EMAIL_CONTENT_LENGTH)) ||
    (replyTo !== undefined && !isValidEmailAddress(replyTo)) ||
    (idempotencyKey !== undefined &&
      (typeof idempotencyKey !== "string" ||
        !/^[a-zA-Z0-9._:-]{1,256}$/.test(idempotencyKey)))
  ) {
    throw createEmailError(
      "Email request parameters are invalid.",
      "EMAIL_PAYLOAD_INVALID",
      400
    );
  }

  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!isTransactionalEmailConfigured()) {
    throw createEmailError(
      "Email delivery is not configured.",
      "RESEND_CONFIG_MISSING",
      503
    );
  }

  const client = new Resend(RESEND_API_KEY.trim(), {
    baseUrl: RESEND_API_URL,
  });
  client.debug = false;
  try {
    const { data, error } = await client.emails.send(
      {
        from: EMAIL_FROM.trim(),
        to,
        subject,
        ...(text !== undefined ? { text } : {}),
        ...(html !== undefined ? { html } : {}),
        ...(replyTo ? { replyTo } : {}),
      },
      {
        signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }
    );

    if (error) {
      const statusCode = Number.isInteger(error.statusCode)
        ? error.statusCode
        : null;
      const retryable = statusCode === 429 || statusCode >= 500;
      const outcomeUnknown = statusCode === null;
      const failure = createEmailError(
        statusCode === 401
          ? "Resend rejected the API key. Check that the key is active and belongs to this account."
          : statusCode === 403
            ? "Resend rejected the sender or recipient. Use a verified sending domain; the test sender can only send to your own address."
          : statusCode === 429
            ? "Email provider rate limit reached."
            : outcomeUnknown
              ? "Email provider response could not be confirmed."
              : "Email provider rejected the request.",
        statusCode === 401
          ? "RESEND_API_KEY_INVALID"
          : statusCode === 403
            ? "RESEND_SENDER_REJECTED"
          : statusCode === 429
            ? "RESEND_RATE_LIMITED"
            : statusCode >= 500
              ? "RESEND_PROVIDER_UNAVAILABLE"
              : outcomeUnknown
                ? "RESEND_OUTCOME_UNKNOWN"
                : "RESEND_REQUEST_REJECTED",
        503,
        retryable
      );
      failure.outcomeUnknown = outcomeUnknown;
      failure.providerStatusCode = statusCode;
      throw failure;
    }

    if (typeof data?.id !== "string" || !data.id.trim()) {
      throw createEmailError(
        "Email provider returned an invalid response.",
        "RESEND_RESPONSE_INVALID",
        503
      );
    }

    console.info(
      JSON.stringify({
        event: "email.send.accepted",
        provider: "resend",
        messageId: data.id,
      })
    );
    return {
      accepted: true,
      messageId: data.id,
    };
  } catch (error) {
    const safeError =
      error?.code && error?.statusCode
        ? error
        : createEmailError(
            "Email provider request failed.",
            "RESEND_NETWORK_ERROR",
            503
          );
    if (!safeError.code) safeError.code = "RESEND_NETWORK_ERROR";
    if (!safeError.statusCode) safeError.statusCode = 503;
    if (safeError.retryable !== true) safeError.retryable = false;
    if (safeError.code === "RESEND_NETWORK_ERROR") {
      safeError.outcomeUnknown = true;
    }
    console.error(
      JSON.stringify({
        event: "email.send.failed",
        provider: "resend",
        ...getEmailDeliveryErrorDetails(safeError),
      })
    );
    throw safeError;
  }
};
