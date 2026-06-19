# TV Status Display Deployment

The TV display is implemented inside the main iPawcus project. You do not need a separate React project.

## URLs

- TV page on the main app: `/status-display`
- TV page on the subdomain: `https://status.ipawcus.com/`
- API endpoint: `/status-display`
- API fallback alias: `/tv-status`

## Files

- Frontend page: `src/components/StatusDisplay/TVStatusDisplay.jsx`
- Frontend API service: `src/services/statusDisplayService.js`
- App route/subdomain detection: `src/App.jsx`
- Backend endpoint: `php/status_display.php`
- Backend router: `php/index.php`

## What It Shows

- Queue pets waiting or in service
- Today's pending/confirmed bookings
- Visit billing/payment status
- Completed pets for the current day
- Summary counters for waiting, in service, for payment, scheduled, and done today

The endpoint does not expose owner names, contact numbers, complaints, or diagnosis text.

## Subdomain Setup

For `status.ipawcus.com`, point the subdomain to the same deployed React build as the main frontend.

Recommended setup:

1. DNS: create `status.ipawcus.com`.
2. Hosting document root: point it to the same folder that serves the built frontend `index.html`.
3. Apache rewrite: keep SPA fallback enabled so unknown routes load `index.html`.
4. API env: make sure the frontend build has `VITE_API_BASE_URL` pointing to the PHP API, for example `https://api.ipawcus.com` or the deployed PHP base URL.
5. Upload the built frontend after running `npm run build`.
6. Upload the PHP backend with `php/status_display.php` included.
7. Open `https://status.ipawcus.com/` on the TV browser.

The app detects hostnames beginning with `status.` and renders the TV display at `/`, so the TV does not need `/status-display` in the address bar.

## Validation

- `php -l php/status_display.php`
- `php -l php/index.php`
- `npm run build`
- Open `/status-display` locally.
- Open `https://status.ipawcus.com/` after deployment.
- Confirm the TV page refreshes without manual reload.
- Confirm no owner names, phone numbers, complaints, or diagnosis text are visible.
