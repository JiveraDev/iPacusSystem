# Prescription workflow

Issued prescriptions are permanent clinical records. A vet can add a new
prescription from the pet's EMR or a saved diagnosis. The form starts empty and
does not reuse medicines from an earlier prescription. Draft medicines can be
removed before issuing; issued directions cannot be edited or replaced.

An additional prescription has its own plan and start confirmation. Issuing it
does not cancel pending doses, restart medicines, or change an earlier course.
Repeated submissions of the same draft are deduplicated. A fresh draft can
prescribe the same medicine as another course.

The default **Active** view shows medicines waiting to start and medicines still
in progress. When every scheduled dose is recorded as Taken or Skipped, that
medicine moves to **History**. Skipped doses retain their skipped status;
completion means the checklist is resolved, not that every dose was taken.
Pending and missed doses keep the medicine active. Finishing one medicine does
not hide another unfinished medicine from the same prescription.

As-needed medicines have no scheduled final dose. Starting activates the medicine
without creating artificial doses. **Mark finished** moves it to History when the
course is finished according to the vet's directions. Owners can finish their
own pet's as-needed medicines; clinic staff retain existing pet record access.

History keeps directions, start dates and dose records. Correcting a scheduled
dose back to Pending restores that medicine to Active. This changes the checklist,
not the issued prescription. Older superseded or stopped prescriptions remain
archived and their checklists cannot be changed.

The backend rejects the former `/prescriptions/{id}/amend` action. Reopening a
diagnosis allows findings to change while preserving its issued medicines.
New prescriptions use `POST /pets/{petId}/prescriptions`. Completion of an
as-needed medicine uses `POST /prescription-items/{itemId}/complete`; scheduled
completion is recalculated after each checklist action and when records are read.

No additional schema migration is needed. The existing
`DDL/20261005_01_pet_prescription_schedules.sql` tables must already be installed.
The retained version columns identify existing records and independent additions;
new additions do not supersede an earlier plan.

Validation:

- `php scripts/tests/prescription-add-only.php` exercises the actual helpers with
  disposable SQLite fixtures (PHP 8.4+ with PDO SQLite). It verifies isolation of
  added prescriptions, immutability, completion, history and ownership filtering.
  It does not verify MySQL locking or a deployed database.
- `node --test src/lib/prescriptions.test.js` verifies Active/History selection,
  mixed courses, new additions and the start prompt.
- Run lint, build and PHP syntax checks. In a connected browser, verify the first
  prescription, an additional prescription, finishing one medicine, History,
  as-needed completion and reopening a mistaken dose completion.
