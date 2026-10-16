# Theme usage audit

Reviewed on 2026-10-15 using synthetic browser fixtures. No real records, payments, messages, or external consultation sessions were submitted.

## Scope

The main browser matrix visits every pattern in `dashboardRouter.jsx`: 59 route entries, including the legacy intake alias. It also visits veterinarian and pet-owner profiles, the pet-owner home screen, and five public screens, for 67 route/role checks per palette. Each page must finish its initial application loading state before its rendered text is assessed. All eight palettes are included: original Light, Islands Light, Islands Dark, Dracula Classic, Alucard Classic, Solarized Light, Solarized Dark, and Nightfall.

| Area | Screens covered |
| --- | --- |
| Public access | Landing, login, account registration, email verification, password recovery; profile registration through the actual first-step form |
| Shared workspace | Role home screens, notifications, calendar/TODOs, admin/veterinarian/pet-owner profiles |
| Pet owner | Consultation list, booking, payment, confirmation, pre-call screen; pet directory, linking, profile, medical history, record-update request |
| Services | Service index, general check-up, laboratory, parasite control, surgery, vaccination, grooming, dental, home service, home-service confirmation, Pet Hotel, special services |
| Administration | Booking management, record requests, boarding, grooming, queue, Pet Intake and its legacy URL, POS, service catalog, consent templates, pet registration and details |
| Inventory | All items, add item, stock-in, low stock, near expiry, disposal logs |
| Veterinary | My list, diagnosis, medical record editor, record requests, histories, online consultations and consultation diagnosis |
| Super administrator | Reports dashboard, report export, activity log, pet media, staff accounts, pet-owner accounts, payment methods |
| Additional populated states | TV status board; clinic-network-verified self-service queue; calendar categories and completed events; appearance selector; administrator and veterinarian homes |

## Corrections

- Extended semantic mappings to legacy neutral, purple/cyan informational, green success, amber warning, and red danger utilities, including page-specific hex colors.
- Corrected translucent upload and consent panels, POS summary labels/badges, account status labels, report links, and pet-registration helper labels.
- Made landing, login, and both registration steps use the selected palette. The landing header uses a borderless sun icon for light palettes and a moon for dark palettes to open the selector; authentication screens inherit the theme without showing a selector.
- Flattened shared and legacy dashboard headers: removed filled containers, shadows, rounded outer borders, and decorative accent bars. A single bottom separator groups the heading with its actions.
- Adapted calendar selection, hover, current-time, category markers, and event foregrounds. Completed events use a strike-through rather than reduced text opacity. Calendar event fills follow the same theme roles as their category markers.
- Preserved dark photographic scrims, white document backgrounds, print colors, and the original Light palette.

## Verification and limits

The broad matrix checks 29,228 rendered text instances over 536 route/role/palette visits. It checks effective solid background/foreground contrast, navigation completion, runtime errors, and desktop overflow. After the last photo-panel correction, 70 follow-up screen checks pass across the seven new palettes: 4,068 rendered text checks and 462 control/placeholder checks, with no contrast failures or JavaScript errors. The TV board, verified queue form, category calendar, and appearance picker also pass their additional populated-state checks. A final Day-view check renders all eight calendar categories in every new palette and passes 497 text checks, including completed-event markers.

Public selector checks cover all eight choices through landing, login, registration, and profile registration. Arrow-key selection, Escape focus restoration, outside dismissal, saved preferences, reloads, and 320/390/820/1920/3840 px widths are covered. Screenshots were reviewed at phone, tablet, and desktop widths.

The follow-up header review checks 32 page/palette combinations (Pet Intake, service catalog, reports, and inventory entry across all eight themes), plus 390/820/1920/3840 px Pet Intake layouts. Header surfaces are transparent, have no side/top border, shadow, rounded frame, or accent bar, and retain their actions. The revised landing-only selector passes all eight choices through login, reload, account registration, and profile registration with zero selectors on those authentication screens and no JavaScript errors.

Pet information actions are restored to a fixed bottom-center dock, with Medical Records, Registration, and the existing conditional Medical Certificate action. The inline Medical overview is removed from both pet information views. The dock is checked in all eight themes, at 320/390/820/1920/3840 px, while scrolling, and with a collapsed sidebar. Synthetic certificate checks confirm that the medical-certificate action is absent without an issued certificate, appears after auto-refresh when one is issued, opens the certificate, and retains the new-certificate view acknowledgement. Registration and medical-record navigation also pass. The registration-edit view retains medical-record access through the same floating dock container.

The veterinarian My List now prioritizes patients in progress, uses compact rows with expandable patient details, and places approved bookings alongside the worklist on wide screens. The four workload summary counters are removed. Completed visits use a shared table on desktop and readable records on smaller screens; desktop retains the Table/Cards selector. Checks cover all eight palettes and 320/390/820/1920/3840 px layouts, diagnosis gating, owner search, clinic filters, consent dialogs, booking previews, reopening visits, quiet refresh, grooming reviews, and recoverable API errors using synthetic records. The pet information brand reads “iPawcus” above “Vetfocus Care · Patient Profile.”

Original Light is preserved as requested. It still has pre-existing faint helper and metadata text, such as `text-slate-400` on white (approximately 2.56:1). It is not claimed to pass a complete contrast audit. Automated readings also cannot establish contrast over photographs or gradients; these require visual review.

Example retained finding: `src/components/PetOwnerDashboard/MedicalRecords.jsx:1145` — the original-Light metadata label uses `text-slate-400` on a white surface. Named palettes map this label to their readable secondary text.

The route matrix covers synthetic populated and empty states available in the fixtures. It does not prove every data-dependent dialog or every permission combination. Real authentication, Google's hosted button, payment submission, clinic network policy, live consultation media, and database workflows require integration testing in their configured environments. The clinic-network form is exercised with a synthetic verified response.

`npm run check` passed 201/201 checks. Browser artifacts are kept under the ignored `tmp/theme-review/` directory. Dashboard and dashboard-router debug bypass logic is unchanged.
