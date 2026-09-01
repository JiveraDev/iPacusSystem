# Standalone TV Status Build Folder

This is the source folder for the standalone TV display. Vite copies it
unchanged into:

```text
dist/tv-status/
```

That keeps the complete TV display together in one build artifact, matching
the `public/pwa/` to `dist/pwa/` workflow.

## Build

From the project root:

```text
npm run build
```

## Files to upload

Upload the contents of `dist/tv-status/` to the TV status subdomain document
root:

- `index.php`
- `status.php`
- `assets/tv-display.css`
- `assets/tv-display.js`
- `.htaccess`

## Database Config

Use one of these options:

1. Copy `.env.example` to `.env` and update the database values.
2. Copy `config.example.php` to `config.php` and update the database values.

The page reads the database directly from `status.php`, so it does not require the React build or the main PHP router.

## Subdomain Setup

Point the subdomain document root to this folder:

```text
dist/tv-status
```

Then open:

```text
https://status.your-domain.com/
```

The header location selector loads only the queue, bookings, and billing data
for the chosen active branch. The selection is retained in the page URL, for
example:

```text
https://status.your-domain.com/?branch=MAIN
```

## Validation

- Open `/status.php` and confirm it returns JSON with `"success":true`.
- Confirm the response includes `branch` and `branches`.
- Open `/` and confirm changing the location refreshes the queue, booking, and payment sections.
