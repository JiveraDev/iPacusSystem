# Empty-table backend audit

## Meaning of the JSON finding

The JSON export contained table names with no rows, so it could not reveal
their columns or data types. That did **not** prove that the database tables had
no schema. The repository DDL, PHP endpoints, route policy, and frontend callers
were cross-checked to recover the intended contract.

No SQL in this repair package was executed by Codex. The database operator must
follow `20260723_BACKEND_INTEGRITY_RUNBOOK.md`.

## Table-by-table result

| Table | Audit result | Backend adjustment | Database/operator action |
| --- | --- | --- | --- |
| `boarding_assignments` | Existing schema and active workflow were present. Lifecycle and checkout relationships needed stricter enforcement. | Assignment state, booking, room, pet, and checkout billing checks were hardened. Payment and checkout now require the captured stay price plus every recorded material. | Run script `01`; no historical row fabrication. Desired-date extensions still require the clinic-approved extension charge because no historical rate policy exists in the schema. |
| `boarding_documents` | Existing schema was present; an empty table is valid before the first upload. | Upload actor, assignment/booking/pet lifecycle, normalized path, and failed-insert cleanup were enforced. | No new table definition; baseline table must exist. |
| `boarding_observations` | Existing free-text schema was present but clinical monitoring lacked structured attributes. | Added structured appetite, water, elimination, behavior, temperature, weight, severity, and veterinarian-review support; history is filterable and no longer silently truncated. | Script `01` adds the eight optional structured columns. |
| `boarding_tasks` | Existing schema was present; empty is valid before staff schedule tasks. | Creation/completion now validates assignment lifecycle, booking/pet relationship, state transitions, and authenticated actor. | No new table definition; baseline table must exist. |
| `online_consultation_reschedules` | Existing schema was present, but history/state safeguards were incomplete. | Strict Manila-time validation, no-op detection, terminal/in-progress state rejection, assigned-veterinarian/admin authorization, authenticated actor, and additive `reschedules` history were implemented. | Script `01` adds a supporting history index. |
| `pet_allergies` | Existing minimal schema was present, but the legacy pet text field and normalized rows could diverge and clinical provenance was missing. | Normalized rows are canonical; legacy reads/writes remain compatible; clinical/profile/registration changes are merged, deduplicated, audited, and synchronized. | Script `01` adds audit/verification fields and duplicate protection. Script `02` copies exact legacy values without clearing them. Clinic staff must review `needs_review` rows. |
| `pet_owner_todos` | Existing complete schema and owner-scoped endpoint were present. An empty table simply means no owner has created a task yet. | No workflow redesign was needed. | Script `01` adds a supporting status/end-date index. |
| `pet_record_update_requests` | Existing request/payment fields were present, but completion did not prove that medical data changed and transition history was absent. | Payment-before-work, guarded transitions, active-veterinarian assignment, authenticated actors, before/after snapshot evidence, notes, and transition events were added. | Script `01` adds two hashes and `pet_record_update_request_events`. Legacy completed rows without reconstructable hashes remain a manual-review list. |
| `room_unit_statuses` | Existing complete schema, uniqueness, and room-status workflow were present. Empty can mean no unit is manually under maintenance. | No process change was needed. | Baseline table must exist; do not manufacture status rows. |
| `service_materials` | Existing complete schema and transactional service-material editor were present. Empty means material presets have not been configured, not that attributes are missing. | Schema readiness and useful migration guidance remain in place. | Configure real presets manually in Service Catalog Management; quantities/material choices must not be guessed. Script `01` adds a supporting lookup index. |
| `visits` | Existing schema was present but old completed clinical work was not consistently linked to a visit, and identity uniqueness was not guaranteed. | Diagnosis/online completion now creates or reuses one visit transactionally, with idempotent retries and strict identity validation. | Script `01` installs identity unique keys. Run `03a`, resolve every blocker, then run `03b` to reconstruct only evidence-backed history. |
| `visit_charges` | Existing schema was present, but paid/refunded invoices could be mutated and boarding material billing had no durable trace. | Charge mutation is locked after payment/refund; authenticated actors are used; each boarding material charge carries a one-to-one usage link. | Script `01` adds the boarding-material usage link, unique key, and foreign key. Script `03b` creates only positive-price charges supported by captured booking data. |
| `visit_payments` | Existing schema was present, but global reference reuse, overpayment, partial-payment preservation, and refunded-state safety required hardening. | References are globally permanent per method, verified retries are idempotent, overpayments/empty invoices are rejected, later partial payments preserve charges, and refunded visits cannot be reopened by recalculation. | Script `01` safely adds `cash`, trims references only when collision-free, and installs the unique method/reference key. No historical payment is created by any repair script. |

## Deployment gates

Do not deploy the SQL or source independently. The release is ready to reopen
writes only when:

1. script `01` finishes without its schema-contract error;
2. script `02` reports no missing legacy allergy value;
3. `03a` contains no `BLOCKED_*` or duplicate conflict;
4. approved `03b` verification counts are zero;
5. script `04` problem counts are zero, excluding its explicitly
   informational review queues;
6. the functional smoke tests in the runbook pass.
