# Email, SMS, and WhatsApp delivery

Phase 17 queues transactional customer messages in `NotificationLog` and sends them from the backend worker started by `index.js`.

## Provider configuration

Configure these values in the deployment environment, not in source control:

```text
RESEND_API_KEY=
EMAIL_FROM=onboarding@resend.dev
FRONTEND_URL=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
PUBLIC_API_URL=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_VERSION=
WHATSAPP_TEMPLATE_LANGUAGE=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
WHATSAPP_TEMPLATE_WELCOME_UPDATE=
WHATSAPP_TEMPLATE_ORDER_UPDATE=
WHATSAPP_TEMPLATE_PAYMENT_UPDATE=
WHATSAPP_TEMPLATE_SHIPPING_UPDATE=
WHATSAPP_TEMPLATE_RETURN_UPDATE=
WHATSAPP_TEMPLATE_EXCHANGE_UPDATE=
WHATSAPP_TEMPLATE_REFUND_UPDATE=
WHATSAPP_TEMPLATE_PROMOTION_UPDATE=
```

Administrator sign-in also requires the Resend settings above. After a valid admin password, the server emails a one-time code to the administrator's registered email address. The code expires after 10 minutes, allows at most five attempts, and can be resent once per minute. Admin sign-in and resend requests also have an IP rate limit. Admin access and refresh cookies are issued only after the code is verified. If Resend is not configured, admin sign-in fails closed; configure a verified sender before deploying the admin portal.

The public contact form posts validated messages to `POST /api/v1/contact`. Messages are sent through the Resend HTTPS API to the support email configured in Store Details and use the sender's validated email as `Reply-To`. Requests are limited to five per IP per 15 minutes; the recipient and sender are never chosen freely by the request.

`PUBLIC_API_URL` is the externally reachable HTTPS API origin. Twilio status callbacks are sent to `/api/v1/notification-delivery-webhooks/twilio`; configure the same URL as the incoming-message webhook to receive STOP/START opt-outs. Configure Meta WhatsApp webhooks at `/api/v1/notification-delivery-webhooks/meta`, subscribe to the `messages` field, and use `WHATSAPP_WEBHOOK_VERIFY_TOKEN` during webhook verification. The Meta app secret validates webhook signatures.

Set `WHATSAPP_GRAPH_VERSION` to a Graph API version currently supported by Meta. Each configured `WHATSAPP_TEMPLATE_*` value must name an approved WhatsApp template whose body accepts exactly one text parameter. Use separate provider-approved templates for each notification key.

## Customer preferences and delivery behavior

- Transactional email is enabled by default and can be disabled with `emailNotifications`.
- Transactional SMS and WhatsApp are disabled by default. Customers must explicitly enable `smsNotifications` or `whatsappNotifications`; numbers must be in E.164 format.
- Promotional delivery also requires the corresponding `promotionalEmail`, `promotionalSms`, or `promotionalWhatsapp` opt-in.
- Channel permissions are checked again immediately before sending. A STOP/START webhook updates channel preferences, so a queued message can be suppressed if consent is withdrawn before delivery.
- Provider credentials, sender identities, WhatsApp template approvals, recipient consent, and production webhook URLs must be configured and tested in the provider consoles before enabling SMS or WhatsApp preferences.

Customers manage preferences through `GET/PATCH /api/v1/notifications/preferences`. Admins with notification permissions can inspect templates at `GET /api/v1/admin/notifications/templates` and create or update a channel template with `PUT /api/v1/admin/notifications/templates/:key/:channel`. Template variables are restricted to names provided by the server (`title`, `message`, and `actionUrl`).

## Retries and operations

Temporary provider errors are retried up to five attempts with capped exponential delays. Resend 429 and 5xx responses are retryable; permanent provider/configuration errors are marked failed. Email notification retries reuse a stable Resend idempotency key. Admins can inspect deliveries at `GET /api/v1/admin/notifications/deliveries` and request retry at `POST /api/v1/admin/notifications/deliveries/:deliveryId/retry`.

A notification marked `sent` records provider acceptance and a Resend message ID, not confirmed inbox delivery. Check Resend message logs or configure delivery event webhooks if final delivery/bounce status is needed.

If a worker stops while a provider outcome is unknown, the delivery becomes `uncertain` instead of being retried automatically. Check the provider first; an admin must explicitly submit `{ "confirmUnknownOutcome": true }` to retry and accept the risk of duplicate delivery. A signed provider callback can reconcile an uncertain SMS or WhatsApp delivery to its final status.

Admin template/log endpoints require the seeded `notifications.read` or `notifications.update` RBAC permissions. Run `npm run seed:roles` from `Backend` after deployment.
