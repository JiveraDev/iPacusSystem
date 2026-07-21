# iPawcus Deployment Upload Materials Format

Updated: 2026-07-21

This guide describes the folder format and upload contents for deploying iPawcus to a live domain. It does not include private passwords, API keys, database passwords, mail passwords, or real client records.

## 1. Recommended Domain Layout

Use one main domain and optional subdomains:

| Hostname | Purpose | Recommended document root |
| --- | --- | --- |
| `ipawcus.com` | React frontend, PWA files, public app shell | `domains/ipawcus.com/public_html` |
| `ipawcus.com/php/index.php` or `ipawcus.com/api` | PHP API when hosted under the same main domain | `domains/ipawcus.com/public_html/php` |
| `api.ipawcus.com` | Optional separate PHP API subdomain | `domains/api.ipawcus.com/public_html` |
| `status.ipawcus.com` | Optional standalone TV status display | `domains/status.ipawcus.com/public_html` |
| `meet.ipawcus.com` | Optional video meeting server | Outside this repository |

Use either same-domain API hosting or API subdomain hosting. Do not mix both unless the frontend `VITE_API_BASE_URL` is intentionally rebuilt for that setup.

## 2. Build Package From Local Workspace

From the project root:

```powershell
npm install
npm run build
```

The deployable frontend package is:

```text
dist/
```

The deployable PHP backend source is:

```text
php/
```

The optional standalone TV package is:

```text
Subdomain_folder/
```

## 3. Frontend Upload Format

Upload the contents of `dist/` into the frontend document root.

Target:

```text
domains/ipawcus.com/public_html/
```

Expected uploaded frontend files:

```text
public_html/
  index.html
  .htaccess
  assets/
  favicon.svg
  icons.svg
  ipawcus-push-sw.js
  pwa/
    manifest.webmanifest
    offline.html
    icons/
  uploads/
  pet_profile_images/
  signatures/
  payments/
  payment_qr/
  concerns/
```

Important upload rule:

- For a first deployment, upload all `dist/` contents.
- For later deployments, do not delete live upload folders before copying the new build.
- Do not use an FTP sync mode that deletes server-only files inside upload/media folders.

The live media folders may contain production files uploaded by users, such as profile photos, payment proofs, signatures, concern photos, and medical attachments.

## 4. Same-Domain API Upload Format

Use this if the frontend and PHP API live under the same domain.

Target:

```text
domains/ipawcus.com/public_html/php/
```

Upload:

```text
php/*  ->  public_html/php/
```

Recommended frontend API value before building:

```env
VITE_API_BASE_URL=https://ipawcus.com/php/index.php
```

Alternative if using the root rewrite rule:

```env
VITE_API_BASE_URL=https://ipawcus.com/api
```

For same-domain hosting, upload the repository root `.htaccess` to:

```text
domains/ipawcus.com/public_html/.htaccess
```

Reason: the repository root `.htaccess` contains the frontend fallback plus PHP/API and public media rewrite rules. The `dist/.htaccess` file is frontend-only.

## 5. API Subdomain Upload Format

Use this if `api.ipawcus.com` points to its own document root.

Target:

```text
domains/api.ipawcus.com/public_html/
```

Upload the contents of `php/` directly into that document root:

```text
php/index.php     -> public_html/index.php
php/config.php    -> public_html/config.php
php/*.php         -> public_html/*.php
```

Recommended frontend API value before building:

```env
VITE_API_BASE_URL=https://api.ipawcus.com/index.php
```

If the API subdomain has an Apache rewrite rule that routes all requests to `index.php`, this may also work:

```env
VITE_API_BASE_URL=https://api.ipawcus.com
```

Only use the shorter value after confirming that `https://api.ipawcus.com/login` routes to the PHP router.

## 6. Environment File Placement

Do not upload local development secrets blindly. Create a server `.env` with production values only.

Same-domain API layout:

```text
domains/ipawcus.com/public_html/
  .env
  php/
    config.php
```

API subdomain layout:

```text
domains/api.ipawcus.com/
  .env
  public_html/
    config.php
```

Why: `php/config.php` loads `.env` from one directory above the PHP folder. For an API subdomain, placing `.env` above `public_html` keeps it outside the web root.

Minimum production env categories:

```env
VITE_API_BASE_URL=https://your-api-url
PWAACTIVATOR=FALSE

DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...

FRONTEND_ORIGIN=https://ipawcus.com

MAIL_HOST=...
MAIL_PORT=...
MAIL_ENCRYPTION=...
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=...
MAIL_FROM_NAME="Vetfocus Animal Care Clinic"
MAIL_REPLY_TO=...

OTP_SECRET=...
NOTIFICATION_REMINDER_KEY=...

PUSH_VAPID_PUBLIC_KEY=...
PUSH_VAPID_PRIVATE_KEY=...
PUSH_VAPID_SUBJECT=...
```

`PWAACTIVATOR` is read at frontend build time. If you change it, rebuild and redeploy `dist/`.

| Value | Behavior |
| --- | --- |
| `PWAACTIVATOR=FALSE` | Hide the PWA install button and disable PWA app-shell caching. |
| `PWAACTIVATOR=TRUE` | Show the PWA install button and enable manifest/iOS tags and offline app-shell caching. |

## 7. Uploads And Writable Folders

These folders must remain writable by PHP or the hosting account when the related features are used:

```text
public_html/uploads/
public_html/pet_profile_images/
public_html/signatures/
public_html/payments/
public_html/payment_qr/
public_html/concerns/
public_html/diagnosis/
public_html/boarding_documents/
public_html/inventory_items/
public_html/inventory_receipts/
```

If a folder does not exist on the server, create it before testing uploads. Do not remove these folders during frontend redeploys.

## 8. Database Upload / Migration Materials

For current deployed updates, use the SQL runbook:

```text
docs/deployed_server_sql_runbook.md
```

Current bundled deployment SQL:

```text
DDL/20260710_deployment_required_all.sql
```

Run SQL only against the intended deployed database, preferably after a backup.

## 9. Mail Queue Cron

If queued email is enabled, configure Hostinger Cron or server cron to run:

```bash
php /home/YOUR_HOSTINGER_USER/domains/ipawcus.com/public_html/php/mail_queue_worker.php --limit=50
```

Run every 1 minute.

If the API is deployed on `api.ipawcus.com` with PHP files directly in its document root, adjust the path:

```bash
php /home/YOUR_HOSTINGER_USER/domains/api.ipawcus.com/public_html/mail_queue_worker.php --limit=50
```

## 10. Standalone TV Status Subdomain

Use this only if you want a separate status display without the React build.

Target:

```text
domains/status.ipawcus.com/public_html/
```

Upload the contents of:

```text
Subdomain_folder/
```

Expected files:

```text
public_html/
  index.php
  status.php
  .htaccess
  assets/
    circular_logo.png
    tv-display.css
    tv-display.js
```

Create either:

```text
public_html/.env
```

or:

```text
public_html/config.php
```

Use placeholders from `Subdomain_folder/.env.example` or `Subdomain_folder/config.example.php`, then set production database values on the server.

Validation URLs:

```text
https://status.ipawcus.com/status.php
https://status.ipawcus.com/
```

`status.php` should return JSON with `"success": true`.

## 11. Files Not To Upload Publicly

Do not upload these to a public domain root:

```text
node_modules/
src/
server/
docs/
DDL/
.git/
.codex/
.agents/
phpTestfiles/
*.log
local database exports
local screenshots with client data
real backup archives
```

Do not place `.env.example.production` or `.env.production.local` in a public web directory.

## 12. Final Deployment Checklist

1. Set production env values.
2. Set `PWAACTIVATOR=TRUE` or `PWAACTIVATOR=FALSE`.
3. Run `npm run build`.
4. Upload `dist/` contents to the frontend document root.
5. Upload PHP files to the chosen API location.
6. Upload the correct `.htaccess` for the chosen layout.
7. Confirm upload folders exist and are writable.
8. Run required SQL from `docs/deployed_server_sql_runbook.md`.
9. Configure the mail queue cron if using queued mail.
10. Open the frontend URL.
11. Test login.
12. Test one read-only API endpoint.
13. Test upload preview with a non-sensitive sample image.
14. Test payment proof upload with a non-sensitive sample image.
15. Test notification preferences and browser push only if push VAPID values are configured.

## 13. Quick URL Checks

Frontend:

```text
https://ipawcus.com/
https://ipawcus.com/dashboard
```

Same-domain API:

```text
https://ipawcus.com/php/index.php/health
https://ipawcus.com/api/health
```

API subdomain:

```text
https://api.ipawcus.com/index.php/health
```

PWA files when `PWAACTIVATOR=TRUE`:

```text
https://ipawcus.com/pwa/manifest.webmanifest
https://ipawcus.com/ipawcus-push-sw.js
https://ipawcus.com/pwa/icons/icon-192.png
```

The health URL should return JSON showing that the PHP API and database are reachable. Use protected endpoints only after logging in with a test account.
