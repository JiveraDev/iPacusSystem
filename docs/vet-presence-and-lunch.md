# Vet status and lunch rules

Admin Home has a clinic-wide Vet is in / Vet is out switch. The landing page and pet-owner Home show the same sign without editing controls. The status refreshes every four seconds while the page is visible.

The daily admin setting defaults to in and resets at midnight Manila. The public sign also checks the selected clinic's actual operating hours and closure dates, using Manila time. It shows **Clinic is closed** before opening, at or after closing, on Sundays, and on configured closure dates. During 12:00–1:00 PM it shows a vet lunch break when the daily setting is in. The admin's switch keeps its daily value while the clinic is closed, so a midnight reset cannot incorrectly claim the vet is already in. The sign is informational and does not cancel appointments or override booking availability. A failed request shows unavailable.

Storage uses a separate `vet_presence` key in the existing `service_display_settings` table. Public GET `/vet-presence` accepts an optional `branchId`; without it the main active clinic is selected. It returns effective `isIn`, the daily `adminIsIn` setting, `status` (in, out, closed, lunch), public clinic opening information, date, reset time, and timezone. PATCH requires a verified Admin or Super Admin; the server assigns the date. No new database columns or tables are required. Missing operating-hours configuration returns unavailable instead of guessing.

On-site vet and home-service appointments must avoid 12:00–1:00 PM lunch. Grooming is exempt while the clinic is open. Online consultations follow the vet's separate online start times, including noon when enabled, and reserve one hour; the public clinic sign does not restrict them. A 30-minute on-site appointment may finish at noon. Room-based boarding stays retain their availability rules. Applicable lunch slots remain disabled in booking controls and are checked by the server. Existing records are not automatically cancelled or moved.

## Verification

The landing hero shows the effective clinic sign, including closed and lunch states, with loading/error states. Pet-owner Home retains its calendar link and lunch information; its status follows the clinic chosen in the booking calendar. The redundant “Current clinic for bookings” control in the welcome section has been removed. Admin controls edit the daily setting while displaying the effective public status.

Landing service-request actions and calendar selections now record a one-time, tab-scoped booking destination. Successful pet-owner login opens the corresponding form and retains date, time, branch, vet and boarding-room prefill. The online-vet hero button opens online consultation booking. Destinations survive login/register/verification navigation in the same tab, expire after 30 minutes, and only resolve through the existing service-route allowlist. Plain landing login/register clears old intent; admin and vet logins retain their normal Home destination. Calendar choices are still revalidated against current availability; selecting a slot does not reserve it before submission.

- `php scripts/tests/clinic-rules-regression.php`
- `node scripts/tests/vet-presence-display.mjs`
- `node --test src/lib/landingBookingIntent.test.js`
- `npm run lint`
- `npm run build`
- PHP syntax checks for changed endpoints and helpers.

Live checks: on admin Home toggle out, confirm landing and pet-owner Home update, toggle in, check reload and a second session, check keyboard switch activation, and verify both themes at phone/tablet/desktop widths. Confirm lunch choices cannot be selected for clinic and online bookings, including rescheduling. Use a test environment to exercise API write permissions and database persistence without changing a live public sign.
