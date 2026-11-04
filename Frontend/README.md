# Nishree Attire storefront

This Vite application is the customer storefront for the existing Nishree Attire Express API. The UI uses the local saree and atelier images in `src/assets`; production product data, cart pricing, coupons, customer accounts and order states come from the backend.

## Run locally

From `Frontend`, run:

```powershell
npm.cmd run dev
```

This command checks the API health endpoint, starts the backend from `../Backend` if needed, waits until its database is connected, and then starts Vite. Stop it with Ctrl+C to stop any processes it started. If the API is already healthy, it is reused and is not stopped with Vite. The proxy defaults to `http://127.0.0.1:5000`; set `VITE_BACKEND_URL` in the frontend environment to use a different API origin. The backend's `FRONTEND_URL` should be `http://localhost:5173` when requests bypass the Vite proxy.

`VITE_API_BASE_URL` is browser-visible and must contain an API origin/path only; never put credentials or private keys in a `VITE_` variable. For production, use same-site storefront/API hosts and set backend `FRONTEND_URL` to the storefront origin: the current backend refresh cookies are `SameSite=Lax` and have no configurable cookie-domain setting. SMTP is checked after the API starts so a mail-provider outage does not make the API unavailable; email delivery will still report its own failures.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```

The frontend package does not define a unit-test script. See [API_INTEGRATION.md](./API_INTEGRATION.md) for the verified backend contracts and integration boundaries.

## Sample catalogue and product photography

Run `npm.cmd run seed:products -- --dry-run` and then `npm.cmd run seed:products` from `../Backend` to add the idempotent 50-product sample catalogue. The sample inventory starts at zero and must be confirmed and stocked in Admin before products can be ordered. Read [the backend setup notes](../Backend/README.md) for image credits, seed behavior and admin setup.

The homepage opens with a short, reduced-motion-aware Nishree Attire wordmark reveal. The earlier Saree Reveal gallery and its feature-only asset helper have been removed.
