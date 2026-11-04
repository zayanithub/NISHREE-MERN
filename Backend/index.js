import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/DBconfig.js";
import {
  startNotificationDeliveryWorker,
  stopNotificationDeliveryWorker,
} from "./service/notificationDeliveryService.js";
import {
  startNotificationOutboxWorker,
  stopNotificationOutboxWorker,
} from "./service/notificationService.js";
import { validateRuntimeConfig } from "./config/runtimeConfig.js";
import mongoose from "mongoose";
import { verifyEmailTransport } from "./service/emailService.js";

const startServer = async () => {
  try {
    const { port } = validateRuntimeConfig();
    await connectDB();
    startNotificationDeliveryWorker();
    startNotificationOutboxWorker();

    const server = app.listen(port, () => {
      console.log(`Nishree Attire API running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
    });

    void verifyEmailTransport()
      .then(() => {
        console.log("SMTP connection and authentication verified.");
      })
      .catch((error) => {
        console.error(
          "SMTP verification failed; the API is available, but email delivery may be unavailable.",
          { code: error.code || "SMTP_VERIFY_FAILED" }
        );
      });

    let shutdownPromise = null;
    const shutdown = (signal) => {
      if (shutdownPromise) {
        return shutdownPromise;
      }
      console.log(`${signal} received. Closing server...`);
      shutdownPromise = (async () => {
        const forceExitTimer = setTimeout(() => {
          console.error("Graceful shutdown timed out.");
          process.exit(1);
        }, 30_000);
        try {
          server.closeIdleConnections?.();
          const serverClosed = new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          });
          await Promise.all([
            stopNotificationDeliveryWorker(),
            stopNotificationOutboxWorker(),
            serverClosed,
          ]);
          await mongoose.disconnect();
          console.log("HTTP server and database connections closed.");
        } catch (error) {
          console.error("Graceful shutdown failed:", error.message);
          process.exitCode = 1;
        } finally {
          clearTimeout(forceExitTimer);
        }
      })();
      return shutdownPromise;
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exitCode = 1;
  }
};

startServer();
