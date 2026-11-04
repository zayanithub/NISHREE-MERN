import nodemailer from "nodemailer";

let transporter;

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

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !SMTP_USER ||
    !SMTP_PASS
  ) {
    const error = new Error("SMTP configuration is incomplete or invalid.");
    error.retryable = false;
    error.code = "SMTP_CONFIG_MISSING";
    throw error;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    secure:
      process.env.SMTP_SECURE === undefined
        ? port === 465
        : process.env.SMTP_SECURE.toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
};

export const sendTransactionalEmail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
}) => {
  if (!to || !subject || !text || !html) {
    const error = new Error("Email recipient and content are required.");
    error.retryable = false;
    error.code = "EMAIL_PAYLOAD_INVALID";
    throw error;
  }

  const mailer = getTransporter();
  try {
    return await mailer.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (error) {
    error.retryable =
      !Number.isInteger(error.responseCode) ||
      (error.responseCode >= 400 && error.responseCode < 500);
    error.code = error.code || "SMTP_SEND_FAILED";
    throw error;
  }
};

export const verifyEmailTransport = async () => {
  const mailer = getTransporter();
  try {
    await mailer.verify();
  } catch (error) {
    error.code = error.code || "SMTP_VERIFY_FAILED";
    throw error;
  }
};
