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

const validateSmtpConfig = (env, required) => {
  const smtpFields = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const configured = smtpFields.some(
    (field) => typeof env[field] === "string" && env[field].trim()
  );
  if (
    env.SMTP_SECURE !== undefined &&
    !["true", "false"].includes(String(env.SMTP_SECURE).toLowerCase())
  ) {
    throw new Error("SMTP_SECURE must be true or false.");
  }
  if (!required && !configured) {
    return;
  }

  const port = Number(env.SMTP_PORT);
  if (
    typeof env.SMTP_HOST !== "string" ||
    !env.SMTP_HOST.trim() ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    typeof env.SMTP_USER !== "string" ||
    !env.SMTP_USER.trim() ||
    typeof env.SMTP_PASS !== "string" ||
    !env.SMTP_PASS.trim()
  ) {
    throw new Error(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured with valid values."
    );
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
    validateSmtpConfig(env, true);
  } else {
    validateSmtpConfig(env, false);
  }

  return { port, sameSite };
};

export const runtimeConfigInternals = {
  isValidMongoUrl,
  requireHttpsUrl,
  validateSmtpConfig,
};
