# Grooming Management — first release

## Routing and responsibility

An approved grooming booking appears automatically in **Admin → Grooming**. Opening the list does not create a second booking or write a job. The first save or photo upload creates its linked job, uniquely keyed by booking ID. Routine grooming is excluded from the vet’s approved booking lists and cannot be received through the clinical booking endpoint.

The working form asks for the grooming service, an optional assisting-nurse name, one intake/owner-approval checkbox, and one optional clinic-notes box. A new job uses the signed-in administrator as its handler automatically; the server ignores a submitted handler override and preserves the original handler on existing jobs. The assisting nurse is stored separately in details JSON. Required before/after evidence, extra details, and history stay in compact sections. Existing notes and checklists are preserved.

Normal flow: receive pet → required before photo → start grooming → optional notes → required after photo → finish → payment in the existing POS → confirm pickup. The underlying statuses are unchanged. Start needs at least one catalog service and confirmed intake/owner approval; staff do not enter a handler or price. Finish explicitly confirms completion without inventing six checklist entries. A neutral owner summary is generated if none was recorded. Pickup uses the booking owner’s name automatically, falling back to the signed-in clinic administrator’s name when the owner profile has no usable name; staff only press Confirm pickup. Existing details JSON stores the confirmation flags and assisting nurse, so no schema migration is needed. Legacy completed checklists and handover notes remain valid; closed jobs and date/booking restrictions are unchanged.

POS search, invoice selection, billing, payment recording, and refund handling are unchanged. Open POS is ordinary navigation, without an invoice shortcut or prefilled transaction. Finishing still prepares/reuses the invoice through the existing grooming billing integration; it never marks the invoice paid. Staff use the existing POS workflow to verify payment before releasing the pet.

## Vet review

From checked in or in progress, the admin saves the record, chooses an active branch veterinarian, and requests review with a concern. Grooming pauses. A dedicated **Grooming reviews** section appears in that vet’s Approved List, with an in-app notification. Only that assigned vet can submit an assessment:

- **Resume:** the admin may resume grooming.
- **Stop:** grooming stays paused until the admin closes it.
- **Separate consultation:** grooming stays paused; staff arrange a separate consultation with owner approval.

Review does not create a diagnosis, book a consultation, charge a consultation fee, or complete the grooming booking. If the job is stopped while review is pending, the pending review closes without inventing a vet assessment.

## Pricing, photos, and sharing

There is no grooming price input or price override. Staff may select one or more active Grooming items from Service Catalog. Each selected item keeps its official catalog price and becomes a separate POS invoice line; the displayed total is the sum of those items. Grooming no longer writes bookings.price or trusts a client-supplied agreedTotal. Existing invoices and payments are reused without repricing; the invoice total is stored as a read-only historical snapshot. Free-text notes and legacy add-on text describe the work but do not define prices or override the catalog. A missing positive official price produces a Service Catalog setup message. Registered pet linkage is still required, and no payment or automatic refund is invented.

Photo categories are owner reference, before, and after; an owner reference may be presented to a veterinarian as concern evidence. Staff keep one current before photo and one current after photo, replacing the matching image when they upload again. JPG/PNG/WebP only, actual MIME validation, maximum 8 MB per image. PHP is configured for an 8 MB file and a 10 MB multipart request. Stored names use a sanitized pet token, category, timestamp, and random suffix; the database stores only `grooming_photos/<filename>`, never the private physical path. Owner concern/reference photos remain clinic-only. Owners can access only their own explicitly shared before/after photos after publication. Vets need a review assignment and branch access. Admin feature permissions and branch boundaries apply. Photos use the existing authenticated `/upload` and protected `/uploads/media` endpoints, but are stored outside the website tree to prevent direct static access. No photo-delete endpoint is introduced.

The admin explicitly shares a ready/picked-up summary. Owner Home then shows the package, add-ons, summary, and selected photos. Internal notes, audit records, and vet assessments are excluded. Ready status locks service/pricing fields; the pickup name is system-assigned. Photos lock on publication or closure, so add final photos before sharing or confirming pickup.

## Booking and staffing scope

Grooming is bookable during **12:00–1:00 PM**, subject to branch hours and free slots. Other vet appointments retain their lunch restriction. Estimated work time is documentation only; it does not reserve a groomer’s capacity or change the existing booking-slot duration. Staffing calendars, concurrent-groomer capacity, itemized package pricing, inventory consumption, and dedicated nurse accounts are future work. Walk-ins should use an approved grooming booking to enter this workflow; historical generic queue entries are not automatically migrated.

## Setup and rollout

1. Apply `DDL/20260906_01_grooming_management.sql` through the normal deployment process. It adds four tables with foreign keys; existing bookings are not rewritten. On local development only, `php scripts/setup-grooming.php --apply` runs this additive migration and refuses a non-local database host.
2. Ensure PHP can write beside the web document root. With no setting, the app creates `ipawcus-private-grooming-media` beside `public_html`, not inside it. To choose another location, set `IPAWCUS_GROOMING_MEDIA_ROOT` to an absolute private directory **outside both the application folder and web document root**. PHP creates missing subdirectories recursively when its nearest existing parent is writable. Back up this directory with the database and keep it across deployments. Do not place it in `public`, `dist`, `public_html`, or any other static web mount.
3. Run `php scripts/tests/grooming-storage.php`. It checks prerequisite columns, new tables, and private-folder access without changing records.
4. Deploy frontend and backend together. Review Grooming feature access in account permissions. Existing admins default to allowed, consistent with the other feature flags.

The local development database was migrated during implementation. The local private directory was created with approval and configured in the ignored `.env`; production still needs its own migration and storage configuration.

## Verification

- `php scripts/tests/grooming-rules-regression.php` — lifecycle, intake, vet-clearance, pricing validation, checklist, pickup, permissions, private-storage guards.
- `php scripts/tests/grooming-media-regression.php` — private directory creation, write/read access, cleanup, and public-folder rejection.
- `php scripts/tests/grooming-db-regression.php` — job identity, audit creation, and photo privacy using temporary tables only.
- `php scripts/tests/grooming-storage.php` — read-only deployment preflight.
- `php scripts/tests/clinic-rules-regression.php` — daily vet sign and lunch exceptions.
- `node scripts/tests/vet-presence-display.mjs` — server-rendered sign states and landing removals.
- `npm run lint`, `npm run build`, and PHP syntax checks.

Manual acceptance still required with signed-in test accounts: approve → intake → start → photo → review → vet clearance → resume → finish/invoice → payment → pickup → publish → owner summary. Also test concurrent edits (409 reload), other-branch access, another owner’s photo URL, malformed files, invoice mismatch, unpaid pickup policy, cancellation, and mobile/tablet/desktop in both themes. Browser interaction was unavailable during implementation; static rendering checks do not replace these flow and visual checks.

The UI follows the existing shared controls and restrained dashboard styling; no new runtime dependencies or decorative animation were introduced.
