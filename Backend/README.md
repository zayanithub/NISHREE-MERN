# Nishree Attire API

The API is the existing Express, Mongoose and MongoDB backend for the Vite storefront. Run these commands from `Backend`.

For production Render and Vercel configuration, OTP email troubleshooting, verification and rollback, see the [deployment guide](../DEPLOYMENT.md).

## Local development

```powershell
npm.cmd run dev
```

Copy `.env.example` to `.env` and set `MONGO_URL`, `JWT_ACCESS_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM`. Google sign-in is enabled only when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` are configured. Register the callback URL exactly in the Google Cloud OAuth client; locally it is `http://localhost:5000/api/v1/auth/google/callback`. In production, use the storefront proxy URL `https://nishree.in/api/v1/auth/google/callback` so the OAuth state cookie remains first-party. Keep the client secret on the backend, never in a `VITE_` variable. `RESEND_API_KEY` and the sender address are also backend-only. Production startup requires both Resend variables. Signup verification, Google sign-in verification, admin sign-in, password recovery, contact notifications, and transactional notifications use the centralized Resend HTTPS API service. Existing branded templates remain in place; `MAIL_LOGO_URL` and `SUPPORT_EMAIL` configure their optional branding/footer.

## Resend email setup and testing

1. Create a Resend account and generate a server-side API key with email-sending permissions from the [API Keys page](https://resend.com/api-keys). See the [Send Email API reference](https://resend.com/docs/api-reference/emails/send-email).
2. Put that key in `Backend/.env` as `RESEND_API_KEY`; configure `EMAIL_FROM=onboarding@resend.dev` for supported initial tests. The Resend test sender is restricted to your account's own address; sending to other recipients requires a verified domain and a sender at that domain. Do not commit `.env` or expose the key in frontend code.
3. For local work, run the backend from `Backend` with `npm.cmd run dev`. Use only a recipient allowed by your Resend account.
4. Automated email tests mock the Resend HTTPS request and do not send real messages. To send a deliberate staging test, configure `RESEND_DIAGNOSTIC_ENV=staging` and `RESEND_DIAGNOSTIC_TO` in the backend environment, then run `npm run resend:diagnose -- --send-test-email`. A successful API response means Resend accepted the request; it does not prove inbox delivery.
5. In production, add a domain you own in the Resend dashboard, publish the requested DNS records, wait for the domain to show as verified, and set `EMAIL_FROM` to an address at that verified domain (for example, `notifications@updates.example.com`). Store `RESEND_API_KEY` only in the backend deployment environment, such as Render, never in Vercel.
6. If admin login advances to OTP but no message arrives, Resend accepted the send request; this alone does not mean the recipient server delivered it. Check the displayed recipient and spam/promotions folders, then find the message ID from the backend `admin.otp.email.accepted` log in Resend Logs. For a Resend custom sending domain, compare the `resend._domainkey` TXT, `send` SPF TXT, and `send` MX records with the exact values shown in Resend. The sending MX should target Resend's `amazonses.com` feedback host and its SPF should authorize `amazonses.com`; do not replace root/inbound mail MX records. Check DMARC alignment if the receiving mailbox quarantines the message.
7. Run `npm run resend:diagnose-domain` to inspect the sender domain's public Resend DKIM, SPF, and return-path MX records. Domain verification still needs to be checked in Resend; a restricted send-only API key cannot query account-domain verification status.

The Free transactional plan currently includes 3,000 emails per month with a 100-email-per-day limit; both sent and received messages count against these quotas. It includes up to three verified domains and starts at a 10-requests-per-second team rate limit. Requests rejected with HTTP 429 or provider 5xx errors are retried by the existing notification worker with bounded backoff; permanent errors are not retried. See the [Resend quota documentation](https://resend.com/docs/knowledge-base/account-quotas-and-limits) and [pricing](https://resend.com/pricing) for current limits.

Troubleshooting:

- `RESEND_API_KEY_INVALID` (provider HTTP 401): create an active API key in the correct Resend account and update `RESEND_API_KEY` in the backend environment. Restart/redeploy the backend after changes.
- `RESEND_SENDER_REJECTED` (provider HTTP 403): `onboarding@resend.dev` is only suitable for sending to your own Resend account email. For customer OTPs, verify a domain you own in Resend and set `EMAIL_FROM` to an address at that domain (for example, `notifications@your-verified-domain.com`). A Gmail/Yahoo mailbox address is not a verified sending domain.
- `RESEND_REQUEST_REJECTED`: check the provider error in Resend's dashboard without exposing the API key; confirm the sender and recipient meet account restrictions.
- `RESEND_RATE_LIMITED`: reduce send volume and inspect the team's daily/monthly quota and request-rate limits.
- No request ID in logs: check backend network access to `https://api.resend.com` and the request timeout.
- Check the destination inbox and Resend message logs separately; an accepted request is not a delivery receipt.

Never put database, JWT, or provider credentials in a `VITE_` variable. Production frontend builds use a same-origin Vercel rewrite from `/api/*` to the Render API so browser refresh and guest-cart cookies remain first-party; set `FRONTEND_URL=https://nishree.in` for CORS. Local development uses `FRONTEND_URL=http://localhost:5173`.

Customer signup requires email OTP verification before an authenticated session is created. Verified customer accounts sign in directly with email and password; unverified accounts are denied until the signup code is verified. Google sign-in verifies Google's ID token on the backend and then requires a separate Resend email OTP before creating a customer session. Google users are matched by Google's verified email, and never receive admin privileges. Customer OTP resends are rate-limited. Admin sign-in continues to require email OTP, and admin permissions are loaded from the active database role on protected requests. Password recovery uses a separate OTP followed by a one-time, expiring password-reset token. OTPs expire after 10 minutes, allow at most five attempts, and are stored as keyed hashes.

Store policy content is managed through the authenticated Admin policy page and stored with the store settings record. Only published non-empty policy sections are shown to customers. Active checkout coupons are surfaced from the same eligibility data used by the server-side discount validator.

## Razorpay payment setup

Online payments require `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend environment. Use a matching pair from the same Razorpay account and mode (test or live); configure `RAZORPAY_WEBHOOK_SECRET` to the secret configured for the webhook endpoint. Restart the API after changing these values so the running process loads them. If order initialization reports that Razorpay rejected the server credentials, generate or copy a fresh matching key ID and secret from the Razorpay Dashboard for the selected mode, update the backend environment, and restart the API. Do not put the secret in a `VITE_` variable or share it in logs or chat. Missing keys return a clear `503` before creating a local payment attempt, so the customer can retry later without an order being stuck in an initializing state. The frontend never receives the key secret.

## Administrator setup

Create the RBAC roles and permissions, then create the first administrator:

```powershell
npm.cmd run seed:roles
npm.cmd run seed:admin
```

`seed:admin` reads `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the backend environment. It requires a password between 12 and 72 characters, hashes it with bcrypt, and does not change an existing administrator with the same email. Admin pages use the existing protected session and RBAC middleware.

## Customer profile photos

Registration accepts an optional JPG, PNG or WebP profile photo (maximum 2 MB) and shows a local preview before account creation. After the account session is established, the photo is uploaded to the existing Cloudinary storage architecture. The account page supports changing or removing a photo; customers and Admin customer records use the saved URL. The API checks file size, MIME type and image signature.

Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` on the backend to store photos. If Cloudinary is unavailable, account creation still completes and the customer is told they can upload later from their account page.

The authenticated admin workspace also includes **Homepage images**. It stores image metadata and ordering in MongoDB, and stores uploaded/replacement files in Cloudinary. The existing homepage artwork is seeded into MongoDB on the first homepage image request; its bundled image files live under `Frontend/public/homepage-images`. Uploads and replacements require the three Cloudinary environment variables above. Image management uses the admin `settings:read` and `settings:update` permissions.

## Sample saree catalogue

```powershell
npm.cmd run seed:products -- --dry-run
npm.cmd run seed:products
```

The dry run validates the 50 records without connecting to MongoDB. The normal command upserts 9 categories and 50 `NIA-SAMPLE-###` products by their unique slugs and SKUs. It creates missing product inventory records at quantity zero. Rerunning it never resets inventory or overwrites products already present, so product content and stock can be edited in Admin.

If the checked-in image mapping changes, `npm.cmd run seed:products -- --refresh-images` refreshes only image URLs, alt text and attribution. `npm.cmd run seed:products -- --refresh-sample-catalogue` refreshes the 50 sample product details and images from the seed file. Both options leave inventory quantities unchanged; the catalogue refresh can replace admin edits to those sample product records.

These listings are illustrative catalogue previews. Their prices, image matches, fabric details and availability are not verified stock. The site labels them as previews, and every seeded inventory quantity starts at zero. Confirm the real product, image, price and stock in Admin before offering it for purchase. Replace or remove the sample records when the verified catalogue is ready.

Product images are static files under `Frontend/public/catalogue-preview/`. The seed stores storefront-relative paths, so deploy those files with the frontend. Forty-three source images come from Wikimedia Commons; artist, license and source links are saved on the product and shown on its product page. Seven images come from the existing project asset library.

## Chatbot AI

See [CHATBOT.md](./CHATBOT.md) for the optional server-side OpenAI configuration and the FAQ fallback behavior.

## Checks

```powershell
npm.cmd run check
npm.cmd test
```

The unit suite does not contact a running API. To exercise the signed Razorpay webhook against a local backend separately, set `RAZORPAY_WEBHOOK_SECRET` and run:

```powershell
npm.cmd run test:webhook:local
```

The local integration check uses `http://localhost:5000/api/v1/payments/razorpay/webhook` by default. Set `RAZORPAY_WEBHOOK_TEST_URL` to target another local test server.

## Resend diagnostics

`npm run resend:diagnose` reports only whether the backend key and sender are configured; it does not make a provider request or send mail. Sending a test requires explicit staging-only opt-in and a dedicated `RESEND_DIAGNOSTIC_TO` inbox as described above.
