# iPawcus System Inventory and Gantt Details

Prepared: 2026-06-20

This document is a planning inventory for the current project. It lists the visible pages, component files, backend endpoints, database areas, workflows, notifications, design parts, and suggested Gantt work packages.

## Current Planning Notes

- The app is a React 19 + Vite + Tailwind frontend with a PHP + MySQL backend.
- The dashboard is role based, but `src/components/Dashboard.jsx` and `src/components/dashboardRouter.jsx` currently have `DEBUG_BYPASS = true`. Do not change that while planning unless it becomes a separate security task.
- The latest full database export in this workspace is `DDL/database_ddl_20260618_034832.sql`. It was generated for database `ipawcus_system` on 2026-06-18 at 03:48:31 UTC and contains 47 tables and 0 views.
- The newest consent-record table is tracked as an explicit migration in `DDL/20260619_create_consent_form_records.sql`; it is not part of the full DDL exports yet.
- `README.md` and `AGENTS.md` mention `tables.sql`, but this workspace currently does not contain that file. Do not use `tables.sql` as the planning source unless a fresh copy is added later.
- Some PHP files perform runtime schema updates or table creation. These should be tracked in the Gantt because they affect deployment.
- Recent confirmed requirements:
  - Diagnosis vaccination is optional. It must not be required for every diagnosis.
  - Veterinarians can add extra consent forms during diagnosis when the default consent is not enough.
  - Extra diagnosis consent should be signed by the pet owner and saved with the diagnosis record.
  - Pet hotel or boarding requires a liability consent signature before the booking/payment submission can proceed.
  - Boarding consent follows the same idea as diagnosis consent: show the form, capture signature, then allow the next action.
  - Medical record actions should show direct `Print` and `Email Copy` buttons, not a problematic dropdown.
  - TV display/status page is implemented as a public read-only route for queue, booking, diagnosis, payment, and pet status.
  - Super Admin reporting now has a live dashboard plus report preview, print, and CSV export flows.
  - Super Admin can review pet owner accounts, linked pets, account status support, and ownership links.
  - Pet media monitoring aggregates consent, booking, queue, diagnosis, and boarding images for Super Admin review.
  - Consent signatures should be captured into `consent_form_records` when the migration is present, with legacy booking/queue fields still used as fallback data.
  - POS billing now consumes linked inventory materials/items and reverses stock movements when visit charges are replaced.
  - Booking/queue lifecycle maintenance now handles expired queues, missed approved bookings, auto-reschedule notes, and recovery reporting.
  - Contact phone inputs now enforce a locked `+639` Philippine mobile prefix and normalize common pasted values.
  - Logout and deactivation actions now require confirmation before continuing.
  - Shared view modals and sheets should expose a visible `X` close control.
  - Notification panels should avoid covering the dashboard navigation, and collapse controls should show clear chevron states.
  - Boarding room creation should only require the `rooms` table and should tolerate room schemas with or without `room_id`.
  - Future task: improve upload preview for non-image files such as PDF or office documents. Current shared preview support is strongest for images through `PhotoViewer`.

## System Areas

| Area | Main Users | Purpose |
| --- | --- | --- |
| Public/auth | Visitors, pet owners, staff | Landing, login, registration, email verification, password reset, server-down handling |
| Pet owner dashboard | Pet Owner | Pet profiles, booking, consultation, service requests, queue self-service, medical records, todos, profile |
| Admin dashboard | Admin, Super Admin | Bookings, queue, boarding, pet registry, service catalog, consent files, POS, inventory, record requests |
| Veterinarian dashboard | Veterinarian, Super Admin | Approved queues, assigned list, diagnosis, EMR review, record update work, online consult diagnosis, schedule/profile |
| Super admin dashboard | Super Admin | Reports dashboard, report export/print center, account management, pet owner controls, pet media monitoring, payment method settings |
| Backend API | All frontend roles | PHP routes, database persistence, upload handling, notifications, email, push |
| Database | Backend | Users, pets, bookings, queues, records, boarding, inventory, notifications, billing |

## Roles and Access

| Role | Expected Access |
| --- | --- |
| Pet Owner / `pet_owner` | Home, consult, services, my pets, self-service queue, todos, profile, own medical records |
| Admin | Bookings, queue, pet registry, boarding, POS, service catalog, consent files, inventory, record update requests, admin profile |
| Veterinarian | Approved queue, my list, diagnosis, medical records, record requests, histories, online consultations, vet profile |
| Super Admin | All admin-level areas plus account and payment method management |

Implementation note: because debug bypass is currently enabled, route role arrays are broadened in the dashboard shell and dashboard router. Treat final role locking as a later hardening task.

## Public Pages

| Path | Component | Main Purpose | Key Actions |
| --- | --- | --- | --- |
| `/` | `LandingPage` from `src/components/landingpage.jsx` | Public entry page | Navigate to login or registration |
| `/landing` | `LandingPage` | Public landing page | Navigate to login or registration |
| `/landing/login` | `Login` | Sign in existing users | Login, forgot password, verify email route |
| `/landing/register` | `RegistrationForm` | First registration step | Capture account data and role |
| `/landing/register/profile` | `PetOwnerProfileForm` | Registration profile step | Capture profile, address autocomplete, submit registration |
| `/landing/verify-email` | `EmailVerification` | OTP email verification | Verify code, resend code |
| `/landing/forgot-password` | `ForgotPassword` | Password reset by OTP | Request reset code, verify code, set new password |
| Server down state | `ServerDownPage` | Full-screen API/database failure page | Retry health check |

## Dashboard Shell

| File | Purpose |
| --- | --- |
| `src/components/Dashboard.jsx` | Main dashboard layout, lazy page loading, sidebar, mobile drawer, role navigation, profile entry, notification bell, route rendering |
| `src/components/dashboardRouter.jsx` | Lightweight internal router for dashboard paths, route parameters, navigation context, route role checks |
| `src/App.jsx` | Public route switching, login session storage, registration flow, server health status, dashboard mount |
| `src/context/ThemeProvider.jsx` | Theme persistence and document root `dark` class control |
| `src/hooks/useTheme.js` | Theme hook used by profile/theme controls |
| `src/hooks/useAutoRefresh.js` | Shared quiet refresh hook for GET-backed dashboard views |

## Pet Owner Pages

| Route | Component | Purpose | Main Actions/Data |
| --- | --- | --- | --- |
| `/dashboard` | `PetOwnerDashboard/Home.jsx` | Dashboard home and quick links | Service cards, pet/booking entry points |
| `/dashboard/consult` | `Consult.jsx` | Online consultation overview | View own online consults/bookings, join active consult |
| `/dashboard/consult/booking` | `ConsultBooking.jsx` | Schedule online consult | Select pet, veterinarian, schedule, load vet schedules/bookings |
| `/dashboard/consult/payment` | `ConsultPayment.jsx` | Online consult payment | Upload payment proof, submit booking |
| `/dashboard/consult/confirmation/:bookingId` | `ConsultConfirmation.jsx` | Booking confirmation | View booking, cancel where allowed, join online consult |
| `/dashboard/consult/video/:consultationId` | `VideoConsultation.jsx` | Online consult room | Load consultation meeting URL and embed/open room |
| `/dashboard/services` | `Services.jsx` | Service menu | Navigate to service-specific forms |
| `/dashboard/services/general-checkup` | `GeneralCheckup.jsx` | General Check-up booking | Select pet/new pet details, upload concern, submit booking |
| `/dashboard/services/parasite-control` | `ParasiteControl.jsx` | Parasite control booking | Same standard service booking flow |
| `/dashboard/services/surgery` | `Surgery.jsx` | Surgery booking | Standard service booking with documents/concern |
| `/dashboard/services/vaccination` | `Vaccination.jsx` | Vaccination booking | Standard service booking for vaccination service |
| `/dashboard/services/grooming` | `Grooming.jsx` | Grooming booking | Standard service booking |
| `/dashboard/services/dental-checkup` | `DentalCheckup.jsx` | Dental checkup booking | Standard service booking |
| `/dashboard/services/home-services` | `HomeServices.jsx` | Home service setup | Select pet, address autocomplete, compute/collect home visit details |
| `/dashboard/consult/confirmation/home-service` | `HomeServiceConfirmation.jsx` | Home service confirmation and payment | Terms, signature, payment method, payment proof, final submit |
| `/dashboard/services/pet-hotel` | `PetHotel.jsx` | Boarding/hotel/kennel booking | Select pets, room/kennel, dates, emergency contact, liability consent signature, submit booking |
| `/dashboard/services/special-services` | `SpecialServices.jsx` | Announced special service booking | Load service catalog, limits, date restrictions, multi-pet booking |
| `/dashboard/my-pets` | `MyPets.jsx` | Owner pet list | Load linked pets, navigate to profile, view available pets if admin/debug role |
| `/dashboard/my-pets/add` | `AddPet.jsx` | Link existing pet by sharable ID | Link pet ownership |
| `/dashboard/my-pets/:petId` | `PetProfile.jsx` | Pet profile and activity | View/edit profile, upload image, print, copy pet ID, cancel eligible queue/booking |
| `/dashboard/my-pets/:petId/medical-records` | `MedicalRecords.jsx` | Owner medical record view | View organized records, image preview, print, email copy |
| `/dashboard/my-pets/:petId/request-update` | `RequestUpdateRecord.jsx` | Request medical record update | Upload proof/document, describe requested update, submit request |
| `/dashboard/self-service-queue` | `Self-Service_QUEUE.jsx` | Public/owner queue self-service | Check WAN/IP access, select pet, sign consent, add queue, cancel own queue |
| `/dashboard/todos` | `Todos.jsx` | Owner reminders/tasks | Create, update, complete, delete personal tasks |
| `/dashboard/profile` | `PetOwnerProfile.jsx` | Owner profile | Edit account/profile, upload image, notification preferences, theme/password panels |
| Shared submit component | `PaymentSubmission.jsx` | Reusable payment submit screen | Payment method, proof upload, booking submit |

## Admin Pages

| Route | Component | Purpose | Main Actions/Data |
| --- | --- | --- | --- |
| `/dashboard/bookings` | `BookingManagement.jsx` | Booking operations | Filter bookings, approve/reject/cancel/reschedule, receive booking, register unregistered pet, view payment/concern images |
| `/dashboard/record-requests` | `RecordUpdateRequestsManagement.jsx` | Admin review of pet record update requests | Review, approve/reject, assign veterinarian, update status/payment |
| `/dashboard/boarding` | `PetBoardingManagement.jsx` | Boarding operations | Room setup, room status, reserve, check in/out, direct boarding, observations, tasks, documents, print history |
| `/dashboard/queue` | `QueueManagement.jsx` | Queue operations | View queues, add queue, status changes, assign/receive/return/reenter queue |
| `/dashboard/pos` | `POSmanagement.jsx` | Visit billing/POS | Create visit, add charges/items/services, post payment, view invoice/payment state |
| `/dashboard/service-catalog` | `ServiceCatalogManagement.jsx` | Clinic service catalog | Add/update/delete service prices, service types, materials linked to inventory |
| `/dashboard/consent` | `ConsentFileManagement.jsx` | Consent template management | Upload TXT consent forms, categorize, edit, preview, delete |
| `/dashboard/pet-register` | `PetRegister.jsx` | Clinic pet registry | Add pets, upload image, status update, add pet to queue |
| `/dashboard/pet-register/:petId` | `PetProfileEdit.jsx` | Admin pet edit/EMR | Edit details, organized medical records, upload record documents |
| `/dashboard/inventory` | `AllItemsPage.jsx` | Inventory list | Search/filter, edit item, stock out, status badges, auto-refresh |
| `/dashboard/inventory/add` | `AddNewItemPage.jsx` | Add inventory item | Create SKU/item, upload image/document, set stock metadata |
| `/dashboard/inventory/stock-in` | `StockInPage.jsx` | Receive inventory | Create stock receipt, supplier/location/batch details |
| `/dashboard/inventory/low-stock` | `LowStockPage.jsx` | Low stock monitoring | Show items below reorder point |
| `/dashboard/inventory/near-expiry` | `NearExpiryPage.jsx` | Expiry monitoring | Show expiring batches |
| `/dashboard/inventory/disposal` | `DisposalLogsPage.jsx` | Disposal report | View/print stock disposal records |
| `/dashboard/profile` for admin | `adminprofile.jsx` | Admin profile | Edit admin profile, upload profile image, notification preferences, theme/password panels |

## Veterinarian Pages

| Route | Component | Purpose | Main Actions/Data |
| --- | --- | --- | --- |
| `/dashboard/vet/approved-queue` | `ApprovedQueueList.jsx` | Queue items ready for vet | View approved bookings/queues, receive queue/booking |
| `/dashboard/vet/my-list` | `VetMylistinService.jsx` | Vet assigned work list | View assigned queues, consent handling, return/reenter when needed |
| `/dashboard/vet/diagnosis` | `VetDiagnosis.jsx` | Diagnosis form | Select assigned queue/booking, add findings, optional vaccination, prescriptions, follow-up, extra consent signatures, attachments, create visit billing |
| `/dashboard/vet/medical-records` | `VetPetsEMR.jsx` | Vet EMR browser | Search pets, view organized medical records, save/update groups/items |
| `/dashboard/vet/record-requests` | `VetRecordUpdateRequests.jsx` | Vet side of record update requests | Start/complete assigned record updates |
| `/dashboard/vet/histories` | `VetDiagnosisHistory.jsx` | Diagnosis history | View past queue/booking/online consult diagnosis records |
| `/dashboard/vet/online-consultations` | `ApprovedOnlineConsultation.jsx` | Online consult worklist | View/auto-refresh consultations, start Jitsi room |
| `/dashboard/vet/online-consultations/:onlineConsultationId/diagnosis` | `VetOnlineConsultDiagnosis.jsx` | Online consult diagnosis | Submit online consultation diagnosis and complete consult |
| `/dashboard/profile` for vet | `VetProfile.jsx` | Vet profile and schedule | Edit vet profile, upload image, manage weekly schedules |

## Super Admin Pages

| Route | Component | Purpose | Main Actions/Data |
| --- | --- | --- | --- |
| `/dashboard` for super admin | `SuperAdminReportsDashboard.jsx` | Super Admin landing dashboard | KPI cards, Chart.js visualizations, staff/activity monitoring, operational attention tables |
| `/dashboard/reports` | `SuperAdminReportsDashboard.jsx` | Reports dashboard route | Same dashboard surface for direct route access |
| `/dashboard/reports/export` | `SuperAdminReportCenter.jsx` | Report export and print center | Select report type/date/filter, preview tables, print, export CSV |
| `/dashboard/pet-media-monitoring` | `PetMediaMonitoring.jsx` | Pet media monitoring | Filter/preview consent, booking, queue, diagnosis, and boarding images |
| `/dashboard/accounts` | `AccountManagement.jsx` | User/staff account management | List accounts, create account, activate/deactivate admin accounts |
| `/dashboard/pet-owner-accounts` | `PetOwnerAccountsManagement.jsx` | Pet owner account control | Search owners, inspect linked pets/activity, deactivate/reactivate where DB supports it, remove ownership links |
| `/dashboard/payment-methods` | `PaymentMethodsManagement.jsx` | Clinic payment method settings | Load methods, upload QR/payment image, OTP verification, save payment options |

## Component Inventory

### Root Components

| Component | Purpose |
| --- | --- |
| `Dashboard.jsx` | Dashboard shell, role nav, lazy route rendering |
| `dashboardRouter.jsx` | Internal dashboard route matching and navigation context |
| `EmailVerification.jsx` | Email OTP verification screen |
| `ForgotPassword.jsx` | Password reset flow |
| `landingpage.jsx` | Public landing page |
| `Login.jsx` | Login form and auth handoff |
| `petownerprofileRegistration.jsx` | Registration profile form with address autocomplete |
| `Registration.jsx` | Account registration form |
| `ServerDownPage.jsx` | API/database outage screen |
| `SignatureCapture.jsx` | Reusable canvas signature capture used in consent flows |
| `StatusDisplay/TVStatusDisplay.jsx` | Public TV queue/booking/payment status display |
| `figma/ImageWithFallback.jsx` | Image helper/fallback component |

### Shared Components

| Component | Purpose |
| --- | --- |
| `shared/ConsentDocument.jsx` | Render consent document content for preview/signing |
| `shared/consentDocumentImage.js` | Consent document image helper |
| `shared/NotificationBell.jsx` | Dashboard notification menu, read actions, push sync |
| `shared/NotificationPreferencesCard.jsx` | User notification preference UI and browser push toggle |
| `shared/PasswordChangeCard.jsx` | Password change panel |
| `shared/PasswordInput.jsx` | Password input with visibility handling |
| `shared/ProfileHistoryEditor.jsx` | Profile/history editing block |
| `shared/SubmissionStatus.jsx` | Submission status display |
| `shared/ThemeToggle.jsx` | Shared light/dark theme control |

### Pet Owner Components

| Component | Purpose |
| --- | --- |
| `AddPet.jsx` | Link pet to owner account |
| `Consult.jsx` | Owner online consultation dashboard |
| `ConsultBooking.jsx` | Online consultation scheduling |
| `ConsultConfirmation.jsx` | Booking/consult confirmation view |
| `ConsultPayment.jsx` | Online consultation payment/proof submit |
| `DentalCheckup.jsx` | Dental checkup booking form |
| `GeneralCheckup.jsx` | General checkup booking form |
| `Grooming.jsx` | Grooming booking form |
| `Home.jsx` | Owner dashboard home |
| `HomeServiceConfirmation.jsx` | Home service signature/payment confirmation |
| `HomeServices.jsx` | Home service details form |
| `MedicalRecords.jsx` | Owner medical record viewer with print/email |
| `MyPets.jsx` | Owner pet list |
| `ParasiteControl.jsx` | Parasite control booking form |
| `PaymentSubmission.jsx` | Payment submission helper screen |
| `PetHotel.jsx` | Boarding booking form with consent signature |
| `PetOwnerProfile.jsx` | Owner profile settings |
| `PetProfile.jsx` | Owner pet profile, activity, cancellation |
| `RequestUpdateRecord.jsx` | Owner request for record correction/update |
| `Self-Service_QUEUE.jsx` | Queue self-service page with consent signature |
| `Services.jsx` | Service menu |
| `SpecialServices.jsx` | Special service catalog/booking |
| `Surgery.jsx` | Surgery booking form |
| `Todos.jsx` | Owner todo/reminder management |
| `Vaccination.jsx` | Vaccination service booking form |
| `VideoConsultation.jsx` | Online consult meeting view |

### Admin Components

| Component | Purpose |
| --- | --- |
| `AddNewItemPage.jsx` | Add inventory item |
| `AddQueueDialog.jsx` | Admin add-to-queue dialog |
| `adminprofile.jsx` | Admin profile settings |
| `AllItemsPage.jsx` | Inventory list and stock out |
| `BookingManagement.jsx` | Booking approval, cancellation, rescheduling, pet registration |
| `ConsentFileManagement.jsx` | Consent template CRUD |
| `DisposalLogsPage.jsx` | Inventory disposal report |
| `InventoryStatusBadge.jsx` | Inventory item status display |
| `LowStockPage.jsx` | Low stock report |
| `NearExpiryPage.jsx` | Near expiry report |
| `PetBoardingManagement.jsx` | Boarding room and stay management |
| `PetInfoModal.jsx` | Pet detail modal |
| `PetOwnerInfoModal.jsx` | Pet owner detail modal |
| `PetProfileEdit.jsx` | Admin pet profile/medical edit |
| `PetRegister.jsx` | Pet registry management |
| `POSmanagement.jsx` | Visit billing and payments |
| `QueueManagement.jsx` | Queue management |
| `RecordUpdateRequestsManagement.jsx` | Admin record request review |
| `ServiceCatalogManagement.jsx` | Service catalog and materials |
| `StockInPage.jsx` | Inventory stock receiving |

### Super Admin Components

| Component | Purpose |
| --- | --- |
| `AccountManagement.jsx` | Account creation and activation state |
| `PaymentMethodsManagement.jsx` | Payment settings with OTP |
| `PetMediaMonitoring.jsx` | Super Admin media review for consent, booking, queue, diagnosis, and boarding images |
| `PetOwnerAccountsManagement.jsx` | Pet owner account and ownership-link management |
| `ReportChartCard.jsx` | Chart.js report card wrapper |
| `ReportKpiCard.jsx` | Report KPI card |
| `ReportPreview.jsx` | Printable report preview |
| `ReportTable.jsx` | Shared report table renderer |
| `SuperAdminReportCenter.jsx` | Report generation, preview, print, and CSV export UI |
| `SuperAdminReportsDashboard.jsx` | Super Admin KPI/chart dashboard |

### Veterinarian Components

| Component | Purpose |
| --- | --- |
| `ApprovedOnlineConsultation.jsx` | Vet online consultation worklist |
| `ApprovedQueueList.jsx` | Approved queue/booking list |
| `VetDiagnosis.jsx` | In-clinic diagnosis form |
| `VetDiagnosisHistory.jsx` | Diagnosis history |
| `VetMylistinService.jsx` | Vet assigned queue list |
| `VetOnlineConsultDiagnosis.jsx` | Online consultation diagnosis |
| `VetPetsEMR.jsx` | Vet EMR browser/editor |
| `VetProfile.jsx` | Vet profile and schedule |
| `VetRecordUpdateRequests.jsx` | Vet record update request workflow |

### UI Primitives

| File | Purpose |
| --- | --- |
| `src/ui/badge.jsx` | Badge/status label primitive |
| `src/ui/button.jsx` | Button primitive |
| `src/ui/card.jsx` | Card primitive |
| `src/ui/checkbox.jsx` | Checkbox primitive |
| `src/ui/command.jsx` | Command/search primitive |
| `src/ui/dialog.jsx` | Modal dialog primitive |
| `src/ui/input.jsx` | Input primitive |
| `src/ui/label.jsx` | Label primitive |
| `src/ui/photo-viewer.jsx` | Image preview modal |
| `src/ui/popover.jsx` | Popover primitive |
| `src/ui/radio-group.jsx` | Radio group primitive |
| `src/ui/select.jsx` | Select/dropdown primitive |
| `src/ui/sheet.jsx` | Side sheet primitive |
| `src/ui/table.jsx` | Table primitive |
| `src/ui/tabs.jsx` | Tabs primitive |
| `src/ui/textarea.jsx` | Textarea primitive |
| `src/ui/utils.js` | UI class merge/helper utilities |

## Frontend Service Modules

| Service | Purpose |
| --- | --- |
| `accountService.js` | Fetch/create accounts, update account status, fetch/manage pet owner accounts |
| `addPet.js` | Create pet records |
| `addressAutocomplete.js` | Geoapify address autocomplete |
| `apiClient.js` | Base API URL, fetch wrapper, health checks, timeout/server-down state |
| `authEmail.js` | Email verification and password reset OTP calls |
| `boardingService.js` | Boarding room availability, rooms, monitoring, assignment, check-in/out, tasks, observations, documents |
| `bookingService.js` | Booking list/detail/create/status/schedule/receive |
| `ConnectOwnership.js` | Link pet ownership and fetch user pets |
| `consentFileService.js` | Consent file CRUD |
| `consentRecordService.js` | Save signed/released consent form records |
| `findPet.js` | Fetch one pet detail |
| `inventoryApi.js` | Inventory meta/items/create/update/stock-in/stock-out/upload |
| `notificationService.js` | Notification list/read/preferences/push/reminders |
| `onlineConsultationService.js` | Online consult list/detail/start/join/end/diagnosis |
| `paymentMethodService.js` | Payment method list, OTP, update |
| `petMediaMonitoringService.js` | Super Admin pet media monitoring query |
| `petService.js` | Pets, pet details/status, activity, medical records, email copy, organized record CRUD |
| `profileService.js` | Role-aware profile fetch/update |
| `pushNotificationService.js` | Browser push service worker, permission, subscription sync |
| `queueService.js` | Queue list/pets/add/status/assign/receive/return/reenter |
| `recordUpdateRequestService.js` | Record update request list/create/update |
| `registerUser.js` | Registration submit |
| `reportService.js` | Reports dashboard and report generation requests |
| `selfServiceService.js` | Public WAN IP and self-service queue access check |
| `serviceCatalogService.js` | Service catalog CRUD and materials |
| `specialServicesService.js` | Special service catalog CRUD |
| `statusDisplayService.js` | Public TV status display fetch |
| `todoService.js` | Owner todo CRUD |
| `uploadService.js` | Upload files/data URLs and delete uploaded files |
| `userLogin.js` | Login |
| `userService.js` | User fetch/update/password |
| `vetDiagnosisService.js` | Diagnosis list/detail/create |
| `vetScheduleService.js` | Vet schedule fetch/update |
| `visitBillingService.js` | Visit, charges, and payment API calls |

## Backend Endpoint Inventory

The backend router starts at `php/index.php`. It strips `/api` if present, then routes to feature scripts.

| Endpoint Group | Routes | Backend Files |
| --- | --- | --- |
| Auth | `/login`, `/register`, `/users`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password` | `login.php`, `register.php`, `auth_*.php`, `auth_otp_helpers.php` |
| Users/profile/accounts | `/users/{id}`, `/users/{id}/password`, `/profile`, `/accounts`, `/accounts/create`, `/accounts/{id}/status`, `/pet-owner-accounts`, `/pet-owner-accounts/{id}/status`, `/pet-owner-accounts/{id}/pets/{petId}` | `get_user.php`, `update_user.php`, `update_password.php`, `get_user_profile.php`, `update_user_profile.php`, `get_accounts.php`, `create_account.php`, `update_account_status.php`, `pet_owner_accounts.php` |
| Pets/ownership | `/pet_information`, `/pet_information/{id}`, `/pet_information/{id}/status`, `/pet_ownership/link`, `/users/{id}/pets` | `add_pet.php`, `get_pets.php`, `get_pet.php`, `update_pet.php`, `update_pet_status.php`, `link_pet.php`, `get_user_pets.php` |
| Pet activity/records | `/pets/{id}/queues`, `/pets/{id}/bookings`, `/pets/{id}/overdue/cancel`, `/pets/{id}/medical` | `get_pet_queues.php`, `get_pet_bookings.php`, `pet_overdue_cancellations.php`, `pet_medical_records.php` |
| Uploads | `/upload`, `/upload/delete` | `upload.php`, `delete_upload.php` |
| Payment methods | `/payment-methods`, `/payment-methods/otp` | `payment_methods.php` |
| Super Admin reports | `/reports/dashboard`, `/reports/generate` | `reports_dashboard.php`, `reports_generate.php`, `reports_common.php` |
| Pet media monitoring | `/pet-media-monitoring` | `pet_media_monitoring.php` |
| Lifecycle recovery | `/lifecycle/recovery-report` | `lifecycle_recovery_report.php` |
| Bookings | `/bookings`, `/bookings/{id}/status`, `/bookings/{id}/receive`, `/bookings/{id}/schedule`, `/users/{id}/bookings` | `add_booking.php`, `get_bookings.php`, `update_booking_status.php`, `receive_booking.php`, `update_booking_schedule.php` |
| Online consultations | `/online-consultations`, `/online-consultations/{id}`, `/online-consultations/{id}/start`, `/join`, `/end`, `/diagnosis` | `online_consultations.php`, `online_consultation_helpers.php` |
| Notifications | `/notifications`, `/notifications/{id}/read`, `/notifications/read-all`, `/notifications/preferences`, `/notifications/push/public-key`, `/push/status`, `/push/subscribe`, `/push/unsubscribe`, `/notifications/reminders/run` | `notifications.php`, `notification_helpers.php`, `mail_helpers.php` |
| Todos | `/todos`, `/todos/{id}`, `/users/{id}/todos` | `pet_owner_todos.php` |
| Special services | `/special_services`, `/special_services/{id}` | `special_services.php` |
| Service catalog | `/service-catalog`, `/service-catalog/{id}`, `/service-catalog/{id}/materials` | `service_catalog.php` |
| Visit billing/POS | `/visits`, `/visits/{id}`, `/visits/{id}/charges`, `/visits/{id}/payments` | `visit_billing.php` |
| Boarding | `/rooms/availability`, `/boarding/rooms`, `/boarding/direct-check-in`, `/boarding/monitoring`, `/boarding/observations`, `/boarding/tasks`, `/boarding/tasks/{id}/complete`, `/boarding/documents`, `/boarding/bookings/{id}/assign-room`, `/check-in`, `/check-out`, `/desired-check-out`, `/documents` | `get_room_availability.php`, `boarding_management.php` |
| Record update requests | `/record-update-requests`, `/record-update-requests/{id}` | `record_update_requests.php` |
| Inventory | `/inventory`, `/inventory/meta`, `/inventory/items`, `/inventory/stock-in`, `/inventory/stock-out` | `inventory.php` |
| Consent files and records | `/consent_files`, `/consent_files/{id}`, `/consent-form-records`, `/consent_form_records` | `get_consent_files.php`, `add_consent_file.php`, `update_consent_file.php`, `delete_consent_file.php`, `consent_form_records.php`, `consent_record_helpers.php` |
| Queue | `/queues`, `/queues/debug`, `/queues/pets`, `/queues/status`, `/queues/receive`, `/queues/assign`, `/queues/return`, `/queues/reenter` | `get_queues.php`, `add_to_queue.php`, `update_queue_status.php`, `receive_queue.php`, `assign_queue_vet.php`, `return_queue.php`, `reenter_queue.php`, `debug_queues.php` |
| Vet diagnosis | `/vet-diagnoses`, `/vet-diagnoses/{id}` | `vet_diagnoses.php` |
| Self-service access | `/self-service/access` | `check_self_service_access.php` |
| TV status display | `/status-display`, `/tv-status` | `status_display.php` |
| Vet schedules | `/vet_schedules` | `get_vet_schedules.php`, `update_vet_schedule.php` |
| Health/mail test | `/health`, `/mail/test` | `index.php`, `mail_test.php` |

## Main Workflows

### 1. Registration and Login

1. User opens landing/register.
2. `Registration.jsx` captures email, password, role, and basic details.
3. `petownerprofileRegistration.jsx` captures profile details and address.
4. `registerUser.js` posts to `/register`.
5. Backend creates `users` and role profile records, then creates/sends OTP using `email_otp_tokens`.
6. User verifies through `/auth/verify-email`.
7. Login stores `currentUser` in localStorage and opens `/dashboard`.
8. `App.jsx` checks `/health`; if DB/API fails, `ServerDownPage` blocks access until recovery.

### 2. Standard Booking

1. Pet owner chooses a service page.
2. Page loads owner pets from `petService`.
3. User selects existing pet or enters unregistered pet details.
4. Optional concern image/document is uploaded through `/upload`.
5. Booking data is submitted to `/bookings`.
6. Booking starts as pending/admin-review style status.
7. Admin reviews in `BookingManagement.jsx`.
8. Admin can confirm, cancel, reschedule, receive, or link/register unregistered pets.
9. Notifications are generated for booking submitted/confirmed/cancelled/rescheduled where backend events are called.

### 3. Online Consultation

1. Pet owner schedules through `ConsultBooking.jsx`.
2. Payment/proof is submitted through `ConsultPayment.jsx`.
3. Admin confirms the booking.
4. `online_consultation_helpers.php` creates a Jitsi room for online consult bookings.
5. Veterinarian starts the consult in `ApprovedOnlineConsultation.jsx`.
6. Pet owner joins from `Consult.jsx` or confirmation page.
7. Vet submits diagnosis through `VetOnlineConsultDiagnosis.jsx`.
8. Consultation can be ended through the online consultation API.

### 4. Home Service

1. Pet owner enters home service details in `HomeServices.jsx`.
2. Confirmation page shows terms and requires a signature.
3. Payment method and proof are required before submission.
4. Backend stores booking data, signature path, transport fee, and payment fields.
5. Admin handles it through booking management.

### 5. Boarding / Pet Hotel

1. Pet owner opens `PetHotel.jsx`.
2. Page loads owner pets, room availability, and boarding consent template.
3. User selects pet(s), service type, room/kennel, check-in/out dates, and emergency contact.
4. User must sign boarding liability consent before the submit/payment button is allowed.
5. Current booking code submits boarding consent data to `/bookings` as `consent_forms` and `consent_status`; these columns are not in the latest full DDL yet, so they need the runtime auto-ALTER or an explicit migration.
6. Admin handles room assignment/reservation/check-in in `PetBoardingManagement.jsx`.
7. During stay, admin records observations, scheduled tasks, documents, and check-out.
8. Boarding history can be printed.

### 6. Queue to Vet Diagnosis to Payment

1. Queue is created by admin, self-service queue, or by receiving a booking.
2. Queue status changes through admin actions or self-service cancellation.
3. Admin assigns/receives queue for a veterinarian.
4. Veterinarian sees assigned work in `VetMylistinService.jsx`.
5. Veterinarian opens `VetDiagnosis.jsx`.
6. Vet records diagnosis details, prescriptions, notes, follow-up, optional vaccination details, attachments, and extra consent signatures if needed.
7. Vaccination fields are optional. Diagnosis can be saved without vaccination.
8. Backend saves `vet_diagnoses`, can save `pet_vaccinations` only when vaccination data exists, completes queue/booking, sends diagnosis notification.
9. Diagnosis creates or connects a `visits` billing record.
10. Admin/POS prepares invoice/charges in `POSmanagement.jsx`.
11. Payment is recorded in visit payments.
12. Owner receives invoice/payment notifications when enabled.

### 7. Medical Records

1. Medical records are loaded through `/pets/{id}/medical`.
2. Owner view uses `MedicalRecords.jsx` with owner-safe records, attachment image preview, print, and email copy.
3. Admin edit view uses `PetProfileEdit.jsx`.
4. Vet EMR view uses `VetPetsEMR.jsx`.
5. Organized records are stored as groups and group items.
6. Email copy uses `emailPetMedicalRecords`.
7. Current preview is image-focused. PDF/document preview should be a future enhancement with embedded PDF/object preview or download fallback.

### 8. Record Update Requests

1. Pet owner submits a request from `RequestUpdateRecord.jsx`.
2. Request can include evidence/proof upload.
3. Admin reviews in `RecordUpdateRequestsManagement.jsx`.
4. Admin can approve/reject, update payment state, or assign a veterinarian.
5. Vet sees assigned requests in `VetRecordUpdateRequests.jsx` and completes work.

### 9. Inventory and Service Catalog

1. Admin manages service prices and linked materials in `ServiceCatalogManagement.jsx`.
2. Inventory items are created in `AddNewItemPage.jsx`.
3. Stock receipts are recorded in `StockInPage.jsx`.
4. Stock-out or disposal movements are recorded from inventory pages.
5. Low stock and near expiry reports support operational monitoring.
6. POS can reference service catalog and inventory items as visit charges.

### 10. Notifications

1. `NotificationBell.jsx` loads in-app notifications.
2. `NotificationPreferencesCard.jsx` controls categories and push/email options.
3. `pushNotificationService.js` registers `public/ipawcus-push-sw.js`.
4. Backend stores notifications in `user_notifications`.
5. Backend stores user preferences in `notification_preferences`.
6. Browser push subscriptions are stored in `notification_push_subscriptions`.
7. Reminder runner is called through `/notifications/reminders/run`.

### 11. Super Admin Reports

1. Super Admin opens `/dashboard` or `/dashboard/reports`.
2. `SuperAdminReportsDashboard.jsx` loads `/reports/dashboard` with role and date-range parameters.
3. Backend `reports_common.php` builds KPIs, Chart.js datasets, summary tables, staff monitoring, and missing-data notes from bookings, queues, visits, diagnosis, inventory, consent, and pet data.
4. The report dashboard auto-refreshes quietly through `useAutoRefresh`.
5. Super Admin opens `/dashboard/reports/export` for detailed reports.
6. `SuperAdminReportCenter.jsx` posts report type, date range, and filters to `/reports/generate`.
7. Generated reports can be previewed, printed, and exported as CSV. PDF/Excel buttons are placeholders until export dependencies are added.

### 12. Pet Owner Accounts and Pet Media Monitoring

1. Super Admin opens `/dashboard/pet-owner-accounts`.
2. `PetOwnerAccountsManagement.jsx` loads pet owner profiles, linked pets, booking counts, and queue counts from `/pet-owner-accounts`.
3. Ownership links can be removed without deleting the pet record.
4. Owner deactivation/reactivation requires `users.account_status`, `users.deactivated_at`, and `users.deactivation_reason`; the endpoint returns the required SQL when those columns are missing.
5. Login checks `users.account_status` when present and blocks deactivated accounts.
6. Super Admin opens `/dashboard/pet-media-monitoring`.
7. `PetMediaMonitoring.jsx` loads image records from consent records, bookings, queues, diagnosis uploads, and boarding documents through `/pet-media-monitoring`.
8. Media can be filtered by date range, source, and pet, then previewed with `PhotoViewer`.

### 13. Consent Records and Lifecycle Maintenance

1. `DDL/20260619_create_consent_form_records.sql` creates `consent_form_records`.
2. `consent_record_helpers.php` saves or updates signed consent records for booking, queue, diagnosis/manual, and released/physical consent states when the table exists.
3. `/consent-form-records` allows explicit consent record creation from the frontend.
4. Reports and media monitoring use `consent_form_records` when available and fall back to legacy booking/queue consent paths where needed.
5. `booking_maintenance.php` runs lifecycle maintenance in the clinic timezone.
6. Lifecycle maintenance cancels previous-day active queues that need re-entry, auto-reschedules missed eligible confirmed bookings, and preserves original booking dates in notes.
7. `/lifecycle/recovery-report` identifies completed queue/booking diagnosis records that are missing visits or visit charges.
8. `status_display.php` runs lifecycle maintenance before returning TV status data.

## Notification Sources

| Trigger Area | Notification Types / Events |
| --- | --- |
| Booking | Submitted, confirmed, cancelled, rescheduled, schedule reminders |
| Queue | Created, in progress/approved, received by veterinarian, completed, cancelled |
| Diagnosis | Diagnosis completed/available |
| Visit billing | Invoice ready, payment received |
| Todos/reminders | Owner todos, diagnosis follow-up reminders, boarding task reminders |
| Account/auth email | Email verification OTP, password reset OTP, payment settings OTP, password changed email |
| Push | Browser push when enabled and VAPID config is available |

Notification preferences include booking updates, schedule reminders, email enabled, diagnosis updates, queue updates, in-app enabled, browser push enabled, and reminder timing flags.

## Design and UI Parts

| Part | Current Design Pattern |
| --- | --- |
| Dashboard layout | Fixed left sidebar on desktop, mobile drawer under 960px, max-width content area |
| Navigation | Lucide icons, role-filtered nav items, active route highlight, collapsible inventory subitems |
| Feedback | Toasts through `reusecomponent/toast.jsx`, loading spinners, disabled states during submit |
| Forms | Tailwind utility styling, shared inputs/buttons/selects where available |
| Modals/dialogs | `src/ui/dialog.jsx` and `src/ui/sheet.jsx` for overlays and side sheets |
| Tables | Admin pages use dense operational tables with search/filter/status badges |
| Images | `PhotoViewer` for previewing uploaded images/payment proof/attachments |
| Signatures | `SignatureCapture.jsx` for home service, self-service queue, diagnosis consents, boarding consent |
| Consent display | `ConsentDocument.jsx` for rendering consent template text |
| Theme | `ThemeProvider`, `ThemeToggle`, localStorage key `ipawcus-theme` |
| Auto refresh | `useAutoRefresh` on GET-heavy pages such as bookings, queues, inventory, todos, consults |
| Server failure | App-level health check and blocking server-down page |
| Reports | Chart.js through `react-chartjs-2`, printable report preview, CSV export, and dense operational tables |
| TV display | Full-screen public status layout with configurable left/right column width stored in localStorage |

## Database Inventory

Latest full export: `DDL/database_ddl_20260618_034832.sql`.

Additional migration: `DDL/20260619_create_consent_form_records.sql`.

DDL export metadata:

- Database name: `ipawcus_system`
- Generated: `2026-06-18T03:48:31+00:00`
- Tables: 47
- Views: 0

| Domain | Tables |
| --- | --- |
| Users/profiles | `users`, `admin_profiles`, `veterinarian_profiles` |
| Vet schedules | `vet_schedules` |
| Auth/OTP | `email_otp_tokens` |
| Pets/ownership | `pets_information`, `pet_ownership`, `history_before_registration`, `pet_allergies`, `pet_vaccinations` |
| Bookings | `bookings`, `booking_pets` |
| Queue/vet assignments | `queues`, `vet_queue_assignments` |
| Diagnosis/medical records | `vet_diagnoses`, `pet_medical_record_groups`, `pet_medical_record_group_items` |
| Online consult | `online_consultations`, `online_consultation_diagnoses`, `online_consultation_reschedules` |
| Boarding | `rooms`, `room_unit_statuses`, `boarding_assignments`, `boarding_documents`, `boarding_observations`, `boarding_tasks` |
| Service catalog | `service_catalog`, `service_materials`, `special_service_catalog`, `special_service_booking_items` |
| Inventory | `inventory_items`, `inventory_batches`, `inventory_locations`, `inventory_suppliers`, `inventory_stock_movements`, `inventory_stock_receipts`, `inventory_stock_receipt_items` |
| Billing/POS | `visits`, `visit_charges`, `visit_payments` |
| Notifications | `notification_preferences`, `notification_push_subscriptions`, `user_notifications` |
| Pet owner productivity | `pet_owner_todos` |
| Record updates | `pet_record_update_requests` |
| Consent/payment settings | `consent_files`, `payment_methods`; planned migration adds `consent_form_records` |

## Runtime DB Updates and Schema Notes

| File | Runtime Schema Behavior |
| --- | --- |
| `php/account_status_helpers.php` | Adds `admin_profiles.is_active` if missing |
| `php/add_booking.php` | Checks for and adds `bookings.payment_method`, `bookings.payment_reference`, `bookings.consent_forms`, `bookings.consent_status` if missing |
| `php/consent_record_helpers.php` | Requires `consent_form_records`; skips automatic persistence when the table is missing unless `/consent-form-records` is called directly |
| `php/update_schema_home_service.php` | Adds `bookings.signature_path` and `bookings.transport_fee` when run |
| `php/notification_helpers.php` | Creates notification tables if missing and adds push-related columns |
| `php/payment_methods.php` | Creates `payment_methods` if missing and adjusts OTP support |
| `php/pet_medical_records.php` | Creates organized medical record groups/items if missing |
| `php/pet_owner_accounts.php` | Requires manual `users.account_status`, `users.deactivated_at`, and `users.deactivation_reason` columns before owner deactivation can be used |
| `php/pet_owner_todos.php` | Creates `pet_owner_todos` if missing |
| `php/record_update_requests.php` | Creates `pet_record_update_requests` if missing |
| `php/visit_billing.php` | Cash payments require `visit_payments.payment_method` enum to include `cash`; visit charges can consume/reverse inventory stock movements |
| `php/rooms_setup.sql` | Standalone boarding room/booking-pets setup SQL |
| `php/vet_schedules.sql` | Standalone vet schedule table SQL |

Full DDL discrepancy note:

- `DDL/database_ddl_20260618_034832.sql` already includes `bookings.payment_method`, `bookings.payment_reference`, `bookings.signature_path`, `bookings.transport_fee`, and the `General Check-up` booking service enum value.
- The same full DDL does not include the newer boarding consent columns `bookings.consent_forms` and `bookings.consent_status`.
- The same full DDL does not include `consent_form_records`; run `DDL/20260619_create_consent_form_records.sql` before relying on consent record persistence, reports, or media monitoring.
- The same full DDL does not include `users.account_status`, `users.deactivated_at`, or `users.deactivation_reason`; apply those columns before enabling pet owner deactivation.
- Current backend code in `php/add_booking.php` auto-adds `bookings.consent_forms` and `bookings.consent_status` if the database user has `ALTER TABLE` permission.
- For deployment planning, create explicit migrations or export a fresh full DDL after those columns/tables exist, so the database files match the current boarding consent, owner status, reporting, and media-monitoring workflows.

## Upload and Static Media Areas

| Directory | Purpose |
| --- | --- |
| `public/uploads` | General uploads and documents |
| `public/concerns` | Booking concern images/files |
| `public/pet_profile_images` | Pet profile images |
| `public/signatures` | Captured signature images |
| `public/payment_qr` | Payment QR/payment method images |
| `public/ipawcus-push-sw.js` | Browser push service worker |

Preview planning:

- Existing `PhotoViewer` is image-oriented.
- For PDF preview, add a file type detector and show `<iframe>` or `<object>` preview when the browser can display the file.
- For Word/Excel/unknown document types, show file metadata, download/open button, and maybe a server-side conversion only if needed later.
- The upload endpoint should keep allowing non-image documents only where the workflow expects them, with file type validation per use case.

## TV Status Page / Subdomain Task

This is implemented in the same React/PHP project and does not require a separate project.

Implemented approach:

1. Frontend route: `/status-display`.
2. Subdomain root support: `status.ipawcus.com/` renders the same TV display.
3. Frontend component: `src/components/StatusDisplay/TVStatusDisplay.jsx`.
4. Backend endpoint: `/status-display` and `/tv-status`, routed to `php/status_display.php`.
5. Auto-refresh interval: backend returns `refreshSeconds`, currently 8 seconds.
6. Privacy rules: owner names, contact details, complaints, and diagnosis text are not returned to the TV endpoint.

Subdomain deployment notes are in `docs/tv_status_display_deployment.md`.

## Suggested Gantt Work Breakdown

| Work Package | Deliverables | Main Files/Areas | Dependencies | Verification |
| --- | --- | --- | --- | --- |
| 1. Environment setup | Node/PHP/MySQL env, `.env`, API URL, health check | `package.json`, `.env.example`, `php/config.php`, `php/db.php` | None | `npm run build`, `/health` |
| 2. Database baseline | Import/export DDL, migration notes, seed inventory | `DDL/*.sql`, runtime migrations | Environment | Fresh DB import and smoke test |
| 3. Auth and registration | Login, registration, email verify, forgot password | `Login.jsx`, `Registration.jsx`, `auth_*.php` | DB users/OTP | Manual registration/login |
| 4. Dashboard shell | Sidebar, route matching, role access, profile entry | `Dashboard.jsx`, `dashboardRouter.jsx` | Auth | Route navigation by role |
| 5. Profile/theme/preferences | Owner/admin/vet profiles, theme, password, notifications | profile components, shared cards | Auth/dashboard | Save profile, theme persists |
| 6. Pet registry and ownership | Add/link pets, pet profile, status, images | pet components, pet PHP files | Auth/users | Register/link/edit pet |
| 7. Standard bookings | Service forms, payment proof, admin approval | booking pages, `add_booking.php`, `BookingManagement.jsx` | Pets/uploads | Submit/approve/cancel/reschedule |
| 8. Online consultation | Vet schedules, consult booking, Jitsi room, online diagnosis | consult pages, online consult PHP | Booking/payment | Start/join/end consult |
| 9. Home service | Address, terms, signature, transport fee | `HomeServices.jsx`, `HomeServiceConfirmation.jsx` | Booking/uploads | Submit with signature/payment |
| 10. Boarding/pet hotel | Room availability, consent, booking, admin check-in/out | `PetHotel.jsx`, `PetBoardingManagement.jsx`, boarding PHP | Pets/bookings/rooms | Submit, assign, check in/out |
| 11. Queue management | Queue CRUD/status, self-service queue, assignments | queue pages/services/PHP | Pets/bookings | Add/assign/receive/complete/cancel |
| 12. Vet diagnosis | Diagnosis save, optional vaccination, extra consent, visit creation | `VetDiagnosis.jsx`, `vet_diagnoses.php` | Queue/vet/profile/catalog | Save diagnosis without vaccine and with extra consent |
| 13. Medical records | Owner/vet/admin record views, print/email, organized groups | `MedicalRecords.jsx`, `VetPetsEMR.jsx`, `pet_medical_records.php` | Diagnosis/pets | Print/email, save record groups |
| 14. Record update requests | Owner request, admin review, vet completion | record request pages/PHP | Medical records/uploads | Request lifecycle |
| 15. POS/billing | Visit creation, charges, payments, invoice/payment notifications | `POSmanagement.jsx`, `visit_billing.php` | Diagnosis/catalog/inventory | Add charges, record payment |
| 16. Service catalog | Services, pricing, materials | `ServiceCatalogManagement.jsx`, `service_catalog.php` | Inventory optional | CRUD services/materials |
| 17. Inventory | Items, stock in/out, low stock, expiry, disposal | inventory pages, `inventory.php` | DB users | Create item, receive stock, stock out |
| 18. Consent management | Consent template CRUD and use in workflows | `ConsentFileManagement.jsx`, `ConsentDocument.jsx`, consent PHP | Uploads | Upload/edit/delete/use templates |
| 19. Notifications | In-app, email, push, reminders, preferences | notification services/PHP, service worker | Auth/events/mail config | Trigger booking/queue/diagnosis/payment notifications |
| 20. Upload/document preview | Images, PDF/document preview plan | `uploadService.js`, `PhotoViewer`, upload PHP | Upload endpoint | Preview image/PDF and download docs |
| 21. TV status display | Read-only status page/subdomain | `TVStatusDisplay.jsx`, `php/status_display.php` | Queue/booking/diagnosis/billing | TV viewport test and privacy review |
| 22. Super Admin reports | KPI dashboard, charts, report center, print/CSV export | report components/services/PHP, `chart.js`, `react-chartjs-2` | Visits/bookings/queues/inventory/consents | Dashboard loads, report filters work, CSV/print output usable |
| 23. Pet owner account controls | Owner/pet detail view, status controls, ownership unlink | `PetOwnerAccountsManagement.jsx`, `pet_owner_accounts.php`, `accountService.js` | Users/pets/ownership schema | Search owners, inspect pets, remove ownership, status SQL documented/applied |
| 24. Consent record ledger | Signed/released consent record persistence | `consent_record_helpers.php`, `consent_form_records.php`, `DDL/20260619_create_consent_form_records.sql` | Consent files, uploads, booking/queue/diagnosis flows | Signed consent rows save and appear in reports/media monitoring |
| 25. Pet media monitoring | Source/date/pet media aggregation and preview | `PetMediaMonitoring.jsx`, `pet_media_monitoring.php` | Uploads, consent records, booking/queue/diagnosis/boarding docs | Filter media and open originals/previews without duplicate rows |
| 26. Lifecycle automation and recovery | Queue expiry, booking reschedule/cancel, recovery report | `booking_maintenance.php`, `lifecycle_recovery_report.php`, status display | Queue/booking/visit schema | Missed/expired cases update correctly; recovery report identifies missing billing links |
| 27. QA and deployment | Lint/build, PHP syntax, manual flow scripts, deployment notes | All touched areas | Feature completion | `npm run lint`, `npm run build`, `php -l` changed files |

## Manual QA Checklist

- Public pages redirect correctly when logged in or logged out.
- Server-down page appears if API/database health fails.
- Registration creates user and sends email verification OTP.
- Login persists `currentUser`.
- Pet owner can link pet by sharable ID.
- Standard booking can be submitted with and without a registered pet.
- Admin can confirm, cancel, and reschedule bookings.
- Online consultation can be started by vet and joined by owner.
- Home service requires terms, signature, payment method, and proof.
- Boarding requires liability consent signature before submit/payment activation.
- Self-service queue requires signature consent and obeys access check.
- Queue can move through waiting, approved/in progress, received, completed, cancelled.
- Vet diagnosis can be saved without vaccination details.
- Vet diagnosis can save extra consent forms/signatures when needed.
- Diagnosis completion creates/updates related visit billing and completes queue/booking.
- Medical records print and email copy actions work.
- Record update request moves from owner submission through admin/vet handling.
- POS can add charges and record payment.
- Inventory item, stock receipt, stock out, low stock, expiry, disposal reports work.
- POS charges consume linked inventory items/materials and reverse stock when charges are replaced.
- Super Admin reports dashboard loads KPI cards, charts, monitoring tables, and missing-data notes.
- Report center can generate each report type, print the preview, and export CSV.
- Pet owner account screen can search owners, inspect linked pets, remove an ownership link, and show required SQL if status columns are missing.
- Deactivated pet owner login is blocked when `users.account_status` exists.
- Consent records save after `DDL/20260619_create_consent_form_records.sql` is applied.
- Pet media monitoring filters by source, date range, and pet and opens image previews/originals.
- TV status display auto-refreshes and does not expose owner contact details or diagnosis text.
- Lifecycle maintenance handles previous-day queue re-entry and missed approved booking reschedules without affecting excluded service types.
- Lifecycle recovery report identifies completed diagnosis records with missing visit/charge data.
- Notification preferences save and notification bell updates.
- Browser push registers/unregisters only when permission/config is valid.
- Profile image uploads work for owner/admin/vet.
- Theme toggle persists across reloads.
- PHP syntax check any changed endpoint.
- Fresh DDL/migration includes newest consent columns before deployment.
