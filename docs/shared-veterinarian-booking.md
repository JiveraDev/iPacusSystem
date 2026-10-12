# Veterinarian booking schedules

## Two separate calendars

On-site medical appointments follow the selected clinic's operating schedule.
Super Admin assigns one or more clinics in Account Management. Each vet chooses
**Accept bookings** independently for each assigned site in Profile → Clinic
Booking Preferences. There is no per-vet working-hours or time-off setup and
no published clinic-visit gate. The live presence sign-in used for today's
patient queue is separate from booking acceptance.

Capacity follows the number of accepting, active vets assigned to the clinic;
it is not fixed at three. Each available vet provides one simultaneous appointment,
whether those are the same medical service or different services. A pending
booking immediately reserves a specific vet. Grooming keeps its own service
slots; boarding keeps its room/date-range capacity.

The landing availability calendar, owner dashboard calendar and booking-form
clinic selectors use the same accepting roster. A medical clinic appears only
when it offers the service and has at least one active, assigned vet accepting
bookings there. These choices refresh every four seconds. If acceptance ends at
the selected clinic, the selection moves to an eligible clinic, or clears when
none remain. An empty accepting roster shows an unavailable state.

New bookings do not inherit an owner-wide saved clinic. An explicit calendar
selection carries its clinic into the matching booking form and is checked
against current acceptance. The service's eligible main clinic, or first
eligible clinic, is the default otherwise. Date and time controls cannot show
another clinic's availability while the selection is being updated. Walk-in
queue location selection retains its separate clinic assignment rules.

Online consultation is a separate call calendar. Profile → Online Consultation
Availability retains Monday–Saturday start-time selections, 8:00 AM–5:30 PM in
30-minute steps. A selected start reserves a full one-hour call; it does not
require selecting two consecutive buttons. Online calls are not gated by clinic
assignments, site acceptance, operating hours, lunch or closure dates. Pet owners
still select their veterinarian before selecting an online date and time.
The booking's branch is administrative metadata, not the source of call hours.

Both calendars check the vet's actual booked intervals across clinics and
services. A vet cannot take a call and an on-site appointment at overlapping
times. Online/home appointments reserve 60 minutes; standard appointments reserve
30 minutes. On-site/home appointments must fit clinic hours and avoid lunch.
An appointment for a vet at one clinic blocks that same vet at every other
clinic for its full duration, including while the booking is pending. Other
available vets can still accept appointments. Admin handover of a patient whose
booked interval has started also checks the replacement vet's remaining time
against all clinics and online calls. Earlier completed intervals do not block
a handover that happens after those intervals have ended.

## Rollout

1. Back up the database and apply
   `DDL/20261005_02_shared_veterinarian_booking_calendar.sql` after the existing
   multi-branch migration. This adds only `veterinarian_booking_clinics`.
   No bookings, clinic visits or existing online selections are deleted.
2. If the earlier version of that migration was already applied, no additional
   database migration is required for this correction. Its working-hours and
   time-off tables may remain intact but are no longer used.
3. In Super Admin → Account Management → veterinarian details → Clinic Booking
   Preferences, assign one or more active clinics. The professional information
   form preserves the vet's other assignments.
4. In the vet's profile, enable Accept bookings for each desired assigned site.
   New on-site availability is zero until acceptance is configured. Online
   availability uses the existing `vet_schedules` table independently and does
   not require the new clinic preference table.
5. Review existing future bookings. Legacy unassigned on-site appointments
   conservatively consume capacity until staff assign their vets. Existing
   conflicting bookings are not automatically changed or cancelled.

## Integrity and refresh

- Only Super Admin can change clinic assignments. Vets can change only their
  own site preferences and online selections.
- Site preference changes cannot remove coverage for future pending/confirmed
  on-site appointments. They do not change existing online calls.
- Removing a selected online start with a future pending/confirmed call is
  rejected. Reschedule or cancel the call first. Online selections are saved
  atomically; a failed save leaves the original schedule intact.
- Booking creation, confirmation, rescheduling, clinic transfers, future
  queue-linked vet assignments and schedule updates use the same database
  medical-calendar lock. All vet conflicts are checked across locations.
- Availability, profile preference panels and to-do views quietly refresh
  every four seconds. Refreshes pause while preference changes are saving.
- The vet's To-do view shows actual tasks, not invented recurring clinic shifts.
  Walk-ins still enter admin physical examination without a published visit.
- Branch-visit publishing and its old frontend service calls are retired. The
  legacy schedule endpoint returns an empty list so older clients cannot show
  saved branch visits again. Historical rows remain in the database.
- Online availability uses weekday buttons and start-time boxes, grouped into
  morning and afternoon. Clicking a time box toggles it and saves immediately;
  no edit button or checkbox is required. Each request changes only that time,
  and other time boxes remain available while it saves.
- Clinic acceptance and Super Admin's assignment checkboxes save immediately.
  Clinic controls pause during a save to keep preference updates in order.
  Failed changes restore the previous selection and show the reason inline.

## Verification

### Daily My List and full To-do schedule

My List shows only today's approved bookings and today's examination/done
patients, using Philippine time. A queue linked to a booking follows the
appointment date rather than the queue entry's creation date. All of the vet's
assigned clinics are visible by default, with a clinic filter available.

The next-booking button opens a read-only list and detail preview. It says
**Tomorrow** when tomorrow has approved bookings; otherwise it says **Next
Monday** (or the actual next booked weekday), skipping days with no approved
bookings. The preview includes the exact date. With no future approved bookings
the button is disabled. Future physical bookings cannot start diagnosis here.

To-dos includes all assigned pending/confirmed medical bookings in the selected
calendar range, including home visits and online calls. Calls retain their
separate category and open online consultations. Each booking is counted once,
regardless of the number of pets or queue records. Calendar dates show booking
counts and open their daily lists; View booking opens the matching My List
preview. No additional database migration is required for this display change.

Database-free checks:

```powershell
php phpTestfiles/test_shared_booking_calendar.php
php phpTestfiles/test_veterinarian_booking_todos.php
node --test src/lib/vetDailyBookings.test.js
node --test src/components/dashboardRouter.test.js
npm run lint -- --ignore-pattern 'tmp/**'
npm run build
```

Live database/browser checks still required:

1. Assign three active vets to a clinic and enable acceptance. Three same-service
   or mixed-service appointments at one time must succeed; a fourth must fail.
2. Assign a vet to both sites. Turning acceptance off at one site must not turn
   it off at the other. Vets cannot add their own clinic assignments.
3. Select online slots without on-site acceptance or per-vet hours. Online slots
   must appear in the owner's vet picker/date/time flow, including a selected
   noon or 5:30 PM start and a date when the physical clinic is closed.
4. Book a one-hour call: overlapping on-site slots for that same vet must become
   unavailable across sites; other vets remain available. Adjacent appointments
   may start exactly at the preceding appointment's end.
5. Edit online slots and clinic acceptance separately. Existing pending/confirmed
   bookings must be protected, and a rejected save must preserve previous data.
6. Check reschedule, confirmation, cancellation and branch-transfer flows.
   Grooming lunch slots and boarding rooms must remain unchanged.
7. Check profile/booking panels in light/dark themes at phone, tablet and desktop
   widths. Verify immediate saving, rapid time toggles, keyboard activation,
   failed-change rollback, error messages, retry, and tab navigation after saving.
8. Check that yesterday's and future bookings do not appear in the main My List.
   A queue created yesterday for today's appointment must still appear today.
   Verify Tomorrow/next-booked-weekday previews, date rollover at Philippine
   midnight, per-day booking counts, cancellations, multiple-clinic assignments
   and To-do View booking links. No booking may be counted twice.

The implementation environment has no connected browser and the local database
connection was refused. The migration and live checks have not been run here.
