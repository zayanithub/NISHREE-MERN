import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const frontendRoot = path.join(workspaceRoot, "Frontend");
const backendRoot = path.join(workspaceRoot, "Backend");

const readEnvValue = (contents, key) => {
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z\d_]*)\s*=\s*(.*)$/);
    if (!match || match[1] !== key) continue;
    const value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      return value.slice(1, value.lastIndexOf(value[0]));
    }
    return value.replace(/\s+#.*$/, "").trim();
  }
  return undefined;
};

const backendEnvPath = path.join(backendRoot, ".env");
const backendEnv = existsSync(backendEnvPath)
  ? readFileSync(backendEnvPath, "utf8")
  : "";
const frontendEnvPath = path.join(frontendRoot, ".env");
const frontendEnv = existsSync(frontendEnvPath)
  ? readFileSync(frontendEnvPath, "utf8")
  : "";
const configuredPort = readEnvValue(backendEnv, "PORT");
const backendPort = Number(process.env.PORT || configuredPort || 5000);

if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
  throw new Error("Backend PORT must be an integer between 1 and 65535.");
}

const backendUrl =
  process.env.VITE_BACKEND_URL ||
  readEnvValue(frontendEnv, "VITE_BACKEND_URL") ||
  `http://127.0.0.1:${backendPort}`;
let backendTarget;
try {
  backendTarget = new URL(backendUrl);
  if (!["http:", "https:"].includes(backendTarget.protocol)) throw new Error();
} catch {
  throw new Error("VITE_BACKEND_URL must be a valid HTTP or HTTPS URL.");
}
const healthUrl = new URL("/api/health", backendTarget);
const startupTimeout = Number(process.env.DEV_BACKEND_START_TIMEOUT_MS || 120_000);
const isLocalBackend =
  ["127.0.0.1", "localhost", "::1"].includes(backendTarget.hostname) &&
  Number(backendTarget.port || 80) === backendPort;

if (!Number.isInteger(startupTimeout) || startupTimeout < 1_000) {
  throw new Error("DEV_BACKEND_START_TIMEOUT_MS must be at least 1000.");
}

const checkBackendHealth = async () => {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(1_500),
    });
    const body = await response.json().catch(() => null);
    return {
      reachable: true,
      ready: response.ok && body?.database === "Connected",
      status: response.status,
      message: body?.message,
    };
  } catch {
    return { reachable: false, ready: false };
  }
};

let backendProcess = null;
let frontendProcess = null;
let stopping = false;

const waitForProcessExit = (child) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => child.once("exit", resolve));
};

const stop = async (signal, exitCode) => {
  if (stopping) return;
  stopping = true;

  const ownedProcesses = [frontendProcess, backendProcess].filter(Boolean);
  for (const child of ownedProcesses) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }

  const timeout = setTimeout(() => process.exit(exitCode), 10_000);
  timeout.unref();
  await Promise.all(ownedProcesses.map(waitForProcessExit));
  clearTimeout(timeout);
  process.exit(exitCode);
};

process.once("SIGINT", () => void stop("SIGINT", 130));
process.once("SIGTERM", () => void stop("SIGTERM", 143));

const waitForBackend = async (child) => {
  const deadline = Date.now() + startupTimeout;
  let processError = null;
  let exit = null;
  child?.once("error", (error) => {
    processError = error;
  });
  child?.once("exit", (code, signal) => {
    exit = { code, signal };
  });

  while (Date.now() < deadline) {
    if (processError) throw processError;
    if (exit) {
      throw new Error(
        `Backend exited before becoming healthy (code ${exit.code ?? "n/a"}, signal ${exit.signal ?? "none"}).`
      );
    }

    const health = await checkBackendHealth();
    if (health.ready) return;
    if (health.reachable && health.status !== 503) {
      throw new Error(
        `The service at ${healthUrl.origin} did not return the expected API health response.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Backend did not become healthy within ${startupTimeout}ms. Check MongoDB connectivity and Backend/.env.`
  );
};

try {
  const initialHealth = await checkBackendHealth();
  if (!initialHealth.ready) {
    if (!isLocalBackend && !initialHealth.reachable) {
      throw new Error(
        `The configured API at ${backendTarget.origin} is unavailable. Start it separately or configure VITE_BACKEND_URL to the local backend.`
      );
    }
    if (initialHealth.reachable) {
      console.log("Backend is responding; waiting for its database connection...");
    } else {
      console.log("Starting the Nishree Attire API...");
      backendProcess = spawn(process.execPath, ["index.js"], {
        cwd: backendRoot,
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "development",
        },
        stdio: "inherit",
      });
    }
    await waitForBackend(backendProcess);
  } else {
    console.log("Using the healthy Nishree Attire API already running.");
  }

  console.log("Starting the storefront...");
  frontendProcess = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
    {
      cwd: frontendRoot,
      env: {
        ...process.env,
        VITE_BACKEND_URL: backendUrl,
      },
      stdio: "inherit",
    }
  );

  frontendProcess.once("error", (error) => {
    console.error("Could not start the Vite development server:", error.message);
    void stop("SIGTERM", 1);
  });
  frontendProcess.once("exit", (code, signal) => {
    if (!stopping) void stop(signal || "SIGTERM", code ?? 1);
  });
} catch (error) {
  console.error(`Development startup failed: ${error.message}`);
  if (backendProcess && backendProcess.exitCode === null) {
    await stop("SIGTERM", 1);
  } else {
    process.exitCode = 1;
  }
}
