# Detailed Staff Activity Narratives (Dormant Proposal)

Status: **not active and not imported by the application**.

This proposal prepares human-readable audit wording without changing the current Activity Log. It must remain dormant until explicit approval is given to activate it.

## Intended result

The visible activity should answer four questions immediately:

1. Who performed the action?
2. What did the person do?
3. Which named pet, product, booking, service, room, or account was affected?
4. At which branch and time did it occur?

Examples:

- `Admin1 registered Dallas`
- `Admin1 stocked in 10 boxes of Biogesic`
- `Dr. Reyes saved diagnosis — Buddy`
- `Admin1 received booking BKG-1048 for Max`
- `Admin1 transferred 5 vials of Anti-Rabies Vaccine from Main Clinic to VFC Pharmacy Enriquez`
- `Super Admin deactivated the account of Anna Cruz`

Names are the primary visible wording. Immutable IDs must still be retained as secondary references so records remain unambiguous when names are duplicated or changed later.

## Safe activation design

Activation should be controlled by one disabled-by-default feature switch, such as `IPAWCUS_DETAILED_ACTIVITY_NARRATIVES=1`. Until that switch is approved and enabled:

- the current stored log format stays unchanged;
- the current Activity Log UI stays unchanged;
- no existing activity is rewritten;
- no database migration is required.

When activation is approved, the central activity recorder should create a versioned `narrative` field after each successful mutation. The UI can prefer that field and fall back to the existing `action_label` for old records.

## Required safe-name snapshots

The central recorder should resolve and snapshot only operational identifiers needed for accountability:

| Module | Visible named context |
| --- | --- |
| Pet registration and records | Pet name, owner name when needed |
| Booking and queue | Pet name, booking/queue number, service |
| Grooming | Pet name, workflow action, veterinarian handoff outcome |
| Diagnosis and visits | Pet name, visit type; never copy clinical free text into the audit sentence |
| Inventory | Product name, quantity, unit, source and destination location |
| Boarding/confinement | Pet name, room/kennel, workflow action |
| Accounts | Staff/owner display name and account action |
| Services and consent | Service/template display name and action |
| Payments and reports | Safe transaction/report category only; never expose credentials or full payment references |

The snapshot keeps the wording historically accurate even if the underlying pet, product, or user is renamed later.

## Privacy boundary

The narrative must never include passwords, tokens, private notes, diagnosis text, prescription instructions, full payment references, contact details, addresses, uploaded file paths, or other unrestricted free text. Detailed sensitive values remain in their proper clinical or billing record, not in the activity sentence.

## Prototype

`activityNarrative.mjs` is a standalone formatter showing the proposed wording. It is deliberately not imported anywhere under `src/` or `php/`, so it cannot affect the current application.

Run its isolated tests with:

```bash
node --test proposals/staff_activity_narratives/activityNarrative.test.mjs
```
 
