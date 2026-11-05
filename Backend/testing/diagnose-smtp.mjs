import "dotenv/config";
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import {
  getEmailTransportErrorDetails,
  sendTransactionalEmail,
  verifyEmailTransport,
} from "../service/emailService.js";

const TIMEOUT_MS = 10_000;
const host = process.env.SMTP_HOST?.trim();
const port = Number(process.env.SMTP_PORT);
const secure =
  process.env.SMTP_SECURE === undefined
    ? port === 465
    : process.env.SMTP_SECURE.toLowerCase() === "true";
const results = {
  configuration: {
    hostConfigured: Boolean(host),
    port: Number.isInteger(port) ? port : null,
    secure,
    userConfigured: Boolean(process.env.SMTP_USER),
    passwordConfigured: Boolean(process.env.SMTP_PASS),
    senderSource: process.env.MAIL_FROM
      ? "MAIL_FROM"
      : process.env.SMTP_FROM
        ? "SMTP_FROM"
        : process.env.SMTP_USER
          ? "SMTP_USER fallback"
          : "missing",
  },
  stages: {},
};

const recordFailure = (stage, error) => {
  results.stages[stage] = {
    ok: false,
    ...getEmailTransportErrorDetails(error),
  };
};

const waitForEvent = (emitter, eventName, timeoutMs = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(Object.assign(new Error("Timed out."), { code: "ETIMEDOUT" }));
    }, timeoutMs);
    const onEvent = (...args) => {
      cleanup();
      resolve(args);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      emitter.removeListener(eventName, onEvent);
      emitter.removeListener("error", onError);
    };
    emitter.once(eventName, onEvent);
    emitter.once("error", onError);
  });

const readReply = (socket) =>
  new Promise((resolve, reject) => {
    let response = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(Object.assign(new Error("SMTP greeting timed out."), {
        code: "ETIMEDOUT",
        command: "CONN",
      }));
    }, TIMEOUT_MS);
    const onData = (chunk) => {
      response += chunk.toString("utf8");
      const lines = response.split(/\r\n/);
      const firstLine = lines.find((line) => /^\d{3}[- ]/.test(line));
      const code = firstLine?.slice(0, 3);
      const finalLine = code && lines.find((line) => line.startsWith(`${code} `));
      if (!finalLine) return;
      cleanup();
      resolve({ code: Number(code), lines });
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
    };
    socket.on("data", onData);
    socket.once("error", onError);
  });

const connectTcp = () =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(Object.assign(new Error("TCP connection timed out."), {
        code: "ETIMEDOUT",
        command: "CONN",
      }));
    }, TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const establishGreetingAndTls = async () => {
  let socket;
  try {
    if (secure) {
      socket = tls.connect({
        host,
        port,
        servername: host,
        rejectUnauthorized: true,
      });
      await waitForEvent(socket, "secureConnect");
      results.stages.tls = { ok: true, mode: "implicit TLS" };
    } else {
      socket = net.createConnection({ host, port });
      await waitForEvent(socket, "connect");
    }

    const greeting = await readReply(socket);
    if (greeting.code !== 220) {
      throw Object.assign(new Error("SMTP server returned an invalid greeting."), {
        code: "SMTP_GREETING_REJECTED",
        responseCode: greeting.code,
        command: "CONN",
      });
    }
    results.stages.greeting = { ok: true, responseCode: greeting.code };

    if (!secure) {
      socket.write("EHLO smtp-diagnostic.invalid\r\n");
      const ehlo = await readReply(socket);
      if (ehlo.code !== 250) {
        throw Object.assign(new Error("SMTP EHLO was rejected."), {
          code: "SMTP_EHLO_REJECTED",
          responseCode: ehlo.code,
          command: "EHLO",
        });
      }

      const supportsStartTls = ehlo.lines.some((line) =>
        /\bSTARTTLS\b/i.test(line)
      );
      if (!supportsStartTls) {
        results.stages.tls = {
          ok: false,
          code: "STARTTLS_NOT_ADVERTISED",
          category: "tls",
          message: "The SMTP server did not advertise STARTTLS.",
        };
        return;
      }

      socket.write("STARTTLS\r\n");
      const startTls = await readReply(socket);
      if (startTls.code !== 220) {
        throw Object.assign(new Error("SMTP server refused STARTTLS."), {
          code: "STARTTLS_REJECTED",
          responseCode: startTls.code,
          command: "STARTTLS",
        });
      }
      const tlsSocket = tls.connect({
        socket,
        servername: host,
        rejectUnauthorized: true,
      });
      await waitForEvent(tlsSocket, "secureConnect");
      socket = tlsSocket;
      results.stages.tls = { ok: true, mode: "STARTTLS" };
    }
  } finally {
    socket?.destroy();
  }
};

const validateConfiguration = () => {
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    results.stages.configuration = {
      ok: false,
      code: "SMTP_CONFIG_MISSING",
      category: "configuration",
      message:
        "Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in this runtime.",
    };
    return false;
  }
  results.stages.configuration = { ok: true };
  return true;
};

const run = async () => {
  if (!validateConfiguration()) return;

  try {
    const addresses = await dns.lookup(host, { all: true });
    results.stages.dns = {
      ok: addresses.length > 0,
      addressCount: addresses.length,
      addressFamilies: [...new Set(addresses.map(({ family }) => family))],
    };
  } catch (error) {
    recordFailure("dns", error);
  }

  if (results.stages.dns?.ok) {
    try {
      await connectTcp();
      results.stages.tcp = { ok: true };
    } catch (error) {
      recordFailure("tcp", error);
    }

    if (results.stages.tcp?.ok) {
      try {
        await establishGreetingAndTls();
      } catch (error) {
        const stage = results.stages.tls ? "greeting" : "tls";
        recordFailure(stage, error);
      }
    }
  } else {
    results.stages.tcp = { skipped: true, reason: "DNS failed." };
    results.stages.greeting = { skipped: true, reason: "DNS failed." };
    results.stages.tls = { skipped: true, reason: "DNS failed." };
  }

  try {
    await verifyEmailTransport();
    results.stages.authentication = {
      ok: true,
      message: "Nodemailer transporter.verify() succeeded.",
    };
  } catch (error) {
    recordFailure("authentication", error);
  }

  if (process.argv.includes("--send-test-email")) {
    const recipient = process.env.SMTP_DIAGNOSTIC_TO?.trim();
    if (
      process.env.SMTP_DIAGNOSTIC_ENV !== "staging" ||
      !recipient ||
      !results.stages.authentication?.ok
    ) {
      results.stages.testEmail = {
        ok: false,
        code: "STAGING_OPT_IN_REQUIRED",
        message:
          "Test sending requires SMTP_DIAGNOSTIC_ENV=staging, SMTP_DIAGNOSTIC_TO, and successful SMTP verification.",
      };
    } else {
      try {
        const info = await sendTransactionalEmail({
          to: recipient,
          subject: "Nishree Attire staging SMTP diagnostic",
          text: "This is an explicitly requested staging-only SMTP delivery test.",
          html: "<p>This is an explicitly requested staging-only SMTP delivery test.</p>",
        });
        const accepted = Array.isArray(info.accepted)
          ? info.accepted.some(
              (address) => String(address).toLowerCase() === recipient.toLowerCase()
            )
          : false;
        results.stages.testEmail = {
          ok: accepted,
          relayAcceptedRecipient: accepted,
          messageId: info.messageId || null,
          note: "Relay acceptance is not proof of inbox delivery.",
          ...(!accepted
            ? {
                code: "SMTP_RECIPIENT_NOT_ACCEPTED",
                message: "The SMTP relay did not accept the test recipient.",
              }
            : {}),
        };
      } catch (error) {
        recordFailure("testEmail", error);
      }
    }
  }

  const failed = Object.values(results.stages).some(
    (stage) => stage.ok === false
  );
  console.log(JSON.stringify(results, null, 2));
  if (failed) process.exitCode = 1;
};

await run();
