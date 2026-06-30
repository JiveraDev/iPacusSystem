# 2026-06-20 Quality Fix Notes

Status: historical release note.

This note records the UX and backend stability revisions completed after the 2026-06-19 planning docs. For the current repository snapshot, see `20260625_repository_update.md`.

## Covered Changes

| Area | Change | Verification Focus |
| --- | --- | --- |
| Queue actions | Queue action buttons now show `View` text for clearer table actions. | Confirm queue rows still open the expected view/details flow. |
| Philippine mobile numbers | Contact number inputs now keep a locked `+639` prefix and normalize pasted `09`, `639`, and `+639` numbers. | Confirm users cannot backspace the prefix and can only submit a complete Philippine mobile number. |
| Logout flow | Dashboard logout now opens a confirmation dialog and shows a toast that includes the account email. | Confirm cancel keeps the session active and confirm logs out after the toast appears. |
| Deactivation actions | Deactivation/status-disable flows now require confirmation in service catalog, account management, pet owner account controls, and related special-service availability controls. | Confirm activation/reactivation remains direct where expected, and deactivation cannot happen from an accidental click. |
| View modals | Shared dialog and sheet content now include visible `X` close controls. | Confirm all view/details modals can close from the header close button and backdrop/escape behavior still works. |
| Notifications | System notification panel positioning was adjusted so it does not cover the dashboard navigation. | Confirm desktop expanded/collapsed sidebar and mobile drawer layouts keep notifications readable. |
| Collapse controls | Sidebar and floating panel collapse buttons were restyled so `<` and `>` states are visible. | Confirm expanded and collapsed states are visually obvious on desktop and mobile-sized layouts. |
| Hotel and boarding rooms | Add-room requests now send an explicit `room_type`, the backend only requires the `rooms` table for room creation, and room capacity updates tolerate schemas with or without `room_id`. | Confirm adding hotel and boarding rooms succeeds, including repeated adds that increase capacity. |

## Backend Notes

- `POST /boarding/rooms` should not be blocked by unrelated monitoring tables such as boarding assignments, observations, or tasks.
- The room creation/update path should use `rooms.room_id` when present and fall back to `room_type` for older local schemas.
- Phone validation should accept complete `+639XXXXXXXXX` values and treat a bare optional `+639` prefix as empty where the field is optional.

## Manual QA Checklist

- Add a new hotel room and boarding room from the admin boarding screen.
- Add the same room type again and confirm capacity increases instead of failing.
- Try deleting the locked `+639` prefix from owner/profile/contact/payment phone inputs.
- Paste `09171234567`, `639171234567`, and `+639171234567` into phone inputs and confirm the display normalizes.
- Open view/details modals from queue, booking, pet, account, and media screens and close them with the `X`.
- Attempt logout and deactivation actions, then cancel and confirm each path.
- Open notifications with the sidebar expanded and collapsed.

## Verification Commands

- `php -l php\boarding_management.php`
- `npm run lint`
- `npm run build`

The later June 23 notification refactor added `/dashboard/notifications`, `NotificationFeed.jsx`, and `useNotificationCenter.js`; include those paths in current responsive regression testing.
