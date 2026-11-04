# Production testing and hardening

## Checks

- `npm test` runs all backend regression tests.
- `npm run check` runs `node --check` for every `.js` and `.mjs` file under
  `Backend`, excluding `node_modules`.
- `GET /api/health` and `GET /api/ready` report MongoDB readiness and are kept
  outside the general API rate limiter for health probes.
- The general API limiter allows 600 requests per IP per 15 minutes. Sensitive
  authentication, contact, and chatbot endpoints retain their stricter,
  route-specific limits.

## Production startup

The server validates `PORT`, `COOKIE_SAME_SITE`, and these production-only
requirements before opening the listener:

- `MONGO_URL` must use `mongodb://` or `mongodb+srv://`.
- `JWT_ACCESS_SECRET` must contain at least 32 UTF-8 bytes.
- `FRONTEND_URL` must be HTTPS.
- If configured, `PUBLIC_API_URL` must be HTTPS.

Configure credentials in the deployment environment or secret manager, never
in source control. The process handles `SIGINT` and `SIGTERM` by stopping
notification workers, closing HTTP connections, and disconnecting MongoDB.
Shutdown is forcefully bounded to 30 seconds.

## Notification event outbox

Customer notification events are stored idempotently in `NotificationOutbox`
before their in-app and channel-delivery work is processed. A database worker
claims events with an expiring lease, retries failures with exponential
backoff (up to eight attempts), and keeps exhausted events available for
administrator inspection and replay:

- `GET /api/v1/admin/notifications/outbox`
- `POST /api/v1/admin/notifications/outbox/:eventId/retry`

These routes require the existing `notifications.read` and
`notifications.update` permissions. The retry endpoint only accepts failed
events. Event processing is idempotent across the in-app notification and
per-channel delivery records, so a worker crash may repeat processing but
should not create duplicate records.

Notification events are currently persisted by the existing post-commit
workflow callbacks. This durable outbox recovers failures after the event has
been recorded, but the small interval between a business transaction commit
and its callback inserting the outbox event is not atomic. A strict
transactional-outbox guarantee requires adding each event insert to the same
database transaction as every emitting business workflow.

## Deployment notes

- The built-in API and admin-login rate limiters use process-local storage.
  Use a shared store before relying on limits across multiple instances.
- Run `npm run seed:roles` after deployment when newly seeded permissions have
  been added.
- Live email/SMS/WhatsApp delivery still requires valid provider credentials,
  approved provider templates, user consent, and public HTTPS callbacks as
  described in `NOTIFICATION-DELIVERY.md`.
