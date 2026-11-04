# Security audit logging

## Admin audit API

`GET /api/v1/admin/audit-logs` requires an active administrator with the
`audit_logs.read` permission. Seed the permission and grant it to `super_admin`
after deployment by running `npm run seed:roles` from `Backend`.

Supported query parameters:

- `page` (default `1`) and `limit` (default `25`, maximum `100`)
- `actorType`: `admin`, `customer`, or `system`
- `action`, `resource`, and `status` (`success` or `failure`)
- `from` and `to`: ISO timestamps with timezone; the requested range is limited
  to 90 days. With no dates, the API returns the last 30 days.

The response is newest-first and includes pagination and the effective date
range. Audit `changes` output is restricted to HTTP method and response status
code. Request bodies, authorization headers, passwords, and refresh tokens are
not captured.

## Events captured

- Authenticated admin mutations and failed admin API requests, including
  permission-denied requests after authentication
- Admin login and refresh success/failure and logout events

The audit middleware writes after the HTTP response completes. Audit storage
errors are explicitly logged and do not change the result of the business
request. This is best-effort request auditing; durable transactional event
delivery and replay are outside this phase.

Admin login is limited to 10 requests per IP in a 15-minute window using the
process-local limiter store. Horizontally scaled deployments should configure a
shared rate-limit store before relying on this limit across instances.
