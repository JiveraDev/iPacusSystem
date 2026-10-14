# Configured database verification and Pet Hotel clinic selection

Reviewed: 2026-10-14. These checks use the normal `.env` database, separately from the sandbox. No database records or table definitions were changed.

## Database results

| Check | Result |
| --- | --- |
| Connection and normal API health | Pass; HTTP 200 |
| Table readability | All 88 tables readable |
| Table/column comparison with the latest supplied export | No missing tables or columns |
| Exported indexes | Incomplete: 87 tables missing exported indexes, including primary keys |
| Foreign keys | No constraints installed; 75 tables are missing exported constraints |
| Auto-increment | Missing from 80 tables that require it in the export |
| Duplicate primary-key groups | None found against the exported primary-key definitions |
| Fifteen ownership/booking/queue/session/billing/stock relationships | No orphaned rows found |
| Google prerequisite probe | Configuration, dependencies and basic table/column checks pass |
| Service catalog and veterinarian-status storage | Pass |
| Grooming tables | Pass; private photo directory is not ready |
| Anonymous protected API requests | Accounts, bookings, inventory and Google account routes return 401 |
| Direct PHP/environment access | 404 on the local API server |
| Google request from an untrusted origin | 403 |

The connection works, but the import is incomplete. Missing primary/unique keys and auto-increment affect insert correctness, session creation and duplicate prevention. Passing a GET or the basic Google prerequisite check does not establish that login, registration or writes are ready.

Run the read-only check again with:

```powershell
npm.cmd run check:db -- "C:\Users\loren\Downloads\u813606159_new_ipawcus_sy.sql"
```

It uses a read-only transaction and saves metadata/counts in `tmp/database-readiness/summary.json`. It does not print records or credentials. The nonzero exit code is expected while schema requirements are missing.

## Prepared schema recovery artifact

`tmp/database-readiness/missing-schema.sql` contains 242 missing `ALTER TABLE` statements selected from the latest export: indexes/primary keys, auto-increment column changes and foreign keys. It is **review-only and has not been applied**. It does not insert, replace or delete records.

Back up the configured database and review every statement before applying it. Duplicate primary keys were checked; all unique-index combinations, full foreign-key references and server compatibility still need validation before executing DDL. DDL changes can commit independently, so a failed multi-statement import is not automatically rolled back. Re-run the metadata checker after any repair.

The private grooming photo path also needs to exist outside the website tree with PHP write access. This review did not create directories outside the workspace or change `.env`.

## Pet Hotel display change

The landing-page **Choose a Pet Hotel room** panel now has a shared **Clinic location** selector. It uses the active clinic choices returned by the booking-availability endpoint. Changing clinic requests `branchId` for that location, reloads its room counts, and temporarily disables room selection. Late responses from a previous location are ignored. Automatic refresh remains quiet after loading.

Selecting a room saves both its size and the selected branch in the landing booking intent. Pet-owner login then opens the Pet Hotel form with that branch retained. The existing dashboard Pet Hotel booking form already has a branch selector and requests availability with `branch_id`; no new backend endpoint or schema change is needed for this UI change.

Verified: live availability returns branch 1 for VFC Pharmacy/Main Clinic and branch 3 for VFC Pet Corner Main Enriquez St.; landing intent regression preserves the chosen branch and room through login; frontend lint/build pass. Headless browser validation is recorded separately when complete.
