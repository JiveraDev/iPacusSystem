# Current Update README

Date: 2026-07-10

This note summarizes the current working update set and the database work needed before testing the full flow in the browser.

## Main Changes

### Co-parent Pet Linking

- Pet linking now supports an approval workflow when a pet already has a primary owner.
- First linked owner remains the primary owner.
- A second owner entering the same Pet Registration ID no longer gets linked immediately.
- The system creates a pending co-parent request.
- The primary owner receives:
  - an in-app ownership notification
  - an email with a button labeled `Review co-parent request`
- Clicking the notification or email opens a co-parent request modal in `My Pets`.
- The primary owner can approve or decline the request.
- Approval links the requester as:
  - `relationship = co_parent`
  - `is_primary = 0`
- The requester receives a notification when the request is submitted and when it is approved or declined.
- The co-parent request modal footer `Close` button was removed. The top-right dialog close control remains.

### Notifications

- Added an `ownership_updates` notification category.
- Ownership/co-parent notifications now have their own label and icon in the notification UI.
- The co-parent approval email uses the existing HTML email CTA button.
- The plain text email fallback still includes the raw review URL.

### Pet Linking Security

- Pet owners can only link pets to their own account.
- Admin/Super Admin can still perform administrative linking behavior where allowed.
- Co-parent request approval is limited to the primary owner or Super Admin.
- Request cancellation is limited to the requester or Super Admin.

### Previous Current Batch Highlights

- Date inputs now reject free text and only accept valid date formats.
- Payment-method OTP bypass was removed.
- Account Management can filter Active and Deactivated accounts.
- Co-parent ownership metadata was introduced.
- Report Center layout was improved and the payment-method filter was removed.
- Booking now adds the PHP 50 POS booking fee.
- Duplicate active bookings per pet/service are restricted.
- Home-service daily and afternoon limits were added.
- QRPH display was enlarged and visible `View Larger` text was removed.
- Consent assignment now enforces one pet-owner-readable assignment per service.
- Upload title can be edited from the selected filename.
- Dialog overlay top/bottom white band issue was fixed.
- Vet approved list, online consult filters, diagnosis vitals numeric restrictions, consent preview, record update workflow, and MyList card/table mode were updated.
- Boarding room availability collation error was fixed.
- Reminder dry-run/send test helper was added.

## Database Work Needed

Yes, the database must be updated for the co-parent workflow.

Run this migration:

```text
DDL/20260709_coparent_requests.sql
```

This migration is required because the old `pet_ownership` table has a single-column unique index on `pet_id`, which blocks more than one owner from being linked to the same pet. Co-parenting requires multiple owners per pet.

The migration handles:

- Adds `pet_ownership.relationship`
- Adds `pet_ownership.is_primary`
- Backfills existing ownership records as `primary` or `co_parent`
- Adds a normal non-unique `pet_id` index
- Removes the old single-column unique `pet_id` index
- Adds unique `(user_id, pet_id)` to prevent duplicate ownership by the same user
- Creates `pet_coparent_requests`
- Adds `notification_preferences.ownership_updates`

## Important DB Constraint Change

Old behavior:

```sql
UNIQUE KEY pet_id (pet_id)
```

This allowed only one owner per pet.

New behavior:

```sql
INDEX pet_ownership_pet_idx (pet_id)
UNIQUE KEY pet_ownership_user_pet_unique (user_id, pet_id)
```

This allows multiple owners for one pet, while still preventing the same user from being linked to the same pet more than once.

## If Approval Still Shows 500

Check whether the old unique `pet_id` index still exists:

```sql
SHOW INDEX FROM pet_ownership;
```

If a unique index exists only on `pet_id`, remove it:

```sql
ALTER TABLE pet_ownership DROP INDEX pet_id;
```

Then add the replacement indexes if they are missing:

```sql
ALTER TABLE pet_ownership ADD INDEX pet_ownership_pet_idx (pet_id);
ALTER TABLE pet_ownership ADD UNIQUE KEY pet_ownership_user_pet_unique (user_id, pet_id);
```

## Verification Already Run

- `php -l php/link_pet.php`
- `php -l php/coparent_request_helpers.php`
- `php -l php/coparent_requests.php`
- `php -l php/notification_helpers.php`
- `npm run lint`
- `npm run build`

## Manual QA Needed

Test this flow after applying the DB migration:

1. Owner A links a pet using the Pet Registration ID.
2. Owner B enters the same Pet Registration ID.
3. Owner B should see a message that the pet is already owned and a co-parent request was sent.
4. Owner A should receive an in-app notification and email.
5. Owner A clicks the email button or notification.
6. The co-parent modal opens in `My Pets`.
7. Owner A approves.
8. Owner B should now see the pet in `My Pets`.
9. Confirm `pet_ownership` has one primary row and one co-parent row for the same pet.
