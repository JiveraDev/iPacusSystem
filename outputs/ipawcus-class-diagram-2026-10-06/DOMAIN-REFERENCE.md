# iPawcus domain UML class diagram

Open `ipawcus-system-class-diagram.drawio`. The first sheet follows the supplied reference: three-part class boxes with typed attributes, domain operations, and relationships.

This replaces the architecture-style interpretation with a conceptual software class model. It is not a table-only ERD, screen diagram, or claim that every class is literally declared in the procedural PHP/functional React implementation.

Coverage: 91 domain classes — all 89 persistent classes (88 from the export plus PhysicalExamination from the current migration), and 2 stateless domain responsibilities. 1069 persistent attributes; 174 source-backed operations.

## What the model means

- Every object has a name, attributes compartment, and operations compartment. Empty compartments are intentional where there is no state or verified operation.
- Attributes are readable camelCase aliases of the supplied SQL fields. Complete exact mappings, original types, nullable flags, enums, and keys are retained in `domain-model.json`.
- Operation names describe domain responsibilities. Source references below identify their actual functions or observed queries; conceptual names do not assert literal object methods.
- Solid lines are associations backed by declared foreign keys. Multiplicities follow nullability and uniqueness; a parent is not required by SQL to have any children.
- Dashed lines without arrows are verified logical references absent from the export's FK definitions (assigned booking vet, consent context, and prescription source). They are not asserted database constraints. Prescription source links are conditional: `source_type` selects either clinic diagnosis or online diagnosis, so each alternative has `0..1` at its source-record end.
- Dashed arrows mean domain service dependencies, labeled separately with `uses`, not multiplicities.
- The main sheet shows core objects with selected attributes. The complete-model sheet contains every class and persistent attribute. Nine domain detail sheets repeat full owned classes and short references.
- Reference boxes are the same class, not additional objects. Editable tooltips identify their full definition sheet.
- `PhysicalExamination` maps to `clinical_intakes`, which is missing from the supplied SQL export but defined by the current migration. No database or supplied SQL change was made.
- Legacy veterinarian working-hours, time-off, and clinic-visit records are retained for schema completeness, not represented as the current onsite scheduling policy.

## Current workflows represented

- Administration: starts a physical examination for booking/queue patients, saves signs and vital findings, uploads evidence, captures consent, and can reassign the veterinarian. Recorded-by and assigned-vet associations remain distinct.
- Veterinarian: records/finalizes diagnosis, adds additional consent, and prints a prescription when it has content. Physical examination provenance is linked through the shared queue.
- Onsite booking: clinic assignments, per-clinic acceptance, branch hours, existing reservations, and veterinarian capacity are represented by BookingScheduler and associated objects. OnlineVetSchedule remains separate.
- Prescriptions: each pet has versioned plans, individually startable/updatable medicine items, and dated occurrences with completion state. OnlineDiagnosis also issues a prescription plan.
- ConsentRecord keeps owner, patient, queue/booking/visit context, template, signature document, and processing staff.
- ReportGenerator represents dashboard/report behavior without inventing a database table. Grooming, boarding, inventory, billing, ownership, authentication, and notifications are included on the complete/detail sheets.

## Sheets

| Sheet | Content |
| --- | --- |
| 00 | System Class Diagram — 35 classes, selected attributes |
| 01 | Complete Domain Model — 91 classes |
| 02 | Identity and access — 9 classes |
| 03 | Clinics and scheduling — 10 classes |
| 04 | Pets and medical records — 12 classes |
| 05 | Bookings and clinical workflow — 9 classes |
| 06 | Online consultations and prescriptions — 8 classes |
| 07 | Grooming and boarding — 11 classes |
| 08 | Inventory and materials — 12 classes |
| 09 | Billing and service catalogues — 12 classes |
| 10 | Notifications and system operations — 6 classes |

## Object responsibilities and implementation evidence

### AdminFeaturePermission

Persistent mapping: `admin_feature_permissions`. Definition sheet 2.  

- `savePermissions()` — [src/services/adminFeatureAccessService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/adminFeatureAccessService.js:11) (`saveAdminFeatureAccess`)

### AdminPermissionAudit

Persistent mapping: `admin_feature_permission_audit`. Definition sheet 2.  

No distinct operation is asserted; this object is supporting persistent state.

### AdminProfile

Persistent mapping: `admin_profiles`. Definition sheet 2.  

- `updateProfile()` — [src/services/accountService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:29) (`updatePersonnelAccountDetails`)

### ApiAccessToken

Persistent mapping: `api_access_tokens`. Definition sheet 2.  

- `viewRecord()` — [php/auth_access_helpers.php:148](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:148): Conceptual read responsibility backed by an observed table query.

### BoardingAssignment

Persistent mapping: `boarding_assignments`. Definition sheet 7.  

- `assignRoom()` — [src/services/boardingService.js:36](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:36) (`assignBoardingRoom`)
- `checkIn()` — [src/services/boardingService.js:44](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:44) (`checkInBoardingBooking`)
- `checkOut()` — [src/services/boardingService.js:48](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:48) (`checkOutBoardingBooking`)
- `updateCheckOut()` — [src/services/boardingService.js:52](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:52) (`updateDesiredCheckOut`)

### BoardingDocument

Persistent mapping: `boarding_documents`. Definition sheet 7.  

- `addDocument()` — [src/services/boardingService.js:73](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:73) (`createBoardingDocument`)
- `listDocuments()` — [src/services/boardingService.js:68](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:68) (`fetchBoardingDocuments`)

### BoardingMaterialUsage

Persistent mapping: `boarding_material_usages`. Definition sheet 7.  

- `recordUsage()` — [src/services/boardingService.js:82](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:82) (`createBoardingMaterial`)
- `removeUsage()` — [src/services/boardingService.js:86](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:86) (`removeBoardingMaterial`)

### BoardingObservation

Persistent mapping: `boarding_observations`. Definition sheet 7.  

- `recordObservation()` — [src/services/boardingService.js:56](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:56) (`createBoardingObservation`)

### BoardingTask

Persistent mapping: `boarding_tasks`. Definition sheet 7.  

- `createTask()` — [src/services/boardingService.js:60](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:60) (`createBoardingTask`)
- `completeTask()` — [src/services/boardingService.js:64](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:64) (`completeBoardingTask`)

### Booking

Persistent mapping: `bookings`. Definition sheet 5.  

- `createBooking()` — [src/services/bookingService.js:43](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:43) (`createBooking`)
- `updateSchedule()` — [src/services/bookingService.js:53](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:53) (`updateBookingSchedule`)
- `updateStatus()` — [src/services/bookingService.js:49](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:49) (`updateBookingStatus`)
- `receiveBooking()` — [src/services/bookingService.js:58](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:58) (`receiveBooking`)
- `cancelBooking()` — [src/services/bookingService.js:49](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:49) (`updateBookingStatus`)

### BookingBranchTransfer

Persistent mapping: `booking_branch_transfers`. Definition sheet 5.  

- `transferBooking()` — [src/services/branchService.js:114](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:114) (`relocateBooking`)

### BookingPaymentRefund

Persistent mapping: `booking_payment_refunds`. Definition sheet 9.  

- `processRefund()` — [src/services/bookingService.js:35](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:35) (`postBookingPaymentRefund`)

### BookingPaymentSubmission

Persistent mapping: `booking_payment_submissions`. Definition sheet 9.  

- `reviewPayment()` — [src/services/bookingService.js:31](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:31) (`reviewBookingPayment`)

### BookingPet

Persistent mapping: `booking_pets`. Definition sheet 5.  

- `attachPet()` — [src/services/bookingService.js:43](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:43) (`createBooking`)

### Branch

Persistent mapping: `branches`. Definition sheet 3.  

- `listBranches()` — [src/services/branchService.js:72](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:72) (`fetchBranches`)
- `checkAvailability()` — [src/services/bookingAvailabilityService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingAvailabilityService.js:3) (`fetchBookingAvailability`)
- `relocateBooking()` — [src/services/branchService.js:114](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:114) (`relocateBooking`)

### BranchClosure

Persistent mapping: `branch_closures`. Definition sheet 3.  

- `checkClosure()` — [php/clinic_booking_helpers.php:198](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:198) (`clinic_booking_capacity`)

### BranchOperatingHour

Persistent mapping: `branch_operating_hours`. Definition sheet 3.  

- `checkClinicHours()` — [php/clinic_booking_helpers.php:198](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:198) (`clinic_booking_capacity`)

### BranchServiceAvailability

Persistent mapping: `branch_service_availability`. Definition sheet 3.  

- `checkServiceAvailability()` — [src/services/bookingAvailabilityService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingAvailabilityService.js:3) (`fetchBookingAvailability`)

### ConsentTemplate

Persistent mapping: `consent_files`. Definition sheet 5.  

- `createTemplate()` — [src/services/consentFileService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:7) (`createConsentFile`)
- `updateTemplate()` — [src/services/consentFileService.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:14) (`updateConsentFile`)
- `deleteTemplate()` — [src/services/consentFileService.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:18) (`deleteConsentFile`)

### ConsentRecord

Persistent mapping: `consent_form_records`. Definition sheet 5.  

- `saveSignedConsent()` — [src/services/consentRecordService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentRecordService.js:3) (`saveConsentFormRecord`)
- `validateDocumentScope()` — [php/consent_record_helpers.php:219](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:219) (`consent_record_assert_document_scope`)

### EmailOtpToken

Persistent mapping: `email_otp_tokens`. Definition sheet 2.  

- `sendVerification()` — [src/services/authEmail.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:14) (`resendVerificationCode`)
- `verifyEmail()` — [src/services/authEmail.js:10](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:10) (`verifyEmail`)

### GoogleAuthOnboardingToken

Persistent mapping: `google_auth_onboarding_tokens`. Definition sheet 2.  

- `completeRegistration()` — [src/services/googleAuthService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:12) (`completeGoogleRegistration`)

### GroomingEvent

Persistent mapping: `grooming_events`. Definition sheet 7.  

- `viewRecord()` — [php/grooming.php:98](C:/Users/Admin/WebstormProjects/untitled1/php/grooming.php:98): Conceptual read responsibility backed by an observed table query.

### GroomingJob

Persistent mapping: `grooming_jobs`. Definition sheet 7.  

- `updateJob()` — [src/services/groomingService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:7) (`updateGroomingJob`)
- `viewJob()` — [src/services/groomingService.js:6](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:6) (`fetchGroomingJob`)

### GroomingPhoto

Persistent mapping: `grooming_photos`. Definition sheet 7.  

- `uploadPhoto()` — [src/services/groomingService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:8) (`uploadGroomingPhoto`)

### GroomingReview

Persistent mapping: `grooming_reviews`. Definition sheet 7.  

- `viewRecord()` — [php/grooming.php:27](C:/Users/Admin/WebstormProjects/untitled1/php/grooming.php:27): Conceptual read responsibility backed by an observed table query.

### PetPriorHistory

Persistent mapping: `history_before_registration`. Definition sheet 4.  

- `viewRecord()` — [php/record_update_requests.php:314](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:314): Conceptual read responsibility backed by an observed table query.

### InventoryAudit

Persistent mapping: `inventory_action_audit`. Definition sheet 8.  

No distinct operation is asserted; this object is supporting persistent state.

### InventoryBatch

Persistent mapping: `inventory_batches`. Definition sheet 8.  

- `viewRecord()` — [php/boarding_management.php:3955](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3955): Conceptual read responsibility backed by an observed table query.

### InventoryBranchItem

Persistent mapping: `inventory_branch_items`. Definition sheet 8.  

- `removeFromClinic()` — [src/services/inventoryApi.js:67](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:67) (`deleteInventoryItem`)

### InventoryItem

Persistent mapping: `inventory_items`. Definition sheet 8.  

- `createItem()` — [src/services/inventoryApi.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:32) (`createInventoryItem`)
- `updateItem()` — [src/services/inventoryApi.js:39](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:39) (`updateInventoryItem`)
- `stockOut()` — [src/services/inventoryApi.js:53](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:53) (`createStockOut`)

### InventoryLocation

Persistent mapping: `inventory_locations`. Definition sheet 8.  

- `viewRecord()` — [php/boarding_management.php:3956](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3956): Conceptual read responsibility backed by an observed table query.

### InventoryStockMovement

Persistent mapping: `inventory_stock_movements`. Definition sheet 8.  

- `viewRecord()` — [php/reports_common.php:2381](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2381): Conceptual read responsibility backed by an observed table query.

### InventoryStockReceipt

Persistent mapping: `inventory_stock_receipts`. Definition sheet 8.  

- `receiveStock()` — [src/services/inventoryApi.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:46) (`createStockReceipt`)

### InventoryStockReceiptItem

Persistent mapping: `inventory_stock_receipt_items`. Definition sheet 8.  

- `recordReceivedItem()` — [src/services/inventoryApi.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:46) (`createStockReceipt`)

### InventorySupplier

Persistent mapping: `inventory_suppliers`. Definition sheet 8.  

- `viewRecord()` — [php/inventory.php:395](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:395): Conceptual read responsibility backed by an observed table query.

### InventoryTransfer

Persistent mapping: `inventory_transfers`. Definition sheet 8.  

- `transferStock()` — [src/services/inventoryApi.js:60](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:60) (`transferInventoryStock`)

### InventoryTransferItem

Persistent mapping: `inventory_transfer_items`. Definition sheet 8.  

- `recordTransferItem()` — [src/services/inventoryApi.js:60](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:60) (`transferInventoryStock`)

### OutgoingEmail

Persistent mapping: `mail_queue`. Definition sheet 10.  

- `viewRecord()` — [php/mail_helpers.php:352](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:352): Conceptual read responsibility backed by an observed table query.

### NotificationPreference

Persistent mapping: `notification_preferences`. Definition sheet 10.  

- `loadPreferences()` — [src/services/notificationService.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:27) (`fetchNotificationPreferences`)
- `savePreferences()` — [src/services/notificationService.js:34](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:34) (`saveNotificationPreferences`)

### NotificationPushSubscription

Persistent mapping: `notification_push_subscriptions`. Definition sheet 10.  

- `subscribe()` — [src/services/notificationService.js:55](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:55) (`saveNotificationPushSubscription`)
- `disable()` — [src/services/notificationService.js:63](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:63) (`disableNotificationPushSubscription`)

### OnlineConsultation

Persistent mapping: `online_consultations`. Definition sheet 6.  

- `start()` — [src/services/onlineConsultationService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:12) (`startOnlineConsultation`)
- `join()` — [src/services/onlineConsultationService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:16) (`joinOnlineConsultation`)
- `end()` — [src/services/onlineConsultationService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:20) (`endOnlineConsultation`)
- `submitDiagnosis()` — [src/services/onlineConsultationService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:24) (`submitOnlineConsultationDiagnosis`)

### OnlineDiagnosis

Persistent mapping: `online_consultation_diagnoses`. Definition sheet 6.  

- `recordDiagnosis()` — [src/services/onlineConsultationService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:24) (`submitOnlineConsultationDiagnosis`)
- `issuePrescription()` — [php/prescription_helpers.php:235](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:235) (`prescription_sync_plan`)

### OnlineConsultationReschedule

Persistent mapping: `online_consultation_reschedules`. Definition sheet 6.  

- `reschedule()` — [src/services/bookingService.js:53](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:53) (`updateBookingSchedule`)

### PaymentMethod

Persistent mapping: `payment_methods`. Definition sheet 9.  

- `updateMethods()` — [src/services/paymentMethodService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js:23) (`updatePaymentMethods`)
- `requestChangeOtp()` — [src/services/paymentMethodService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js:19) (`requestPaymentMethodsOtp`)

### Pet

Persistent mapping: `pets_information`. Definition sheet 4.  

- `registerPet()` — [src/services/addPet.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/addPet.js:3) (`addPetService`)
- `updateDetails()` — [src/services/petService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:29) (`updatePetDetails`)
- `updateStatus()` — [src/services/petService.js:33](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:33) (`updatePetStatus`)
- `viewMedicalHistory()` — [src/services/petService.js:49](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:49) (`fetchPetMedicalRecords`)

### PetAllergy

Persistent mapping: `pet_allergies`. Definition sheet 4.  

- `saveAllergy()` — [php/pet_medical_records.php:2243](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:2243) (`pet_medical_save_allergy`)
- `viewAllergies()` — [php/pet_medical_records.php:448](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:448) (`pet_medical_fetch_allergies`)

### PetCatalogOption

Persistent mapping: `pet_catalog_options`. Definition sheet 4.  

- `listOptions()` — [src/services/petCatalogService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCatalogService.js:3) (`fetchPetCatalog`)

### PetCoparentRequest

Persistent mapping: `pet_coparent_requests`. Definition sheet 4.  

- `viewRequest()` — [src/services/ConnectOwnership.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:14) (`fetchCoparentRequest`)
- `decideRequest()` — [src/services/ConnectOwnership.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:22) (`decideCoparentRequest`)

### PetMedicalCertificate

Persistent mapping: `pet_medical_certificates`. Definition sheet 4.  

- `issueCertificate()` — [src/services/petCertificateService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js:12) (`issuePetMedicalCertificate`)
- `markViewed()` — [src/services/petCertificateService.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js:22) (`markPetMedicalCertificateViewed`)

### MedicalRecordGroup

Persistent mapping: `pet_medical_record_groups`. Definition sheet 4.  

- `createGroup()` — [src/services/petService.js:62](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:62) (`createPetMedicalRecordGroup`)
- `updateGroup()` — [src/services/petService.js:66](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:66) (`updatePetMedicalRecordGroup`)
- `deleteGroup()` — [src/services/petService.js:70](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:70) (`deletePetMedicalRecordGroup`)

### MedicalRecordItem

Persistent mapping: `pet_medical_record_group_items`. Definition sheet 4.  

- `addItem()` — [src/services/petService.js:74](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:74) (`addPetMedicalRecordGroupItem`)
- `updateItem()` — [src/services/petService.js:78](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:78) (`updatePetMedicalRecordGroupItem`)
- `removeItem()` — [src/services/petService.js:82](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:82) (`removePetMedicalRecordGroupItem`)

### PetOwnership

Persistent mapping: `pet_ownership`. Definition sheet 4.  

- `linkPet()` — [src/services/ConnectOwnership.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:3) (`linkPetService`)
- `requestCoParent()` — [src/services/ConnectOwnership.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:3) (`linkPetService`)
- `removeOwnership()` — [src/services/accountService.js:63](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:63) (`removePetOwnerOwnership`)

### PetOwnerTodo

Persistent mapping: `pet_owner_todos`. Definition sheet 6.  

- `createTodo()` — [src/services/todoService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:19) (`createPetOwnerTodo`)
- `updateTodo()` — [src/services/todoService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:23) (`updatePetOwnerTodo`)
- `deleteTodo()` — [src/services/todoService.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:27) (`deletePetOwnerTodo`)

### PetRecordUpdateRequest

Persistent mapping: `pet_record_update_requests`. Definition sheet 4.  

- `createRequest()` — [src/services/recordUpdateRequestService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js:20) (`createRecordUpdateRequest`)
- `updateRequest()` — [src/services/recordUpdateRequestService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js:24) (`updateRecordUpdateRequest`)

### PetRecordUpdateRequestEvent

Persistent mapping: `pet_record_update_request_events`. Definition sheet 4.  

No distinct operation is asserted; this object is supporting persistent state.

### PetVaccination

Persistent mapping: `pet_vaccinations`. Definition sheet 4.  

- `recordVaccination()` — [php/pet_medical_records.php:2187](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:2187) (`pet_medical_save_vaccination`)
- `viewHistory()` — [php/pet_medical_records.php:335](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:335) (`pet_medical_fetch_vaccinations`)

### PrescriptionEvent

Persistent mapping: `prescription_events`. Definition sheet 6.  

- `recordEvent()` — [php/prescription_helpers.php:198](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:198) (`prescription_event`)

### PrescriptionItem

Persistent mapping: `prescription_items`. Definition sheet 6.  

- `startItem()` — [src/services/prescriptionService.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:14) (`startPrescriptionPlan`): Start payload selects individual items and their start dates.
- `updateItem()` — [src/services/prescriptionService.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:18) (`amendPrescriptionPlan`)
- `generateOccurrences()` — [php/prescription_helpers.php:471](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:471) (`prescription_generate_occurrences`)

### PrescriptionOccurrence

Persistent mapping: `prescription_occurrences`. Definition sheet 6.  

- `markDone()` — [src/services/prescriptionService.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:22) (`updatePrescriptionOccurrence`)
- `skipOccurrence()` — [src/services/prescriptionService.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:22) (`updatePrescriptionOccurrence`)

### PrescriptionPlan

Persistent mapping: `prescription_plans`. Definition sheet 6.  

- `syncFromDiagnosis()` — [php/prescription_helpers.php:235](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:235) (`prescription_sync_plan`)
- `startSelectedItems()` — [src/services/prescriptionService.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:14) (`startPrescriptionPlan`)
- `amend()` — [src/services/prescriptionService.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:18) (`amendPrescriptionPlan`)
- `notifyOwner()` — [php/prescription_helpers.php:311](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:311) (`prescription_notify_plan`)

### QueueEntry

Persistent mapping: `queues`. Definition sheet 5.  

- `enqueue()` — [src/services/queueService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:12) (`addQueueItem`)
- `updateStatus()` — [src/services/queueService.js:17](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:17) (`updateQueueStatus`)
- `assignVeterinarian()` — [src/services/queueService.js:21](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:21) (`assignQueueToVeterinarian`)
- `reenterQueue()` — [src/services/queueService.js:33](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:33) (`reenterQueue`)

### Room

Persistent mapping: `rooms`. Definition sheet 7.  

- `createRooms()` — [src/services/boardingService.js:28](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:28) (`createBoardingRooms`)
- `updateRoom()` — [src/services/boardingService.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:32) (`updateBoardingRoom`)
- `checkAvailability()` — [src/services/boardingService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:3) (`fetchRoomAvailability`)

### RoomUnitStatus

Persistent mapping: `room_unit_statuses`. Definition sheet 7.  

- `updateStatus()` — [src/services/boardingService.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:32) (`updateBoardingRoom`)

### ServiceCatalog

Persistent mapping: `service_catalog`. Definition sheet 9.  

- `saveService()` — [src/services/serviceCatalogService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:8) (`saveServiceCatalogItem`)
- `updateMaterials()` — [src/services/serviceCatalogService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:16) (`updateServiceCatalogMaterials`)
- `deactivate()` — [src/services/serviceCatalogService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:20) (`deactivateServiceCatalogItem`)

### ServiceDisplaySetting

Persistent mapping: `service_display_settings`. Definition sheet 9.  

- `saveDisplaySettings()` — [src/services/serviceCatalogService.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:32) (`saveServiceDisplaySettings`)

### ServiceMaterial

Persistent mapping: `service_materials`. Definition sheet 8.  

- `updateMaterials()` — [src/services/serviceCatalogService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:16) (`updateServiceCatalogMaterials`)

### SpecialServiceBookingItem

Persistent mapping: `special_service_booking_items`. Definition sheet 9.  

- `viewRecord()` — [php/add_booking.php:419](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:419): Conceptual read responsibility backed by an observed table query.

### SpecialServiceCatalog

Persistent mapping: `special_service_catalog`. Definition sheet 9.  

- `createService()` — [src/services/specialServicesService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js:8) (`createSpecialService`)
- `updateService()` — [src/services/specialServicesService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js:12) (`updateSpecialService`)

### SystemBackup

Persistent mapping: `system_backups`. Definition sheet 10.  

- `createBackup()` — [php/system_backup_common.php:638](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:638) (`ipawcus_backup_create`)
- `listBackups()` — [src/services/systemBackupService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js:3) (`fetchSystemBackups`)
- `downloadBackup()` — [src/services/systemBackupService.js:76](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js:76) (`downloadLocalSystemBackup`)

### SystemBackupSetting

Persistent mapping: `system_backup_settings`. Definition sheet 10.  

No distinct operation is asserted; this object is supporting persistent state.

### User

Persistent mapping: `users`. Definition sheet 2.  

- `login()` — [src/services/userLogin.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js:16) (`loginUser`)
- `logout()` — [src/services/apiClient.js:292](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:292) (`clearStoredAuthSession`)
- `updateProfile()` — [src/services/profileService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js:12) (`updateProfile`)
- `updatePassword()` — [src/services/userService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/userService.js:11) (`updateUserPassword`)

### UserAuthIdentity

Persistent mapping: `user_auth_identities`. Definition sheet 2.  

- `connectGoogle()` — [src/services/googleAuthService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:23) (`connectGoogleAccount`)
- `checkConnection()` — [src/services/googleAuthService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:19) (`getGoogleConnectionStatus`)

### UserBranchAssignment

Persistent mapping: `user_branch_assignments`. Definition sheet 3.  

- `assignClinic()` — [src/services/accountService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:29) (`updatePersonnelAccountDetails`)
- `setPrimaryClinic()` — [src/services/accountService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:29) (`updatePersonnelAccountDetails`)

### Notification

Persistent mapping: `user_notifications`. Definition sheet 10.  

- `notify()` — [php/notification_helpers.php:1215](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1215) (`notification_create_event`)
- `markRead()` — [src/services/notificationService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:19) (`markNotificationRead`)
- `markAllRead()` — [src/services/notificationService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:23) (`markAllNotificationsRead`)

### VetClinicBookingPreference

Persistent mapping: `veterinarian_booking_clinics`. Definition sheet 3.  

- `setAcceptsBookings()` — [src/services/vetBookingScheduleService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js:11) (`saveVetBookingSchedule`)
- `listAcceptedClinics()` — [src/services/vetBookingScheduleService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js:3) (`fetchVetBookingSchedule`)

### LegacyVetTimeOff

Persistent mapping: `veterinarian_booking_time_off`. Definition sheet 3.  Legacy scheduling data only.

No distinct operation is asserted; this object is supporting persistent state.

### LegacyVetClinicVisit

Persistent mapping: `veterinarian_branch_schedules`. Definition sheet 3.  Legacy scheduling data only.

- `viewRecord()` — [php/branch_helpers.php:305](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:305): Conceptual read responsibility backed by an observed table query.

### VeterinarianProfile

Persistent mapping: `veterinarian_profiles`. Definition sheet 2.  

- `updateProfile()` — [src/services/profileService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js:12) (`updateProfile`)
- `setAcceptingPatients()` — [src/services/vetPresenceService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetPresenceService.js:7) (`updateVetPresence`)
- `receivePatient()` — [src/services/queueService.js:25](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:25) (`receiveQueue`)

### LegacyVetWorkingHours

Persistent mapping: `veterinarian_working_hours`. Definition sheet 3.  Legacy scheduling data only.

No distinct operation is asserted; this object is supporting persistent state.

### Diagnosis

Persistent mapping: `vet_diagnoses`. Definition sheet 5.  

- `recordDiagnosis()` — [src/services/vetDiagnosisService.js:15](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js:15) (`createVetDiagnosis`)
- `finalize()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:1673](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:1673) (`handleSaveDiagnosis`)
- `viewDiagnosis()` — [src/services/vetDiagnosisService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js:11) (`fetchVetDiagnosis`)
- `addConsent()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:1432](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:1432) (`addAdditionalConsent`)
- `printPrescription()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:1654](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:1654) (`printPrescriptionFromCurrentForm`): Print only when a prescription has content.

### VetQueueAssignment

Persistent mapping: `vet_queue_assignments`. Definition sheet 5.  

- `receive()` — [src/services/queueService.js:25](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:25) (`receiveQueue`)
- `returnQueue()` — [src/services/queueService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:29) (`returnQueue`)
- `complete()` — [php/vet_diagnoses.php:447](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:447) (`vetDiagnosisCompleteQueue`)

### OnlineVetSchedule

Persistent mapping: `vet_schedules`. Definition sheet 3.  

- `updateAvailability()` — [src/services/vetScheduleService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js:8) (`updateVetSchedules`)
- `listAvailableSlots()` — [src/services/vetScheduleService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js:3) (`fetchVetSchedules`)

### Visit

Persistent mapping: `visits`. Definition sheet 9.  

- `createVisit()` — [src/services/visitBillingService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:12) (`createVisit`)
- `updateStatus()` — [php/visit_billing.php:1054](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1054) (`visit_billing_update_status`)
- `calculateBalance()` — [php/visit_billing.php:3360](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3360) (`visit_billing_fetch_visit`)

### VisitCharge

Persistent mapping: `visit_charges`. Definition sheet 9.  

- `saveCharges()` — [src/services/visitBillingService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:16) (`saveVisitCharges`)
- `replaceCharges()` — [php/visit_billing.php:3612](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3612) (`visit_billing_replace_charges`)

### VisitInvoiceDocument

Persistent mapping: `visit_invoice_documents`. Definition sheet 9.  

- `saveInvoice()` — [php/visit_billing.php:349](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:349) (`visit_billing_save_invoice_document`)
- `listInvoices()` — [php/visit_billing.php:448](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:448) (`visit_billing_fetch_invoice_documents`)

### VisitPayment

Persistent mapping: `visit_payments`. Definition sheet 9.  

- `recordPayment()` — [src/services/visitBillingService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:20) (`postVisitPayment`)
- `requestRefund()` — [src/services/visitBillingService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:24) (`postVisitRefund`)

### VisitPaymentRefund

Persistent mapping: `visit_payment_refunds`. Definition sheet 9.  

- `processRefund()` — [src/services/visitBillingService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:24) (`postVisitRefund`)

### PhysicalExamination

Persistent mapping: `clinical_intakes`. Definition sheet 5. Migration only; absent from supplied export. 

- `startExamination()` — [src/services/clinicalIntakeService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js:12) (`startClinicalIntake`)
- `saveFindings()` — [src/services/clinicalIntakeService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js:16) (`saveClinicalIntake`)
- `completeExamination()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:662](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:662) (`persistIntake`)
- `reassignVeterinarian()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:493](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:493) (`reassignVeterinarian`)
- `attachEvidence()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:551](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:551) (`uploadPhotos`)
- `captureConsent()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:592](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:592) (`saveSignedConsent`)

### BookingScheduler

Stateless domain service; no persistent table or invented fields.

- `findAvailableVets()` — [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26) (`clinic_booking_roster`)
- `checkCapacity()` — [php/clinic_booking_helpers.php:198](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:198) (`clinic_booking_capacity`)
- `reserveVet()` — [php/clinic_booking_helpers.php:216](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:216) (`clinic_booking_reserve_vet`)
- `getOnlineSlots()` — [php/clinic_booking_helpers.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:80) (`clinic_booking_online_times`)

### ReportGenerator

Stateless domain service; no persistent table or invented fields.

- `generateReport()` — [src/services/reportService.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:46) (`generateReport`)
- `buildDashboard()` — [php/reports_common.php:3734](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3734) (`reports_dashboard`)

## Associations and dependencies

| Object / fields | Related object / fields | End multiplicities | Evidence |
| --- | --- | --- | --- |
| AdminProfile.user_id | User.user_id | 0..* / 1 | admin_profiles_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:45](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:45) |
| BoardingAssignment.booking_id | Booking.booking_id | 0..* / 1 | boarding_assignment_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:81](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:81) |
| BoardingAssignment.branch_id | Branch.branch_id | 0..* / 1 | boarding_assignment_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:82](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:82) |
| BoardingDocument.assignment_id | BoardingAssignment.assignment_id | 0..* / 0..1 | boarding_documents_assignment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:104](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:104) |
| BoardingDocument.booking_id | Booking.booking_id | 0..* / 1 | boarding_documents_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:105](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:105) |
| BoardingDocument.pet_id | Pet.pet_id | 0..* / 0..1 | boarding_documents_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:106](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:106) |
| BoardingDocument.uploaded_by_user_id | User.user_id | 0..* / 0..1 | boarding_documents_uploaded_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:107](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:107) |
| BoardingMaterialUsage.assignment_id | BoardingAssignment.assignment_id | 0..* / 1 | boarding_material_assignment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:140](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:140) |
| BoardingMaterialUsage.booking_id | Booking.booking_id | 0..* / 1 | boarding_material_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:141](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:141) |
| BoardingMaterialUsage.item_id | InventoryItem.item_id | 0..* / 0..1 | boarding_material_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:142](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:142) |
| BoardingMaterialUsage.pet_id | Pet.pet_id | 0..* / 0..1 | boarding_material_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:143](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:143) |
| BoardingMaterialUsage.recorded_by_user_id | User.user_id | 0..* / 0..1 | boarding_material_recorded_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:144](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:144) |
| BoardingMaterialUsage.voided_by_user_id | User.user_id | 0..* / 0..1 | boarding_material_voided_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:145](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:145) |
| BoardingObservation.assignment_id | BoardingAssignment.assignment_id | 0..* / 0..1 | boarding_observation_assignment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:175](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:175) |
| BoardingObservation.booking_id | Booking.booking_id | 0..* / 1 | boarding_observation_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:176](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:176) |
| BoardingObservation.pet_id | Pet.pet_id | 0..* / 0..1 | boarding_observation_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:177](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:177) |
| BoardingObservation.created_by_user_id | User.user_id | 0..* / 0..1 | boarding_observation_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:178](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:178) |
| BoardingTask.assignment_id | BoardingAssignment.assignment_id | 0..* / 0..1 | boarding_task_assignment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:203](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:203) |
| BoardingTask.booking_id | Booking.booking_id | 0..* / 1 | boarding_task_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:204](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:204) |
| BoardingTask.pet_id | Pet.pet_id | 0..* / 0..1 | boarding_task_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:205](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:205) |
| BoardingTask.created_by_user_id | User.user_id | 0..* / 0..1 | boarding_task_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:206](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:206) |
| Booking.branch_id | Branch.branch_id | 0..* / 1 | bookings_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:273](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:273) |
| Booking.user_id | User.user_id | 0..* / 1 | bookings_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:274](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:274) |
| Booking.pet_id | Pet.pet_id | 0..* / 0..1 | bookings_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:275](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:275) |
| Booking.original_branch_id | Branch.branch_id | 0..* / 0..1 | bookings_original_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:276](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:276) |
| BookingBranchTransfer.transferred_by_user_id | User.user_id | 0..* / 1 | booking_branch_transfer_actor_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:293](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:293) |
| BookingBranchTransfer.booking_id | Booking.booking_id | 0..* / 1 | booking_branch_transfer_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:294](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:294) |
| BookingBranchTransfer.from_branch_id | Branch.branch_id | 0..* / 1 | booking_branch_transfer_from_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:295](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:295) |
| BookingBranchTransfer.to_branch_id | Branch.branch_id | 0..* / 1 | booking_branch_transfer_to_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:296](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:296) |
| BookingPaymentRefund.booking_id | Booking.booking_id | 0..* / 1 | booking_payment_refund_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:317](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:317) |
| BookingPaymentRefund.booking_payment_submission_id | BookingPaymentSubmission.submission_id | 0..* / 1 | booking_payment_refund_submission_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:318](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:318) |
| BookingPaymentRefund.processed_by_user_id | User.user_id | 0..* / 1 | booking_payment_refund_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:319](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:319) |
| BookingPaymentSubmission.booking_id | Booking.booking_id | 0..* / 1 | booking_payment_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:343](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:343) |
| BookingPaymentSubmission.reviewed_by_user_id | User.user_id | 0..* / 0..1 | booking_payment_reviewer_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:344](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:344) |
| BookingPaymentSubmission.linked_visit_payment_id | VisitPayment.payment_id | 0..1 / 0..1 | booking_payment_visit_payment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:345](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:345) |
| BookingPet.booking_id | Booking.booking_id | 0..* / 1 | booking_pets_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:357](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:357) |
| BookingPet.pet_id | Pet.pet_id | 0..* / 1 | booking_pets_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:358](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:358) |
| BranchClosure.branch_id | Branch.branch_id | 0..* / 1 | branch_closures_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:388](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:388) |
| BranchClosure.created_by_user_id | User.user_id | 0..* / 0..1 | branch_closures_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:389](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:389) |
| BranchOperatingHour.branch_id | Branch.branch_id | 0..* / 1 | branch_operating_hours_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:403](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:403) |
| BranchServiceAvailability.branch_id | Branch.branch_id | 0..* / 1 | branch_service_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:420](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:420) |
| EmailOtpToken.user_id | User.user_id | 0..* / 0..1 | email_otp_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:482](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:482) |
| GroomingEvent.booking_id | GroomingJob.booking_id | 0..* / 1 | grooming_event_job_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:511](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:511) |
| GroomingJob.booking_id | Booking.booking_id | 0..1 / 1 | grooming_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:526](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:526) |
| GroomingPhoto.booking_id | GroomingJob.booking_id | 0..* / 1 | grooming_photo_job_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:541](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:541) |
| GroomingReview.booking_id | GroomingJob.booking_id | 0..* / 1 | grooming_review_job_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:557](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:557) |
| GroomingReview.veterinarian_id | User.user_id | 0..* / 1 | grooming_review_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:558](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:558) |
| PetPriorHistory.pet_id | Pet.pet_id | 0..* / 0..1 | history_before_registration_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:567](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:567) |
| InventoryAudit.batch_id | InventoryBatch.batch_id | 0..* / 0..1 | inventory_audit_batch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:589](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:589) |
| InventoryAudit.item_id | InventoryItem.item_id | 0..* / 0..1 | inventory_audit_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:590](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:590) |
| InventoryAudit.location_id | InventoryLocation.location_id | 0..* / 0..1 | inventory_audit_location_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:591](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:591) |
| InventoryAudit.performed_by_user_id | User.user_id | 0..* / 1 | inventory_audit_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:592](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:592) |
| InventoryBatch.item_id | InventoryItem.item_id | 0..* / 1 | inventory_batches_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:610](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:610) |
| InventoryBatch.location_id | InventoryLocation.location_id | 0..* / 1 | inventory_batches_location_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:611](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:611) |
| InventoryBranchItem.branch_id | Branch.branch_id | 0..* / 1 | inventory_branch_items_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:628](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:628) |
| InventoryBranchItem.item_id | InventoryItem.item_id | 0..* / 1 | inventory_branch_items_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:629](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:629) |
| InventoryBranchItem.primary_location_id | InventoryLocation.location_id | 0..* / 1 | inventory_branch_items_location_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:630](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:630) |
| InventoryBranchItem.removed_by_user_id | User.user_id | 0..* / 0..1 | inventory_branch_items_removed_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:631](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:631) |
| InventoryItem.created_by_user_id | User.user_id | 0..* / 1 | inventory_items_created_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:661](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:661) |
| InventoryItem.location_id | InventoryLocation.location_id | 0..* / 1 | inventory_items_location_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:662](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:662) |
| InventoryLocation.branch_id | Branch.branch_id | 0..* / 1 | inventory_locations_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:677](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:677) |
| InventoryStockMovement.batch_id | InventoryBatch.batch_id | 0..* / 0..1 | inventory_movements_batch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:702](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:702) |
| InventoryStockMovement.item_id | InventoryItem.item_id | 0..* / 1 | inventory_movements_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:703](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:703) |
| InventoryStockMovement.location_id | InventoryLocation.location_id | 0..* / 0..1 | inventory_movements_location_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:704](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:704) |
| InventoryStockMovement.performed_by_user_id | User.user_id | 0..* / 1 | inventory_movements_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:705](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:705) |
| InventoryStockReceipt.branch_id | Branch.branch_id | 0..* / 1 | inventory_receipts_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:721](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:721) |
| InventoryStockReceipt.received_by_user_id | User.user_id | 0..* / 1 | inventory_receipts_received_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:722](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:722) |
| InventoryStockReceiptItem.batch_id | InventoryBatch.batch_id | 0..* / 0..1 | inventory_receipt_items_batch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:742](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:742) |
| InventoryStockReceiptItem.item_id | InventoryItem.item_id | 0..* / 1 | inventory_receipt_items_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:743](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:743) |
| InventoryStockReceiptItem.location_id | InventoryLocation.location_id | 0..* / 1 | inventory_receipt_items_location_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:744](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:744) |
| InventoryStockReceiptItem.receipt_id | InventoryStockReceipt.receipt_id | 0..* / 1 | inventory_receipt_items_receipt_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:745](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:745) |
| InventoryStockReceiptItem.supplier_id | InventorySupplier.supplier_id | 0..* / 1 | inventory_receipt_items_supplier_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:746](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:746) |
| InventoryTransfer.created_by_user_id | User.user_id | 0..* / 1 | inventory_transfer_creator_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:778](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:778) |
| InventoryTransfer.from_location_id | InventoryLocation.location_id | 0..* / 1 | inventory_transfer_from_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:779](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:779) |
| InventoryTransfer.received_by_user_id | User.user_id | 0..* / 0..1 | inventory_transfer_receiver_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:780](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:780) |
| InventoryTransfer.to_location_id | InventoryLocation.location_id | 0..* / 1 | inventory_transfer_to_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:781](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:781) |
| InventoryTransferItem.source_batch_id | InventoryBatch.batch_id | 0..* / 1 | inventory_transfer_items_batch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:795](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:795) |
| InventoryTransferItem.item_id | InventoryItem.item_id | 0..* / 1 | inventory_transfer_items_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:796](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:796) |
| InventoryTransferItem.inventory_transfer_id | InventoryTransfer.inventory_transfer_id | 0..* / 1 | inventory_transfer_items_transfer_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:797](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:797) |
| NotificationPreference.user_id | User.user_id | 0..1 / 1 | notification_preferences_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:844](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:844) |
| NotificationPushSubscription.user_id | User.user_id | 0..* / 1 | notification_push_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:864](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:864) |
| OnlineConsultation.booking_id | Booking.booking_id | 0..1 / 1 | online_consultations_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:890](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:890) |
| OnlineConsultation.owner_user_id | User.user_id | 0..* / 1 | online_consultations_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:891](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:891) |
| OnlineConsultation.veterinarian_user_id | User.user_id | 0..* / 1 | online_consultations_ibfk_3; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:892](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:892) |
| OnlineDiagnosis.online_consultation_id | OnlineConsultation.online_consultation_id | 0..1 / 1 | online_consultation_diagnoses_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:915](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:915) |
| OnlineDiagnosis.booking_id | Booking.booking_id | 0..* / 1 | online_consultation_diagnoses_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:916](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:916) |
| OnlineDiagnosis.veterinarian_user_id | User.user_id | 0..* / 1 | online_consultation_diagnoses_ibfk_3; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:917](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:917) |
| OnlineConsultationReschedule.online_consultation_id | OnlineConsultation.online_consultation_id | 0..* / 1 | online_consultation_reschedules_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:934](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:934) |
| OnlineConsultationReschedule.changed_by_user_id | User.user_id | 0..* / 0..1 | online_consultation_reschedules_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:935](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:935) |
| PetAllergy.created_by_user_id | User.user_id | 0..* / 0..1 | pet_allergies_created_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1006](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1006) |
| PetAllergy.pet_id | Pet.pet_id | 0..* / 1 | pet_allergies_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1007](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1007) |
| PetAllergy.updated_by_user_id | User.user_id | 0..* / 0..1 | pet_allergies_updated_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1008](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1008) |
| PetAllergy.verified_by_user_id | User.user_id | 0..* / 0..1 | pet_allergies_verified_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1009](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1009) |
| PetMedicalCertificate.pet_id | Pet.pet_id | 0..* / 1 | pet_medical_certificate_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1064](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1064) |
| PetMedicalCertificate.request_id | PetRecordUpdateRequest.request_id | 0..* / 0..1 | pet_medical_certificate_request_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1065](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1065) |
| PetMedicalCertificate.veterinarian_user_id | User.user_id | 0..* / 1 | pet_medical_certificate_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1066](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1066) |
| MedicalRecordGroup.pet_id | Pet.pet_id | 0..* / 1 | pet_medical_record_groups_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1084](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1084) |
| MedicalRecordItem.group_id | MedicalRecordGroup.group_id | 0..* / 1 | pet_medical_record_group_items_group_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1108](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1108) |
| PetOwnership.user_id | User.user_id | 0..* / 0..1 | pet_ownership_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1122](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1122) |
| PetOwnership.pet_id | Pet.pet_id | 0..* / 0..1 | pet_ownership_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1123](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1123) |
| PetOwnerTodo.user_id | User.user_id | 0..* / 1 | pet_owner_todos_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1142](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1142) |
| PetRecordUpdateRequest.branch_id | Branch.branch_id | 0..* / 1 | record_requests_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1184](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1184) |
| PetRecordUpdateRequest.assigned_veterinarian_user_id | User.user_id | 0..* / 0..1 | record_update_assigned_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1185](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1185) |
| PetRecordUpdateRequest.completed_by_user_id | User.user_id | 0..* / 0..1 | record_update_completed_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1186](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1186) |
| PetRecordUpdateRequest.owner_user_id | User.user_id | 0..* / 0..1 | record_update_owner_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1187](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1187) |
| PetRecordUpdateRequest.pet_id | Pet.pet_id | 0..* / 1 | record_update_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1188](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1188) |
| PetRecordUpdateRequest.reviewed_by_user_id | User.user_id | 0..* / 0..1 | record_update_reviewed_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1189](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1189) |
| PetRecordUpdateRequestEvent.actor_user_id | User.user_id | 0..* / 0..1 | record_update_event_actor_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1206](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1206) |
| PetRecordUpdateRequestEvent.request_id | PetRecordUpdateRequest.request_id | 0..* / 1 | record_update_event_request_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1207](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1207) |
| PetVaccination.pet_id | Pet.pet_id | 0..* / 1 | pet_vaccinations_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1221](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1221) |
| PrescriptionEvent.actor_user_id | User.user_id | 0..* / 0..1 | prescription_event_actor_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1236](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1236) |
| PrescriptionEvent.item_id | PrescriptionItem.item_id | 0..* / 0..1 | prescription_event_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1237](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1237) |
| PrescriptionEvent.plan_id | PrescriptionPlan.plan_id | 0..* / 1 | prescription_event_plan_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1238](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1238) |
| PrescriptionItem.plan_id | PrescriptionPlan.plan_id | 0..* / 1 | prescription_item_plan_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1267](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1267) |
| PrescriptionItem.replaces_item_id | PrescriptionItem.item_id | 0..* / 0..1 | prescription_item_replaces_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1268](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1268) |
| PrescriptionOccurrence.completed_by_user_id | User.user_id | 0..* / 0..1 | prescription_occurrence_completed_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1285](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1285) |
| PrescriptionOccurrence.item_id | PrescriptionItem.item_id | 0..* / 1 | prescription_occurrence_item_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1286](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1286) |
| PrescriptionPlan.owner_user_id | User.user_id | 0..* / 0..1 | prescription_plan_owner_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1310](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1310) |
| PrescriptionPlan.pet_id | Pet.pet_id | 0..* / 1 | prescription_plan_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1311](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1311) |
| PrescriptionPlan.supersedes_plan_id | PrescriptionPlan.plan_id | 0..* / 0..1 | prescription_plan_supersedes_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1312](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1312) |
| PrescriptionPlan.veterinarian_user_id | User.user_id | 0..* / 1 | prescription_plan_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1313](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1313) |
| QueueEntry.booking_id | Booking.booking_id | 0..* / 0..1 | queues_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1342](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1342) |
| QueueEntry.branch_id | Branch.branch_id | 0..* / 1 | queues_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1343](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1343) |
| QueueEntry.pet_id | Pet.pet_id | 0..* / 1 | queues_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1344](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1344) |
| QueueEntry.user_id | User.user_id | 0..* / 1 | queues_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1345](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1345) |
| Room.branch_id | Branch.branch_id | 0..* / 1 | rooms_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1357](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1357) |
| RoomUnitStatus.branch_id | Branch.branch_id | 0..* / 1 | room_unit_status_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1372](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1372) |
| ServiceCatalog.created_by_user_id | User.user_id | 0..* / 0..1 | service_catalog_created_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1391](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1391) |
| ServiceDisplaySetting.updated_by_user_id | User.user_id | 0..* / 0..1 | fk_service_display_settings_user; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1402](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1402) |
| ServiceMaterial.service_id | ServiceCatalog.service_id | 0..* / 1 | service_materials_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1418](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1418) |
| ServiceMaterial.item_id | InventoryItem.item_id | 0..* / 0..1 | service_materials_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1419](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1419) |
| SpecialServiceBookingItem.booking_id | Booking.booking_id | 0..* / 1 | special_service_booking_items_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1434](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1434) |
| SpecialServiceBookingItem.special_service_id | SpecialServiceCatalog.special_service_id | 0..* / 0..1 | special_service_booking_items_catalog_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1435](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1435) |
| SpecialServiceCatalog.created_by_user_id | User.user_id | 0..* / 0..1 | special_service_catalog_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1458](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1458) |
| SystemBackup.created_by_user_id | User.user_id | 0..* / 0..1 | fk_system_backups_actor; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1491](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1491) |
| SystemBackup.base_backup_id | SystemBackup.backup_id | 0..* / 0..1 | fk_system_backups_base; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1492](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1492) |
| SystemBackup.parent_backup_id | SystemBackup.backup_id | 0..* / 0..1 | fk_system_backups_parent; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1493](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1493) |
| SystemBackupSetting.updated_by_user_id | User.user_id | 0..* / 0..1 | fk_system_backup_settings_actor; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1510](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1510) |
| SystemBackupSetting.last_automatic_backup_id | SystemBackup.backup_id | 0..* / 0..1 | fk_system_backup_settings_last_backup; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1511](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1511) |
| User.preferred_branch_id | Branch.branch_id | 0..* / 0..1 | users_preferred_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1539](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1539) |
| UserAuthIdentity.user_id | User.user_id | 0..* / 1 | fk_user_auth_identity_user; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1554](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1554) |
| UserBranchAssignment.assigned_by_user_id | User.user_id | 0..* / 0..1 | user_branch_assignment_actor_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1570](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1570) |
| UserBranchAssignment.branch_id | Branch.branch_id | 0..* / 1 | user_branch_assignment_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1571](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1571) |
| UserBranchAssignment.user_id | User.user_id | 0..* / 1 | user_branch_assignment_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1572](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1572) |
| Notification.branch_id | Branch.branch_id | 0..* / 0..1 | user_notifications_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1603](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1603) |
| Notification.user_id | User.user_id | 0..* / 1 | user_notifications_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1604](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1604) |
| VetClinicBookingPreference.branch_id | Branch.branch_id | 0..* / 1 | vet_booking_clinic_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1614](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1614) |
| VetClinicBookingPreference.veterinarian_user_id | User.user_id | 0..* / 1 | vet_booking_clinic_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1615](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1615) |
| LegacyVetTimeOff.veterinarian_user_id | User.user_id | 0..* / 1 | vet_booking_time_off_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1626](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1626) |
| LegacyVetClinicVisit.branch_id | Branch.branch_id | 0..* / 1 | vet_branch_schedule_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1646](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1646) |
| LegacyVetClinicVisit.created_by_user_id | User.user_id | 0..* / 1 | vet_branch_schedule_creator_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1647](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1647) |
| LegacyVetClinicVisit.veterinarian_user_id | User.user_id | 0..* / 1 | vet_branch_schedule_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1648](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1648) |
| VeterinarianProfile.user_id | User.user_id | 0..* / 1 | veterinarian_profiles_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1667](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1667) |
| LegacyVetWorkingHours.branch_id | Branch.branch_id | 0..* / 1 | vet_working_hours_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1680](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1680) |
| LegacyVetWorkingHours.veterinarian_user_id | User.user_id | 0..* / 1 | vet_working_hours_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1681](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1681) |
| Diagnosis.assignment_id | VetQueueAssignment.assignment_id | 0..* / 0..1 | vet_diagnoses_assignment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1719](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1719) |
| Diagnosis.booking_id | Booking.booking_id | 0..* / 0..1 | vet_diagnoses_booking_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1720](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1720) |
| Diagnosis.pet_id | Pet.pet_id | 0..* / 1 | vet_diagnoses_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1721](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1721) |
| Diagnosis.queue_id | QueueEntry.queue_id | 0..1 / 0..1 | vet_diagnoses_queue_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1722](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1722) |
| Diagnosis.veterinarian_user_id | User.user_id | 0..* / 1 | vet_diagnoses_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1723](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1723) |
| VetQueueAssignment.queue_id | QueueEntry.queue_id | 0..* / 1 | vet_queue_assignments_queue_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1742](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1742) |
| VetQueueAssignment.veterinarian_user_id | User.user_id | 0..* / 1 | vet_queue_assignments_vet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1743](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1743) |
| OnlineVetSchedule.user_id | User.user_id | 0..* / 1 | vet_schedules_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1754](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1754) |
| Visit.branch_id | Branch.branch_id | 0..* / 1 | visits_branch_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1786](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1786) |
| Visit.diagnosis_id | Diagnosis.diagnosis_id | 0..1 / 0..1 | visits_diagnosis_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1787](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1787) |
| Visit.pet_id | Pet.pet_id | 0..* / 1 | visits_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1788](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1788) |
| Visit.owner_user_id | User.user_id | 0..* / 1 | visits_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1789](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1789) |
| Visit.veterinarian_user_id | User.user_id | 0..* / 0..1 | visits_ibfk_3; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1790](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1790) |
| Visit.queue_id | QueueEntry.queue_id | 0..* / 0..1 | visits_ibfk_4; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1791](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1791) |
| Visit.booking_id | Booking.booking_id | 0..* / 0..1 | visits_ibfk_5; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1792](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1792) |
| VisitCharge.boarding_material_usage_id | BoardingMaterialUsage.usage_id | 0..1 / 0..1 | visit_charges_boarding_material_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1816](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1816) |
| VisitCharge.created_by_user_id | User.user_id | 0..* / 0..1 | visit_charges_created_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1817](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1817) |
| VisitCharge.visit_id | Visit.visit_id | 0..* / 1 | visit_charges_ibfk_1; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1818](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1818) |
| VisitCharge.service_id | ServiceCatalog.service_id | 0..* / 0..1 | visit_charges_ibfk_2; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1819](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1819) |
| VisitCharge.item_id | InventoryItem.item_id | 0..* / 0..1 | visit_charges_ibfk_3; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1820](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1820) |
| VisitInvoiceDocument.created_by_user_id | User.user_id | 0..* / 0..1 | visit_invoice_documents_creator_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1842](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1842) |
| VisitInvoiceDocument.payment_id | VisitPayment.payment_id | 0..1 / 1 | visit_invoice_documents_payment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1843](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1843) |
| VisitInvoiceDocument.pet_id | Pet.pet_id | 0..* / 1 | visit_invoice_documents_pet_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1844](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1844) |
| VisitInvoiceDocument.visit_id | Visit.visit_id | 0..* / 1 | visit_invoice_documents_visit_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1845](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1845) |
| VisitPayment.received_by_user_id | User.user_id | 0..* / 0..1 | visit_payments_received_by_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1868](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1868) |
| VisitPayment.visit_id | Visit.visit_id | 0..* / 1 | visit_payments_visit_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1869](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1869) |
| VisitPaymentRefund.visit_payment_id | VisitPayment.payment_id | 0..* / 1 | visit_payment_refund_payment_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1890](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1890) |
| VisitPaymentRefund.processed_by_user_id | User.user_id | 0..* / 1 | visit_payment_refund_user_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1891](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1891) |
| VisitPaymentRefund.visit_id | Visit.visit_id | 0..* / 1 | visit_payment_refund_visit_fk; [C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1892](C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql:1892) |
| PhysicalExamination.queue_id | QueueEntry.queue_id | 0..1 / 1 | clinical_intakes_queue_fk; [DDL/20261004_01_clinical_intakes.sql:4](C:/Users/Admin/WebstormProjects/untitled1/DDL/20261004_01_clinical_intakes.sql:4) |
| PhysicalExamination.booking_id | Booking.booking_id | 0..* / 0..1 | clinical_intakes_booking_fk; [DDL/20261004_01_clinical_intakes.sql:4](C:/Users/Admin/WebstormProjects/untitled1/DDL/20261004_01_clinical_intakes.sql:4) |
| PhysicalExamination.pet_id | Pet.pet_id | 0..* / 1 | clinical_intakes_pet_fk; [DDL/20261004_01_clinical_intakes.sql:4](C:/Users/Admin/WebstormProjects/untitled1/DDL/20261004_01_clinical_intakes.sql:4) |
| PhysicalExamination.assigned_veterinarian_user_id | User.user_id | 0..* / 1 | clinical_intakes_assigned_vet_fk; [DDL/20261004_01_clinical_intakes.sql:4](C:/Users/Admin/WebstormProjects/untitled1/DDL/20261004_01_clinical_intakes.sql:4) |
| PhysicalExamination.recorded_by_user_id | User.user_id | 0..* / 1 | clinical_intakes_recorded_by_fk; [DDL/20261004_01_clinical_intakes.sql:4](C:/Users/Admin/WebstormProjects/untitled1/DDL/20261004_01_clinical_intakes.sql:4) |
| Booking.veterinarian_id | User.user_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/get_bookings.php:146](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:146) |
| ConsentRecord.consent_file_id | ConsentTemplate.file_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:369](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:369) |
| ConsentRecord.owner_user_id | User.user_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:371](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:371) |
| ConsentRecord.pet_id | Pet.pet_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:372](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:372) |
| ConsentRecord.booking_id | Booking.booking_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:373](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:373) |
| ConsentRecord.queue_id | QueueEntry.queue_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:374](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:374) |
| ConsentRecord.visit_id | Visit.visit_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:375](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:375) |
| ConsentRecord.processed_by_user_id | User.user_id | 0..* / 0..1 | Logical application association; not a declared SQL foreign key.; [php/consent_record_helpers.php:385](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:385) |
| PrescriptionPlan.source_record_id | Diagnosis.diagnosis_id | 0..* / 0..1 | Conditional logical reference when source_type = clinic_diagnosis; alternatives are mutually exclusive, not declared SQL foreign keys.; [php/vet_diagnoses.php:1061](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:1061) |
| PrescriptionPlan.source_record_id | OnlineDiagnosis.diagnosis_id | 0..* / 0..1 | Conditional logical reference when source_type = online_consultation; alternatives are mutually exclusive, not declared SQL foreign keys.; [php/online_consultations.php:631](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:631) |
| BookingScheduler. | Branch. | uses | Domain dependency; [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26) |
| BookingScheduler. | BranchOperatingHour. | uses | Domain dependency; [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26) |
| BookingScheduler. | VetClinicBookingPreference. | uses | Domain dependency; [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26) |
| BookingScheduler. | OnlineVetSchedule. | uses | Domain dependency; [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26) |
| BookingScheduler. | Booking. | uses | Domain dependency; [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26) |
| ReportGenerator. | Booking. | uses | Domain dependency; [src/services/reportService.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:46) |
| ReportGenerator. | Visit. | uses | Domain dependency; [src/services/reportService.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:46) |
| ReportGenerator. | InventoryItem. | uses | Domain dependency; [src/services/reportService.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:46) |
