# Standalone TV Display

This folder can be used as the document root for the TV display subdomain.

## Files To Upload

Upload the whole `Subdomain_folder` folder to the subdomain document root:

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
Subdomain_folder
```

Then open:

```text
https://status.your-domain.com/
```

## Validation

- Open `/status.php` and confirm it returns JSON with `"success":true`.
- Open `/` and confirm the TV display loads queue, booking, and payment sections.
