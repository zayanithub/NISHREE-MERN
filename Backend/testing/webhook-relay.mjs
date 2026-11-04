import http from "node:http";

const PORT = 5055;
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 5000;

const WEBHOOK_PATH = "/webhook";
const BACKEND_WEBHOOK_PATH =
  "/api/v1/payments/razorpay/webhook";

const MAX_BODY_BYTES = 1024 * 1024;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  res.end(JSON.stringify(payload));
};

/*
|--------------------------------------------------------------------------
| Read the original request body without modifying its bytes.
|--------------------------------------------------------------------------
*/

const readRawBody = async (req) => {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;

    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error(
        "Webhook body exceeds the allowed size."
      );

      error.statusCode = 413;

      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalBytes);
};

/*
|--------------------------------------------------------------------------
| Forward only the Razorpay webhook endpoint.
|--------------------------------------------------------------------------
|
| The relay does not expose arbitrary backend routes.
| The original body bytes and Razorpay signature headers
| are forwarded unchanged to the local backend.
|--------------------------------------------------------------------------
*/

const forwardWebhook = (rawBody, signature, eventId, res) => {
  const backendRequest = http.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: BACKEND_WEBHOOK_PATH,
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Content-Length": rawBody.length,
        "X-Razorpay-Signature": signature,
        "x-razorpay-event-id": eventId,
      },

      timeout: 5000,
    },

    (backendResponse) => {
      const responseChunks = [];
      let responseBytes = 0;

      backendResponse.on("data", (chunk) => {
        responseBytes += chunk.length;

        if (responseBytes > MAX_BODY_BYTES) {
          backendResponse.destroy(
            new Error("Backend response exceeded the allowed size.")
          );

          return;
        }

        responseChunks.push(chunk);
      });

      backendResponse.on("end", () => {
        if (res.writableEnded) {
          return;
        }

        const responseBody = Buffer.concat(
          responseChunks,
          responseBytes
        );

        res.writeHead(
          backendResponse.statusCode || 502,
          {
            "Content-Type":
              backendResponse.headers["content-type"] ||
              "application/json",

            "Cache-Control": "no-store",
          }
        );

        res.end(responseBody);
      });

      backendResponse.on("error", (error) => {
        console.error(
          "Backend response error:",
          error.message
        );

        if (!res.headersSent) {
          sendJson(res, 502, {
            success: false,
            message: "Webhook backend response failed.",
          });
        } else {
          res.destroy();
        }
      });
    }
  );

  backendRequest.on("timeout", () => {
    backendRequest.destroy(
      new Error("Backend webhook request timed out.")
    );
  });

  backendRequest.on("error", (error) => {
    console.error(
      "Webhook forwarding error:",
      error.message
    );

    if (!res.headersSent) {
      sendJson(res, 502, {
        success: false,
        message: "Local webhook backend is unavailable.",
      });
    } else {
      res.destroy();
    }
  });

  backendRequest.end(rawBody);
};

/*
|--------------------------------------------------------------------------
| Relay Request Handler
|--------------------------------------------------------------------------
*/

const server = http.createServer((req, res) => {
  void (async () => {
    /*
     * Health check for local testing.
     */
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        success: true,
        message: "Webhook relay is running.",
      });
    }

    /*
     * Only POST /webhook is allowed.
     */
    if (req.url !== WEBHOOK_PATH) {
      return sendJson(res, 404, {
        success: false,
        message: "Route not found.",
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");

      return sendJson(res, 405, {
        success: false,
        message: "Method not allowed.",
      });
    }

    /*
     * Reject incomplete webhook requests before forwarding.
     */
    const contentType = req.headers["content-type"];
    const signature =
      req.headers["x-razorpay-signature"];

    const eventId =
      req.headers["x-razorpay-event-id"];

    if (
      typeof contentType !== "string" ||
      !contentType.toLowerCase().startsWith(
        "application/json"
      )
    ) {
      return sendJson(res, 415, {
        success: false,
        message: "Content-Type must be application/json.",
      });
    }

    if (
      typeof signature !== "string" ||
      typeof eventId !== "string"
    ) {
      return sendJson(res, 400, {
        success: false,
        message: "Required Razorpay webhook headers are missing.",
      });
    }

    let rawBody;

    try {
      rawBody = await readRawBody(req);
    } catch (error) {
      return sendJson(
        res,
        error.statusCode || 400,
        {
          success: false,
          message:
            error.statusCode === 413
              ? "Webhook body is too large."
              : "Unable to read webhook request body.",
        }
      );
    }

    return forwardWebhook(
      rawBody,
      signature,
      eventId,
      res
    );
  })().catch((error) => {
    console.error(
      "Webhook relay error:",
      error.message
    );

    if (!res.headersSent) {
      sendJson(res, 500, {
        success: false,
        message: "Webhook relay failed.",
      });
    } else {
      res.destroy();
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Nishree webhook relay running at http://127.0.0.1:${PORT}`
  );

  console.log(
    `Only POST ${WEBHOOK_PATH} is forwarded to the backend.`
  );
});

server.on("error", (error) => {
  console.error(
    "Unable to start webhook relay:",
    error.message
  );

  process.exitCode = 1;
});