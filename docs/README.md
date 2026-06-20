# iPawcus Documentation Index

Updated: 2026-06-20

This folder contains planning, backlog, and deployment notes for the current iPawcus React/PHP project.

| Document | Purpose |
| --- | --- |
| `system_inventory_gantt_details.md` | System inventory, module map, workflows, schema notes, Gantt-ready work packages, and manual QA checklist. |
| `git_backlog_assumptions.md` | Git-history-based backlog assumptions, current working-tree evidence, backlog IDs, release phases, risks, and cleanup items. |
| `tv_status_display_deployment.md` | Deployment notes for serving the TV status display through `/status-display`, `/tv-status`, or the status subdomain. |
| `20260620_quality_fix_notes.md` | Latest UX/API fix notes for phone inputs, confirmations, modals, notifications, collapse controls, and boarding room creation. |

## Latest Planning Coverage

- Super Admin reports dashboard and report export/print center.
- TV status display route and deployment notes.
- Pet media monitoring and pet owner account controls.
- Consent form record migration and consent ledger persistence.
- Booking/queue lifecycle maintenance and recovery reporting.
- POS billing and inventory stock movement linkage.
- Updated Gantt/backlog items for verification and deployment risks.
- Latest UX/API stability pass: locked `+639` phone inputs, logout/deactivation confirmations, visible modal close buttons, notification/collapse control polish, queue `View` actions, and boarding add-room fixes.

## Current Verification Notes

- `npm run lint` passed.
- `npm run build` passed.
- PHP syntax checks passed for the changed and newly added endpoints.
- Latest targeted verification includes `php -l php\boarding_management.php`, `npm run lint`, and `npm run build`.

## Deployment Notes

- Run `DDL/20260619_create_consent_form_records.sql` before relying on consent ledger reports/media monitoring.
- Add the owner status columns documented in `system_inventory_gantt_details.md` before enabling pet owner deactivation.
- Confirm `visit_payments.payment_method` supports `cash` before posting cash POS payments.
- Keep the dashboard debug bypass unchanged until a separate security hardening task is approved.
  Set Aside For Later

    1. Role/API Security Enforcement
        - Put real role checks in PHP APIs.
        - Frontend role checks stay only for UI.
        - API must block unauthorized access with 403.
        - Protect Super Admin reports, pet directory, POS, inventory, diagnosis, bookings, queue, etc.

    2. Full Booking / Queue / POS Lifecycle Review
        - Booking status rules.
        - Queue day expiration rules.
        - Vet My List rules.
        - Diagnosis completion must create POS bill in one backend transaction.
        - Pending payment must stay visible until paid.
        - Pet owner pending payment todo must stay active.

    3. POS Improvements
        - Rebrand to Point-Of-Sale.
        - Cash-only option for now.
        - Transaction number input only when needed.
        - Fix walk-in sale payment/preview invoice button.
        - Add prescription holder/inclusion idea.
        - Improve prescription/product search using variant names.

    4. Inventory / Service Catalog / Materials
        - Review service catalog material usage.
        - Strengthen backend for materials used.
        - Clarify medicine vs product IDs in POS.
        - Inventory/report lifecycle inspection.

    5. Reports / Super Admin
        - Reports Dashboard.
        - Export/Print Report Center.
        - Service utilization, revenue graphs, animal distribution, inventory status, queue/booking trends, boarding/hotel/kennel reports.
        - Consent reporting needs real signed consent records table.

    6. Consent / Media Monitoring
        - Let Super Admin view consent result images and pet-related uploaded images.
        - Fix signed consent record loading/date filtering where needed.
        - Exclude profile-only images from monitoring if not relevant.

    7. Pet Owner Accounts
        - Separate pet owner page.
        - Card/table modal view.
        - Pet owner profile summary with picture.
        - Possible account deactivation.
        - Possible removal of ownership from pets.

    8. Push Notifications
        - Diagnose why login/push is not working.
        - Queue approval notification behavior.
        - SSL/local issuer certificate issue.

    9. UI / UX Cleanup
        - Searchable dropdowns everywhere needed, especially inventory.
        - Supplier input should allow adding new suppliers.
        - TV display cleanup and spacing adjustment.
        - Vet/Admin online monitoring redesign and remove last seen.

  Main next big engineering task should probably be API role enforcement, because it protects everything else.
