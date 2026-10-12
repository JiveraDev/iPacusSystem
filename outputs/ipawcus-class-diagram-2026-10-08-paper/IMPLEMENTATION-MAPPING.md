# Implementation mapping for the simplified class diagram

This appendix preserves the supporting objects and source-backed responsibilities that were folded into the sixteen paper-level classes. It is not a proposed database redesign. Original detailed diagram: `../ipawcus-class-diagram-2026-10-06/ipawcus-system-class-diagram.drawio`.

Reference schema: `C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql`, previously parsed in the detailed domain model. Additional current table: `DDL/20261004_01_clinical_intakes.sql`. Legacy scheduling objects are included in coverage but are not activated as current onsite booking requirements.

## Clinic

Represents a clinic and its operating calendar. Onsite medical capacity is determined by active veterinarians assigned to that clinic who accept bookings, with conflicts checked across sites and online calls. Three eligible veterinarians allow three simultaneous medical appointments, including the same service. Grooming and boarding retain their separate capacity rules. Legacy veterinarian working-hours, time-off and clinic-visit tables are reference data only; they are not current onsite scheduling gates.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| Branch | `branches` | `listBranches()` — [src/services/branchService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js)<br>`checkAvailability()` — [src/services/bookingAvailabilityService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingAvailabilityService.js)<br>`relocateBooking()` — [src/services/branchService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js) |
| BranchClosure | `branch_closures` | `checkClosure()` — [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php) |
| BranchOperatingHour | `branch_operating_hours` | `checkClinicHours()` — [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php) |
| BranchServiceAvailability | `branch_service_availability` | `checkServiceAvailability()` — [src/services/bookingAvailabilityService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingAvailabilityService.js) |
| LegacyVetTimeOff (legacy) | `veterinarian_booking_time_off` | Supporting state; no distinct operation asserted. |
| LegacyVetClinicVisit (legacy) | `veterinarian_branch_schedules` | `viewRecord()` — [php/branch_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php) (Conceptual read responsibility backed by an observed table query.) |
| LegacyVetWorkingHours (legacy) | `veterinarian_working_hours` | Supporting state; no distinct operation asserted. |
| BookingScheduler | Stateless service; no table | `findAvailableVets()` — [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php)<br>`checkCapacity()` — [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php)<br>`reserveVet()` — [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php)<br>`getOnlineSlots()` — [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php) |

## UserAccount

Represents Pet Owner, Admin, Veterinarian and Super Admin accounts using a role property rather than four duplicated classes. Role-specific profiles retain staff position and veterinarian license details. Super Admin assigns clinic access; veterinarians independently toggle booking acceptance at their assigned clinics and select a separate online-call calendar. Authentication, permissions and account tasks are supporting objects. Fields and operations are role-dependent: a pet owner cannot assign clinics or edit veterinarian availability. Today's My List and future booking tasks are views of assigned records, not new entity classes.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| User | `users` | `login()` — [src/services/userLogin.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js)<br>`logout()` — [src/services/apiClient.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js)<br>`updateProfile()` — [src/services/profileService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js)<br>`updatePassword()` — [src/services/userService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/userService.js) |
| AdminProfile | `admin_profiles` | `updateProfile()` — [src/services/accountService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js) |
| VeterinarianProfile | `veterinarian_profiles` | `updateProfile()` — [src/services/profileService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js)<br>`setAcceptingPatients()` — [src/services/vetPresenceService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetPresenceService.js)<br>`receivePatient()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js) |
| UserAuthIdentity | `user_auth_identities` | `connectGoogle()` — [src/services/googleAuthService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js)<br>`checkConnection()` — [src/services/googleAuthService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js) |
| ApiAccessToken | `api_access_tokens` | `viewRecord()` — [php/auth_access_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php) (Conceptual read responsibility backed by an observed table query.) |
| EmailOtpToken | `email_otp_tokens` | `sendVerification()` — [src/services/authEmail.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js)<br>`verifyEmail()` — [src/services/authEmail.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js) |
| GoogleAuthOnboardingToken | `google_auth_onboarding_tokens` | `completeRegistration()` — [src/services/googleAuthService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js) |
| AdminFeaturePermission | `admin_feature_permissions` | `savePermissions()` — [src/services/adminFeatureAccessService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/adminFeatureAccessService.js) |
| AdminPermissionAudit | `admin_feature_permission_audit` | Supporting state; no distinct operation asserted. |
| UserBranchAssignment | `user_branch_assignments` | `assignClinic()` — [src/services/accountService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js)<br>`setPrimaryClinic()` — [src/services/accountService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js) |
| VetClinicBookingPreference | `veterinarian_booking_clinics` | `setAcceptsBookings()` — [src/services/vetBookingScheduleService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js)<br>`listAcceptedClinics()` — [src/services/vetBookingScheduleService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js) |
| OnlineVetSchedule | `vet_schedules` | `updateAvailability()` — [src/services/vetScheduleService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js)<br>`listAvailableSlots()` — [src/services/vetScheduleService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js) |
| PetOwnerTodo | `pet_owner_todos` | `createTodo()` — [src/services/todoService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js)<br>`updateTodo()` — [src/services/todoService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js)<br>`deleteTodo()` — [src/services/todoService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js) |

## Pet

Represents a patient independently of a single owner account. Ownership links and co-parent requests support shared pet access. Registration details, species/breed choices and status remain part of the patient identity. The same pet identifier links bookings, examinations, medical history, prescriptions and billing, so updated prescription plans remain synchronized to the correct pet.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| Pet | `pets_information` | `registerPet()` — [src/services/addPet.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/addPet.js)<br>`updateDetails()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)<br>`updateStatus()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)<br>`viewMedicalHistory()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js) |
| PetOwnership | `pet_ownership` | `linkPet()` — [src/services/ConnectOwnership.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js)<br>`requestCoParent()` — [src/services/ConnectOwnership.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js)<br>`removeOwnership()` — [src/services/accountService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js) |
| PetCoparentRequest | `pet_coparent_requests` | `viewRequest()` — [src/services/ConnectOwnership.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js)<br>`decideRequest()` — [src/services/ConnectOwnership.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js) |
| PetCatalogOption | `pet_catalog_options` | `listOptions()` — [src/services/petCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCatalogService.js) |

## Notification

Represents a user-directed message and its navigation target. Booking changes, care updates and prescription-plan updates can direct the recipient to the related record or checklist. Read state, delivery preferences, push subscriptions and outgoing email are retained as supporting records rather than separate boxes. A notification is not itself a medication occurrence or proof that a dose was taken.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| Notification | `user_notifications` | `notify()` — [php/notification_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php)<br>`markRead()` — [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js)<br>`markAllRead()` — [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js) |
| NotificationPreference | `notification_preferences` | `loadPreferences()` — [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js)<br>`savePreferences()` — [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js) |
| NotificationPushSubscription | `notification_push_subscriptions` | `subscribe()` — [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js)<br>`disable()` — [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js) |
| OutgoingEmail | `mail_queue` | `viewRecord()` — [php/mail_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php) (Conceptual read responsibility backed by an observed table query.) |

## BillingRecord

Represents the visit-centered financial record, not a single payment. Charge lines, invoices, booking payment proofs, reviewed payments and refunds remain distinct supporting records within this simplified explanation. Service catalogues define available service prices and required materials; they are referenced by booking, care and billing rather than becoming extra overview classes. Walk-in billing may exist without a booking. Calculate balance uses recorded charges, payments and refunds; it does not silently erase payment history.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| Visit | `visits` | `createVisit()` — [src/services/visitBillingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js)<br>`updateStatus()` — [php/visit_billing.php](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php)<br>`calculateBalance()` — [php/visit_billing.php](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php) |
| VisitCharge | `visit_charges` | `saveCharges()` — [src/services/visitBillingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js)<br>`replaceCharges()` — [php/visit_billing.php](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php) |
| VisitInvoiceDocument | `visit_invoice_documents` | `saveInvoice()` — [php/visit_billing.php](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php)<br>`listInvoices()` — [php/visit_billing.php](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php) |
| VisitPayment | `visit_payments` | `recordPayment()` — [src/services/visitBillingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js)<br>`requestRefund()` — [src/services/visitBillingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js) |
| VisitPaymentRefund | `visit_payment_refunds` | `processRefund()` — [src/services/visitBillingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js) |
| BookingPaymentSubmission | `booking_payment_submissions` | `reviewPayment()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js) |
| BookingPaymentRefund | `booking_payment_refunds` | `processRefund()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js) |
| PaymentMethod | `payment_methods` | `updateMethods()` — [src/services/paymentMethodService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js)<br>`requestChangeOtp()` — [src/services/paymentMethodService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js) |
| ServiceCatalog | `service_catalog` | `saveService()` — [src/services/serviceCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js)<br>`updateMaterials()` — [src/services/serviceCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js)<br>`deactivate()` — [src/services/serviceCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js) |
| ServiceDisplaySetting | `service_display_settings` | `saveDisplaySettings()` — [src/services/serviceCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js) |
| ServiceMaterial | `service_materials` | `updateMaterials()` — [src/services/serviceCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js) |
| SpecialServiceCatalog | `special_service_catalog` | `createService()` — [src/services/specialServicesService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js)<br>`updateService()` — [src/services/specialServicesService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js) |

## Booking

Represents a scheduled service request. Supporting pet links allow multiple registered patients, while legacy/unregistered-pet booking details are retained in the implementation. Onsite bookings use clinic hours and a reserved eligible veterinarian. Online consultations use the veterinarian's separate call slots, although both calendars prevent an individual veterinarian from overlapping appointments. Branch transfers, status changes and service details remain covered. Online, grooming and boarding bookings lead to their corresponding workflows; not every booking requires a physical examination.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| Booking | `bookings` | `createBooking()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js)<br>`updateSchedule()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js)<br>`updateStatus()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js)<br>`receiveBooking()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js)<br>`cancelBooking()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js) |
| BookingBranchTransfer | `booking_branch_transfers` | `transferBooking()` — [src/services/branchService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js) |
| BookingPet | `booking_pets` | `attachPet()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js) |
| SpecialServiceBookingItem | `special_service_booking_items` | `viewRecord()` — [php/add_booking.php](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php) (Conceptual read responsibility backed by an observed table query.) |

## MedicalRecord

Represents a pet-linked record group and its supporting clinical entries. Diagnosis results, prior history, vaccination records, allergies and medical certificates remain available in the electronic record. Owner update requests and their review history are supporting records, not automatic edits to verified clinical history. This is a logical record aggregate; it does not claim that vaccinations or certificates are columns in one SQL table.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| MedicalRecordGroup | `pet_medical_record_groups` | `createGroup()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)<br>`updateGroup()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)<br>`deleteGroup()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js) |
| MedicalRecordItem | `pet_medical_record_group_items` | `addItem()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)<br>`updateItem()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)<br>`removeItem()` — [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js) |
| PetVaccination | `pet_vaccinations` | `recordVaccination()` — [php/pet_medical_records.php](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php)<br>`viewHistory()` — [php/pet_medical_records.php](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php) |
| PetAllergy | `pet_allergies` | `saveAllergy()` — [php/pet_medical_records.php](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php)<br>`viewAllergies()` — [php/pet_medical_records.php](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php) |
| PetPriorHistory | `history_before_registration` | `viewRecord()` — [php/record_update_requests.php](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php) (Conceptual read responsibility backed by an observed table query.) |
| PetMedicalCertificate | `pet_medical_certificates` | `issueCertificate()` — [src/services/petCertificateService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js)<br>`markViewed()` — [src/services/petCertificateService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js) |
| PetRecordUpdateRequest | `pet_record_update_requests` | `createRequest()` — [src/services/recordUpdateRequestService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js)<br>`updateRequest()` — [src/services/recordUpdateRequestService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js) |
| PetRecordUpdateRequestEvent | `pet_record_update_request_events` | Supporting state; no distinct operation asserted. |

## SystemOperations

A conceptual service facade for cross-cutting administration, not a new database table or a literal PHP class declaration. It summarizes role-authorized report generation, dashboard charts, staff activity history, media management and backup creation/download. Reporting reads existing records rather than maintaining a duplicate reporting database. Backup endpoints require an active Super Admin. The diagram shows authorized account use of the service; report inputs such as bookings, billing, inventory and care records are documented here rather than connecting this service to every class.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| SystemBackup | `system_backups` | `createBackup()` — [php/system_backup_common.php](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php)<br>`listBackups()` — [src/services/systemBackupService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js)<br>`downloadBackup()` — [src/services/systemBackupService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js) |
| SystemBackupSetting | `system_backup_settings` | Supporting state; no distinct operation asserted. |
| ReportGenerator | Stateless service; no table | `generateReport()` — [src/services/reportService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js)<br>`buildDashboard()` — [php/reports_common.php](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php) |

## CareSession

A common overview abstraction for grooming jobs and boarding/confinement stays. It is not a request to merge their tables or workflows. Grooming keeps job details, photos, events and veterinarian review. Boarding/confinement keeps room reservations, check-in/out, observations, documents, tasks and material use. Room-related fields and operations apply only to boarding/confinement; grooming uses its own service capacity. sourceId is interpreted together with careType, so unrelated table IDs are not treated as globally unique.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| GroomingJob | `grooming_jobs` | `updateJob()` — [src/services/groomingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js)<br>`viewJob()` — [src/services/groomingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js) |
| GroomingEvent | `grooming_events` | `viewRecord()` — [php/grooming.php](C:/Users/Admin/WebstormProjects/untitled1/php/grooming.php) (Conceptual read responsibility backed by an observed table query.) |
| GroomingPhoto | `grooming_photos` | `uploadPhoto()` — [src/services/groomingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js) |
| GroomingReview | `grooming_reviews` | `viewRecord()` — [php/grooming.php](C:/Users/Admin/WebstormProjects/untitled1/php/grooming.php) (Conceptual read responsibility backed by an observed table query.) |
| BoardingAssignment | `boarding_assignments` | `assignRoom()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`checkIn()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`checkOut()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`updateCheckOut()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |
| BoardingDocument | `boarding_documents` | `addDocument()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`listDocuments()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |
| BoardingMaterialUsage | `boarding_material_usages` | `recordUsage()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`removeUsage()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |
| BoardingObservation | `boarding_observations` | `recordObservation()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |
| BoardingTask | `boarding_tasks` | `createTask()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`completeTask()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |
| Room | `rooms` | `createRooms()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`updateRoom()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)<br>`checkAvailability()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |
| RoomUnitStatus | `room_unit_statuses` | `updateStatus()` — [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js) |

## PatientExamination

Represents the admin/assistant-led physical examination and its queue/assignment context. It retains chief complaint, symptoms and clinical signs, major/urgent symptoms, vital signs, physical findings and images. Starting examination marks the patient as undergoing physical examination in the assigned veterinarian's current-day list. examinedBy preserves who performed the assessment; assignedVet remains separately adjustable. Consent must be captured before completion. Walk-ins are supported without a booking. The physical-examination table comes from the current clinical_intakes migration, which is absent from the supplied SQL export.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| PhysicalExamination | `clinical_intakes` (current migration) | `startExamination()` — [src/services/clinicalIntakeService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js)<br>`saveFindings()` — [src/services/clinicalIntakeService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js)<br>`completeExamination()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx)<br>`reassignVeterinarian()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx)<br>`attachEvidence()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx)<br>`captureConsent()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx) |
| QueueEntry | `queues` | `enqueue()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js)<br>`updateStatus()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js)<br>`assignVeterinarian()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js)<br>`reenterQueue()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js) |
| VetQueueAssignment | `vet_queue_assignments` | `receive()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js)<br>`returnQueue()` — [src/services/queueService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js)<br>`complete()` — [php/vet_diagnoses.php](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php) |

## Diagnosis

A shared conceptual abstraction for onsite and online diagnostic records. Findings include assessment, treatment, laboratory-result entries, notes, attachments and follow-up information where the corresponding workflow supports them. The veterinarian can retain/add consent during diagnosis; moving initial consent to admin examination does not remove that capability. Finalization synchronizes nonempty prescription content to the patient's plan. Automatic prescription printing runs only when printable medicine rows exist. sourceType and sourceId distinguish onsite and online records, so this overview does not imply that their tables share an identifier namespace or a declared inheritance hierarchy.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| Diagnosis | `vet_diagnoses` | `recordDiagnosis()` — [src/services/vetDiagnosisService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js)<br>`finalize()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx)<br>`viewDiagnosis()` — [src/services/vetDiagnosisService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js)<br>`addConsent()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx)<br>`printPrescription()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx) (Print only when a prescription has content.) |
| OnlineDiagnosis | `online_consultation_diagnoses` | `recordDiagnosis()` — [src/services/onlineConsultationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js)<br>`issuePrescription()` — [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php) |

## OnlineConsultation

Represents the remote call attached to an online booking. It keeps the scheduled call interval, meeting details, participation/status timestamps and reschedule history. Online availability remains distinct from clinic operating hours and clinic booking acceptance, while shared veterinarian conflict checking prevents overlapping onsite and remote appointments. Its diagnostic record can issue prescription plans and per-item schedules, just like an onsite diagnosis; a call does not require an onsite physical examination.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| OnlineConsultation | `online_consultations` | `start()` — [src/services/onlineConsultationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js)<br>`join()` — [src/services/onlineConsultationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js)<br>`end()` — [src/services/onlineConsultationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js)<br>`submitDiagnosis()` — [src/services/onlineConsultationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js) |
| OnlineConsultationReschedule | `online_consultation_reschedules` | `reschedule()` — [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js) |

## InventoryItem

Represents a medicine, supply or product together with its stock-management details. Branch/location balances, batches, receipts, suppliers, stock movements, transfers and audit history remain supporting records. Care sessions and service material definitions reference inventory for consumption. Billing may reference an inventory item for a product charge. This simplification does not replace auditable movements with an untracked editable total.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| InventoryItem | `inventory_items` | `createItem()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js)<br>`updateItem()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js)<br>`stockOut()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js) |
| InventoryBranchItem | `inventory_branch_items` | `removeFromClinic()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js) |
| InventoryBatch | `inventory_batches` | `viewRecord()` — [php/boarding_management.php](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php) (Conceptual read responsibility backed by an observed table query.) |
| InventoryLocation | `inventory_locations` | `viewRecord()` — [php/boarding_management.php](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php) (Conceptual read responsibility backed by an observed table query.) |
| InventoryStockMovement | `inventory_stock_movements` | `viewRecord()` — [php/reports_common.php](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php) (Conceptual read responsibility backed by an observed table query.) |
| InventoryStockReceipt | `inventory_stock_receipts` | `receiveStock()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js) |
| InventoryStockReceiptItem | `inventory_stock_receipt_items` | `recordReceivedItem()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js) |
| InventorySupplier | `inventory_suppliers` | `viewRecord()` — [php/inventory.php](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php) (Conceptual read responsibility backed by an observed table query.) |
| InventoryTransfer | `inventory_transfers` | `transferStock()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js) |
| InventoryTransferItem | `inventory_transfer_items` | `recordTransferItem()` — [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js) |
| InventoryAudit | `inventory_action_audit` | Supporting state; no distinct operation asserted. |

## ConsentRecord

Represents a consent instance and its signed/physical document, template, patient/owner context and processing staff. Admin captures the initial owner consent during examination; the veterinarian can handle additional consent in diagnosis. Consent can also be tied to booking or visit context without an examination, so the optional association in the diagram is not a requirement that every consent record originated at intake. Signer, examined-by staff and assigned veterinarian are different responsibilities.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| ConsentRecord | `consent_form_records` | `saveSignedConsent()` — [src/services/consentRecordService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentRecordService.js)<br>`validateDocumentScope()` — [php/consent_record_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php) |
| ConsentTemplate | `consent_files` | `createTemplate()` — [src/services/consentFileService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js)<br>`updateTemplate()` — [src/services/consentFileService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js)<br>`deleteTemplate()` — [src/services/consentFileService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js) |

## PrescriptionPlan

Represents a pet-specific, versioned prescription linked to an onsite or online diagnosis. New or amended content is synchronized to pet/veterinarian views; replacement versions supersede previous plans while keeping history. Owners can start selected medicines or all medicines and receive a navigation-linked update notification. The plan contains item definitions, but it does not force all medicines to share one start date or frequency. Empty diagnostic prescription content does not create a new plan.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| PrescriptionPlan | `prescription_plans` | `syncFromDiagnosis()` — [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php)<br>`startSelectedItems()` — [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js)<br>`amend()` — [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js)<br>`notifyOwner()` — [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php) |
| PrescriptionEvent | `prescription_events` | `recordEvent()` — [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php) |

## PrescriptionItem

Represents one medicine and its own dosing rules, instructions, duration, selected start date and dated completion occurrences. Daily time slots, hourly intervals or selected weekdays belong to the item, not the entire plan. Three-times-a-day defaults can use morning, noon and evening slots, with item-specific times retained. Starting an item generates its due checklist/calendar occurrences. Completing or skipping an occurrence updates that dated dose, not every medicine or every day. Occurrence rows remain stored separately in the implementation even though this paper diagram nests them under PrescriptionItem.

| Supporting object | Persistent mapping | Source-backed responsibilities |
| --- | --- | --- |
| PrescriptionItem | `prescription_items` | `startItem()` — [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js) (Start payload selects individual items and their start dates.)<br>`updateItem()` — [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js)<br>`generateOccurrences()` — [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php) |
| PrescriptionOccurrence | `prescription_occurrences` | `markDone()` — [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js)<br>`skipOccurrence()` — [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js) |

## Additional current-source references

- Clinic/calendar distinction and daily My List: [docs/shared-veterinarian-booking.md](C:/Users/Admin/WebstormProjects/untitled1/docs/shared-veterinarian-booking.md)
- Intake consent requirement and examination provenance: [php/clinical_intakes.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php)
- Per-item recurrence generation, plan versioning and empty-plan guard: [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php)
- Diagnosis prescription synchronization: [php/vet_diagnoses.php](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php)
- Online diagnosis prescription synchronization: [php/online_consultations.php](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php)
- Prescription start/checklist UI: [src/components/shared/PrescriptionPlanPanel.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx)
- Conditional automatic printing and extra vet consent: [src/components/VetrinarianComponents/VetDiagnosis.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx)
- Staff history: [php/staff_activity_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php)
- Media operations: [php/pet_media_monitoring.php](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php)
- Super Admin backup authorization: [php/system_backups.php](C:/Users/Admin/WebstormProjects/untitled1/php/system_backups.php)

Coverage: 91 detailed responsibilities, 89 persistent objects, 174 source-backed operations, each supporting object assigned to exactly one main class.

