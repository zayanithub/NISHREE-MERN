const isMongoConnectivityError = (error) => {
  const name = String(error?.name || "");
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return /Mongo(?:ServerSelection|Network|NotConnected|NetworkTimeout)/i.test(name)
    || ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENETUNREACH"].includes(code)
    || /server monitor timeout|connection .*interrupted|topology was destroyed|not connected to mongodb/i.test(message);
};

export const createPollingBackoff = ({
  baseDelayMs = 2_000,
  maxDelayMs = 60_000,
  logIntervalMs = 60_000,
} = {}) => {
  let failures = 0;
  let nextAttemptAt = 0;
  let lastErrorKey = "";
  let lastLoggedAt = Number.NEGATIVE_INFINITY;

  return {
    shouldPoll(now = Date.now()) {
      return now >= nextAttemptAt;
    },
    failed(error, now = Date.now()) {
      failures += 1;
      const exponent = Math.min(failures - 1, 20);
      const delayMs = Math.min(maxDelayMs, baseDelayMs * (2 ** exponent));
      const errorKey = `${error?.name || "Error"}:${error?.code || ""}:${error?.message || String(error)}`;
      const shouldLog = errorKey !== lastErrorKey || now - lastLoggedAt >= logIntervalMs;
      nextAttemptAt = now + delayMs;
      if (shouldLog) {
        lastErrorKey = errorKey;
        lastLoggedAt = now;
      }
      return { attempt: failures, delayMs, shouldLog };
    },
    succeeded() {
      failures = 0;
      nextAttemptAt = 0;
      lastErrorKey = "";
      lastLoggedAt = Number.NEGATIVE_INFINITY;
    },
    getState() {
      return { failures, nextAttemptAt, lastErrorKey, lastLoggedAt };
    },
  };
};

export { isMongoConnectivityError };
