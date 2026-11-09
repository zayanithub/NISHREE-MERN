# Nishree Attire storefront

This Vite application is the customer storefront for the existing Nishree Attire Express API. The UI uses the local saree and atelier images in `src/assets`; production product data, cart pricing, coupons, customer accounts and order states come from the backend.

For production Vercel and Render configuration, verification and rollback, see the [deployment guide](../DEPLOYMENT.md).

## Run locally

From `Frontend`, run:

```powershell
npm.cmd run dev
```

This command checks the API health endpoint, starts the backend from `../Backend` if needed, waits until its database is connected, and then starts Vite. Stop it with Ctrl+C to stop any processes it started. If the API is already healthy, it is reused and is not stopped with Vite. The proxy defaults to `http://127.0.0.1:5000`; set `VITE_BACKEND_URL` in the frontend environment to use a different API origin. The backend's `FRONTEND_URL` should be `http://localhost:5173` when requests bypass the Vite proxy.

`VITE_API_BASE_URL` is browser-visible and must contain an API origin/path only; never put credentials or private keys in a `VITE_` variable. Production builds use `/api/v1` and the Vercel rewrite in `vercel.json` proxies `/api/*` to the Render API, keeping refresh and guest-cart cookies first-party on `nishree.in`. Keep the Vercel project root set to `Frontend` so this rewrite is applied. Set backend `FRONTEND_URL=https://nishree.in`; direct cross-origin API clients also require CORS. Local development uses the Vite `/api` proxy and backend `FRONTEND_URL=http://localhost:5173`. Resend credentials and email sending are backend-only; an email provider outage does not prevent the API from starting.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```

The frontend package does not define a unit-test script. See [API_INTEGRATION.md](./API_INTEGRATION.md) for the verified backend contracts and integration boundaries.

## Sample catalogue and product photography

Run `npm.cmd run seed:products -- --dry-run` and then `npm.cmd run seed:products` from `../Backend` to add the idempotent 50-product sample catalogue. The sample inventory starts at zero and must be confirmed and stocked in Admin before products can be ordered. Read [the backend setup notes](../Backend/README.md) for image credits, seed behavior and admin setup.

The homepage opens with a short, reduced-motion-aware Nishree Attire wordmark reveal. The earlier Saree Reveal gallery and its feature-only asset helper have been removed.

## Saree collections

The secondary category navigation and collection landing pages are driven by [`src/data/collectionCatalog.js`](./src/data/collectionCatalog.js). Add or edit a collection there to set its route slug, parent, description, SEO copy, imagery and product query; every entry is served through the reusable `/collections/:slug` page. Product queries use existing category slugs, catalogue tags, material fields or product text. Only map a subcategory to a source when the catalogue supports that classification; otherwise its collection stays empty until matching products are added. Silk-cotton subcategories are maintained under Silk Cotton rather than duplicated under Cotton.

The collection template reuses the storefront product cards and product-list API. Product filters and pagination remain URL-backed; the API supports featured/newest/name/price sorting and in-stock/out-of-stock filtering.
