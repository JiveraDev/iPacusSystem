# 2026-06-30 Project Update

This note records the current whole-project working-tree update, including the dashboard changes in `src/components/Dashboard.jsx`.

## Suggested Commit Message

```text
feat: secure clinic workflows and sync dashboard operations

Add bearer-token API access, route role policies, protected media delivery,
role-aware dashboard navigation, live home summaries, consent-template
assignment, queue/booking reference numbers, richer notifications and TODOs,
and POS/payment-proof handling across booking, queue, veterinarian, pet owner,
reporting, and media-monitoring workflows.

Keep the existing dashboard and dashboard-router debug bypass values unchanged.
```

## Working Tree Scope

- 70 tracked files currently show modifications in `docs/`, `php/`, and `src/`.
- New backend helpers include API access tokens, route access policies, consent-file context helpers, reference-number helpers, and protected media delivery.
- New frontend helpers include consent assignment parsing, notification redirect preparation, and queue reference formatting.
- New uploaded media exists under `public/payment_qr/`.

## Major Backend Changes

- Added real API access token creation on login and bearer-token route enforcement through `php/auth_access_helpers.php`, `php/role_access.php`, and `php/index.php`.
- Added a protected `/uploads/media/{path}` route so runtime upload directories can be served through API access checks instead of direct public paths.
- Added role policies for accounts, reports, inventory, boarding, bookings, queue, veterinarian diagnoses, consultations, consent files, todos, media monitoring, record-update requests, services, schedules, and mail testing.
- Added consistent booking and queue reference helpers:
  - Booking numbers now use date-based `B-{sequence}{MON}{DD}` format.
  - Queue references now use `Q-{queue_number}{MON}{DD}` format in responses, conflicts, notifications, billing, and UI labels.
- Expanded notification generation for clinic booking submissions, queue creation, queue assignment to vets, online consultation confirmation, and paid/urgent record-update requests.
- Expanded TODO/reminder sources so veterinarian users can see online consultation appointments and follow-up recording tasks.
- Added consent-file `pet_owner_contexts` support with automatic schema alignment for assigned pet-owner flows.
- Preserved richer queue consent record capture, including selected consent file, consent type, signer name, and signed timestamp.
- Added booking payment-proof fields and allowed booking status updates to persist payment method/reference/proof without reopening completed bookings.
- Updated visit billing so paid visits are not overwritten by later diagnosis or billing saves.
- Added previous-period comparison data to report KPIs and removed the dashboard follow-up/staff-monitoring blocks from the report dashboard payload.

## Major Frontend Changes

- `Dashboard.jsx` now groups Super Admin sidebar navigation by role section, exposes media monitoring to Super Admin/Veterinarian roles, exposes Schedule / TODOs to Pet Owner/Veterinarian roles, and simplifies logout copy.
- `apiClient.js` now attaches the stored bearer token and current user headers to API requests.
- `image.js` now resolves runtime upload paths through the protected media route with the current access token.
- The dashboard Home screen now loads live role-specific summaries for pet owners, admins, and veterinarians, using quiet auto-refresh instead of static overview cards.
- Admin booking management now uses clickable rows, improved confirmation state, clearer counter-payment wording, and POS handoff for booking payment proof.
- Queue management now displays/searches queue IDs through formatted references, uses row expansion, and resolves concern images through protected media URLs.
- POS management now generates and uploads invoice-proof images, links booking payment proof, filters payable visits, and auto-confirms linked bookings after payment posting.
- Consent File Management now lets admins assign templates to pet-owner contexts: online consultation, boarding, and home service.
- Pet owner booking flows now require the assigned consent template for online consultation, home service, boarding, and self-service queue signatures.
- Self-service queue now renders the assigned consent document, uploads a signed consent image, and sends consent metadata to the backend.
- Veterinarian diagnosis now supports persisted diagnosis drafts, queue references, linked consent uploads, custom diagnosis catalog sections, and visit charge lines.
- Veterinarian medical records can open directly from paid urgent record-update notifications using session-stored pet/request context.
- Pet media monitoring is now gated for Super Admin and Veterinarian roles and uses the protected media flow.
- Report KPI cards now show trend direction and previous-period comparison where available.

## New Files

- `php/auth_access_helpers.php`
- `php/role_access.php`
- `php/reference_number_helpers.php`
- `php/consent_file_helpers.php`
- `php/upload_media.php`
- `src/lib/consentAssignments.js`
- `src/lib/notificationRedirect.js`
- `src/lib/referenceNumbers.js`
- `public/payment_qr/1782702861_1.png`

## Documentation Changes

- Updated the docs index for the June 30 project update.
- Existing docs also include repository update, deployment, backlog, quality, and system-inventory revisions from the broader cleanup pass.

## Verification Notes

No automated verification was run while preparing this documentation note.

Before committing or deploying this full project update, run:

- `npm run lint`
- `npm run build`
- PHP syntax checks for changed PHP files, especially new helpers and routed endpoints
- Manual browser checks for login, protected uploads, Super Admin navigation, pet-owner booking/consent flows, queue intake, booking confirmation, POS payment posting, veterinarian diagnosis, record-update notifications, reports, and media monitoring

## Deployment Notes

- The access-token helper creates `api_access_tokens` automatically, but production databases should still receive an explicit migration for auditability.
- The consent-file helper adds `consent_files.pet_owner_contexts` at runtime; production should also capture this in schema migration docs.
- Protected media URLs may require frontend/backend deployments to land together because uploaded images now resolve through the API route.
- Keep the existing debug-bypass values in `src/components/Dashboard.jsx` and `src/components/dashboardRouter.jsx` unchanged unless a separate security-hardening task explicitly authorizes that work.
