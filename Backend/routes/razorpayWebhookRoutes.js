import express, { Router } from "express";

import {
  razorpayWebhookController,
} from "../controllers/razorpayWebhookController.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Razorpay Webhook Route
|--------------------------------------------------------------------------
|
| This route must be mounted BEFORE express.json() in app.js.
|
| Razorpay signs the original raw request body.
| Do not parse the body before capturing it.
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),

  (req, res, next) => {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "A valid raw JSON webhook body is required.",
      });
    }

    // Preserve the original body for signature verification.
    req.rawBody = req.body;

    return next();
  },

  razorpayWebhookController
);

export default router;