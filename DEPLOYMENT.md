# Nishree production deployment and troubleshooting

This project deploys the React/Vite storefront on Vercel and the Express API on Render. The browser uses the same-origin `/api/v1` path; `Frontend/vercel.json` proxies `/api/*` to Render and sends application routes to the Vite SPA.

## 1. Render backend

In the Render dashboard, open the existing Nishree backend web service and confirm:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `Backend` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

The API trusts one proxy hop so Express and `express-rate-limit` can derive the
client IP from Render's `X-Forwarded-For` header. Keep the service reachable
through Render's proxy; do not increase this hop count without verifying the
proxy chain, since trusting extra hops can allow clients to spoof their IP.

Set or verify these environment variables in the Render service. Enter secrets directly in Render; never commit them or add them to Vercel.

| Variable | Value / guidance |
| --- | --- |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://nishree.in` (origin only; no trailing slash) |
| `MONGO_URL` | Existing production MongoDB URI; do not replace the database |
| `JWT_ACCESS_SECRET` | A private random secret, at least 32 bytes. Rotating it signs out active users. |
| `COOKIE_SAME_SITE` | `lax` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web application client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Backend-only Google OAuth client secret; never add to Vercel or a `VITE_` variable |
| `GOOGLE_CALLBACK_URL` | `https://nishree.in/api/v1/auth/google/callback` (same-origin Vercel API proxy) |
| `RESEND_API_KEY` | Backend-only Resend API key with email-sending permission |
| `EMAIL_FROM` | `onboarding@resend.dev` for supported tests, or an address at your verified production domain |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name, required for persistent uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `PUBLIC_API_URL` | `https://nishree-mern-backend.onrender.com` when provider callbacks need the public API origin |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Matching keys from the intended Razorpay mode; keep the secret only on Render |
| `RAZORPAY_WEBHOOK_SECRET` | The same webhook signing secret configured in Razorpay |

Keep the existing production values for credentials and optional notification providers. Do not copy example or test values over working production settings. Render supplies `PORT`; do not hardcode a different port.

Create a Google OAuth 2.0 **Web application** client and add the exact production callback URL from `GOOGLE_CALLBACK_URL` to its authorized redirect URIs. Use the storefront's same-origin `/api/v1` proxy for the production callback so the OAuth state cookie is set and returned on the same host; the Vercel rewrite forwards the callback to Render. Set all three Google variables in Render. For local development, use `http://localhost:5000/api/v1/auth/google/callback` as the callback and configure the local frontend origin in `FRONTEND_URL`. The API handles the authorization code exchange and Google ID-token verification; the client secret must never be exposed to the browser. After Google verifies an account identity, the customer must also verify a one-time code sent through the existing Resend HTTPS API before an application session is issued.

### Fix `JWT_ACCESS_SECRET must contain at least 32 bytes`

This is a Render environment-variable issue, not a database migration or frontend setting. Generate a fresh value locally in PowerShell; the command prints a 48-byte random value:

```powershell
node -p "require('node:crypto').randomBytes(48).toString('base64url')"
```

In the Render service, open **Environment**, set `JWT_ACCESS_SECRET` to that value exactly (no quotes or spaces), save, and let Render redeploy. Do not post the generated value in chat, commit it, or add it to Vercel. Changing the signing secret invalidates existing access tokens, so users and admins may need to sign in again. Verify the deploy logs no longer contain the startup validation error and `/api/health` returns 200 with the database connected.

### Fix npm's `Unknown env config "cache-dir"` warning

The repository has no `.npmrc` setting this option, so check the Render service's **Environment** for `NPM_CONFIG_CACHE_DIR` or `npm_config_cache_dir` and remove it. npm's supported setting is `cache`, not `cache-dir`; Render already manages its build cache. Save and redeploy. This warning is separate from the backend crash and does not itself prevent `npm ci` from succeeding.

After changing environment variables, save them and wait for the Render deploy to finish. Check the service logs for startup/database/email errors, then confirm:

```text
https://nishree-mern-backend.onrender.com/api/health
```

It should return HTTP 200 and `"database":"Connected"`.

### Email OTP troubleshooting

Customer signup, Google sign-in, and administrator sign-in send a one-time email code. Normal customer sign-in with email and password uses no additional OTP. If Resend authentication or request acceptance fails for a signup, Google sign-in, or admin OTP, that flow cannot complete even while MongoDB and `/api/health` are healthy. Check the backend's Resend API key, sender verification, recipient restrictions, and quota in Render's environment and the Resend dashboard. Never paste the API key into a support chat or browser-visible variable. A Resend API acceptance is not proof of inbox delivery.

The API returns HTTP 503 when a signup or admin OTP email cannot be delivered; the failed OTP challenge is revoked. Check the backend log event `email.send.failed` for the sanitized provider status: `RESEND_API_KEY_INVALID` with provider HTTP 401 means the API key is invalid/inactive, while `RESEND_SENDER_REJECTED` with provider HTTP 403 usually means the sender domain is unverified or the recipient is not permitted. The Resend test sender `onboarding@resend.dev` only allows sending to your own Resend account email. Customer signup verification and admin sign-in require a verified domain for arbitrary recipients; a public mailbox sender such as Gmail is not supported. Update both values in Render, then restart/redeploy. Invalid credentials should return 401, and malformed login input should return 400.

### Resend API diagnostics

An HTTP health check confirms the API and database, not email provider connectivity. Run `npm run resend:diagnose` from `Backend` to check only whether the key and sender are configured. For an explicit staging-only email test, set `RESEND_DIAGNOSTIC_ENV=staging` and `RESEND_DIAGNOSTIC_TO` to a dedicated test inbox, then run `npm run resend:diagnose -- --send-test-email`. The script never prints credentials; a successful response confirms Resend accepted the request, not that it reached the inbox. Check the recipient mailbox and Resend message logs separately.

The Resend Free transactional plan currently allows 3,000 emails per month and 100 per day (including inbound email usage), with a 10-requests-per-second team rate limit. HTTP 429 and provider 5xx failures are retried by the existing notification worker with bounded backoff; permanent errors are not. Confirm current quotas in the Resend dashboard before rollout.

## 2. Vercel storefront

In Vercel, open the project serving `nishree.in` and confirm:

| Setting | Value |
| --- | --- |
| Git Repository | `zayanithub/NISHREE-MERN` |
| Production Branch | `main` |
| Root Directory | `Frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

The Vercel project root must be `Frontend` so Vercel reads `Frontend/vercel.json`. Trigger a deployment from the latest `main` commit after changing project settings. No API secret or `VITE_` credential is needed in Vercel; production API requests use same-origin `/api/v1`.

Confirm `nishree.in` is assigned to this Vercel project and the deployment is marked **Ready**. Open deployment build logs if it fails.

## 3. Safe verification

After both services are ready:

1. Open `https://nishree.in/api/health`; expect HTTP 200 and a connected database.
2. Open `https://nishree.in/login`, a collection URL, a product URL, and `/admin/login` directly, then refresh each. Expect the storefront to load, not a hosting 404/503.
3. In browser developer tools, confirm API calls use `https://nishree.in/api/v1/...`, not localhost or a direct cross-site API hostname.
4. Confirm product images load and the browser has no CORS or failed-request errors.
5. Test signup/admin OTP with authorized test accounts and inboxes, and test customer login with email/password only. Do not create real orders, refunds, or inventory changes as a connectivity test.
6. Only test payment-provider callbacks with the provider's test mode and a controlled test order.

The deployed API's `OPTIONS` preflight should allow `https://nishree.in` with credentials and the requested authorization/content headers. Keep Render `FRONTEND_URL` aligned with that exact origin.

## 4. Rollback

- **Vercel:** use the Deployments page to promote the last known-good frontend deployment.
- **Render:** redeploy the last known-good backend deploy. Preserve its environment variables.
- Avoid database resets, destructive seeds, and schema changes during rollback. The frontend and backend changes in this repository do not require a database migration.

If a failure persists, capture its timestamp, page/API path, HTTP status, and request/deploy identifier from the browser or Render logs. Redact cookies, OTPs, authorization headers, email addresses, and all secret values before sharing logs.
