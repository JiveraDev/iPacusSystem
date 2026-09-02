# Hostinger Git Branch Deployment

This project can publish a deployment-only branch containing the built React frontend at the branch root and the PHP API under `php/`.

## One-command deployment

From the repository root, run:

```powershell
npm run deploy:hostinger
```

The command:

1. runs `npm run build`;
2. fetches the latest `origin/hostinger-deploy` branch;
3. prepares a separate temporary Git worktree, leaving the current branch and uncommitted work untouched;
4. copies the contents of `dist/` to the deployment root;
5. copies `php/` to the deployment root as `php/`;
6. excludes runtime uploads because they live in a persistent sibling directory outside the Git deployment target;
7. uses the repository root `.htaccess` for the React fallback and same-domain PHP/API routes;
8. excludes `.env` so production secrets remain server-only;
9. commits and pushes the remaining deployment files to `origin/hostinger-deploy`.

If the remote branch does not exist, the command creates it on the first push. In this repository it already exists, so the command updates it.

Preview the deployment without fetching, committing, or pushing:

```powershell
npm run deploy:hostinger:preview
```

Reuse an existing `dist/` without rebuilding:

```powershell
npm run deploy:hostinger -- --skip-build
```

Use a different remote or branch:

```powershell
npm run deploy:hostinger -- --remote origin --branch hostinger-deploy
```

## Server-managed files

### Persistent runtime media

The Hostinger Git deployment target must be a child directory such as `public_html/set`. Runtime uploads live in the sibling directory `public_html/ipawcus_runtime_media`, which remains inside `public_html` but outside the directory replaced by Git deployment.

Required Hostinger layout:

```text
public_html/
├── set/                       # Git deployment target
└── ipawcus_runtime_media/     # persistent owner uploads
    ├── boarding_documents/
    ├── concerns/
    ├── diagnosis/
    ├── inventory_items/
    ├── inventory_receipts/
    ├── invoices/
    ├── payment_qr/
    ├── payments/
    ├── pet_profile_images/
    ├── signatures/
    └── uploads/
```

The PHP API detects this layout automatically. A custom absolute location can be provided with `IPAWCUS_RUNTIME_MEDIA_ROOT` when necessary.

### One-time backup restoration

Perform these steps in this order before the first deployment using persistent media storage:

1. In Hostinger File Manager, create `public_html/ipawcus_runtime_media`.
2. Upload the contents of these backup folders into their matching directories under `ipawcus_runtime_media`: `boarding_documents`, `concerns`, `diagnosis`, `inventory_items`, `inventory_receipts`, `invoices`, `payment_qr`, `payments`, `pet_profile_images`, `signatures`, and `uploads`.
3. Do not upload a nested `public` folder. The correct path is `public_html/ipawcus_runtime_media/payments/example.jpg`, not `public_html/ipawcus_runtime_media/public/payments/example.jpg`.
4. Set directory permissions to `755` and file permissions to `644`.
5. Add `public_html/ipawcus_runtime_media/.htaccess` with direct web access disabled, or perform one authenticated upload after deployment so the application creates this protection file automatically.
6. Confirm the Hostinger Git deployment target is `public_html/set`.
7. Copy `docs/hostinger-public-html-router.htaccess` to `public_html/.htaccess`. This keeps the public URL at `https://ipawcus.com`, routes `/api` and `/php` into `set/php`, and serves the application from `public_html/set`.
8. Deploy the corrected application and verify an existing pet image, payment proof, consent PDF, and a new test upload.

Suggested `.htaccess` content:

```apache
Options -Indexes
<IfModule mod_authz_core.c>
Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
Deny from all
</IfModule>
```

The build also contains copies of local runtime media folders. The updater removes these build-time copies by default:

- `uploads/`
- `pet_profile_images/`
- `signatures/`
- `payments/`
- `payment_qr/`
- `concerns/`
- `diagnosis/`
- `boarding_documents/`
- `inventory_items/`
- `inventory_receipts/`
- `invoices/`

This prevents stale local files from replacing live customer uploads. Restore the matching runtime folders from the backup into `public_html/ipawcus_runtime_media` before deploying this version. Do not upload a nested `public` directory there.

The deployment script no longer supports including runtime media in Git. Keep regular off-server backups of `ipawcus_runtime_media`.

### `.env`

The updater does not copy or commit `.env`. Keep the production `.env` on Hostinger and edit it manually only when a production configuration value changes. Normal code deployments do not require a File Manager update.

### `.htaccess`

The updater intentionally includes the repository root `.htaccess`, so React routing and same-domain API rewrite changes reach Hostinger automatically. No manual File Manager update is needed for this file after a normal deployment.

## Connect the branch in Hostinger

In hPanel:

1. Open **Websites**, select the site, and open its dashboard.
2. Go to **Advanced > Git**.
3. Connect the GitHub account and select `JiveraDev/iPacusSystem`.
4. Select the `hostinger-deploy` branch.
5. Set the Git deployment root directory to `public_html/set`, not to all of `public_html`.
6. Deploy, then enable automatic deployment if desired.

The deployment branch already has `index.html`, frontend assets, `.htaccess`, and `php/` at its root. Hostinger may continue serving the fixed `public_html` document root; the permanent `public_html/.htaccess` router forwards requests internally to `set` while keeping `ipawcus_runtime_media` outside the Git deployment target.

## Important checks

- Keep the real production `.env` on Hostinger; the script never copies the local `.env` files.
- Confirm `VITE_API_BASE_URL` is correct before building. The current same-domain layout expects `https://ipawcus.com/php/index.php` or the `/api` rewrite.
- Back up live uploads and the database before switching the website's connected Git branch.
- Database migrations are not run by this command.
- After deployment, check the landing page, login, a PHP API request, PWA files, uploads, and browser refresh on a nested React route.
