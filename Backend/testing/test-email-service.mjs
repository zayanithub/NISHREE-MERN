import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {
  getEmailTransportErrorDetails,
  verifyEmailTransport,
} from "../service/emailService.js";

test("classifies common SMTP failures without exposing provider messages", () => {
  const cases = [
    ["ETIMEDOUT", "timeout"],
    ["ECONNECTION", "connection"],
    ["ECONNREFUSED", "connection_refused"],
    ["EACCES", "egress_denied"],
    ["ENOTFOUND", "dns"],
    ["EAUTH", "authentication"],
    ["EPROTOCOL", "tls"],
    ["ESOCKET", "tls"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "tls"],
  ];

  for (const [code, category] of cases) {
    const details = getEmailTransportErrorDetails({
      code,
      command: "AUTH PLAIN",
      responseCode: 535,
      message: code === "ESOCKET"
        ? "TLS certificate validation failed"
        : "sensitive provider response and password",
    });
    assert.equal(details.code, code);
    assert.equal(details.category, category);
    assert.equal(details.responseCode, 535);
    assert.equal(details.command, "AUTH PLAIN");
    assert.equal(JSON.stringify(details).includes("password"), false);
  }
});

test("reports a useful timeout diagnosis without swallowing Nodemailer errors", async (t) => {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "test-only-password",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const timeout = Object.assign(new Error("Connection timeout"), {
    code: "ETIMEDOUT",
    command: "CONN",
  });
  t.mock.method(nodemailer, "createTransport", () => ({
    verify: async () => {
      throw timeout;
    },
  }));

  await assert.rejects(verifyEmailTransport(), (error) => {
    assert.equal(error, timeout);
    const details = getEmailTransportErrorDetails(error);
    assert.equal(details.code, "ETIMEDOUT");
    assert.equal(details.category, "timeout");
    assert.match(details.message, /outbound firewall rules/);
    assert.equal(details.command, "CONN");
    return true;
  });
});

test("marks a timed-out SMTP DATA transaction as an unknown delivery outcome", async (t) => {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "test-only-password",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const isolatedEmailService = await import(
    "../service/emailService.js?smtp-data-timeout-test"
  );
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => {
      throw Object.assign(new Error("Connection timeout"), {
        code: "ETIMEDOUT",
        command: "DATA",
      });
    },
  }));
  await assert.rejects(
    isolatedEmailService.sendTransactionalEmail({
      to: "test-recipient@example.test",
      subject: "SMTP timeout test",
      text: "SMTP timeout test.",
      html: "<p>SMTP timeout test.</p>",
    }),
    (error) => {
      assert.equal(error.code, "ETIMEDOUT");
      assert.equal(error.outcomeUnknown, true);
      assert.equal(error.retryable, true);
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /SMTP operation timed out/);
      return true;
    }
  );
});

test("uses SMTP_FROM only when MAIL_FROM is not configured", async (t) => {
  const keys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "MAIL_FROM",
  ];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "test-only-password",
    SMTP_FROM: "Nishree <verified@example.test>",
  });
  delete process.env.MAIL_FROM;
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const isolatedEmailService = await import(
    "../service/emailService.js?smtp-from-alias-test"
  );
  let sentMessage;
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async (message) => {
      sentMessage = message;
      return { messageId: "smtp-from-alias-test" };
    },
  }));
  await isolatedEmailService.sendTransactionalEmail({
    to: "test-recipient@example.test",
    subject: "SMTP sender configuration test",
    text: "SMTP sender alias test.",
    html: "<p>SMTP sender alias test.</p>",
  });
  assert.equal(sentMessage.from, "Nishree <verified@example.test>");
});
