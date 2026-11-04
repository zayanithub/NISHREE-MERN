# Nishree Attire API

The API is the existing Express, Mongoose and MongoDB backend for the Vite storefront. Run these commands from `Backend`.

## Local development

```powershell
npm.cmd run dev
```

Copy `.env.example` to `.env` and set `MONGO_URL`, `JWT_ACCESS_SECRET`, and the SMTP credentials in the backend environment. Customer sign-in, email verification, password recovery, and transactional notifications are sent through Nodemailer. For Gmail, use an app password and `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, and `SMTP_SECURE=true`; `MAIL_FROM` is optional and defaults to `SMTP_USER`. `MAIL_LOGO_URL` can point to a public Nishree logo for branded email headers, and `SUPPORT_EMAIL` is shown in the template footer when configured. Production startup validates that the SMTP settings are present and well-formed. The API binds after connecting to MongoDB, then verifies SMTP in the background with bounded connection timeouts; an SMTP outage is reported but does not prevent the API from starting. Email-sending operations still return/log their delivery failures through the existing error-handling flow.

Never put database, JWT, or provider credentials in a `VITE_` variable.

Customer registration and sign-in return an email OTP challenge and do not create an authenticated session until the code is verified. Password recovery uses a separate OTP followed by a one-time, expiring password-reset token. OTPs expire after 10 minutes, allow at most five attempts, and are stored as keyed hashes.

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
