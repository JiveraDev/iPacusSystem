# TV Status Display Deployment

The TV display can run in two ways:

- Standalone PHP/HTML/JS folder for a subdomain document root.
- Existing React route inside the main iPawcus frontend.

Use the standalone folder when the hosting panel lets you point `status.ipawcus.com` directly to a folder.

## URLs

- Standalone TV folder: `Subdomain_folder`
- Standalone TV page: `https://status.ipawcus.com/`
- Main app TV page: `/status-display`
- API endpoint: `/status-display`
- API fallback alias: `/tv-status`
- Standalone local API wrapper: `/status.php`

## Files

- Standalone page: `Subdomain_folder/index.php`
- Standalone API: `Subdomain_folder/status.php`
- Standalone styles: `Subdomain_folder/assets/tv-display.css`
- Standalone script: `Subdomain_folder/assets/tv-display.js`
- Standalone config templates: `Subdomain_folder/.env.example` and `Subdomain_folder/config.example.php`
- Standalone Apache defaults: `Subdomain_folder/.htaccess`
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
- Section counts for now serving, payment, and waiting/scheduled lists

The endpoint does not expose owner names, contact numbers, complaints, or diagnosis text.

## Standalone Subdomain Setup

For `status.ipawcus.com`, point the subdomain document root to:

```text
Subdomain_folder
```

Recommended setup:

1. DNS: create `status.ipawcus.com`.
2. Hosting document root: point the subdomain to `Subdomain_folder`.
3. Copy `.env.example` to `.env` or `config.example.php` to `config.php`, then update the database credentials.
4. Open `https://status.ipawcus.com/status.php` and confirm it returns JSON with `"success":true`.
5. Open `https://status.ipawcus.com/` on the TV browser.

The standalone page fetches `status.php` from the same folder, so it does not need the React build or SPA rewrite rules.

## React Subdomain Setup

The original React display still works. For that approach, point `status.ipawcus.com` to the same deployed React build as the main frontend.

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

- `php -l Subdomain_folder/index.php`
- `php -l Subdomain_folder/status.php`
- `node --check Subdomain_folder/assets/tv-display.js`
- `php -l php/status_display.php`
- `php -l php/index.php`
- `npm run build`
- Open `/status-display` locally.
- Open `https://status.ipawcus.com/` after deployment.
- Confirm the TV page refreshes without manual reload.
- Confirm no owner names, phone numbers, complaints, or diagnosis text are visible.
