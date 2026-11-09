const isValidMongoUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return ["mongodb:", "mongodb+srv:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const requireHttpsUrl = (value, name) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be an HTTPS URL.`);
  }
  try {
    if (new URL(value).protocol === "https:") {
      return;
    }
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  throw new Error(`${name} must be an HTTPS URL.`);
};

const isValidEmailAddress = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/.test(
    value
  );

const validateResendConfig = (env, required) => {
  const apiKey =
    typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  const apiKeyConfigured =
    /^re_[A-Za-z0-9_-]+$/.test(apiKey) &&
    !/^re_your_new_api_key$/i.test(apiKey);
  const senderConfigured =
    typeof env.EMAIL_FROM === "string" && env.EMAIL_FROM.trim();

  if (!required && !apiKeyConfigured && !senderConfigured) {
    return;
  }
  if (!apiKeyConfigured || !senderConfigured) {
    throw new Error(
      "RESEND_API_KEY and EMAIL_FROM must both be configured for email delivery."
    );
  }
  if (!isValidEmailAddress(env.EMAIL_FROM)) {
    throw new Error("EMAIL_FROM must be a valid email address.");
  }
};

export const validateRuntimeConfig = (env = process.env) => {
  const port = Number(env.PORT ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const sameSite = String(env.COOKIE_SAME_SITE || "lax").toLowerCase();
  if (!["lax", "strict", "none"].includes(sameSite)) {
    throw new Error("COOKIE_SAME_SITE must be lax, strict, or none.");
  }
  if (env.NODE_ENV === "production") {
    if (!isValidMongoUrl(env.MONGO_URL)) {
      throw new Error("A valid MONGO_URL is required in production.");
    }
    if (
      typeof env.JWT_ACCESS_SECRET !== "string" ||
      Buffer.byteLength(env.JWT_ACCESS_SECRET, "utf8") < 32
    ) {
      throw new Error(
        "JWT_ACCESS_SECRET must contain at least 32 bytes in production."
      );
    }
    requireHttpsUrl(env.FRONTEND_URL, "FRONTEND_URL");
    if (env.PUBLIC_API_URL) {
      requireHttpsUrl(env.PUBLIC_API_URL, "PUBLIC_API_URL");
    }
    validateResendConfig(env, true);
  } else {
    validateResendConfig(env, false);
  }

  return { port, sameSite };
};

export const runtimeConfigInternals = {
  isValidMongoUrl,
  requireHttpsUrl,
  validateResendConfig,
};
