# iPawcus PWA Files

This PWA setup is intentionally isolated so the install/offline pieces are easy to find.

## Public files

- `public/.htaccess`: Apache rules copied into `dist/` so `.webmanifest` serves as JSON and SPA routes still fall back to `index.html`.
- `public/pwa/manifest.webmanifest`: app install metadata used by browsers.
- `public/pwa/offline.html`: fallback page shown when a navigation cannot load while offline.
- `public/pwa/icons/icon-192.png`: standard app icon.
- `public/pwa/icons/icon-512.png`: large app icon.
- `public/pwa/icons/icon-maskable-512.png`: Android maskable app icon.
- `public/pwa/icons/apple-touch-icon.png`: iOS home-screen icon.
- `public/ipawcus-push-sw.js`: existing push service worker, extended to also handle PWA shell caching.

## Source files

- `src/pwa/registerPwaServiceWorker.js`: registers the existing root service worker for PWA support.
- `src/pwa/usePwaInstallPrompt.js`: owns browser install prompt state.
- `src/pwa/PwaInstallButton.jsx`: reusable install button used on the Home dashboard.

## Wiring points

- `index.html`: keeps the base app metadata only; PWA manifest and iOS tags are injected at runtime when `PWAACTIVATOR=TRUE`.
- `PWAACTIVATOR=TRUE`: enables manifest/iOS head tags, PWA app-shell caching, and the install button.
- `PWAACTIVATOR=FALSE`: keeps the PWA install/offline layer hidden while browser push can still register the same worker only when a user enables browser notifications.
- `src/main.jsx`: registers the PWA service worker only when `PWAACTIVATOR=TRUE`.
- `src/components/PetOwnerDashboard/Home.jsx`: shows the install button only when `PWAACTIVATOR=TRUE`.
- `.htaccess`: declares the `.webmanifest` MIME type for Apache deployments.

## Notes

- HTTPS is required in production for install prompts, service workers, and browser push.
- The current setup caches the app shell and static build assets only. It does not offline-cache private dashboard API records.
- Push subscriptions already use the existing `notification_push_subscriptions` backend table.

## Deployment check

After deploying, open these URLs directly:

- `https://your-domain.com/pwa/manifest.webmanifest`
- `https://your-domain.com/ipawcus-push-sw.js`
- `https://your-domain.com/pwa/icons/icon-192.png`

The manifest URL must show JSON beginning with `{`. If it shows the iPawcus page HTML, the server is rewriting `/pwa/manifest.webmanifest` to `index.html`, and the PWA install prompt will not work.
