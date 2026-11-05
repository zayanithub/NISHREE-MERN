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
| `SMTP_HOST` | Your configured SMTP host (for Gmail, `smtp.gmail.com`) |
| `SMTP_PORT` | `465` for implicit TLS, or the port specified by your SMTP provider |
| `SMTP_SECURE` | `true` for port 465; otherwise match the provider's TLS setup |
| `SMTP_USER` | Verified sender account |
| `SMTP_PASS` | Valid SMTP credential/app password; do not use an account's normal password |
| `MAIL_FROM` | Optional verified sender; defaults to `SMTP_USER` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name, required for persistent uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `PUBLIC_API_URL` | `https://nishree-mern-backend.onrender.com` when provider callbacks need the public API origin |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Matching keys from the intended Razorpay mode; keep the secret only on Render |
| `RAZORPAY_WEBHOOK_SECRET` | The same webhook signing secret configured in Razorpay |

Keep the existing production values for credentials and optional notification providers. Do not copy example or test values over working production settings. Render supplies `PORT`; do not hardcode a different port.

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

### Login OTP troubleshooting

Customer and administrator sign-in send a one-time email code after credentials are validated. If SMTP authentication or delivery fails, the login cannot complete even while MongoDB and `/api/health` are healthy. Check Render logs at the time of the attempt and confirm `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS` are correct for the sender. A Gmail sender generally needs a Google app password with 2-step verification enabled. Never paste SMTP credentials into a support chat or browser-visible variable.

The API returns HTTP 503 with a retryable message when the customer OTP email cannot be delivered; the failed OTP challenge is revoked. Invalid credentials should return 401, and malformed login input should return 400.

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
5. Test customer/admin OTP with authorized test accounts and inboxes. Do not create real orders, refunds, or inventory changes as a connectivity test.
6. Only test payment-provider callbacks with the provider's test mode and a controlled test order.

The deployed API's `OPTIONS` preflight should allow `https://nishree.in` with credentials and the requested authorization/content headers. Keep Render `FRONTEND_URL` aligned with that exact origin.

## 4. Rollback

- **Vercel:** use the Deployments page to promote the last known-good frontend deployment.
- **Render:** redeploy the last known-good backend deploy. Preserve its environment variables.
- Avoid database resets, destructive seeds, and schema changes during rollback. The frontend and backend changes in this repository do not require a database migration.

If a failure persists, capture its timestamp, page/API path, HTTP status, and request/deploy identifier from the browser or Render logs. Redact cookies, OTPs, authorization headers, email addresses, and all secret values before sharing logs.
