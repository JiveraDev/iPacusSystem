# User Instructions for Different Roles

This guide explains how each iPawcus user role uses the Vetfocus clinic system. It follows the usual care journey from selecting a service, booking or joining the queue, receiving a diagnosis or boarding care, and completing payment and medical records.

## Roles at a Glance

| Role | Main responsibility | Main work areas |
| --- | --- | --- |
| Pet Owner | Register pets, request services, submit payments, attend consultations, and review records | Services, Online Consultations, My Pets, Self-Service Queue, Medical Records, Schedule / TODOs |
| Admin | Run daily clinic operations and review transactions | Bookings, Record Update Requests, Queue, Boarding, POS, Service Catalog, Consent Files, Inventory |
| Veterinarian | Receive patients, document consent, diagnose, prescribe, and maintain clinical records | Approved List, My List, Diagnosis, Medical Records, Record Requests, Online Consults, Histories, Schedule / TODOs |
| Super Admin | Manage the whole clinic configuration and supervise all operational areas | Reports, Accounts, Pet Owners, Payment Methods, Services, plus admin workflows |

Archived users retain their normal system permissions. Archive status is an administrative marker and is not a separate restricted role.

## Common System Use

1. Sign in using the email and password assigned to the account.
2. Use the left navigation on desktop or the menu button on mobile.
3. Check the page title before entering data. Browser-tab titles change according to the selected page.
4. Complete all required fields before submitting a form. Missing or invalid fields are highlighted, and the toast message identifies what must be corrected.
5. For payment references, enter exactly 18 digits. Letters, spaces, and shorter or longer values are rejected.
6. Use image previews to inspect uploaded receipts, payment proofs, pet photos, and clinical attachments before approving or submitting them.
7. Confirm the selected branch whenever the page provides a branch selector. Personnel with a locked assigned branch will see that branch instead of an editable selector.

## Pet Owner Instructions

### 1. Prepare the Owner and Pet Profiles

1. Open **Profile** and confirm the owner's contact information.
2. Open **My Pets**.
3. Select **Add Pet** if the pet is not registered.
4. Enter the pet's identity, species, breed, sex, birth information, and other required details.
5. Upload a clear pet profile image when available.
6. Open an existing pet to review **Update Record**, **Clinical Records**, and **Health History**.

The pet profile should be completed before using workflows that require a registered patient, including clinic diagnosis and organized medical records.

### 2. Book a Clinic Service

Use this flow for services such as General Check-up, Dental Check-up, Vaccination, Grooming, Surgery, Laboratory Testing, and Parasite Control.

1. Open **Services**.
2. Select the required service card.
3. Review the service overview, inclusions, duration, price, and clinic instructions.
4. Select the pet and complete the concern or service-specific questions.
5. Select the branch, date, and available time when required.
6. Review and accept the applicable consent form.
7. Select the available payment method when payment is required.
8. Upload the payment proof and enter its 18-digit transaction number.
9. Submit the request.
10. Wait for clinic review. The booking remains pending until the clinic confirms it.

If submission fails, return to every highlighted field. The error toast names the missing selection, upload, invalid value, or invalid range.

### 3. Book a Home Service

1. Open **Services**, then select **Home Services**.
2. Select the required home-service option.
3. Enter the complete service address and location details.
4. Review the service description. Home-visit pricing may be quoted according to location.
5. Select **Continue to Consent** below the service choices.
6. Complete the consent and payment steps.
7. Upload payment proof and enter the 18-digit transaction number when requested.
8. Submit the booking for clinic review.

### 4. Book Special Services

1. Open **Services**, then select **Special Services**.
2. Select the required special service and pet.
3. Complete the service details and schedule fields.
4. Select a payment method.
5. Upload payment proof and provide the exact 18-digit transaction number.
6. Submit the request and wait for approval.

Payment method selection is required for Special Services and is validated by both the page and the server.

### 5. Book Pet Hotel or Kennel Boarding

1. Open **Services**, then select **Pet Hotel**.
2. Choose the pet and the appropriate kennel or hotel option.
3. Select the intended check-in and check-out dates.
4. Complete care instructions, feeding details, medication details, emergency information, and required uploads.
5. Review and sign the boarding consent.
6. Select a payment method and submit the required payment details.
7. Submit the boarding request for review.
8. Monitor the booking status until the clinic confirms the stay.

The clinic assigns the actual unit and manages check-in, daily care, additional materials, and check-out.

### 6. Use the Self-Service Queue

1. Open **Self-Service Queue**.
2. Select or register the pet.
3. Choose the clinic service and branch.
4. Enter the requested queue and concern information.
5. Submit the queue request.
6. Keep the queue reference visible and wait for clinic handling.

A veterinarian receives eligible patients from the Approved Queue List. The patient then appears in the veterinarian's My List.

### 7. Attend an Online Consultation

1. Open **Online Consultation** and create a booking.
2. Select the pet, veterinarian schedule, date, and time.
3. Complete the consent document.
4. Pay the fixed PHP 500 consultation fee using an available payment method.
5. Upload payment proof and enter the 18-digit transaction number.
6. Wait for booking confirmation and for the veterinarian to start the room.
7. When notified that the veterinarian is ready, open the consultation and join the call.
8. The owner may join as soon as the veterinarian is ready; there is no 10-minute joining restriction.
9. Use **Minimize** to keep the call active while viewing other dashboard pages, then use the floating call control to return.
10. Use **Leave** when finished.

Completed, cancelled, or no-show consultation rooms cannot be reopened using the browser Back button.

### 8. Review Payments, Records, and Follow-ups

1. Open the relevant booking to review its status and payment details.
2. Compare the uploaded proof with the transaction number shown beside it.
3. Open the pet profile and select **Health History** to review or export clinical medical logs.
4. If a paid or finished record needs correction, select **Update Record**.
5. Complete the record update request, select payment details when required, upload proof, and provide the 18-digit transaction number.
6. Track the request while it is under review or assigned to a veterinarian.
7. Open **Schedule / TODOs** to review appointments, boarding tasks, payments, follow-ups, and reminders.

## Admin Instructions

### 1. Review and Manage Bookings

1. Open **Bookings Management**.
2. The initial view uses **All Service Type**, **All Status**, and **All Dates** so existing bookings are visible immediately.
3. Use search, service type, status, branch, and date filters only when needed.
4. Open a booking to review owner, pet, service, consent, schedule, payment proof, and transaction number.
5. Compare the receipt or proof with the 18-digit transaction number.
6. Approve, confirm, reschedule, relocate, reject, or cancel according to clinic policy and available actions.
7. Use **Add Booking** for an authorized staff-created appointment.

Past calendar dates display as **Closed**. **Full** is reserved for dates whose capacity is actually full.

### 2. Process Record Update Requests

1. Open **Record Update Requests**.
2. Search for the request, owner, or pet and filter by request status when necessary.
3. Open the request and review its submitted payment proof.
4. Check the transaction number displayed beside the proof.
5. Preview the uploaded image before deciding.
6. Verify or waive payment according to clinic policy.
7. Approve the request and assign an active veterinarian, or reject it with a clear reason.
8. Monitor assigned and in-progress requests until the veterinarian completes the record update.

### 3. Manage the Clinic Queue

1. Open **Queue Management**.
2. Review walk-in, self-service, and booking-based queue entries.
3. Confirm the pet, service, branch, queue status, and relevant booking details.
4. Correct or update the queue entry when operationally required.
5. Veterinarians will receive eligible patients from their **Approved List**.

### 4. Manage Boarding Operations

1. Open **Pet Hotel & Kennel Boarding Management**.
2. Confirm the branch shown in the grouped page header.
3. Switch between **Kennel Boarding** and **Pet Hotel Boarding**.
4. Review available, reserved, occupied, and maintenance units.
5. Assign a confirmed booking to an appropriate unit.
6. Complete check-in and verify consent, owner contact details, pet care instructions, and desired check-out.
7. Record observations, feeding, bathing, play, medication, inspections, and other daily tasks.
8. Add used supplies or medication materials when needed.
9. Generate or upload boarding documents and monitoring records.
10. Review charges and complete check-out when the stay is finished.

### 5. Use Point of Sale and Payments

1. Open **POS**.
2. Select the relevant customer, booking, service, or visit.
3. Add service, medicine, product, or boarding charges.
4. Verify quantities, prices, payment method, and the 18-digit transaction reference.
5. Record the payment and provide the receipt.

The **Record Refund** action is intentionally hidden for now. Refund UI must not be used until clinic management enables the workflow.

### 6. Manage Inventory

1. Open **All Inventory Items**.
2. Inventory is the only area where filters remain unapplied until a **Select ...** filter value is chosen.
3. Use **Add Item** to create a new medicine, product, vaccine, or supply record.
4. Use **Stock In** to record supplier deliveries, batch numbers, quantities, locations, expiry dates, and receipt attachments.
5. Use stock-out actions when supplies are issued or consumed.
6. Monitor low stock, near expiry, and disposal logs.

### 7. Manage Consent Templates and Services

1. Open **Consent Files** to create, import, edit, preview, activate, deactivate, or remove reusable consent templates.
2. Use template codes for automatic owner, patient, service, veterinarian, license, branch, and date information.
3. Open **Services** and select a child service page to edit client-facing content in its modal.
4. Update service inclusions, duration, price, instructions, and relevant home-service options.
5. Save and verify the corresponding pet-owner booking page.

Both Admin and Super Admin roles can edit service content directly from the service child pages. The old Display Settings or Client-facing Service Content block is not part of Booking Management or the Service Catalog.

## Veterinarian Instructions

### 1. Receive a Patient from the Approved Queue

1. Open **Approved List**.
2. Review today's queue patients, confirmed current-date bookings, and missed physical bookings.
3. Search for the patient and verify the branch.
4. If a confirmed physical booking is not scheduled today, reschedule it to today when appropriate.
5. Select **Receive** for an eligible registered pet.
6. The patient moves to **My List** and becomes assigned to the veterinarian.

### 2. Prepare Consent in My List

1. Open **My List**.
2. Select the received patient.
3. Verify patient, owner, service, branch, queue, and booking information.
4. Select the correct consent template.
5. Capture or upload the required signature or physical consent document.
6. Save the signed consent PDF.
7. Confirm that consent is recorded before starting the diagnosis.

### 3. Diagnose and Complete the Clinic Visit

1. From **My List**, select **Start Diagnosis** after consent is ready.
2. Record the complaint, findings, diagnosis, treatment, recommendations, prescriptions, attachments, and required clinical fields.
3. Save progress when the visit is still being handled.
4. Review all clinical content before completing the diagnosis.
5. Complete the service when documentation is final.
6. The completed entry becomes available in **Diagnosis Histories** and the pet's medical record.

### 4. Conduct an Online Consultation

1. Open **Online Consults**.
2. Select a confirmed scheduled consultation.
3. Start the consultation room so the pet owner is notified that the veterinarian is already in the call.
4. Join the room and conduct the video consultation.
5. Use minimize and restore controls when navigating during the call.
6. Capture the remote participant only when authorized and needed; the capture targets the person being spoken to, not the local user.
7. Record the online diagnosis, treatment, recommendations, medications, notes, and attachments.
8. Complete the consultation to close the meeting and its linked booking.

After completion, the room is closed for both the veterinarian and pet owner and should not be re-entered through browser history.

### 5. Process an Approved Record Update Request

1. Open **Record Requests**.
2. Review approved owner requests assigned to the veterinarian or available for assignment.
3. Accept or start the request.
4. Open **Medical Records** for the request's pet.
5. Review the source diagnosis sheet, existing clinical data, and owner request.
6. Create or edit an organized medical summary.
7. Add appropriate diagnosis, vaccination, prescription, or service records to the organized group.
8. Edit the Group Summary and Source Diagnosis Sheet as needed.
9. Save the revision and mark the record update request complete.

### 6. Maintain Organized Medical Records

1. Open **Medical Records**.
2. Search for a pet by name, pet ID, breed, or owner.
3. Review the pet information and vaccination history.
4. Select **New Organized Summary** from the Organized Medical Records header.
5. Give the summary a clear title, such as the pet's clinical summary.
6. Drag or add completed source records into the correct organized summary.
7. Edit titles, group summaries, source diagnosis summaries, and revision notes.
8. Choose whether the organized record is visible in the pet-owner print view.
9. Save and verify the final owner-ready record.

Spaces and normal multi-word typing are supported in Group Summary and Source Diagnosis Sheet fields.

### 7. Review Histories and Schedule

1. Open **Histories** to review completed clinic, online, and boarding records.
2. Search and filter by record source when needed.
3. Preview attachments, consent documents, images, prescriptions, and record details.
4. Open **Schedule / TODOs** to manage clinic schedules, payments, follow-ups, boarding tasks, and personal reminders.

## Super Admin Instructions

The Super Admin supervises system-wide configuration while also supporting clinic operations.

### 1. Manage Accounts and Access

1. Open **Account Management**.
2. Search or filter personnel accounts.
3. Select **Create Account** to add an authorized clinic user.
4. Open an account to review personal and professional information.
5. For Admin and Super Admin assignments, edit the assigned branch, position, and employment status in the expanded account dialog.
6. For Veterinarians, verify professional information, specialization, and PRC license number.
7. Save assignment changes or archive the account as an administrative marker.

During Admin assignment editing, unrelated employment-history and government-number fields are hidden or read-only so the branch and position controls remain clear.

### 2. Manage Pet Owners

1. Open **Pet Owners**.
2. Search by owner or pet and switch between card and table views.
3. Open an owner to review linked pets and activity.
4. Archive or restore an owner when authorized.

### 3. Manage Payment Methods

1. Open **Payment Methods**.
2. Review the e-wallet and bank-transfer details used for owner payments, invoices, refunds, and reports.
3. Select **Add Method** to create a method.
4. Edit or deactivate outdated payment information.
5. Use **Refresh** to reload current database values.

### 4. Manage Service Content

1. Open **Services**.
2. Select the specific child service, such as General Check-up or Dental Check-up.
3. Use the service-content edit modal on that child page.
4. Update the overview, included items, duration, price, instructions, and service-specific options.
5. Save the changes and verify the client-facing booking page.

Admin and Super Admin have the same service-content editing access on service child pages.

### 5. Review Reports and Clinic Operations

1. Open **Reports Dashboard** for clinic performance, patient activity, billing, inventory, and service demand.
2. Select the report period.
3. Open **Report Center** for focused exports and detailed reporting.
4. Use the Admin workflows in this guide when supervising bookings, queues, boarding, POS, consent, and inventory.

## End-to-End Workflow Reference

### Clinic Appointment

Pet Owner booking request → Admin booking and payment review → Confirmed appointment → Queue entry → Veterinarian receives patient → Consent recorded → Diagnosis completed → POS payment or receipt finalized → Medical history available

### Self-Service Queue

Pet Owner submits queue request → Admin monitors queue → Veterinarian receives patient from Approved List → Patient enters My List → Consent recorded → Diagnosis completed → History updated

### Online Consultation

Pet Owner selects schedule and pays PHP 500 → Admin confirms booking/payment → Veterinarian starts room → Owner is notified and joins → Veterinarian completes diagnosis → Consultation and booking close → Records become available in history

### Boarding

Pet Owner submits boarding request and consent → Admin confirms booking → Unit assigned → Pet checked in → Daily observations, tasks, medication, and materials recorded → Charges reviewed → Payment finalized → Pet checked out → Boarding history retained

### Medical Record Update

Pet Owner submits request, proof, and transaction number → Admin reviews image and payment → Admin approves and assigns veterinarian → Veterinarian updates organized medical record → Request marked complete → Owner reviews updated Health History

## Status and Filter Guidance

- Use **All ...** filters on non-inventory pages to display all records at the start.
- Inventory filters intentionally begin with **Select ...** and do not filter until the user chooses a value.
- **Pending** means the request still needs review or confirmation.
- **Confirmed** means the clinic approved the booking and reserved the schedule.
- **In Progress** means clinic or veterinarian work has started.
- **Completed** means the operational and clinical workflow is finished.
- **Closed** on a calendar means the date is in the past or not open for booking.
- **Full** means all available capacity is already allocated.
- **Archived** is an administrative marker; it does not automatically change normal role permissions.

## Troubleshooting

- If no records appear, reset non-inventory filters to **All ...**. In Inventory, explicitly choose the needed **Select ...** values.
- If a form will not submit, inspect highlighted fields and read the specific toast message.
- If payment submission fails, confirm the payment method, proof upload, and exact 18-digit transaction number.
- If an image does not appear, refresh the page and reopen the protected preview while signed in.
- If a dropdown is hidden, close overlapping sheets and reopen the modal. Dropdowns should display above dialogs and side sheets.
- If an online call cannot be opened, confirm that the booking is confirmed and the veterinarian has started the room.
- If the call is completed, return to the consultation list; closed rooms cannot be reopened.
- On mobile consultation pages, scroll within the page to reach the remaining controls.

