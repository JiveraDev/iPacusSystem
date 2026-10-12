# iPawcus system + database class reference

Open `ipawcus-system-and-database.drawio`. The first tab is the new system overview; the original ten database pages are retained unchanged.

## Scope and meaning

Static source coverage: 142 React/component modules, 50 JavaScript service modules, 142 PHP modules, all 88 SQL-export tables, and the migration-defined ClinicalIntake entity. There are 44 editable pages.

- This is a hybrid implementation class/module model. React function components, JavaScript modules, and procedural PHP handlers are marked by stereotypes; they are not falsely claimed to be object-oriented classes.
- Literal JavaScript classes are shown separately, with only their real declared inheritance.
- Original SQL entity pages contain every exported table and column. System pages use entity references to those definitions.
- System dependency arrows mean `uses`, `HTTP`, `includes`, or `SQL`. They do not imply database foreign keys or UML multiplicities.
- Each detailed relationship includes source-file and line evidence in its editable tooltip and in `system-source-model.json`.
- The overview packages and role views summarize the implementation; their detailed modules are shown on the following system pages. Role views are not a replacement for backend authorization rules.
- Component state names and operations come from source. Dense boxes show selected operations; the complete exported/PHP operation list is below, and React internal functions are retained in the JSON source index.
- Components not reachable through imports from `src/App.jsx` are marked `source-only`. Their presence is not a claim of active navigation or a deployed working feature.
- Database connection/configuration values, secrets, UI primitives, static assets, third-party libraries, and pure formatting utilities are not modeled as business classes.
- Direct source imports and SQL literals are statically inspected. Dynamic SQL/table selection and runtime behavior still require application/runtime verification.
- Shared `apiClient`, PDO/database access, role guards, workflow guards, and staff-activity includes are expanded on infrastructure pages and omitted from repeated feature-page connectors. The full import list is preserved in JSON.

## Schema difference and application-only association

- `clinical_intakes` is defined by `DDL/20261004_01_clinical_intakes.sql`, but is absent from the supplied SQL export. Its full fields and five migration foreign keys are on the final additions page. It is explicitly migration-only; no live DB change was made.
- `bookings.veterinarian_id` is joined to `users.user_id` by `php/get_bookings.php:146`, despite having no FK in the exported schema. The additions page shows that relationship as a dashed application reference, not a made-up FK.
- The supplied export remains the authority for the original 88 entity definitions. Existing-table column changes from other migrations are not silently merged into the exported entities.

## Page index

| Tab prefix | Content |
| --- | --- |
| 00 | Core class overview — original DB model |
| 01 | Identity and access — original DB model |
| 02 | Clinics and scheduling — original DB model |
| 03 | Pets and medical records — original DB model |
| 04 | Bookings and clinical workflow — original DB model |
| 05 | Online consultations and prescriptions — original DB model |
| 06 | Grooming and boarding — original DB model |
| 07 | Inventory and materials — original DB model |
| 08 | Billing and service catalogues — original DB model |
| 09 | Notifications and system operations — original DB model |
| 10 | System + database reference overview |
| 11 | System shell and API infrastructure / 1 of 2 |
| 12 | System shell and API infrastructure / 2 of 2 |
| 13 | Authentication and registration / 1 of 2 |
| 14 | Authentication and registration / 2 of 2 |
| 15 | Accounts, profiles and access control / 1 of 2 |
| 16 | Accounts, profiles and access control / 2 of 2 |
| 17 | Clinic assignments and vet availability / 1 of 2 |
| 18 | Clinic assignments and vet availability / 2 of 2 |
| 19 | Pets, ownership and catalog / 1 of 3 |
| 20 | Pets, ownership and catalog / 2 of 3 |
| 21 | Pets, ownership and catalog / 3 of 3 |
| 22 | Bookings and shared clinic capacity / 1 of 3 |
| 23 | Bookings and shared clinic capacity / 2 of 3 |
| 24 | Bookings and shared clinic capacity / 3 of 3 |
| 25 | Queue, physical examination and handoff / 1 of 2 |
| 26 | Queue, physical examination and handoff / 2 of 2 |
| 27 | Veterinarian diagnosis and medical records |
| 28 | Online consultation and call diagnosis |
| 29 | Prescriptions, per-item schedules and printing |
| 30 | Record requests and pet certificates |
| 31 | Consent templates, signatures and documents |
| 32 | Grooming operations |
| 33 | Boarding, rooms and monitoring |
| 34 | Inventory and stock movements / 1 of 2 |
| 35 | Inventory and stock movements / 2 of 2 |
| 36 | Visits, POS and payment methods |
| 37 | Service catalog and special services |
| 38 | Notifications, push, TODOs and reminders |
| 39 | Reports, exports and activity history / 1 of 2 |
| 40 | Reports, exports and activity history / 2 of 2 |
| 41 | Uploads and pet media monitoring |
| 42 | System backup management |
| 43 | Migration entity + application-only association |

## Complete module and public-operation index

### AddNewItemPage — boundary

Definition: [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:1) · diagram tab 34.

- State: `meta` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:61)
- State: `category` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:62](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:62)
- State: `brand` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:63)
- State: `unit` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:64)
- State: `location` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:65](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:65)
- State: `productImage` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:66](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:66)
- State: `viewerImage` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:67](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:67)
- State: `pendingItem` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:68)
- State: `errorMessage` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:69)
- State: `isSubmitting` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:70](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:70)
- State: `isResponsibilityOpen` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:71)
- `AddNewItemPage()` — [src/components/AdminDashboardsComponent/AddNewItemPage.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddNewItemPage.jsx:57)

### AddQueueDialog — boundary

Definition: [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:1) · diagram tab 25.

- State: `allPets` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:57)
- State: `searchTerm` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:58](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:58)
- State: `selectedPet` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:59](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:59)
- State: `service` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:60](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:60)
- State: `priority` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:61)
- State: `complaint` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:62](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:62)
- State: `branchId` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:63)
- State: `verified` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:64)
- State: `isOpen` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:65](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:65)
- State: `isMenuOpen` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:66](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:66)
- State: `isSubmitting` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:67](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:67)
- State: `bookingConflict` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:68)
- `AddQueueDialog({…})` — [src/components/AdminDashboardsComponent/AddQueueDialog.jsx:53](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AddQueueDialog.jsx:53)

### AdminAssignedLocationPanel — boundary

Definition: [src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:1) · diagram tab 17.

- State: `branches` — [src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:10](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:10)
- State: `isLoading` — [src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:11](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:11)
- State: `error` — [src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:12](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:12)
- `AdminAssignedLocationPanel()` — [src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:7](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AdminAssignedLocationPanel.jsx:7)

### AllItemsPage — boundary

Definition: [src/components/AdminDashboardsComponent/AllItemsPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:1) · diagram tab 34.

- State: `inventoryItems` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:54](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:54)
- State: `locations` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:55](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:55)
- State: `isLoading` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:56](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:56)
- State: `errorMessage` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:57)
- State: `searchQuery` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:58](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:58)
- State: `categoryFilter` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:59](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:59)
- State: `locationFilter` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:60](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:60)
- State: `statusFilter` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:61)
- State: `currentPage` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:63)
- State: `selectedItem` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:64)
- State: `isDetailModalOpen` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:65](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:65)
- State: `stockOutItem` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:66](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:66)
- State: `stockOutBatchId` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:67](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:67)
- State: `stockOutQuantity` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:68)
- State: `batchSort` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:69)
- State: `isEditingItem` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:70](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:70)
- State: `editItemForm` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:71)
- State: `transferItem` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:72)
- State: `transferBatchId` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:73)
- State: `transferDestinationId` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:74)
- State: `transferQuantity` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:75)
- State: `inventoryConfirmation` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:76](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:76)
- State: `isConfirmingAction` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:77)
- State: `isSelectionMode` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:78)
- State: `selectedInventoryItemIds` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:79)
- `AllItemsPage()` — [src/components/AdminDashboardsComponent/AllItemsPage.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/AllItemsPage.jsx:50)

### BookingManagement — boundary

Definition: [src/components/AdminDashboardsComponent/BookingManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:1) · diagram tab 22.

- State: `hasImageError` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:325](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:325)
- State: `isDownloading` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:326](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:326)
- State: `isOpening` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:327](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:327)
- State: `isDownloading` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:438](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:438)
- State: `isOpening` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:439](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:439)
- State: `hasImageError` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:549](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:549)
- State: `bookings` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:591](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:591)
- State: `searchQuery` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:592](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:592)
- State: `filterType` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:593](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:593)
- State: `filterStatus` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:594](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:594)
- State: `filterBranch` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:595](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:595)
- State: `filterDate` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:596](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:596)
- State: `currentPage` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:597](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:597)
- State: `rescheduleDialogOpen` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:598](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:598)
- State: `currentRescheduleBooking` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:599](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:599)
- State: `newDate` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:600](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:600)
- State: `newTime` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:601](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:601)
- State: `isRescheduling` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:602](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:602)
- State: `viewerImage` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:603](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:603)
- State: `infoModal` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:604](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:604)
- State: `cancellationDialogOpen` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:605](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:605)
- State: `currentCancellationBooking` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:606](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:606)
- State: `cancellationData` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:607](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:607)
- State: `reviewDrafts` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:612](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:612)
- State: `addBookingOpen` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:613](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:613)
- State: `isLoadingBookingPets` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:614](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:614)
- State: `isCreatingBooking` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:615](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:615)
- State: `confirmingBookingId` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:616](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:616)
- State: `openingPaymentBookingId` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:617](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:617)
- State: `bookingRefundOpen` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:618](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:618)
- State: `bookingRefundContext` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:619](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:619)
- State: `bookingRefundForm` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:620](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:620)
- State: `isSubmittingBookingRefund` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:621](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:621)
- State: `bookingPets` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:622](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:622)
- State: `veterinarians` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:623](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:623)
- State: `branches` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:624](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:624)
- State: `relocatingBookingId` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:625](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:625)
- State: `isLoadingVeterinarians` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:626](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:626)
- State: `bookingPetSearch` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:627](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:627)
- State: `selectedBookingPet` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:628](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:628)
- State: `adminBookingForm` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:629](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:629)
- State: `displayConfigOpen` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:630](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:630)
- State: `displayConfigDraft` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:631](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:631)
- State: `isRegisterModalOpen` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:634](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:634)
- State: `isRegistering` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:635](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:635)
- State: `registrationData` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:636](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:636)
- `BookingsManagement()` — [src/components/AdminDashboardsComponent/BookingManagement.jsx:573](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/BookingManagement.jsx:573)

### ConsentFileManagement — boundary

Definition: [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:1) · diagram tab 31.

- State: `files` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:29)
- State: `isLoading` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:30](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:30)
- State: `isUploading` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:31](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:31)
- State: `uploadFile` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:34)
- State: `uploadTitle` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:35)
- State: `uploadContent` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:36)
- State: `uploadCategory` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:37)
- State: `uploadPetOwnerContexts` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:38)
- State: `viewModalOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:41](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:41)
- State: `editModalOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:42](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:42)
- State: `deleteDialogOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:43](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:43)
- State: `uploadEditorOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:44](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:44)
- State: `uploadPreviewOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:45](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:45)
- State: `editEditorOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:46](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:46)
- State: `editPreviewOpen` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:47](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:47)
- State: `selectedFile` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:48](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:48)
- State: `fileToDelete` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:49](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:49)
- State: `editTitle` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:50)
- State: `editContent` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:51)
- State: `editCategory` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:52)
- State: `editPetOwnerContexts` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:53](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:53)
- `ConsentFilesManagement()` — [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:28](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ConsentFileManagement.jsx:28)

### DisposalLogsPage — boundary

Definition: [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:1) · diagram tab 34.

- State: `searchQuery` — [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:14](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:14)
- State: `reasonFilter` — [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:15)
- State: `methodFilter` — [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:16](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:16)
- State: `selectedLog` — [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:17](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:17)
- State: `isDetailModalOpen` — [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:18)
- `DisposalLogsPage()` — [src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:13](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/DisposalLogsPage.jsx:13)

### GroomingManagement — boundary

Definition: [src/components/AdminDashboardsComponent/GroomingManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/GroomingManagement.jsx:1) · diagram tab 32.

- `GroomingManagement()` — [src/components/AdminDashboardsComponent/GroomingManagement.jsx:3](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/GroomingManagement.jsx:3)

### InventoryBranchScope — boundary

Definition: [src/components/AdminDashboardsComponent/InventoryBranchScope.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryBranchScope.jsx:1) · diagram tab 34.

- `InventoryBranchScope({…})` — [src/components/AdminDashboardsComponent/InventoryBranchScope.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryBranchScope.jsx:4)

### InventoryLocationFields — boundary

Definition: [src/components/AdminDashboardsComponent/InventoryLocationFields.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryLocationFields.jsx:1) · diagram tab 34.

- `InventoryLocationFields({…})` — [src/components/AdminDashboardsComponent/InventoryLocationFields.jsx:26](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryLocationFields.jsx:26)

### InventoryResponsibilityDialog — boundary

Definition: [src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:1) · diagram tab 34.

- State: `password` — [src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:23)
- State: `reason` — [src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:24)
- State: `acknowledged` — [src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:25)
- `InventoryResponsibilityDialog({…})` — [src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:10](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryResponsibilityDialog.jsx:10)

### InventoryStatusBadge — boundary

Definition: [src/components/AdminDashboardsComponent/InventoryStatusBadge.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryStatusBadge.jsx:1) · diagram tab 34.

- `InventoryStatusBadge({…})` — [src/components/AdminDashboardsComponent/InventoryStatusBadge.jsx:3](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/InventoryStatusBadge.jsx:3)

### LowStockPage — boundary

Definition: [src/components/AdminDashboardsComponent/LowStockPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/LowStockPage.jsx:1) · diagram tab 35.

- State: `inventoryItems` — [src/components/AdminDashboardsComponent/LowStockPage.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/LowStockPage.jsx:20)
- State: `statusFilter` — [src/components/AdminDashboardsComponent/LowStockPage.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/LowStockPage.jsx:21)
- State: `isLoading` — [src/components/AdminDashboardsComponent/LowStockPage.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/LowStockPage.jsx:22)
- State: `errorMessage` — [src/components/AdminDashboardsComponent/LowStockPage.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/LowStockPage.jsx:23)
- `LowStockPage()` — [src/components/AdminDashboardsComponent/LowStockPage.jsx:16](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/LowStockPage.jsx:16)

### NearExpiryPage — boundary

Definition: [src/components/AdminDashboardsComponent/NearExpiryPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/NearExpiryPage.jsx:1) · diagram tab 35.

- State: `inventoryItems` — [src/components/AdminDashboardsComponent/NearExpiryPage.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/NearExpiryPage.jsx:22)
- State: `urgencyFilter` — [src/components/AdminDashboardsComponent/NearExpiryPage.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/NearExpiryPage.jsx:23)
- State: `isLoading` — [src/components/AdminDashboardsComponent/NearExpiryPage.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/NearExpiryPage.jsx:24)
- State: `errorMessage` — [src/components/AdminDashboardsComponent/NearExpiryPage.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/NearExpiryPage.jsx:25)
- `NearExpiryPage()` — [src/components/AdminDashboardsComponent/NearExpiryPage.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/NearExpiryPage.jsx:18)

### POSmanagement — boundary

Definition: [src/components/AdminDashboardsComponent/POSmanagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1) · diagram tab 36.

- State: `inventory` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1301](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1301)
- State: `serviceCatalog` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1302](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1302)
- State: `visitBills` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1303](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1303)
- State: `hasLoadedVisitBills` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1304](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1304)
- State: `visitSchemaMessage` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1305](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1305)
- State: `invoiceDocumentSchemaReady` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1306](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1306)
- State: `catalogSchemaMessage` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1307](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1307)
- State: `isLoadingVisits` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1308](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1308)
- State: `isLoadingInventory` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1309](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1309)
- State: `inventoryError` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1310](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1310)
- State: `isLoadingCatalog` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1311](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1311)
- State: `isPostingPayment` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1312](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1312)
- State: `paymentMethod` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1313](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1313)
- State: `paymentReference` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1314](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1314)
- State: `cashNoReference` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1315](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1315)
- State: `posPrefill` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1316](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1316)
- State: `isPrefillReconciled` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1318](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1318)
- State: `branches` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1321](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1321)
- State: `branchError` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1322](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1322)
- State: `branchId` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1323](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1323)
- State: `selectedVisitId` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1377](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1377)
- State: `charges` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1379](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1379)
- State: `activeTab` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1384](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1384)
- State: `searchQuery` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1385](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1385)
- State: `receiptPaperWidth` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1386](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1386)
- State: `receiptPageHeight` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1387](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1387)
- State: `invoicePanelOpen` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1388](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1388)
- State: `invoicePanelWidth` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1389](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1389)
- State: `invoiceOpen` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1390](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1390)
- State: `invoiceNumber` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1391](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1391)
- State: `selectedChargeId` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1392](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1392)
- `ServicePOS()` — [src/components/AdminDashboardsComponent/POSmanagement.jsx:1297](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/POSmanagement.jsx:1297)

### PatientIntake — boundary

Definition: [src/components/AdminDashboardsComponent/PatientIntake.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:1) · diagram tab 25.

- State: `queues` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:311](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:311)
- State: `bookings` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:312](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:312)
- State: `search` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:313](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:313)
- State: `isLoading` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:314](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:314)
- State: `startingKey` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:315](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:315)
- State: `selected` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:316](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:316)
- State: `draft` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:317](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:317)
- State: `isSaving` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:318](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:318)
- State: `uploadingField` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:319](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:319)
- State: `previewPhoto` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:320](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:320)
- State: `consentForms` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:321](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:321)
- State: `selectedConsentId` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:322](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:322)
- State: `signerName` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:323](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:323)
- State: `signatureImage` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:324](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:324)
- State: `savedConsent` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:325](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:325)
- State: `isSavingConsent` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:326](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:326)
- State: `veterinarians` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:327](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:327)
- State: `selectedVeterinarianId` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:328](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:328)
- State: `isReassigning` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:329](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:329)
- `PatientIntake()` — [src/components/AdminDashboardsComponent/PatientIntake.jsx:308](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx:308)

### PetBoardingManagement — boundary

Definition: [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1) · diagram tab 33.

- State: `activeTab` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:954](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:954)
- State: `facilityView` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:955](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:955)
- State: `units` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:956](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:956)
- State: `tasks` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:957](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:957)
- State: `observations` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:958](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:958)
- State: `documents` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:959](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:959)
- State: `previewDocument` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:960](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:960)
- State: `pets` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:961](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:961)
- State: `inventoryItems` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:962](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:962)
- State: `materialUsage` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:963](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:963)
- State: `materialBackendReady` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:964](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:964)
- State: `materialSchemaReady` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:965](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:965)
- State: `materialBillingTraceReady` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:966](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:966)
- State: `materialSyncMessage` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:967](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:967)
- State: `boardingBookings` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:968](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:968)
- State: `serviceCatalog` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:969](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:969)
- State: `searchQuery` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:970](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:970)
- State: `roomViewMode` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:971](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:971)
- State: `isLoading` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:972](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:972)
- State: `schemaMessage` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:973](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:973)
- State: `catalogSchemaMessage` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:974](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:974)
- State: `documentSchemaMessage` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:975](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:975)
- State: `selectedUnit` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:976](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:976)
- State: `isDetailOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:977](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:977)
- State: `isAddRoomOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:978](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:978)
- State: `isDirectCheckInOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:979](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:979)
- State: `isMonitoringEntryOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:980](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:980)
- State: `monitoringEntryMode` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:981](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:981)
- State: `isDocumentOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:982](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:982)
- State: `isMaterialOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:983](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:983)
- State: `isDesiredOutOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:984](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:984)
- State: `isReservationConsentOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:985](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:985)
- State: `reservationBooking` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:986](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:986)
- State: `reservationUnit` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:987](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:987)
- State: `reservationConsentPurpose` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:988](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:988)
- State: `reservationForceConsentCapture` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:989](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:989)
- State: `consentTemplates` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:990](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:990)
- State: `reservationConsentTemplateId` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:991](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:991)
- State: `reservationConsentMode` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:992](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:992)
- State: `reservationConsentSignature` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:993](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:993)
- State: `reservationConsentFile` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:994](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:994)
- State: `directConsentTemplateId` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:995](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:995)
- State: `directConsentMode` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:996](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:996)
- State: `directConsentSignature` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:997](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:997)
- State: `directConsentFile` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:998](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:998)
- State: `addRoomForm` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:999](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:999)
- State: `directCheckInForm` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1000](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1000)
- State: `observationForm` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1001](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1001)
- State: `taskForm` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1002](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1002)
- State: `documentForm` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1003](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1003)
- State: `materialForm` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1004](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1004)
- State: `desiredOutDate` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1005](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1005)
- State: `actionLoading` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1006](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1006)
- State: `branches` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1007](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1007)
- State: `branchId` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1008](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:1008)
- State: `query` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:4557](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:4557)
- State: `isOpen` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:4558](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:4558)
- `PetBoardingManagement()` — [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:947](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetBoardingManagement.jsx:947)

### PetInfoModal — boundary

Definition: [src/components/AdminDashboardsComponent/PetInfoModal.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetInfoModal.jsx:1) · diagram tab 19.

- State: `pets` — [src/components/AdminDashboardsComponent/PetInfoModal.jsx:45](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetInfoModal.jsx:45)
- State: `isLoading` — [src/components/AdminDashboardsComponent/PetInfoModal.jsx:46](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetInfoModal.jsx:46)
- State: `imageError` — [src/components/AdminDashboardsComponent/PetInfoModal.jsx:119](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetInfoModal.jsx:119)
- `PetInfoModal({…})` — [src/components/AdminDashboardsComponent/PetInfoModal.jsx:44](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetInfoModal.jsx:44)

### PetOwnerInfoModal — boundary

Definition: [src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:1) · diagram tab 19.

- State: `owner` — [src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:47](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:47)
- State: `isLoading` — [src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:48](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:48)
- State: `imageError` — [src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:49](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:49)
- `PetOwnerProfileModal({…})` — [src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:27](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetOwnerInfoModal.jsx:27)

### PetProfileEdit — boundary

Definition: [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:1) · diagram tab 15.

- State: `pet` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:36)
- State: `isLoading` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:37)
- State: `isSaving` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:38)
- State: `isEditMode` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:39](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:39)
- State: `copied` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:40](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:40)
- State: `isMedicalLoading` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:41](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:41)
- State: `formData` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:44](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:44)
- State: `vaccinations` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:45](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:45)
- State: `allergies` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:46](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:46)
- State: `prescriptionDocuments` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:47](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:47)
- State: `showAddVax` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:50)
- State: `showAddAllergy` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:51)
- State: `newVax` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:52)
- State: `newAllergy` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:53](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:53)
- `PetProfileEdit()` — [src/components/AdminDashboardsComponent/PetProfileEdit.jsx:32](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetProfileEdit.jsx:32)

### PetRegister — boundary

Definition: [src/components/AdminDashboardsComponent/PetRegister.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:1) · diagram tab 13.

- State: `formData` — [src/components/AdminDashboardsComponent/PetRegister.jsx:92](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:92)
- State: `registeredPets` — [src/components/AdminDashboardsComponent/PetRegister.jsx:93](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:93)
- State: `isLoading` — [src/components/AdminDashboardsComponent/PetRegister.jsx:94](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:94)
- State: `isUploading` — [src/components/AdminDashboardsComponent/PetRegister.jsx:95](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:95)
- State: `searchTerm` — [src/components/AdminDashboardsComponent/PetRegister.jsx:96](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:96)
- State: `statusFilter` — [src/components/AdminDashboardsComponent/PetRegister.jsx:97](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:97)
- State: `registeredPetsOpen` — [src/components/AdminDashboardsComponent/PetRegister.jsx:98](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:98)
- State: `registeredPetsPage` — [src/components/AdminDashboardsComponent/PetRegister.jsx:99](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:99)
- State: `showSuccessDialog` — [src/components/AdminDashboardsComponent/PetRegister.jsx:103](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:103)
- State: `generatedPetId` — [src/components/AdminDashboardsComponent/PetRegister.jsx:104](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:104)
- State: `copiedPetId` — [src/components/AdminDashboardsComponent/PetRegister.jsx:105](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:105)
- State: `registeredPetName` — [src/components/AdminDashboardsComponent/PetRegister.jsx:106](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:106)
- State: `registeredPetQueueHandoff` — [src/components/AdminDashboardsComponent/PetRegister.jsx:107](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:107)
- `PetRegister()` — [src/components/AdminDashboardsComponent/PetRegister.jsx:90](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PetRegister.jsx:90)

### QueueManagement — boundary

Definition: [src/components/AdminDashboardsComponent/QueueManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:1) · diagram tab 25.

- State: `queue` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:89](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:89)
- State: `expandedRows` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:90](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:90)
- State: `searchTerm` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:91](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:91)
- State: `priorityFilter` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:92](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:92)
- State: `serviceFilter` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:93](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:93)
- State: `branchFilter` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:94](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:94)
- State: `branches` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:95](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:95)
- State: `loading` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:96](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:96)
- State: `viewingImage` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:97](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:97)
- State: `veterinarians` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:98](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:98)
- State: `selectedVetByQueue` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:99](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:99)
- State: `assigningQueueId` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:100](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:100)
- State: `updatingQueueId` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:101](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:101)
- State: `queueToCancel` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:102](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:102)
- `QueueManagement()` — [src/components/AdminDashboardsComponent/QueueManagement.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/QueueManagement.jsx:84)

### RecordUpdateRequestsManagement — boundary

Definition: [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:1) · diagram tab 30.

- State: `requests` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:89](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:89)
- State: `veterinarians` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:90](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:90)
- State: `isLoading` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:91](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:91)
- State: `searchQuery` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:92](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:92)
- State: `statusFilter` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:93](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:93)
- State: `selectedRequest` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:94](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:94)
- State: `selectedVetId` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:95](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:95)
- State: `adminNotes` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:96](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:96)
- State: `actionLoading` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:97](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:97)
- State: `viewer` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:98](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:98)
- `RecordUpdateRequestsManagement()` — [src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:88](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx:88)

### ServiceCatalogManagement — boundary

Definition: [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:1) · diagram tab 37.

- State: `services` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:105](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:105)
- State: `inventoryItems` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:106](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:106)
- State: `selectedServiceId` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:107](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:107)
- State: `serviceForm` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:108](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:108)
- State: `materials` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:109](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:109)
- State: `materialDraft` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:110](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:110)
- State: `searchQuery` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:111](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:111)
- State: `typeFilter` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:112](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:112)
- State: `statusFilter` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:113](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:113)
- State: `schemaMessage` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:114](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:114)
- State: `isLoading` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:115](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:115)
- State: `isSaving` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:116](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:116)
- State: `isServiceModalOpen` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:117](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:117)
- State: `pendingDeactivationAction` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:118](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:118)
- `ServiceCatalogManagement()` — [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:102](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx:102)

### StockInPage — boundary

Definition: [src/components/AdminDashboardsComponent/StockInPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:1) · diagram tab 35.

- State: `items` — [src/components/AdminDashboardsComponent/StockInPage.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:69)
- State: `inventoryItems` — [src/components/AdminDashboardsComponent/StockInPage.jsx:70](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:70)
- State: `suppliers` — [src/components/AdminDashboardsComponent/StockInPage.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:71)
- State: `locations` — [src/components/AdminDashboardsComponent/StockInPage.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:72)
- State: `receivingDate` — [src/components/AdminDashboardsComponent/StockInPage.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:73)
- State: `deliveryNote` — [src/components/AdminDashboardsComponent/StockInPage.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:74)
- State: `notes` — [src/components/AdminDashboardsComponent/StockInPage.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:75)
- State: `receiptFile` — [src/components/AdminDashboardsComponent/StockInPage.jsx:76](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:76)
- State: `viewerImage` — [src/components/AdminDashboardsComponent/StockInPage.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:77)
- State: `errorMessage` — [src/components/AdminDashboardsComponent/StockInPage.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:78)
- State: `isSubmitting` — [src/components/AdminDashboardsComponent/StockInPage.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:79)
- State: `isResponsibilityOpen` — [src/components/AdminDashboardsComponent/StockInPage.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:80)
- `StockInPage()` — [src/components/AdminDashboardsComponent/StockInPage.jsx:65](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/StockInPage.jsx:65)

### adminprofile — boundary

Definition: [src/components/AdminDashboardsComponent/adminprofile.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:1) · diagram tab 15.

- State: `isLoading` — [src/components/AdminDashboardsComponent/adminprofile.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:57)
- State: `isEditing` — [src/components/AdminDashboardsComponent/adminprofile.jsx:58](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:58)
- State: `isSaving` — [src/components/AdminDashboardsComponent/adminprofile.jsx:59](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:59)
- State: `profile` — [src/components/AdminDashboardsComponent/adminprofile.jsx:60](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:60)
- State: `savedProfile` — [src/components/AdminDashboardsComponent/adminprofile.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:61)
- State: `imageFile` — [src/components/AdminDashboardsComponent/adminprofile.jsx:62](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:62)
- State: `imageError` — [src/components/AdminDashboardsComponent/adminprofile.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:63)
- State: `phoneError` — [src/components/AdminDashboardsComponent/adminprofile.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:64)
- State: `activeTab` — [src/components/AdminDashboardsComponent/adminprofile.jsx:65](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:65)
- State: `pendingProfileTab` — [src/components/AdminDashboardsComponent/adminprofile.jsx:66](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:66)
- State: `isProfileLeaveDialogOpen` — [src/components/AdminDashboardsComponent/adminprofile.jsx:67](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:67)
- State: `isBackupOpen` — [src/components/AdminDashboardsComponent/adminprofile.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:68)
- `ProfileManagement({…})` — [src/components/AdminDashboardsComponent/adminprofile.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/adminprofile.jsx:50)

### inventoryLocationUtils — boundary

Definition: [src/components/AdminDashboardsComponent/inventoryLocationUtils.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/inventoryLocationUtils.js:1) · diagram tab 35.

- `matchingLocation(locations, locationName, storageArea)` — [src/components/AdminDashboardsComponent/inventoryLocationUtils.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/inventoryLocationUtils.js:7)

### Dashboard — boundary

Definition: [src/components/Dashboard.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:1) · diagram tab 15.

- State: `historyStack` — [src/components/Dashboard.jsx:605](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:605)
- State: `isMobileNavOpen` — [src/components/Dashboard.jsx:606](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:606)
- State: `isCompactLayout` — [src/components/Dashboard.jsx:607](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:607)
- State: `isSidebarCollapsed` — [src/components/Dashboard.jsx:608](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:608)
- State: `openSuperAdminNavGroup` — [src/components/Dashboard.jsx:609](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:609)
- State: `isLogoutDialogOpen` — [src/components/Dashboard.jsx:614](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:614)
- State: `adminFeaturePermissions` — [src/components/Dashboard.jsx:705](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:705)
- State: `adminFeatureAccessError` — [src/components/Dashboard.jsx:706](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:706)
- `Dashboard({…})` — [src/components/Dashboard.jsx:596](C:/Users/Admin/WebstormProjects/untitled1/src/components/Dashboard.jsx:596)

### EmailVerification — boundary

Definition: [src/components/EmailVerification.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/EmailVerification.jsx:1) · diagram tab 13.

- State: `email` — [src/components/EmailVerification.jsx:14](C:/Users/Admin/WebstormProjects/untitled1/src/components/EmailVerification.jsx:14)
- State: `code` — [src/components/EmailVerification.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/EmailVerification.jsx:15)
- State: `isVerifying` — [src/components/EmailVerification.jsx:16](C:/Users/Admin/WebstormProjects/untitled1/src/components/EmailVerification.jsx:16)
- State: `isResending` — [src/components/EmailVerification.jsx:17](C:/Users/Admin/WebstormProjects/untitled1/src/components/EmailVerification.jsx:17)
- `EmailVerification({…})` — [src/components/EmailVerification.jsx:13](C:/Users/Admin/WebstormProjects/untitled1/src/components/EmailVerification.jsx:13)

### ForgotPassword — boundary

Definition: [src/components/ForgotPassword.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:1) · diagram tab 13.

- State: `email` — [src/components/ForgotPassword.jsx:17](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:17)
- State: `code` — [src/components/ForgotPassword.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:18)
- State: `newPassword` — [src/components/ForgotPassword.jsx:19](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:19)
- State: `confirmPassword` — [src/components/ForgotPassword.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:20)
- State: `codeRequested` — [src/components/ForgotPassword.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:21)
- State: `isCodeVerified` — [src/components/ForgotPassword.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:22)
- State: `codeExpiresAt` — [src/components/ForgotPassword.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:23)
- State: `remainingSeconds` — [src/components/ForgotPassword.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:24)
- State: `isRequesting` — [src/components/ForgotPassword.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:25)
- State: `isVerifyingCode` — [src/components/ForgotPassword.jsx:26](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:26)
- State: `isResetting` — [src/components/ForgotPassword.jsx:27](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:27)
- `ForgotPassword({…})` — [src/components/ForgotPassword.jsx:16](C:/Users/Admin/WebstormProjects/untitled1/src/components/ForgotPassword.jsx:16)

### Login — boundary

Definition: [src/components/Login.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:1) · diagram tab 13.

- State: `email` — [src/components/Login.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:20)
- State: `password` — [src/components/Login.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:21)
- State: `showPassword` — [src/components/Login.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:22)
- State: `isSubmitting` — [src/components/Login.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:23)
- State: `errorMessage` — [src/components/Login.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:24)
- `Login({…})` — [src/components/Login.jsx:10](C:/Users/Admin/WebstormProjects/untitled1/src/components/Login.jsx:10)

### AddPet — boundary

Definition: [src/components/PetOwnerDashboard/AddPet.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/AddPet.jsx:1) · diagram tab 19.

- State: `petId` — [src/components/PetOwnerDashboard/AddPet.jsx:14](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/AddPet.jsx:14)
- State: `isLoading` — [src/components/PetOwnerDashboard/AddPet.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/AddPet.jsx:15)
- `AddPet()` — [src/components/PetOwnerDashboard/AddPet.jsx:12](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/AddPet.jsx:12)

### Consult — boundary

Definition: [src/components/PetOwnerDashboard/Consult.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Consult.jsx:1) · diagram tab 22.

- State: `upcomingConsultations` — [src/components/PetOwnerDashboard/Consult.jsx:113](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Consult.jsx:113)
- State: `onlineConsultationsByBookingId` — [src/components/PetOwnerDashboard/Consult.jsx:114](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Consult.jsx:114)
- State: `isLoading` — [src/components/PetOwnerDashboard/Consult.jsx:115](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Consult.jsx:115)
- State: `joiningConsultationId` — [src/components/PetOwnerDashboard/Consult.jsx:116](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Consult.jsx:116)
- `Consult()` — [src/components/PetOwnerDashboard/Consult.jsx:109](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Consult.jsx:109)

### ConsultBooking — boundary

Definition: [src/components/PetOwnerDashboard/ConsultBooking.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:1) · diagram tab 22.

- State: `pets` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:64)
- State: `veterinarians` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:65](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:65)
- State: `isLoading` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:66](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:66)
- State: `selectedPet` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:67](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:67)
- State: `discussionTopic` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:68)
- State: `notes` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:69)
- State: `selectedDate` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:70](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:70)
- State: `selectedTime` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:71)
- State: `selectedVet` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:72)
- State: `concernImages` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:73)
- State: `viewingImage` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:74)
- State: `isNewPet` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:77)
- State: `newPetName` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:78)
- State: `newPetSpecies` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:79)
- State: `newPetBreed` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:80)
- State: `newPetAge` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:81](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:81)
- State: `newPetWeight` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:82](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:82)
- State: `newPetColorMarkings` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:83](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:83)
- State: `newPetMedicalConditions` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:84)
- `ConsultBooking()` — [src/components/PetOwnerDashboard/ConsultBooking.jsx:58](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultBooking.jsx:58)

### ConsultConfirmation — boundary

Definition: [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:1) · diagram tab 22.

- State: `submissionReceipt` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:94](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:94)
- State: `consultation` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:95](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:95)
- State: `onlineConsultation` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:96](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:96)
- State: `canJoin` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:97](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:97)
- State: `isLoading` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:98](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:98)
- State: `cancelDialogOpen` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:99](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:99)
- State: `viewerImage` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:100](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:100)
- State: `isCancelling` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:101](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:101)
- State: `cancellationData` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:102](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:102)
- `ConsultConfirmation()` — [src/components/PetOwnerDashboard/ConsultConfirmation.jsx:89](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultConfirmation.jsx:89)

### ConsultPayment — boundary

Definition: [src/components/PetOwnerDashboard/ConsultPayment.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:1) · diagram tab 22.

- State: `bookingData` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:32](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:32)
- State: `isProcessing` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:33](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:33)
- State: `signature` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:34)
- State: `viewer` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:35)
- State: `consentTemplates` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:36)
- State: `isLoadingConsent` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:37)
- State: `formData` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:38)
- `ConsultPayment()` — [src/components/PetOwnerDashboard/ConsultPayment.jsx:30](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ConsultPayment.jsx:30)

### DentalCheckup — boundary

Definition: [src/components/PetOwnerDashboard/DentalCheckup.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:1) · diagram tab 22.

- State: `pets` — [src/components/PetOwnerDashboard/DentalCheckup.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:34)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/DentalCheckup.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:35)
- State: `isNewPet` — [src/components/PetOwnerDashboard/DentalCheckup.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:36)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/DentalCheckup.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:37)
- State: `formData` — [src/components/PetOwnerDashboard/DentalCheckup.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:38)
- `DentalCheckup()` — [src/components/PetOwnerDashboard/DentalCheckup.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/DentalCheckup.jsx:29)

### GeneralCheckup — boundary

Definition: [src/components/PetOwnerDashboard/GeneralCheckup.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:1) · diagram tab 22.

- State: `pets` — [src/components/PetOwnerDashboard/GeneralCheckup.jsx:47](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:47)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/GeneralCheckup.jsx:48](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:48)
- State: `isNewPet` — [src/components/PetOwnerDashboard/GeneralCheckup.jsx:49](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:49)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/GeneralCheckup.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:50)
- State: `formData` — [src/components/PetOwnerDashboard/GeneralCheckup.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:51)
- `GeneralCheckup({…})` — [src/components/PetOwnerDashboard/GeneralCheckup.jsx:40](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/GeneralCheckup.jsx:40)

### Grooming — boundary

Definition: [src/components/PetOwnerDashboard/Grooming.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:1) · diagram tab 32.

- State: `pets` — [src/components/PetOwnerDashboard/Grooming.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:35)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/Grooming.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:36)
- State: `isNewPet` — [src/components/PetOwnerDashboard/Grooming.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:37)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/Grooming.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:38)
- State: `selectedGroomingOptions` — [src/components/PetOwnerDashboard/Grooming.jsx:39](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:39)
- State: `formData` — [src/components/PetOwnerDashboard/Grooming.jsx:40](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:40)
- `Grooming()` — [src/components/PetOwnerDashboard/Grooming.jsx:30](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Grooming.jsx:30)

### Home — boundary

Definition: [src/components/PetOwnerDashboard/Home.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Home.jsx:1) · diagram tab 23.

- State: `homeData` — [src/components/PetOwnerDashboard/Home.jsx:527](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Home.jsx:527)
- State: `ownerClinicId` — [src/components/PetOwnerDashboard/Home.jsx:528](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Home.jsx:528)
- State: `ownerClinics` — [src/components/PetOwnerDashboard/Home.jsx:529](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Home.jsx:529)
- `Home({…})` — [src/components/PetOwnerDashboard/Home.jsx:519](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Home.jsx:519)

### HomeServiceConfirmation — boundary

Definition: [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:1) · diagram tab 31.

- State: `booking` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:40](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:40)
- State: `signature` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:41](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:41)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:42](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:42)
- State: `viewer` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:43](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:43)
- State: `consentTemplates` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:44](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:44)
- State: `isLoadingConsent` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:45](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:45)
- State: `paymentFormData` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:48](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:48)
- `HomeServiceConfirmation()` — [src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:36)

### HomeServices — boundary

Definition: [src/components/PetOwnerDashboard/HomeServices.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:1) · diagram tab 19.

- State: `pets` — [src/components/PetOwnerDashboard/HomeServices.jsx:49](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:49)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/HomeServices.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:50)
- State: `selectedPet` — [src/components/PetOwnerDashboard/HomeServices.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:51)
- State: `selectedServices` — [src/components/PetOwnerDashboard/HomeServices.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:52)
- State: `bookingBranchId` — [src/components/PetOwnerDashboard/HomeServices.jsx:53](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:53)
- State: `bookingVetId` — [src/components/PetOwnerDashboard/HomeServices.jsx:54](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:54)
- State: `preferredDate` — [src/components/PetOwnerDashboard/HomeServices.jsx:55](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:55)
- State: `preferredTime` — [src/components/PetOwnerDashboard/HomeServices.jsx:56](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:56)
- State: `address` — [src/components/PetOwnerDashboard/HomeServices.jsx:59](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:59)
- State: `specificLocation` — [src/components/PetOwnerDashboard/HomeServices.jsx:60](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:60)
- State: `addressSuggestions` — [src/components/PetOwnerDashboard/HomeServices.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:61)
- State: `isSearchingAddress` — [src/components/PetOwnerDashboard/HomeServices.jsx:62](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:62)
- State: `showSuggestions` — [src/components/PetOwnerDashboard/HomeServices.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:63)
- State: `selectedAddressLocation` — [src/components/PetOwnerDashboard/HomeServices.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:64)
- State: `notes` — [src/components/PetOwnerDashboard/HomeServices.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:77)
- State: `uploadedImages` — [src/components/PetOwnerDashboard/HomeServices.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:78)
- State: `viewingImage` — [src/components/PetOwnerDashboard/HomeServices.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:79)
- State: `isNewPet` — [src/components/PetOwnerDashboard/HomeServices.jsx:82](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:82)
- State: `newPetName` — [src/components/PetOwnerDashboard/HomeServices.jsx:83](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:83)
- State: `newPetSpecies` — [src/components/PetOwnerDashboard/HomeServices.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:84)
- State: `newPetBreed` — [src/components/PetOwnerDashboard/HomeServices.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:85)
- State: `newPetAge` — [src/components/PetOwnerDashboard/HomeServices.jsx:86](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:86)
- State: `newPetWeight` — [src/components/PetOwnerDashboard/HomeServices.jsx:87](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:87)
- State: `newPetColorMarkings` — [src/components/PetOwnerDashboard/HomeServices.jsx:88](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:88)
- `HomeServices()` — [src/components/PetOwnerDashboard/HomeServices.jsx:45](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/HomeServices.jsx:45)

### LaboratoryTesting — boundary

Definition: [src/components/PetOwnerDashboard/LaboratoryTesting.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/LaboratoryTesting.jsx:1) · diagram tab 11.

- `LaboratoryTesting()` — [src/components/PetOwnerDashboard/LaboratoryTesting.jsx:17](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/LaboratoryTesting.jsx:17)

### MedicalRecords — boundary

Definition: [src/components/PetOwnerDashboard/MedicalRecords.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:1) · diagram tab 27.

- State: `records` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:353](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:353)
- State: `isLoading` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:354](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:354)
- State: `viewer` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:355](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:355)
- State: `isPreparingPrint` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:356](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:356)
- State: `searchFocus` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:357](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:357)
- State: `highlightedTarget` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:358](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:358)
- State: `highlightedMatch` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:359](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:359)
- State: `expandedIds` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:800](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:800)
- State: `isDownloading` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:1036](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:1036)
- State: `isOpening` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:1037](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:1037)
- State: `isDownloading` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:1410](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:1410)
- State: `isOpening` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:1411](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:1411)
- `MedicalRecords()` — [src/components/PetOwnerDashboard/MedicalRecords.jsx:350](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MedicalRecords.jsx:350)

### MyBookings — boundary

Definition: [src/components/PetOwnerDashboard/MyBookings.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:1) · diagram tab 23.

- State: `isOpen` — [src/components/PetOwnerDashboard/MyBookings.jsx:167](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:167)
- State: `selectedBooking` — [src/components/PetOwnerDashboard/MyBookings.jsx:168](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:168)
- State: `bookings` — [src/components/PetOwnerDashboard/MyBookings.jsx:169](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:169)
- State: `hasLoaded` — [src/components/PetOwnerDashboard/MyBookings.jsx:170](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:170)
- State: `isLoading` — [src/components/PetOwnerDashboard/MyBookings.jsx:171](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:171)
- State: `errorMessage` — [src/components/PetOwnerDashboard/MyBookings.jsx:172](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:172)
- State: `panelStyle` — [src/components/PetOwnerDashboard/MyBookings.jsx:173](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:173)
- `MyBookings({…})` — [src/components/PetOwnerDashboard/MyBookings.jsx:162](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyBookings.jsx:162)

### MyPets — boundary

Definition: [src/components/PetOwnerDashboard/MyPets.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:1) · diagram tab 19.

- State: `pets` — [src/components/PetOwnerDashboard/MyPets.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:73)
- State: `isLoading` — [src/components/PetOwnerDashboard/MyPets.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:74)
- State: `isAdminView` — [src/components/PetOwnerDashboard/MyPets.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:75)
- State: `directorySearch` — [src/components/PetOwnerDashboard/MyPets.jsx:76](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:76)
- State: `directoryView` — [src/components/PetOwnerDashboard/MyPets.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:77)
- State: `isArchiveOpen` — [src/components/PetOwnerDashboard/MyPets.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:78)
- State: `archiveSearch` — [src/components/PetOwnerDashboard/MyPets.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:79)
- State: `pendingArchivePet` — [src/components/PetOwnerDashboard/MyPets.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:80)
- State: `isUpdatingArchive` — [src/components/PetOwnerDashboard/MyPets.jsx:81](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:81)
- State: `clinicalSearchResults` — [src/components/PetOwnerDashboard/MyPets.jsx:82](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:82)
- State: `isClinicalSearchLoading` — [src/components/PetOwnerDashboard/MyPets.jsx:83](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:83)
- State: `clinicalSearchError` — [src/components/PetOwnerDashboard/MyPets.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:84)
- State: `coparentRequest` — [src/components/PetOwnerDashboard/MyPets.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:85)
- State: `isCoparentModalOpen` — [src/components/PetOwnerDashboard/MyPets.jsx:86](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:86)
- State: `isCoparentLoading` — [src/components/PetOwnerDashboard/MyPets.jsx:87](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:87)
- State: `coparentAction` — [src/components/PetOwnerDashboard/MyPets.jsx:88](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:88)
- `MyPets()` — [src/components/PetOwnerDashboard/MyPets.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/MyPets.jsx:71)

### ParasiteControl — boundary

Definition: [src/components/PetOwnerDashboard/ParasiteControl.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:1) · diagram tab 23.

- State: `pets` — [src/components/PetOwnerDashboard/ParasiteControl.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:34)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/ParasiteControl.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:35)
- State: `isNewPet` — [src/components/PetOwnerDashboard/ParasiteControl.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:36)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/ParasiteControl.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:37)
- State: `formData` — [src/components/PetOwnerDashboard/ParasiteControl.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:38)
- `ParasiteControl()` — [src/components/PetOwnerDashboard/ParasiteControl.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ParasiteControl.jsx:29)

### PaymentSubmission — boundary

Definition: [src/components/PetOwnerDashboard/PaymentSubmission.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PaymentSubmission.jsx:1) · diagram tab 23.

- State: `paymentData` — [src/components/PetOwnerDashboard/PaymentSubmission.jsx:54](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PaymentSubmission.jsx:54)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/PaymentSubmission.jsx:55](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PaymentSubmission.jsx:55)
- State: `viewer` — [src/components/PetOwnerDashboard/PaymentSubmission.jsx:56](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PaymentSubmission.jsx:56)
- State: `formData` — [src/components/PetOwnerDashboard/PaymentSubmission.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PaymentSubmission.jsx:57)
- `PaymentSubmission()` — [src/components/PetOwnerDashboard/PaymentSubmission.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PaymentSubmission.jsx:52)

### PetHotel — boundary

Definition: [src/components/PetOwnerDashboard/PetHotel.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:1) · diagram tab 33.

- State: `today` — [src/components/PetOwnerDashboard/PetHotel.jsx:150](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:150)
- State: `pets` — [src/components/PetOwnerDashboard/PetHotel.jsx:151](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:151)
- State: `branchId` — [src/components/PetOwnerDashboard/PetHotel.jsx:153](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:153)
- State: `selectedPets` — [src/components/PetOwnerDashboard/PetHotel.jsx:154](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:154)
- State: `roomSize` — [src/components/PetOwnerDashboard/PetHotel.jsx:155](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:155)
- State: `checkInDate` — [src/components/PetOwnerDashboard/PetHotel.jsx:156](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:156)
- State: `checkOutDate` — [src/components/PetOwnerDashboard/PetHotel.jsx:157](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:157)
- State: `addOns` — [src/components/PetOwnerDashboard/PetHotel.jsx:158](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:158)
- State: `specialRequests` — [src/components/PetOwnerDashboard/PetHotel.jsx:159](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:159)
- State: `emergencyContact` — [src/components/PetOwnerDashboard/PetHotel.jsx:160](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:160)
- State: `roomAvailability` — [src/components/PetOwnerDashboard/PetHotel.jsx:161](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:161)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/PetHotel.jsx:162](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:162)
- State: `isLoadingAvailability` — [src/components/PetOwnerDashboard/PetHotel.jsx:163](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:163)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/PetHotel.jsx:164](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:164)
- State: `consentTemplates` — [src/components/PetOwnerDashboard/PetHotel.jsx:165](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:165)
- State: `isLoadingConsent` — [src/components/PetOwnerDashboard/PetHotel.jsx:166](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:166)
- State: `boardingSignature` — [src/components/PetOwnerDashboard/PetHotel.jsx:167](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:167)
- `PetHotel()` — [src/components/PetOwnerDashboard/PetHotel.jsx:139](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetHotel.jsx:139)

### PetOwnerProfile — boundary

Definition: [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:1) · diagram tab 15.

- State: `isEditingProfile` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:57)
- State: `isSaving` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:58](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:58)
- State: `imageError` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:59](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:59)
- State: `profileData` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:61)
- State: `imageFile` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:71)
- State: `phoneError` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:72)
- State: `activeTab` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:73)
- State: `pendingProfileTab` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:74)
- State: `isProfileLeaveDialogOpen` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:75)
- `PetOwnerProfile({…})` — [src/components/PetOwnerDashboard/PetOwnerProfile.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetOwnerProfile.jsx:52)

### PetProfile — boundary

Definition: [src/components/PetOwnerDashboard/PetProfile.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:1) · diagram tab 15.

- State: `pet` — [src/components/PetOwnerDashboard/PetProfile.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:79)
- State: `isLoading` — [src/components/PetOwnerDashboard/PetProfile.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:80)
- State: `isActivityLoading` — [src/components/PetOwnerDashboard/PetProfile.jsx:81](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:81)
- State: `queueRecords` — [src/components/PetOwnerDashboard/PetProfile.jsx:82](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:82)
- State: `bookingRecords` — [src/components/PetOwnerDashboard/PetProfile.jsx:83](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:83)
- State: `bookingPage` — [src/components/PetOwnerDashboard/PetProfile.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:84)
- State: `confirmAction` — [src/components/PetOwnerDashboard/PetProfile.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:85)
- State: `isCancelling` — [src/components/PetOwnerDashboard/PetProfile.jsx:86](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:86)
- State: `copied` — [src/components/PetOwnerDashboard/PetProfile.jsx:87](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:87)
- State: `detailModal` — [src/components/PetOwnerDashboard/PetProfile.jsx:88](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:88)
- State: `consentViewer` — [src/components/PetOwnerDashboard/PetProfile.jsx:89](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:89)
- State: `isEditingTempOwner` — [src/components/PetOwnerDashboard/PetProfile.jsx:90](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:90)
- State: `isSavingTempOwner` — [src/components/PetOwnerDashboard/PetProfile.jsx:91](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:91)
- State: `tempOwnerDraft` — [src/components/PetOwnerDashboard/PetProfile.jsx:92](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:92)
- State: `activeRecordUpdateRequest` — [src/components/PetOwnerDashboard/PetProfile.jsx:93](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:93)
- State: `isPetInformationEditorOpen` — [src/components/PetOwnerDashboard/PetProfile.jsx:94](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:94)
- State: `isIdentityCardFlipped` — [src/components/PetOwnerDashboard/PetProfile.jsx:95](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:95)
- State: `isConsentPanelOpen` — [src/components/PetOwnerDashboard/PetProfile.jsx:96](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:96)
- State: `isBookingsPanelOpen` — [src/components/PetOwnerDashboard/PetProfile.jsx:97](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:97)
- State: `certificates` — [src/components/PetOwnerDashboard/PetProfile.jsx:98](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:98)
- State: `certificateViewer` — [src/components/PetOwnerDashboard/PetProfile.jsx:99](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:99)
- State: `isDownloading` — [src/components/PetOwnerDashboard/PetProfile.jsx:1958](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:1958)
- State: `isOpening` — [src/components/PetOwnerDashboard/PetProfile.jsx:1959](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:1959)
- State: `isOpening` — [src/components/PetOwnerDashboard/PetProfile.jsx:2136](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:2136)
- `PetProfile()` — [src/components/PetOwnerDashboard/PetProfile.jsx:76](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/PetProfile.jsx:76)

### RequestUpdateRecord — boundary

Definition: [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:1) · diagram tab 41.

- State: `selectedMethod` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:43](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:43)
- State: `paymentProof` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:44](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:44)
- State: `paymentReference` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:45](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:45)
- State: `notes` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:46](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:46)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:47](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:47)
- State: `isSubmitted` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:48](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:48)
- State: `submittedRequest` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:49](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:49)
- State: `errorMessage` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:50](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:50)
- State: `viewer` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:51)
- State: `activeRequest` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:52)
- State: `isCheckingActiveRequest` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:53](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:53)
- `RequestUpdateRecord()` — [src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/RequestUpdateRecord.jsx:37)

### Self-Service_QUEUE — boundary

Definition: [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:1) · diagram tab 25.

- State: `pets` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:119](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:119)
- State: `isAccessLoading` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:120](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:120)
- State: `isAccessAllowed` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:121](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:121)
- State: `publicWanIp` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:122](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:122)
- State: `selectedPet` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:123](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:123)
- State: `selectedService` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:124](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:124)
- State: `selectedBranchId` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:125](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:125)
- State: `signature` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:126](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:126)
- State: `submitted` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:127](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:127)
- State: `concernStatement` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:128](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:128)
- State: `uploadedImages` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:129](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:129)
- State: `viewingImage` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:130](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:130)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:131](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:131)
- State: `consentTemplates` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:132](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:132)
- State: `isLoadingConsentTemplates` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:133](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:133)
- `QueueDashboard()` — [src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:117](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:117)

### ServiceContentEditor — boundary

Definition: [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:1) · diagram tab 37.

- State: `isEditing` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:61)
- State: `isSaving` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:62](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:62)
- State: `draft` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:63)
- State: `isEditing` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:266](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:266)
- State: `draft` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:267](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:267)
- State: `isSaving` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:268](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:268)
- State: `isEditing` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:404](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:404)
- State: `draftRooms` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:405](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:405)
- State: `draftAddOns` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:406](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:406)
- State: `isSaving` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:407](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:407)
- `ServiceProjectionEditor({…})` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:53](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:53)
- `HomeServicesContentEditor({…})` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:265](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:265)
- `PetHotelContentEditor({…})` — [src/components/PetOwnerDashboard/ServiceContentEditor.jsx:403](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceContentEditor.jsx:403)

### ServicePageLayout — boundary

Definition: [src/components/PetOwnerDashboard/ServicePageLayout.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServicePageLayout.jsx:1) · diagram tab 37.

- `ServicePageShell({…})` — [src/components/PetOwnerDashboard/ServicePageLayout.jsx:8](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServicePageLayout.jsx:8)
- `ServicePageHeader({…})` — [src/components/PetOwnerDashboard/ServicePageLayout.jsx:16](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServicePageLayout.jsx:16)
- `ServiceSummaryCard({…})` — [src/components/PetOwnerDashboard/ServicePageLayout.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServicePageLayout.jsx:51)

### ServiceProjectionDetails — boundary

Definition: [src/components/PetOwnerDashboard/ServiceProjectionDetails.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceProjectionDetails.jsx:1) · diagram tab 37.

- `ServiceProjectionDetails({…})` — [src/components/PetOwnerDashboard/ServiceProjectionDetails.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceProjectionDetails.jsx:4)
- `ServiceProjectionNote({…})` — [src/components/PetOwnerDashboard/ServiceProjectionDetails.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/ServiceProjectionDetails.jsx:34)

### Services — boundary

Definition: [src/components/PetOwnerDashboard/Services.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Services.jsx:1) · diagram tab 11.

- `Services({…})` — [src/components/PetOwnerDashboard/Services.jsx:112](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Services.jsx:112)

### SpecialServices — boundary

Definition: [src/components/PetOwnerDashboard/SpecialServices.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:1) · diagram tab 37.

- State: `pets` — [src/components/PetOwnerDashboard/SpecialServices.jsx:291](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:291)
- State: `services` — [src/components/PetOwnerDashboard/SpecialServices.jsx:292](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:292)
- State: `selectedPetIds` — [src/components/PetOwnerDashboard/SpecialServices.jsx:293](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:293)
- State: `selectedServiceIds` — [src/components/PetOwnerDashboard/SpecialServices.jsx:294](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:294)
- State: `bookingBranchId` — [src/components/PetOwnerDashboard/SpecialServices.jsx:295](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:295)
- State: `bookingVetId` — [src/components/PetOwnerDashboard/SpecialServices.jsx:296](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:296)
- State: `serviceDate` — [src/components/PetOwnerDashboard/SpecialServices.jsx:297](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:297)
- State: `serviceTime` — [src/components/PetOwnerDashboard/SpecialServices.jsx:298](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:298)
- State: `paymentMethod` — [src/components/PetOwnerDashboard/SpecialServices.jsx:299](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:299)
- State: `notes` — [src/components/PetOwnerDashboard/SpecialServices.jsx:300](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:300)
- State: `isNewPet` — [src/components/PetOwnerDashboard/SpecialServices.jsx:301](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:301)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/SpecialServices.jsx:302](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:302)
- State: `isLoadingServices` — [src/components/PetOwnerDashboard/SpecialServices.jsx:303](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:303)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/SpecialServices.jsx:304](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:304)
- State: `showAdminForm` — [src/components/PetOwnerDashboard/SpecialServices.jsx:305](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:305)
- State: `isSavingService` — [src/components/PetOwnerDashboard/SpecialServices.jsx:306](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:306)
- State: `editDialogOpen` — [src/components/PetOwnerDashboard/SpecialServices.jsx:307](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:307)
- State: `editingService` — [src/components/PetOwnerDashboard/SpecialServices.jsx:308](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:308)
- State: `editServiceForm` — [src/components/PetOwnerDashboard/SpecialServices.jsx:309](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:309)
- State: `isUpdatingService` — [src/components/PetOwnerDashboard/SpecialServices.jsx:310](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:310)
- State: `availabilityDialogService` — [src/components/PetOwnerDashboard/SpecialServices.jsx:311](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:311)
- State: `pendingEditDisableConfirmation` — [src/components/PetOwnerDashboard/SpecialServices.jsx:312](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:312)
- State: `newPetName` — [src/components/PetOwnerDashboard/SpecialServices.jsx:320](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:320)
- State: `newPetSpecies` — [src/components/PetOwnerDashboard/SpecialServices.jsx:321](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:321)
- State: `newPetBreed` — [src/components/PetOwnerDashboard/SpecialServices.jsx:322](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:322)
- State: `newPetAge` — [src/components/PetOwnerDashboard/SpecialServices.jsx:323](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:323)
- State: `newPetWeight` — [src/components/PetOwnerDashboard/SpecialServices.jsx:324](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:324)
- State: `newPetColorMarkings` — [src/components/PetOwnerDashboard/SpecialServices.jsx:325](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:325)
- State: `newPetMedicalConditions` — [src/components/PetOwnerDashboard/SpecialServices.jsx:326](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:326)
- State: `serviceForm` — [src/components/PetOwnerDashboard/SpecialServices.jsx:328](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:328)
- `SpecialServices({…})` — [src/components/PetOwnerDashboard/SpecialServices.jsx:283](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/SpecialServices.jsx:283)

### Surgery — boundary

Definition: [src/components/PetOwnerDashboard/Surgery.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:1) · diagram tab 23.

- State: `pets` — [src/components/PetOwnerDashboard/Surgery.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:34)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/Surgery.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:35)
- State: `isNewPet` — [src/components/PetOwnerDashboard/Surgery.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:36)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/Surgery.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:37)
- State: `formData` — [src/components/PetOwnerDashboard/Surgery.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:38)
- `Surgery()` — [src/components/PetOwnerDashboard/Surgery.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Surgery.jsx:29)

### Todos — boundary

Definition: [src/components/PetOwnerDashboard/Todos.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:1) · diagram tab 38.

- State: `calendarDate` — [src/components/PetOwnerDashboard/Todos.jsx:316](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:316)
- State: `calendarView` — [src/components/PetOwnerDashboard/Todos.jsx:317](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:317)
- State: `selectedDate` — [src/components/PetOwnerDashboard/Todos.jsx:318](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:318)
- State: `tasks` — [src/components/PetOwnerDashboard/Todos.jsx:319](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:319)
- State: `isDialogOpen` — [src/components/PetOwnerDashboard/Todos.jsx:320](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:320)
- State: `isLoading` — [src/components/PetOwnerDashboard/Todos.jsx:321](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:321)
- State: `isSaving` — [src/components/PetOwnerDashboard/Todos.jsx:322](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:322)
- State: `loadError` — [src/components/PetOwnerDashboard/Todos.jsx:323](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:323)
- State: `editingTask` — [src/components/PetOwnerDashboard/Todos.jsx:324](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:324)
- State: `form` — [src/components/PetOwnerDashboard/Todos.jsx:325](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:325)
- `Todos({…})` — [src/components/PetOwnerDashboard/Todos.jsx:312](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx:312)

### Vaccination — boundary

Definition: [src/components/PetOwnerDashboard/Vaccination.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:1) · diagram tab 23.

- State: `pets` — [src/components/PetOwnerDashboard/Vaccination.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:34)
- State: `isLoadingPets` — [src/components/PetOwnerDashboard/Vaccination.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:35)
- State: `isNewPet` — [src/components/PetOwnerDashboard/Vaccination.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:36)
- State: `isSubmitting` — [src/components/PetOwnerDashboard/Vaccination.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:37)
- State: `formData` — [src/components/PetOwnerDashboard/Vaccination.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:38)
- `Vaccination()` — [src/components/PetOwnerDashboard/Vaccination.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Vaccination.jsx:29)

### VideoConsultation — boundary

Definition: [src/components/PetOwnerDashboard/VideoConsultation.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/VideoConsultation.jsx:1) · diagram tab 28.

- State: `consultation` — [src/components/PetOwnerDashboard/VideoConsultation.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/VideoConsultation.jsx:25)
- State: `isLoading` — [src/components/PetOwnerDashboard/VideoConsultation.jsx:26](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/VideoConsultation.jsx:26)
- `VideoConsultation()` — [src/components/PetOwnerDashboard/VideoConsultation.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/VideoConsultation.jsx:21)

### Registration — boundary

Definition: [src/components/Registration.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/Registration.jsx:1) · diagram tab 13.

- State: `email` — [src/components/Registration.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/Registration.jsx:22)
- State: `password` — [src/components/Registration.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/Registration.jsx:23)
- State: `confirmPassword` — [src/components/Registration.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/Registration.jsx:24)
- State: `errors` — [src/components/Registration.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/Registration.jsx:25)
- `RegistrationForm({…})` — [src/components/Registration.jsx:13](C:/Users/Admin/WebstormProjects/untitled1/src/components/Registration.jsx:13)

### ServerDownPage — boundary

Definition: [src/components/ServerDownPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/ServerDownPage.jsx:1) · diagram tab 11.

- State: `reportState` — [src/components/ServerDownPage.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/ServerDownPage.jsx:69)
- `ServerDownPage({…})` — [src/components/ServerDownPage.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/ServerDownPage.jsx:68)

### SignatureCapture — boundary

Definition: [src/components/SignatureCapture.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SignatureCapture.jsx:1) · diagram tab 31.

- State: `isDrawing` — [src/components/SignatureCapture.jsx:42](C:/Users/Admin/WebstormProjects/untitled1/src/components/SignatureCapture.jsx:42)
- `SignatureCapture({…})` — [src/components/SignatureCapture.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/SignatureCapture.jsx:36)

### TVStatusDisplay — boundary

Definition: [src/components/StatusDisplay/TVStatusDisplay.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:1) · diagram tab 17.

- State: `branchCode` — [src/components/StatusDisplay/TVStatusDisplay.jsx:270](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:270)
- State: `branches` — [src/components/StatusDisplay/TVStatusDisplay.jsx:271](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:271)
- State: `statusData` — [src/components/StatusDisplay/TVStatusDisplay.jsx:272](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:272)
- State: `error` — [src/components/StatusDisplay/TVStatusDisplay.jsx:273](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:273)
- State: `isInitialLoading` — [src/components/StatusDisplay/TVStatusDisplay.jsx:274](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:274)
- State: `clock` — [src/components/StatusDisplay/TVStatusDisplay.jsx:275](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:275)
- `TVStatusDisplay()` — [src/components/StatusDisplay/TVStatusDisplay.jsx:269](C:/Users/Admin/WebstormProjects/untitled1/src/components/StatusDisplay/TVStatusDisplay.jsx:269)

### AccountManagement — boundary

Definition: [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:1) · diagram tab 15.

- State: `selectedUser` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:178](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:178)
- State: `showDetails` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:179](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:179)
- State: `showCreateAccount` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:180](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:180)
- State: `showAccessControl` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:181](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:181)
- State: `selectedAccessAdminId` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:182](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:182)
- State: `accessPermissions` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:183](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:183)
- State: `savedAccessPermissions` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:184](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:184)
- State: `isLoadingAccess` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:185](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:185)
- State: `isSavingAccess` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:186](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:186)
- State: `pendingStatusAction` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:187](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:187)
- State: `pendingDeleteAction` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:188](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:188)
- State: `isUpdatingStatus` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:189](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:189)
- State: `isDeletingAccount` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:190](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:190)
- State: `isEditingPersonnel` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:191](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:191)
- State: `isEditingBookingSchedule` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:192](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:192)
- State: `isSavingBookingSchedule` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:193](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:193)
- State: `personnelForm` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:194](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:194)
- State: `deleteForm` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:201](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:201)
- State: `isSavingPersonnel` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:202](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:202)
- State: `isLoading` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:203](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:203)
- State: `accounts` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:204](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:204)
- State: `searchQuery` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:205](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:205)
- State: `roleFilter` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:206](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:206)
- State: `showArchiveList` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:207](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:207)
- State: `archiveSearch` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:208](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:208)
- State: `branches` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:209](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:209)
- State: `createForm` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:212](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:212)
- State: `isSubmitting` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:227](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:227)
- State: `failedSrc` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:777](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:777)
- `AccountManagement()` — [src/components/SuperAdminDashboardComponent/AccountManagement.jsx:177](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/AccountManagement.jsx:177)

### BackupManagement — boundary

Definition: [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:1) · diagram tab 42.

- State: `data` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:76](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:76)
- State: `loading` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:77)
- State: `loadError` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:78)
- State: `downloading` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:79)
- State: `downloadProgress` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:80)
- State: `historyExpanded` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:81](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:81)
- `BackupManagement({…})` — [src/components/SuperAdminDashboardComponent/BackupManagement.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/BackupManagement.jsx:75)

### PaymentMethodsManagement — boundary

Definition: [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:1) · diagram tab 36.

- State: `methods` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:166](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:166)
- State: `filter` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:167](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:167)
- State: `searchQuery` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:168](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:168)
- State: `otpCode` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:169](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:169)
- State: `isLoading` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:170](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:170)
- State: `isSendingOtp` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:171](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:171)
- State: `isSaving` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:172](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:172)
- State: `editorOpen` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:173](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:173)
- State: `editingKey` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:174](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:174)
- State: `draft` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:175](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:175)
- State: `draftErrors` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:176](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:176)
- State: `baselineFingerprint` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:177](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:177)
- State: `serverRevision` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:178](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:178)
- State: `verificationEmail` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:179](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:179)
- State: `loadError` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:180](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:180)
- State: `viewer` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:181](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:181)
- `PaymentMethodsManagement()` — [src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:165](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PaymentMethodsManagement.jsx:165)

### PetMediaMonitoring — boundary

Definition: [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:1) · diagram tab 41.

- State: `pets` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:125](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:125)
- State: `petSearch` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:126](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:126)
- State: `isPetSearchOpen` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:127](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:127)
- State: `selectedPetId` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:128](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:128)
- State: `isLoadingPets` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:129](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:129)
- State: `petLoadError` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:130](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:130)
- State: `mediaData` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:131](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:131)
- State: `isLoadingMedia` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:132](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:132)
- State: `errorMessage` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:133](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:133)
- State: `serviceFilter` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:134](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:134)
- State: `viewMode` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:135](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:135)
- State: `viewer` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:136](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:136)
- State: `openingDocumentId` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:137](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:137)
- State: `selectedServiceName` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:487](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:487)
- State: `selectedDateKey` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:488](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:488)
- `PetMediaMonitoring()` — [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:123](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx:123)

### PetOwnerAccountsManagement — boundary

Definition: [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:1) · diagram tab 15.

- State: `failed` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:117](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:117)
- State: `failed` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:140](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:140)
- State: `owners` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:172](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:172)
- State: `statusSupported` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:173](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:173)
- State: `search` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:174](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:174)
- State: `isArchiveOpen` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:175](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:175)
- State: `archiveSearch` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:176](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:176)
- State: `selectedOwner` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:177](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:177)
- State: `pendingStatusOwner` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:178](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:178)
- State: `pendingPetArchive` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:179](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:179)
- State: `reason` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:180](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:180)
- State: `viewMode` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:181](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:181)
- State: `isLoading` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:182](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:182)
- State: `isSaving` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:183](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:183)
- `PetOwnerAccountsManagement()` — [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:171](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx:171)

### ReportChartCard — boundary

Definition: [src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:1) · diagram tab 39.

- State: `reduceMotion` — [src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:195](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:195)
- State: `selectedPointIndex` — [src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:196](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:196)
- `ReportChartCard({…})` — [src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:191](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportChartCard.jsx:191)

### ReportDateInput — boundary

Definition: [src/components/SuperAdminDashboardComponent/ReportDateInput.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportDateInput.jsx:1) · diagram tab 39.

- State: `hasError` — [src/components/SuperAdminDashboardComponent/ReportDateInput.jsx:52](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportDateInput.jsx:52)
- `ReportDateInput({…})` — [src/components/SuperAdminDashboardComponent/ReportDateInput.jsx:51](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportDateInput.jsx:51)

### ReportKpiCard — boundary

Definition: [src/components/SuperAdminDashboardComponent/ReportKpiCard.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportKpiCard.jsx:1) · diagram tab 39.

- `ReportKpiCard({…})` — [src/components/SuperAdminDashboardComponent/ReportKpiCard.jsx:66](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportKpiCard.jsx:66)

### ReportPreview — boundary

Definition: [src/components/SuperAdminDashboardComponent/ReportPreview.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportPreview.jsx:1) · diagram tab 39.

- `ReportPreview({…})` — [src/components/SuperAdminDashboardComponent/ReportPreview.jsx:56](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportPreview.jsx:56)

### ReportTable — boundary

Definition: [src/components/SuperAdminDashboardComponent/ReportTable.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportTable.jsx:1) · diagram tab 39.

- `ReportTable({…})` — [src/components/SuperAdminDashboardComponent/ReportTable.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/ReportTable.jsx:37)

### SuperAdminActivityLog — boundary

Definition: [src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx:1) · diagram tab 39.

- `SuperAdminActivityLog()` — [src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx:6](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx:6)

### SuperAdminReportCenter — boundary

Definition: [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:1) · diagram tab 39.

- State: `reportType` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:208](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:208)
- State: `range` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:209](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:209)
- State: `customStart` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:210](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:210)
- State: `customEnd` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:211](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:211)
- State: `filters` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:212](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:212)
- State: `report` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:213](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:213)
- State: `isLoading` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:214](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:214)
- State: `exportingFormat` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:215](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:215)
- State: `error` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:216](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:216)
- State: `branches` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:217](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:217)
- State: `veterinarians` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:218](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:218)
- `SuperAdminReportCenter()` — [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:205](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:205)

### SuperAdminReportsDashboard — boundary

Definition: [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:1) · diagram tab 40.

- State: `range` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:307](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:307)
- State: `customStart` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:308](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:308)
- State: `customEnd` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:309](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:309)
- State: `dashboard` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:310](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:310)
- State: `isLoading` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:311](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:311)
- State: `error` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:312](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:312)
- State: `highlightedTargetId` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:313](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:313)
- State: `selectedKpiLabel` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:314](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:314)
- `SuperAdminReportsDashboard()` — [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:302](C:/Users/Admin/WebstormProjects/untitled1/src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx:302)

### ApprovedOnlineConsultation — boundary

Definition: [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:1) · diagram tab 28.

- State: `consultations` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:183](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:183)
- State: `isLoading` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:184](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:184)
- State: `actionId` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:185](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:185)
- State: `searchQuery` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:186](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:186)
- State: `dateFilter` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:187](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:187)
- State: `activeView` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:188](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:188)
- State: `upcomingStatusFilter` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:189](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:189)
- State: `viewerImage` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:190](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:190)
- `ApprovedOnlineConsultation()` — [src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:178](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedOnlineConsultation.jsx:178)

### ApprovedQueueList — boundary

Definition: [src/components/VetrinarianComponents/ApprovedQueueList.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:1) · diagram tab 25.

- State: `queue` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:218](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:218)
- State: `bookings` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:219](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:219)
- State: `groomingReviews` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:220](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:220)
- State: `expandedRows` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:221](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:221)
- State: `searchQuery` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:222](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:222)
- State: `isLoading` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:223](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:223)
- State: `isBookingsLoading` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:224](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:224)
- State: `errorMessage` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:225](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:225)
- State: `bookingsErrorMessage` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:226](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:226)
- State: `updatingQueueId` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:227](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:227)
- State: `updatingBookingId` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:228](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:228)
- State: `branches` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:229](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:229)
- State: `branchFilter` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:230](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:230)
- `VetQueueList()` — [src/components/VetrinarianComponents/ApprovedQueueList.jsx:212](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/ApprovedQueueList.jsx:212)

### VetActiveLocationPanel — boundary

Definition: [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:1) · diagram tab 17.

- State: `branches` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:22)
- State: `selectedBranchId` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:23)
- State: `savedBranchId` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:24)
- State: `isLoading` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:25)
- State: `isSaving` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:26](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:26)
- State: `error` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:27](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:27)
- `VetActiveLocationPanel()` — [src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetActiveLocationPanel.jsx:15)

### VetDiagnosis — boundary

Definition: [src/components/VetrinarianComponents/VetDiagnosis.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:1) · diagram tab 27.

- State: `veterinarianLicense` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:712](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:712)
- State: `context` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:725](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:725)
- State: `boardingDocuments` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:733](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:733)
- State: `diagnosisType` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:741](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:741)
- State: `formData` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:742](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:742)
- State: `currentPrescription` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:751](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:751)
- State: `customFields` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:756](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:756)
- State: `uploadedImages` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:761](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:761)
- State: `isSaving` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:766](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:766)
- State: `isLoadingRecord` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:767](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:767)
- State: `loadedDiagnosisId` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:768](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:768)
- State: `schemaWarning` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:769](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:769)
- State: `previewImage` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:770](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:770)
- State: `isLoadingContext` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:771](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:771)
- State: `consentTemplates` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:772](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:772)
- State: `isLoadingConsentTemplates` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:773](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:773)
- State: `consentDraft` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:774](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:774)
- State: `additionalConsents` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:778](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:778)
- State: `shouldRecordVaccination` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:784](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:784)
- State: `vaccinationRecord` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:785](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:785)
- State: `serviceCatalog` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:791](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:791)
- State: `selectedServiceId` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:792](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:792)
- State: `selectedCustomServiceId` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:793](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:793)
- State: `visitCharges` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:794](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:794)
- State: `confinementPlan` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:797](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:797)
- State: `billingSchemaMessage` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:801](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:801)
- State: `isDraftReady` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:802](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:802)
- State: `showAdditionalRecords` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:803](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:803)
- State: `isSheetOpen` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:2261](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:2261)
- State: `showTemplatePreview` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:2262](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:2262)
- State: `isOpening` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:2432](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:2432)
- State: `isDownloading` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:2433](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:2433)
- State: `isDownloading` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:3806](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:3806)
- State: `isOpening` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:3807](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:3807)
- `VetDiagnosis()` — [src/components/VetrinarianComponents/VetDiagnosis.jsx:706](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx:706)

### VetDiagnosisHistory — boundary

Definition: [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:1) · diagram tab 27.

- State: `records` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:277](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:277)
- State: `isLoading` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:278](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:278)
- State: `errorMessage` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:279](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:279)
- State: `searchQuery` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:280](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:280)
- State: `sourceFilter` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:281](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:281)
- State: `selectedRecord` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:282](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:282)
- State: `previewImage` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:283](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:283)
- State: `isDownloading` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:775](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:775)
- State: `isOpening` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:776](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:776)
- State: `isDownloading` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:1047](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:1047)
- State: `isOpening` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:1048](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:1048)
- `VetDiagnosisHistory()` — [src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:273](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosisHistory.jsx:273)

### VetMylistinService — boundary

Definition: [src/components/VetrinarianComponents/VetMylistinService.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:1) · diagram tab 31.

- State: `queue` — [src/components/VetrinarianComponents/VetMylistinService.jsx:131](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:131)
- State: `bookings` — [src/components/VetrinarianComponents/VetMylistinService.jsx:132](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:132)
- State: `todayKey` — [src/components/VetrinarianComponents/VetMylistinService.jsx:133](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:133)
- State: `isBookingsLoading` — [src/components/VetrinarianComponents/VetMylistinService.jsx:134](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:134)
- State: `bookingsError` — [src/components/VetrinarianComponents/VetMylistinService.jsx:135](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:135)
- State: `bookingViewerDate` — [src/components/VetrinarianComponents/VetMylistinService.jsx:136](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:136)
- State: `previewBookingId` — [src/components/VetrinarianComponents/VetMylistinService.jsx:137](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:137)
- State: `consentForms` — [src/components/VetrinarianComponents/VetMylistinService.jsx:138](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:138)
- State: `consentRecords` — [src/components/VetrinarianComponents/VetMylistinService.jsx:139](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:139)
- State: `veterinarianLicense` — [src/components/VetrinarianComponents/VetMylistinService.jsx:140](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:140)
- State: `searchQuery` — [src/components/VetrinarianComponents/VetMylistinService.jsx:141](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:141)
- State: `isLoading` — [src/components/VetrinarianComponents/VetMylistinService.jsx:142](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:142)
- State: `hasLoadedQueue` — [src/components/VetrinarianComponents/VetMylistinService.jsx:143](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:143)
- State: `isSavingConsent` — [src/components/VetrinarianComponents/VetMylistinService.jsx:144](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:144)
- State: `errorMessage` — [src/components/VetrinarianComponents/VetMylistinService.jsx:145](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:145)
- State: `updatingQueueId` — [src/components/VetrinarianComponents/VetMylistinService.jsx:146](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:146)
- State: `selectedPatient` — [src/components/VetrinarianComponents/VetMylistinService.jsx:147](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:147)
- State: `consentDialogOpen` — [src/components/VetrinarianComponents/VetMylistinService.jsx:148](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:148)
- State: `uploadDialogOpen` — [src/components/VetrinarianComponents/VetMylistinService.jsx:149](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:149)
- State: `groomingReviewsOpen` — [src/components/VetrinarianComponents/VetMylistinService.jsx:150](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:150)
- State: `selectedConsentId` — [src/components/VetrinarianComponents/VetMylistinService.jsx:172](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:172)
- State: `signerName` — [src/components/VetrinarianComponents/VetMylistinService.jsx:173](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:173)
- State: `signatureImage` — [src/components/VetrinarianComponents/VetMylistinService.jsx:174](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:174)
- State: `uploadedFileName` — [src/components/VetrinarianComponents/VetMylistinService.jsx:175](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:175)
- State: `previewUrl` — [src/components/VetrinarianComponents/VetMylistinService.jsx:176](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:176)
- State: `completedViewMode` — [src/components/VetrinarianComponents/VetMylistinService.jsx:177](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:177)
- State: `branches` — [src/components/VetrinarianComponents/VetMylistinService.jsx:178](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:178)
- State: `branchFilter` — [src/components/VetrinarianComponents/VetMylistinService.jsx:179](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:179)
- `VetMyList()` — [src/components/VetrinarianComponents/VetMylistinService.jsx:124](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetMylistinService.jsx:124)

### VetOnlineConsultDiagnosis — boundary

Definition: [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:1) · diagram tab 28.

- State: `consultation` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:150](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:150)
- State: `isLoading` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:151](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:151)
- State: `isSaving` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:152](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:152)
- State: `isStarting` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:153](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:153)
- State: `isCapturing` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:154](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:154)
- State: `lastAutosavedAt` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:155](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:155)
- State: `diagnosisForm` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:156](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:156)
- State: `prescriptionDraft` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:157](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:157)
- State: `diagnosisError` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:158](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:158)
- State: `isClinicalPanelOpen` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:159](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:159)
- `VetOnlineConsultDiagnosis()` — [src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:146](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetOnlineConsultDiagnosis.jsx:146)

### VetPetsEMR — boundary

Definition: [src/components/VetrinarianComponents/VetPetsEMR.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:1) · diagram tab 27.

- State: `veterinarianProfile` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:347](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:347)
- State: `pets` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:348](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:348)
- State: `petSearch` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:349](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:349)
- State: `selectedPetId` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:350](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:350)
- State: `recordsData` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:351](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:351)
- State: `isLoadingPets` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:352](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:352)
- State: `isLoadingRecords` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:353](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:353)
- State: `isPetSearchOpen` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:354](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:354)
- State: `selectedGroupId` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:355](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:355)
- State: `editingGroupId` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:356](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:356)
- State: `groupDraft` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:357](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:357)
- State: `isSavingGroup` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:358](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:358)
- State: `groupAutosaveStatus` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:359](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:359)
- State: `editingItem` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:360](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:360)
- State: `itemDraft` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:361](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:361)
- State: `itemAutosaveStatus` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:367](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:367)
- State: `isUploadingRevisionFiles` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:368](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:368)
- State: `sourceSearch` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:369](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:369)
- State: `showIncludedSources` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:370](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:370)
- State: `addingRecordKey` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:371](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:371)
- State: `viewer` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:372](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:372)
- State: `previewRecord` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:373](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:373)
- State: `recordUpdateContext` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:374](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:374)
- State: `highlightedRequest` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:375](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:375)
- State: `isCompletingRequest` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:376](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:376)
- State: `isPetInformationEditorOpen` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:377](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:377)
- State: `certificateData` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:378](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:378)
- State: `isCertificateDialogOpen` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:379](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:379)
- State: `certificateViewer` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:380](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:380)
- State: `medicalCertificateDraft` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:381](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:381)
- State: `showMedicalCertificateSignature` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:382](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:382)
- State: `isIssuingMedicalCertificate` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:383](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:383)
- State: `isDialogOpen` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:1941](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:1941)
- State: `isSaving` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:1942](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:1942)
- State: `draft` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:1943](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:1943)
- State: `isDownloading` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:2413](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:2413)
- State: `isOpening` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:2414](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:2414)
- `VetPetsEMR()` — [src/components/VetrinarianComponents/VetPetsEMR.jsx:344](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetPetsEMR.jsx:344)

### VetProfile — boundary

Definition: [src/components/VetrinarianComponents/VetProfile.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:1) · diagram tab 16.

- State: `isEditing` — [src/components/VetrinarianComponents/VetProfile.jsx:71](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:71)
- State: `isLoading` — [src/components/VetrinarianComponents/VetProfile.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:72)
- State: `isSaving` — [src/components/VetrinarianComponents/VetProfile.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:73)
- State: `isEditingAvailability` — [src/components/VetrinarianComponents/VetProfile.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:74)
- State: `isSavingAvailability` — [src/components/VetrinarianComponents/VetProfile.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:75)
- State: `isEditingOnlineAvailability` — [src/components/VetrinarianComponents/VetProfile.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:77)
- State: `isSavingOnlineAvailability` — [src/components/VetrinarianComponents/VetProfile.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:78)
- State: `profileData` — [src/components/VetrinarianComponents/VetProfile.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:80)
- State: `savedProfile` — [src/components/VetrinarianComponents/VetProfile.jsx:81](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:81)
- State: `imageFile` — [src/components/VetrinarianComponents/VetProfile.jsx:82](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:82)
- State: `imageError` — [src/components/VetrinarianComponents/VetProfile.jsx:83](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:83)
- State: `phoneError` — [src/components/VetrinarianComponents/VetProfile.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:84)
- State: `activeTab` — [src/components/VetrinarianComponents/VetProfile.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:85)
- State: `pendingProfileTab` — [src/components/VetrinarianComponents/VetProfile.jsx:86](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:86)
- State: `isProfileLeaveDialogOpen` — [src/components/VetrinarianComponents/VetProfile.jsx:87](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:87)
- `VetProfile({…})` — [src/components/VetrinarianComponents/VetProfile.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetProfile.jsx:64)

### VetRecordUpdateRequests — boundary

Definition: [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:1) · diagram tab 30.

- State: `requests` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:72)
- State: `isLoading` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:73)
- State: `searchQuery` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:74](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:74)
- State: `selectedRequest` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:75](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:75)
- State: `assignmentRequest` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:76](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:76)
- State: `actionLoading` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:77](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:77)
- `VetRecordUpdateRequests()` — [src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:68](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetRecordUpdateRequests.jsx:68)

### dashboardRouter — boundary

Definition: [src/components/dashboardRouter.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:1) · diagram tab 11.

- `DashboardRouterProvider({…})` — [src/components/dashboardRouter.jsx:153](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:153)
- `getRouteMatch(path)` — [src/components/dashboardRouter.jsx:137](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:137)
- `normalizePath(path)` — [src/components/dashboardRouter.jsx:99](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:99)
- `useNavigate()` — [src/components/dashboardRouter.jsx:157](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:157)
- `useParams()` — [src/components/dashboardRouter.jsx:162](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:162)
- `useUserUpdate()` — [src/components/dashboardRouter.jsx:167](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:167)
- `useDashboardUser()` — [src/components/dashboardRouter.jsx:172](C:/Users/Admin/WebstormProjects/untitled1/src/components/dashboardRouter.jsx:172)

### landingpage — boundary

Definition: [src/components/landingpage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/landingpage.jsx:1) · diagram tab 11.

- `LandingPage({…})` — [src/components/landingpage.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/landingpage.jsx:4)

### petownerprofileRegistration — boundary

Definition: [src/components/petownerprofileRegistration.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:1) · diagram tab 13.

- State: `formData` — [src/components/petownerprofileRegistration.jsx:48](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:48)
- State: `errors` — [src/components/petownerprofileRegistration.jsx:56](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:56)
- State: `addressSuggestions` — [src/components/petownerprofileRegistration.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:57)
- State: `isSearchingAddress` — [src/components/petownerprofileRegistration.jsx:58](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:58)
- State: `addressLookupError` — [src/components/petownerprofileRegistration.jsx:59](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:59)
- State: `isAddressMenuOpen` — [src/components/petownerprofileRegistration.jsx:60](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:60)
- State: `selectedAddressLocation` — [src/components/petownerprofileRegistration.jsx:61](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:61)
- State: `hasAcceptedTerms` — [src/components/petownerprofileRegistration.jsx:62](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:62)
- State: `isTermsPreviewOpen` — [src/components/petownerprofileRegistration.jsx:63](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:63)
- State: `hasReachedTermsEnd` — [src/components/petownerprofileRegistration.jsx:64](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:64)
- `PetOwnerProfileForm({…})` — [src/components/petownerprofileRegistration.jsx:47](C:/Users/Admin/WebstormProjects/untitled1/src/components/petownerprofileRegistration.jsx:47)

### AddressMapPreview — boundary

Definition: [src/components/shared/AddressMapPreview.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/AddressMapPreview.jsx:1) · diagram tab 11.

- State: `failedMapUrls` — [src/components/shared/AddressMapPreview.jsx:6](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/AddressMapPreview.jsx:6)
- `AddressMapPreview({…})` — [src/components/shared/AddressMapPreview.jsx:5](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/AddressMapPreview.jsx:5)

### AppMotionSystem — boundary

Definition: [src/components/shared/AppMotionSystem.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/AppMotionSystem.jsx:1) · diagram tab 11.

- `AppMotionSystem({…})` — [src/components/shared/AppMotionSystem.jsx:88](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/AppMotionSystem.jsx:88)

### BookingDateInput — boundary

Definition: [src/components/shared/BookingDateInput.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingDateInput.jsx:1) · diagram tab 23.

- State: `navigation` — [src/components/shared/BookingDateInput.jsx:13](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingDateInput.jsx:13)
- State: `result` — [src/components/shared/BookingDateInput.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingDateInput.jsx:18)
- `BookingDateInput({…})` — [src/components/shared/BookingDateInput.jsx:11](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingDateInput.jsx:11)

### BookingTimeSlotField — boundary

Definition: [src/components/shared/BookingTimeSlotField.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingTimeSlotField.jsx:1) · diagram tab 24.

- State: `loadState` — [src/components/shared/BookingTimeSlotField.jsx:57](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingTimeSlotField.jsx:57)
- `BookingTimeSlotField({…})` — [src/components/shared/BookingTimeSlotField.jsx:42](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BookingTimeSlotField.jsx:42)

### BranchBookingSelect — boundary

Definition: [src/components/shared/BranchBookingSelect.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BranchBookingSelect.jsx:1) · diagram tab 24.

- State: `branches` — [src/components/shared/BranchBookingSelect.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BranchBookingSelect.jsx:36)
- State: `isLoading` — [src/components/shared/BranchBookingSelect.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BranchBookingSelect.jsx:37)
- State: `error` — [src/components/shared/BranchBookingSelect.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BranchBookingSelect.jsx:38)
- `BranchBookingSelect({…})` — [src/components/shared/BranchBookingSelect.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BranchBookingSelect.jsx:25)

### BrowserNotificationButton — boundary

Definition: [src/components/shared/BrowserNotificationButton.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BrowserNotificationButton.jsx:1) · diagram tab 38.

- State: `preferences` — [src/components/shared/BrowserNotificationButton.jsx:19](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BrowserNotificationButton.jsx:19)
- State: `browserState` — [src/components/shared/BrowserNotificationButton.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BrowserNotificationButton.jsx:20)
- State: `isUpdating` — [src/components/shared/BrowserNotificationButton.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BrowserNotificationButton.jsx:21)
- `BrowserNotificationButton({…})` — [src/components/shared/BrowserNotificationButton.jsx:17](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/BrowserNotificationButton.jsx:17)

### ClinicAvailabilityCalendar — boundary

Definition: [src/components/shared/ClinicAvailabilityCalendar.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:1) · diagram tab 17.

- State: `service` — [src/components/shared/ClinicAvailabilityCalendar.jsx:127](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:127)
- State: `month` — [src/components/shared/ClinicAvailabilityCalendar.jsx:128](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:128)
- State: `selectedDate` — [src/components/shared/ClinicAvailabilityCalendar.jsx:129](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:129)
- State: `branchId` — [src/components/shared/ClinicAvailabilityCalendar.jsx:130](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:130)
- State: `veterinarianId` — [src/components/shared/ClinicAvailabilityCalendar.jsx:131](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:131)
- State: `availability` — [src/components/shared/ClinicAvailabilityCalendar.jsx:132](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:132)
- State: `isLoading` — [src/components/shared/ClinicAvailabilityCalendar.jsx:133](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:133)
- State: `errorMessage` — [src/components/shared/ClinicAvailabilityCalendar.jsx:134](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:134)
- `ClinicAvailabilityCalendar({…})` — [src/components/shared/ClinicAvailabilityCalendar.jsx:109](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ClinicAvailabilityCalendar.jsx:109)

### ConsentDocument — boundary

Definition: [src/components/shared/ConsentDocument.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentDocument.jsx:1) · diagram tab 31.


### ConsentTemplateEditor — boundary

Definition: [src/components/shared/ConsentTemplateEditor.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentTemplateEditor.jsx:1) · diagram tab 31.

- State: `open` — [src/components/shared/ConsentTemplateEditor.jsx:86](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentTemplateEditor.jsx:86)
- `ConsentTemplateEditor({…})` — [src/components/shared/ConsentTemplateEditor.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentTemplateEditor.jsx:15)
- `ConsentCodeReference({…})` — [src/components/shared/ConsentTemplateEditor.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentTemplateEditor.jsx:85)

### ConsentTemplateText — boundary

Definition: [src/components/shared/ConsentTemplateText.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentTemplateText.jsx:1) · diagram tab 31.

- `ConsentTemplateText({…})` — [src/components/shared/ConsentTemplateText.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ConsentTemplateText.jsx:4)

### DashboardPageHeader — boundary

Definition: [src/components/shared/DashboardPageHeader.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/DashboardPageHeader.jsx:1) · diagram tab 12.

- `DashboardPageHeader({…})` — [src/components/shared/DashboardPageHeader.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/DashboardPageHeader.jsx:18)

### EditPetInformationDialog — boundary

Definition: [src/components/shared/EditPetInformationDialog.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:1) · diagram tab 19.

- State: `pet` — [src/components/shared/EditPetInformationDialog.jsx:25](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:25)
- State: `draft` — [src/components/shared/EditPetInformationDialog.jsx:26](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:26)
- State: `dirty` — [src/components/shared/EditPetInformationDialog.jsx:27](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:27)
- State: `busy` — [src/components/shared/EditPetInformationDialog.jsx:28](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:28)
- State: `error` — [src/components/shared/EditPetInformationDialog.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:29)
- `EditPetInformationDialog({…})` — [src/components/shared/EditPetInformationDialog.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/EditPetInformationDialog.jsx:23)

### FileUploadDropzone — boundary

Definition: [src/components/shared/FileUploadDropzone.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/FileUploadDropzone.jsx:1) · diagram tab 41.

- `FileUploadDropzone({…})` — [src/components/shared/FileUploadDropzone.jsx:70](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/FileUploadDropzone.jsx:70)

### GoogleAccountLinkControl — boundary

Definition: [src/components/shared/GoogleAccountLinkControl.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleAccountLinkControl.jsx:1) · diagram tab 13.

- State: `connection` — [src/components/shared/GoogleAccountLinkControl.jsx:19](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleAccountLinkControl.jsx:19)
- State: `isLoading` — [src/components/shared/GoogleAccountLinkControl.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleAccountLinkControl.jsx:20)
- State: `isDialogOpen` — [src/components/shared/GoogleAccountLinkControl.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleAccountLinkControl.jsx:21)
- State: `loadError` — [src/components/shared/GoogleAccountLinkControl.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleAccountLinkControl.jsx:22)
- `GoogleAccountLinkControl()` — [src/components/shared/GoogleAccountLinkControl.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleAccountLinkControl.jsx:18)

### GoogleContinueButton — boundary

Definition: [src/components/shared/GoogleContinueButton.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleContinueButton.jsx:1) · diagram tab 14.

- State: `isLoading` — [src/components/shared/GoogleContinueButton.jsx:106](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleContinueButton.jsx:106)
- State: `isSubmitting` — [src/components/shared/GoogleContinueButton.jsx:107](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleContinueButton.jsx:107)
- State: `errorMessage` — [src/components/shared/GoogleContinueButton.jsx:108](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleContinueButton.jsx:108)
- State: `loadAttempt` — [src/components/shared/GoogleContinueButton.jsx:109](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleContinueButton.jsx:109)
- `GoogleContinueButton({…})` — [src/components/shared/GoogleContinueButton.jsx:97](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GoogleContinueButton.jsx:97)

### GroomingWorkspace — boundary

Definition: [src/components/shared/GroomingWorkspace.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:1) · diagram tab 32.

- State: `viewer` — [src/components/shared/GroomingWorkspace.jsx:90](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:90)
- State: `viewer` — [src/components/shared/GroomingWorkspace.jsx:109](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:109)
- State: `previewUrl` — [src/components/shared/GroomingWorkspace.jsx:159](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:159)
- State: `record` — [src/components/shared/GroomingWorkspace.jsx:188](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:188)
- State: `details` — [src/components/shared/GroomingWorkspace.jsx:189](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:189)
- State: `performer` — [src/components/shared/GroomingWorkspace.jsx:190](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:190)
- State: `dirty` — [src/components/shared/GroomingWorkspace.jsx:191](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:191)
- State: `autoSaving` — [src/components/shared/GroomingWorkspace.jsx:194](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:194)
- State: `autoSaveState` — [src/components/shared/GroomingWorkspace.jsx:196](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:196)
- State: `autoSaveRetry` — [src/components/shared/GroomingWorkspace.jsx:197](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:197)
- State: `busy` — [src/components/shared/GroomingWorkspace.jsx:200](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:200)
- State: `error` — [src/components/shared/GroomingWorkspace.jsx:202](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:202)
- State: `vetId` — [src/components/shared/GroomingWorkspace.jsx:203](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:203)
- State: `reason` — [src/components/shared/GroomingWorkspace.jsx:204](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:204)
- State: `outcome` — [src/components/shared/GroomingWorkspace.jsx:205](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:205)
- State: `reviewNotes` — [src/components/shared/GroomingWorkspace.jsx:206](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:206)
- State: `confinementPlan` — [src/components/shared/GroomingWorkspace.jsx:207](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:207)
- State: `photo` — [src/components/shared/GroomingWorkspace.jsx:208](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:208)
- State: `category` — [src/components/shared/GroomingWorkspace.jsx:210](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:210)
- State: `share` — [src/components/shared/GroomingWorkspace.jsx:211](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:211)
- State: `catalogSearch` — [src/components/shared/GroomingWorkspace.jsx:212](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:212)
- State: `showVetHandoff` — [src/components/shared/GroomingWorkspace.jsx:213](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:213)
- State: `branchState` — [src/components/shared/GroomingWorkspace.jsx:769](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:769)
- State: `items` — [src/components/shared/GroomingWorkspace.jsx:770](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:770)
- State: `loading` — [src/components/shared/GroomingWorkspace.jsx:771](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:771)
- State: `error` — [src/components/shared/GroomingWorkspace.jsx:772](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:772)
- State: `selected` — [src/components/shared/GroomingWorkspace.jsx:773](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:773)
- State: `receivingId` — [src/components/shared/GroomingWorkspace.jsx:774](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:774)
- State: `search` — [src/components/shared/GroomingWorkspace.jsx:775](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:775)
- State: `groomingServices` — [src/components/shared/GroomingWorkspace.jsx:776](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:776)
- State: `catalogMessage` — [src/components/shared/GroomingWorkspace.jsx:777](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:777)
- `GroomingWorkspace({…})` — [src/components/shared/GroomingWorkspace.jsx:765](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/GroomingWorkspace.jsx:765)

### JaaSMeeting — boundary

Definition: [src/components/shared/JaaSMeeting.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/JaaSMeeting.jsx:1) · diagram tab 28.

- State: `loadAttempt` — [src/components/shared/JaaSMeeting.jsx:134](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/JaaSMeeting.jsx:134)
- State: `status` — [src/components/shared/JaaSMeeting.jsx:135](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/JaaSMeeting.jsx:135)
- State: `errorMessage` — [src/components/shared/JaaSMeeting.jsx:136](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/JaaSMeeting.jsx:136)

### NotificationBell — boundary

Definition: [src/components/shared/NotificationBell.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationBell.jsx:1) · diagram tab 38.

- State: `isOpen` — [src/components/shared/NotificationBell.jsx:28](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationBell.jsx:28)
- `NotificationBell({…})` — [src/components/shared/NotificationBell.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationBell.jsx:18)

### NotificationFeed — boundary

Definition: [src/components/shared/NotificationFeed.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationFeed.jsx:1) · diagram tab 38.

- `NotificationFeed({…})` — [src/components/shared/NotificationFeed.jsx:33](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationFeed.jsx:33)

### NotificationPreferencesCard — boundary

Definition: [src/components/shared/NotificationPreferencesCard.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:1) · diagram tab 38.

- State: `preferences` — [src/components/shared/NotificationPreferencesCard.jsx:154](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:154)
- State: `isLoading` — [src/components/shared/NotificationPreferencesCard.jsx:155](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:155)
- State: `isSaving` — [src/components/shared/NotificationPreferencesCard.jsx:156](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:156)
- State: `saveStatus` — [src/components/shared/NotificationPreferencesCard.jsx:157](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:157)
- State: `isPushUpdating` — [src/components/shared/NotificationPreferencesCard.jsx:158](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:158)
- State: `loadError` — [src/components/shared/NotificationPreferencesCard.jsx:159](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:159)
- State: `browserPushState` — [src/components/shared/NotificationPreferencesCard.jsx:160](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:160)
- `NotificationPreferencesCard({…})` — [src/components/shared/NotificationPreferencesCard.jsx:149](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationPreferencesCard.jsx:149)

### NotificationsPage — boundary

Definition: [src/components/shared/NotificationsPage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationsPage.jsx:1) · diagram tab 38.

- `NotificationsPage({…})` — [src/components/shared/NotificationsPage.jsx:12](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/NotificationsPage.jsx:12)

### PasswordChangeCard — boundary

Definition: [src/components/shared/PasswordChangeCard.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordChangeCard.jsx:1) · diagram tab 14.

- State: `form` — [src/components/shared/PasswordChangeCard.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordChangeCard.jsx:23)
- State: `isSaving` — [src/components/shared/PasswordChangeCard.jsx:28](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordChangeCard.jsx:28)
- State: `isForgotPasswordDialogOpen` — [src/components/shared/PasswordChangeCard.jsx:29](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordChangeCard.jsx:29)
- `PasswordChangeCard({…})` — [src/components/shared/PasswordChangeCard.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordChangeCard.jsx:22)

### PasswordInput — boundary

Definition: [src/components/shared/PasswordInput.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordInput.jsx:1) · diagram tab 14.

- State: `showPassword` — [src/components/shared/PasswordInput.jsx:7](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordInput.jsx:7)
- `PasswordInput({…})` — [src/components/shared/PasswordInput.jsx:6](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordInput.jsx:6)

### PasswordRequirements — boundary

Definition: [src/components/shared/PasswordRequirements.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordRequirements.jsx:1) · diagram tab 14.

- `PasswordRequirements({…})` — [src/components/shared/PasswordRequirements.jsx:6](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PasswordRequirements.jsx:6)

### PetCatalogAutocomplete — boundary

Definition: [src/components/shared/PetCatalogAutocomplete.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCatalogAutocomplete.jsx:1) · diagram tab 19.

- State: `catalog` — [src/components/shared/PetCatalogAutocomplete.jsx:27](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCatalogAutocomplete.jsx:27)
- `PetSpeciesAutocomplete(props)` — [src/components/shared/PetCatalogAutocomplete.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCatalogAutocomplete.jsx:69)
- `PetBreedAutocomplete({…})` — [src/components/shared/PetCatalogAutocomplete.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCatalogAutocomplete.jsx:85)

### PetCertificateDialog — boundary

Definition: [src/components/shared/PetCertificateDialog.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCertificateDialog.jsx:1) · diagram tab 30.

- State: `isPrinting` — [src/components/shared/PetCertificateDialog.jsx:282](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCertificateDialog.jsx:282)
- `PetCertificateDialog({…})` — [src/components/shared/PetCertificateDialog.jsx:281](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetCertificateDialog.jsx:281)

### PetHotelRoomShowcase — boundary

Definition: [src/components/shared/PetHotelRoomShowcase.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:1) · diagram tab 33.

- State: `stays` — [src/components/shared/PetHotelRoomShowcase.jsx:483](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:483)
- State: `error` — [src/components/shared/PetHotelRoomShowcase.jsx:484](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:484)
- State: `selectedAssignmentId` — [src/components/shared/PetHotelRoomShowcase.jsx:485](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:485)
- State: `availability` — [src/components/shared/PetHotelRoomShowcase.jsx:547](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:547)
- State: `loading` — [src/components/shared/PetHotelRoomShowcase.jsx:548](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:548)
- State: `error` — [src/components/shared/PetHotelRoomShowcase.jsx:549](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:549)
- `PetHotelRoomIllustration({…})` — [src/components/shared/PetHotelRoomShowcase.jsx:200](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:200)
- `PetHotelRoomGrid({…})` — [src/components/shared/PetHotelRoomShowcase.jsx:260](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:260)
- `PetHotelOwnerRooms({…})` — [src/components/shared/PetHotelRoomShowcase.jsx:482](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:482)
- `PetHotelLandingRooms({…})` — [src/components/shared/PetHotelRoomShowcase.jsx:546](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PetHotelRoomShowcase.jsx:546)

### PrescriptionEditor — boundary

Definition: [src/components/shared/PrescriptionEditor.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionEditor.jsx:1) · diagram tab 29.

- `PrescriptionEditor({…})` — [src/components/shared/PrescriptionEditor.jsx:26](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionEditor.jsx:26)

### PrescriptionPlanPanel — boundary

Definition: [src/components/shared/PrescriptionPlanPanel.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:1) · diagram tab 29.

- State: `plans` — [src/components/shared/PrescriptionPlanPanel.jsx:78](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:78)
- State: `isLoading` — [src/components/shared/PrescriptionPlanPanel.jsx:79](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:79)
- State: `error` — [src/components/shared/PrescriptionPlanPanel.jsx:80](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:80)
- State: `startPlan` — [src/components/shared/PrescriptionPlanPanel.jsx:81](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:81)
- State: `selectedItemIds` — [src/components/shared/PrescriptionPlanPanel.jsx:82](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:82)
- State: `scheduleDrafts` — [src/components/shared/PrescriptionPlanPanel.jsx:83](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:83)
- State: `startedPlanId` — [src/components/shared/PrescriptionPlanPanel.jsx:84](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:84)
- State: `amendPlan` — [src/components/shared/PrescriptionPlanPanel.jsx:85](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:85)
- State: `amendItems` — [src/components/shared/PrescriptionPlanPanel.jsx:86](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:86)
- State: `amendDraft` — [src/components/shared/PrescriptionPlanPanel.jsx:87](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:87)
- State: `editingAmendId` — [src/components/shared/PrescriptionPlanPanel.jsx:88](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:88)
- State: `isSaving` — [src/components/shared/PrescriptionPlanPanel.jsx:89](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:89)
- `PrescriptionPlanPanel({…})` — [src/components/shared/PrescriptionPlanPanel.jsx:69](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/PrescriptionPlanPanel.jsx:69)

### ProfileHistoryEditor — boundary

Definition: [src/components/shared/ProfileHistoryEditor.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProfileHistoryEditor.jsx:1) · diagram tab 16.

- `ProfileHistoryEditor({…})` — [src/components/shared/ProfileHistoryEditor.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProfileHistoryEditor.jsx:15)

### ProfileWorkspaceHeader — boundary

Definition: [src/components/shared/ProfileWorkspaceHeader.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProfileWorkspaceHeader.jsx:1) · diagram tab 16.

- `ProfileWorkspaceHeader({…})` — [src/components/shared/ProfileWorkspaceHeader.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProfileWorkspaceHeader.jsx:22)

### ProtectedImage — boundary

Definition: [src/components/shared/ProtectedImage.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProtectedImage.jsx:1) · diagram tab 41.

- State: `displaySrc` — [src/components/shared/ProtectedImage.jsx:14](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProtectedImage.jsx:14)
- State: `failedSrc` — [src/components/shared/ProtectedImage.jsx:15](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProtectedImage.jsx:15)
- `ProtectedImage({…})` — [src/components/shared/ProtectedImage.jsx:5](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ProtectedImage.jsx:5)

### RegistrationTermsPreview — boundary

Definition: [src/components/shared/RegistrationTermsPreview.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/RegistrationTermsPreview.jsx:1) · diagram tab 14.

- `RegistrationTermsPreview()` — [src/components/shared/RegistrationTermsPreview.jsx:1243](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/RegistrationTermsPreview.jsx:1243)

### ServicePetPeek — boundary

Definition: [src/components/shared/ServicePetPeek.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ServicePetPeek.jsx:1) · diagram tab 20.

- `ServicePetPeek({…})` — [src/components/shared/ServicePetPeek.jsx:3](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ServicePetPeek.jsx:3)

### StaffActivityHistory — boundary

Definition: [src/components/shared/StaffActivityHistory.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:1) · diagram tab 40.

- State: `rows` — [src/components/shared/StaffActivityHistory.jsx:192](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:192)
- State: `hasMore` — [src/components/shared/StaffActivityHistory.jsx:193](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:193)
- State: `loading` — [src/components/shared/StaffActivityHistory.jsx:194](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:194)
- State: `error` — [src/components/shared/StaffActivityHistory.jsx:195](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:195)
- State: `options` — [src/components/shared/StaffActivityHistory.jsx:196](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:196)
- State: `offset` — [src/components/shared/StaffActivityHistory.jsx:197](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:197)
- State: `userId` — [src/components/shared/StaffActivityHistory.jsx:198](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:198)
- State: `role` — [src/components/shared/StaffActivityHistory.jsx:199](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:199)
- State: `branchId` — [src/components/shared/StaffActivityHistory.jsx:200](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:200)
- State: `module` — [src/components/shared/StaffActivityHistory.jsx:201](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:201)
- State: `timeRange` — [src/components/shared/StaffActivityHistory.jsx:202](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:202)
- `StaffActivityHistory({…})` — [src/components/shared/StaffActivityHistory.jsx:190](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/StaffActivityHistory.jsx:190)

### SubmissionStatus — boundary

Definition: [src/components/shared/SubmissionStatus.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/SubmissionStatus.jsx:1) · diagram tab 12.

- State: `isSlow` — [src/components/shared/SubmissionStatus.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/SubmissionStatus.jsx:23)
- `SubmissionStatus({…})` — [src/components/shared/SubmissionStatus.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/SubmissionStatus.jsx:4)

### TablePagination — boundary

Definition: [src/components/shared/TablePagination.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/TablePagination.jsx:1) · diagram tab 12.

- `TablePagination({…})` — [src/components/shared/TablePagination.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/TablePagination.jsx:20)

### ThemeToggle — boundary

Definition: [src/components/shared/ThemeToggle.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ThemeToggle.jsx:1) · diagram tab 12.

- `ThemeToggle({…})` — [src/components/shared/ThemeToggle.jsx:12](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/ThemeToggle.jsx:12)

### UnsavedProfileChangesDialog — boundary

Definition: [src/components/shared/UnsavedProfileChangesDialog.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/UnsavedProfileChangesDialog.jsx:1) · diagram tab 16.

- `UnsavedProfileChangesDialog({…})` — [src/components/shared/UnsavedProfileChangesDialog.jsx:13](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/UnsavedProfileChangesDialog.jsx:13)

### UploadImagePreview — boundary

Definition: [src/components/shared/UploadImagePreview.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/UploadImagePreview.jsx:1) · diagram tab 41.

- State: `status` — [src/components/shared/UploadImagePreview.jsx:10](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/UploadImagePreview.jsx:10)
- `UploadImagePreview({…})` — [src/components/shared/UploadImagePreview.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/UploadImagePreview.jsx:4)

### VetBookingDayList — boundary

Definition: [src/components/shared/VetBookingDayList.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingDayList.jsx:1) · diagram tab 24.

- `VetBookingDayList({…})` — [src/components/shared/VetBookingDayList.jsx:6](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingDayList.jsx:6)

### VetBookingSchedulePanel — boundary

Definition: [src/components/shared/VetBookingSchedulePanel.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:1) · diagram tab 24.

- State: `schedule` — [src/components/shared/VetBookingSchedulePanel.jsx:19](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:19)
- State: `saved` — [src/components/shared/VetBookingSchedulePanel.jsx:20](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:20)
- State: `isLoading` — [src/components/shared/VetBookingSchedulePanel.jsx:21](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:21)
- State: `isEditing` — [src/components/shared/VetBookingSchedulePanel.jsx:22](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:22)
- State: `isSaving` — [src/components/shared/VetBookingSchedulePanel.jsx:23](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:23)
- State: `error` — [src/components/shared/VetBookingSchedulePanel.jsx:24](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:24)
- `VetBookingSchedulePanel({…})` — [src/components/shared/VetBookingSchedulePanel.jsx:18](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetBookingSchedulePanel.jsx:18)

### VetOnlineAvailabilityPanel — boundary

Definition: [src/components/shared/VetOnlineAvailabilityPanel.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:1) · diagram tab 28.

- State: `availability` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:33](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:33)
- State: `saved` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:34](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:34)
- State: `isLoading` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:35](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:35)
- State: `isEditing` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:36](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:36)
- State: `isSaving` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:37](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:37)
- State: `error` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:38](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:38)
- `VetOnlineAvailabilityPanel({…})` — [src/components/shared/VetOnlineAvailabilityPanel.jsx:32](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetOnlineAvailabilityPanel.jsx:32)

### VetPresenceDisplay — boundary

Definition: [src/components/shared/VetPresenceDisplay.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceDisplay.jsx:1) · diagram tab 17.

- `VetPresenceDisplay({…})` — [src/components/shared/VetPresenceDisplay.jsx:4](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceDisplay.jsx:4)

### VetPresenceSign — boundary

Definition: [src/components/shared/VetPresenceSign.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceSign.jsx:1) · diagram tab 17.

- State: `presence` — [src/components/shared/VetPresenceSign.jsx:10](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceSign.jsx:10)
- State: `error` — [src/components/shared/VetPresenceSign.jsx:11](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceSign.jsx:11)
- State: `saving` — [src/components/shared/VetPresenceSign.jsx:12](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceSign.jsx:12)
- `VetPresenceSign({…})` — [src/components/shared/VetPresenceSign.jsx:9](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/VetPresenceSign.jsx:9)

### profileUiStyles — boundary

Definition: [src/components/shared/profileUiStyles.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/profileUiStyles.js:1) · diagram tab 16.

- `profileInputClass(…)` — [src/components/shared/profileUiStyles.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/profileUiStyles.js:27)
- `profileLabelClass(…)` — [src/components/shared/profileUiStyles.js:31](C:/Users/Admin/WebstormProjects/untitled1/src/components/shared/profileUiStyles.js:31)

### ThemeProvider — boundary

Definition: [src/context/ThemeProvider.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/context/ThemeProvider.jsx:1) · diagram tab 12.

- State: `theme` — [src/context/ThemeProvider.jsx:7](C:/Users/Admin/WebstormProjects/untitled1/src/context/ThemeProvider.jsx:7)
- `ThemeProvider({…})` — [src/context/ThemeProvider.jsx:6](C:/Users/Admin/WebstormProjects/untitled1/src/context/ThemeProvider.jsx:6)

### ThemedMantineProvider — boundary

Definition: [src/context/ThemedMantineProvider.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/context/ThemedMantineProvider.jsx:1) · diagram tab 12.

- `ThemedMantineProvider({…})` — [src/context/ThemedMantineProvider.jsx:10](C:/Users/Admin/WebstormProjects/untitled1/src/context/ThemedMantineProvider.jsx:10)

### VideoCallProvider — boundary

Definition: [src/context/VideoCallProvider.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/context/VideoCallProvider.jsx:1) · diagram tab 28.

- State: `callState` — [src/context/VideoCallProvider.jsx:73](C:/Users/Admin/WebstormProjects/untitled1/src/context/VideoCallProvider.jsx:73)
- State: `dockRect` — [src/context/VideoCallProvider.jsx:167](C:/Users/Admin/WebstormProjects/untitled1/src/context/VideoCallProvider.jsx:167)
- `VideoCallProvider({…})` — [src/context/VideoCallProvider.jsx:72](C:/Users/Admin/WebstormProjects/untitled1/src/context/VideoCallProvider.jsx:72)
- `useVideoCall()` — [src/context/VideoCallProvider.jsx:154](C:/Users/Admin/WebstormProjects/untitled1/src/context/VideoCallProvider.jsx:154)

### App — boundary

Definition: [src/App.jsx:1](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:1) · diagram tab 14.

- State: `view` — [src/App.jsx:170](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:170)
- State: `currentUser` — [src/App.jsx:174](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:174)
- State: `registrationData` — [src/App.jsx:177](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:177)
- State: `registrationFlowKey` — [src/App.jsx:178](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:178)
- State: `pendingVerificationEmail` — [src/App.jsx:179](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:179)
- State: `forgotPasswordEmail` — [src/App.jsx:182](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:182)
- State: `serverStatus` — [src/App.jsx:183](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:183)
- State: `isCheckingServer` — [src/App.jsx:184](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:184)
- `App()` — [src/App.jsx:169](C:/Users/Admin/WebstormProjects/untitled1/src/App.jsx:169)

### ConnectOwnership — service

Definition: [src/services/ConnectOwnership.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:1) · diagram tab 19.

- `linkPetService(userId, sharableId)` — [src/services/ConnectOwnership.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:3)
- `fetchCoparentRequest(requestId)` — [src/services/ConnectOwnership.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:14)
- `decideCoparentRequest(requestId, action, note)` — [src/services/ConnectOwnership.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:22)
- `getUserPetsService(userId)` — [src/services/ConnectOwnership.js:28](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js:28)

### accountService — service

Definition: [src/services/accountService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:1) · diagram tab 15.

- `fetchAccounts()` — [src/services/accountService.js:4](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:4)
- `fetchVeterinarians()` — [src/services/accountService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:8)
- `createAccount(payload)` — [src/services/accountService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:12)
- `updateAccountStatus(userId, payload)` — [src/services/accountService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:16)
- `updatePersonnelAccountDetails(userId, payload)` — [src/services/accountService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:29)
- `deleteAccount(userId, payload)` — [src/services/accountService.js:36](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:36)
- `fetchPetOwnerAccounts()` — [src/services/accountService.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:46)
- `updatePetOwnerStatus(userId, payload)` — [src/services/accountService.js:56](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:56)
- `removePetOwnerOwnership(userId, petId)` — [src/services/accountService.js:63](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js:63)

### addPet — service

Definition: [src/services/addPet.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/addPet.js:1) · diagram tab 19.

- `addPetService(petData)` — [src/services/addPet.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/addPet.js:3)

### addressAutocomplete — service

Definition: [src/services/addressAutocomplete.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/addressAutocomplete.js:1) · diagram tab 11.

- `searchAddresses(query, signal)` — [src/services/addressAutocomplete.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/addressAutocomplete.js:29)
- `reverseGeocodeAddress(latitude, longitude, signal)` — [src/services/addressAutocomplete.js:64](C:/Users/Admin/WebstormProjects/untitled1/src/services/addressAutocomplete.js:64)
- `getAddressMapPreviewUrls(location)` — [src/services/addressAutocomplete.js:114](C:/Users/Admin/WebstormProjects/untitled1/src/services/addressAutocomplete.js:114)
- `getAddressMapPreviewUrl(location)` — [src/services/addressAutocomplete.js:145](C:/Users/Admin/WebstormProjects/untitled1/src/services/addressAutocomplete.js:145)

### adminFeatureAccessService — service

Definition: [src/services/adminFeatureAccessService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/adminFeatureAccessService.js:1) · diagram tab 15.

- `fetchAdminFeatureAccess(userId)` — [src/services/adminFeatureAccessService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/adminFeatureAccessService.js:3)
- `saveAdminFeatureAccess(userId, permissions)` — [src/services/adminFeatureAccessService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/adminFeatureAccessService.js:11)

### apiClient — service

Definition: [src/services/apiClient.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:1) · diagram tab 11.

- `getServerStatusSnapshot()` — [src/services/apiClient.js:207](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:207)
- `subscribeToServerStatus(listener)` — [src/services/apiClient.js:211](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:211)
- `reportServerUnavailable(error, details)` — [src/services/apiClient.js:224](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:224)
- `reportServerAvailable()` — [src/services/apiClient.js:237](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:237)
- `getApiUrl(path, {…})` — [src/services/apiClient.js:253](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:253)
- `getStoredApiUser()` — [src/services/apiClient.js:272](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:272)
- `getStoredAuthToken()` — [src/services/apiClient.js:284](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:284)
- `clearStoredAuthSession()` — [src/services/apiClient.js:292](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:292)
- `isStoredAuthTokenExpired()` — [src/services/apiClient.js:315](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:315)
- `expireStoredAuthSession(message, options)` — [src/services/apiClient.js:375](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:375)
- `readJsonResponse(response, fallback)` — [src/services/apiClient.js:439](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:439)
- `apiFetch(path, options)` — [src/services/apiClient.js:480](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:480)
- `apiRequest(path, options)` — [src/services/apiClient.js:676](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:676)
- `checkServerHealth(options)` — [src/services/apiClient.js:698](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:698)
- `jsonRequest(path, payload, options)` — [src/services/apiClient.js:730](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:730)
- `postJson(path, payload, options)` — [src/services/apiClient.js:737](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:737)
- `patchJson(path, payload, options)` — [src/services/apiClient.js:744](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:744)
- `deleteRequest(path, options)` — [src/services/apiClient.js:751](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:751)
- Actual class: `ApiError` extends `Error` — [src/services/apiClient.js:41](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:41)
  - `constructor(message, details)` — [src/services/apiClient.js:42](C:/Users/Admin/WebstormProjects/untitled1/src/services/apiClient.js:42)

### authEmail — service

Definition: [src/services/authEmail.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:1) · diagram tab 13.

- `verifyEmail(payload)` — [src/services/authEmail.js:10](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:10)
- `resendVerificationCode(payload)` — [src/services/authEmail.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:14)
- `requestPasswordReset(payload)` — [src/services/authEmail.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:18)
- `verifyPasswordResetCode(payload)` — [src/services/authEmail.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:22)
- `resetPasswordWithOtp(payload)` — [src/services/authEmail.js:26](C:/Users/Admin/WebstormProjects/untitled1/src/services/authEmail.js:26)

### boardingService — service

Definition: [src/services/boardingService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:1) · diagram tab 33.

- `fetchRoomAvailability(params)` — [src/services/boardingService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:3)
- `fetchBoardingRooms(params)` — [src/services/boardingService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:16)
- `fetchBoardingMonitoring(params)` — [src/services/boardingService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:20)
- `fetchOwnerBoardingStays()` — [src/services/boardingService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:24)
- `createBoardingRooms(payload)` — [src/services/boardingService.js:28](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:28)
- `updateBoardingRoom(payload)` — [src/services/boardingService.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:32)
- `assignBoardingRoom(bookingId, payload)` — [src/services/boardingService.js:36](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:36)
- `directBoardingCheckIn(payload)` — [src/services/boardingService.js:40](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:40)
- `checkInBoardingBooking(bookingId, payload)` — [src/services/boardingService.js:44](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:44)
- `checkOutBoardingBooking(bookingId, payload)` — [src/services/boardingService.js:48](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:48)
- `updateDesiredCheckOut(bookingId, payload)` — [src/services/boardingService.js:52](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:52)
- `createBoardingObservation(payload)` — [src/services/boardingService.js:56](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:56)
- `createBoardingTask(payload)` — [src/services/boardingService.js:60](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:60)
- `completeBoardingTask(taskId, payload)` — [src/services/boardingService.js:64](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:64)
- `fetchBoardingDocuments(params)` — [src/services/boardingService.js:68](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:68)
- `createBoardingDocument(payload)` — [src/services/boardingService.js:73](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:73)
- `fetchBoardingMaterials(params)` — [src/services/boardingService.js:77](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:77)
- `createBoardingMaterial(payload)` — [src/services/boardingService.js:82](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:82)
- `removeBoardingMaterial(usageId)` — [src/services/boardingService.js:86](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js:86)

### bookingAvailabilityService — service

Definition: [src/services/bookingAvailabilityService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingAvailabilityService.js:1) · diagram tab 22.

- `fetchBookingAvailability(params, options)` — [src/services/bookingAvailabilityService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingAvailabilityService.js:3)

### bookingService — service

Definition: [src/services/bookingService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:1) · diagram tab 22.

- `fetchBookings(options)` — [src/services/bookingService.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:14)
- `fetchVeterinarianBookings(options)` — [src/services/bookingService.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:18)
- `fetchBookingById(bookingId, options)` — [src/services/bookingService.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:22)
- `fetchBookingBillingContext(bookingId, options)` — [src/services/bookingService.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:27)
- `reviewBookingPayment(bookingId, payload, options)` — [src/services/bookingService.js:31](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:31)
- `postBookingPaymentRefund(bookingId, payload, options)` — [src/services/bookingService.js:35](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:35)
- `fetchUserBookings(userId, options)` — [src/services/bookingService.js:39](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:39)
- `createBooking(payload, options)` — [src/services/bookingService.js:43](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:43)
- `updateBookingStatus(bookingId, payload, options)` — [src/services/bookingService.js:49](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:49)
- `updateBookingSchedule(bookingId, payload, options)` — [src/services/bookingService.js:53](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:53)
- `receiveBooking(bookingId, payload, options)` — [src/services/bookingService.js:58](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js:58)

### branchService — service

Definition: [src/services/branchService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:1) · diagram tab 17.

- `getVisibleBranchCode(branch)` — [src/services/branchService.js:13](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:13)
- `isVisibleBranch(branch)` — [src/services/branchService.js:51](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:51)
- `filterVisibleBranches(branches)` — [src/services/branchService.js:55](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:55)
- `normalizeVisibleBranchCode(branch, fallback)` — [src/services/branchService.js:59](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:59)
- `getBranchDisplayName(branches, branchId, fallback)` — [src/services/branchService.js:63](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:63)
- `fetchBranches({…})` — [src/services/branchService.js:72](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:72)
- `fetchVeterinarianBranchSchedules(params)` — [src/services/branchService.js:90](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:90)
- `saveVeterinarianBranchSchedule(payload)` — [src/services/branchService.js:108](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:108)
- `relocateBooking(bookingId, payload)` — [src/services/branchService.js:114](C:/Users/Admin/WebstormProjects/untitled1/src/services/branchService.js:114)

### clinicalIntakeService — service

Definition: [src/services/clinicalIntakeService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js:1) · diagram tab 25.

- `fetchClinicalIntakes(params, options)` — [src/services/clinicalIntakeService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js:3)
- `startClinicalIntake(payload, options)` — [src/services/clinicalIntakeService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js:12)
- `saveClinicalIntake(payload, options)` — [src/services/clinicalIntakeService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/clinicalIntakeService.js:16)

### consentDocumentPdf — service

Definition: [src/services/consentDocumentPdf.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentDocumentPdf.js:1) · diagram tab 31.

- `createConsentDocumentPdfBlob({…})` — [src/services/consentDocumentPdf.js:212](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentDocumentPdf.js:212)
- `createConsentDocumentPdfFile(payload, fileNamePrefix)` — [src/services/consentDocumentPdf.js:359](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentDocumentPdf.js:359)
- `createAndUploadConsentDocumentPdf(payload, fileNamePrefix, options)` — [src/services/consentDocumentPdf.js:368](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentDocumentPdf.js:368)

### consentFileService — service

Definition: [src/services/consentFileService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:1) · diagram tab 31.

- `fetchConsentFiles()` — [src/services/consentFileService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:3)
- `createConsentFile(formData)` — [src/services/consentFileService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:7)
- `updateConsentFile(fileId, payload)` — [src/services/consentFileService.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:14)
- `deleteConsentFile(fileId)` — [src/services/consentFileService.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentFileService.js:18)

### consentRecordService — service

Definition: [src/services/consentRecordService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentRecordService.js:1) · diagram tab 31.

- `saveConsentFormRecord(payload, options)` — [src/services/consentRecordService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/consentRecordService.js:3)

### findPet — service

Definition: [src/services/findPet.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/findPet.js:1) · diagram tab 19.

- `findPetService(petId)` — [src/services/findPet.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/findPet.js:8)

### googleAuthService — service

Definition: [src/services/googleAuthService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:1) · diagram tab 13.

- `authenticateWithGoogle(credential)` — [src/services/googleAuthService.js:5](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:5)
- `completeGoogleRegistration(payload)` — [src/services/googleAuthService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:12)
- `getGoogleConnectionStatus(options)` — [src/services/googleAuthService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:19)
- `connectGoogleAccount(credential)` — [src/services/googleAuthService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:23)
- `resetGoogleIdentitySession()` — [src/services/googleAuthService.js:30](C:/Users/Admin/WebstormProjects/untitled1/src/services/googleAuthService.js:30)

### groomingService — service

Definition: [src/services/groomingService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:1) · diagram tab 32.

- `fetchGroomingJobs(reviewsOnly)` — [src/services/groomingService.js:5](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:5)
- `fetchGroomingJob(id)` — [src/services/groomingService.js:6](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:6)
- `updateGroomingJob(payload)` — [src/services/groomingService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:7)
- `uploadGroomingPhoto(file, fields)` — [src/services/groomingService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js:8)

### inventoryApi — service

Definition: [src/services/inventoryApi.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:1) · diagram tab 34.

- `getCurrentUser()` — [src/services/inventoryApi.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:18)
- `fetchInventoryMeta(params)` — [src/services/inventoryApi.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:22)
- `fetchInventoryItems(params)` — [src/services/inventoryApi.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:27)
- `createInventoryItem(payload)` — [src/services/inventoryApi.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:32)
- `updateInventoryItem(payload)` — [src/services/inventoryApi.js:39](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:39)
- `createStockReceipt(payload)` — [src/services/inventoryApi.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:46)
- `createStockOut(payload)` — [src/services/inventoryApi.js:53](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:53)
- `transferInventoryStock(payload)` — [src/services/inventoryApi.js:60](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:60)
- `deleteInventoryItem(payload)` — [src/services/inventoryApi.js:67](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:67)
- `uploadInventoryFile(file, type)` — [src/services/inventoryApi.js:81](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js:81)

### notificationService — service

Definition: [src/services/notificationService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:1) · diagram tab 38.

- `fetchNotifications(userId, options)` — [src/services/notificationService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:7)
- `markNotificationRead(notificationId, userId)` — [src/services/notificationService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:19)
- `markAllNotificationsRead(userId)` — [src/services/notificationService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:23)
- `fetchNotificationPreferences(userId, options)` — [src/services/notificationService.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:27)
- `saveNotificationPreferences(userId, preferences)` — [src/services/notificationService.js:34](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:34)
- `fetchNotificationPushPublicKey(options)` — [src/services/notificationService.js:41](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:41)
- `fetchNotificationPushStatus(userId, options)` — [src/services/notificationService.js:48](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:48)
- `saveNotificationPushSubscription(userId, subscription)` — [src/services/notificationService.js:55](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:55)
- `disableNotificationPushSubscription(userId, endpoint)` — [src/services/notificationService.js:63](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:63)
- `runNotificationReminders(payload, options)` — [src/services/notificationService.js:70](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js:70)

### onlineConsultationService — service

Definition: [src/services/onlineConsultationService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:1) · diagram tab 28.

- `fetchOnlineConsultations(params)` — [src/services/onlineConsultationService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:3)
- `fetchOnlineConsultation(onlineConsultationId)` — [src/services/onlineConsultationService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:8)
- `startOnlineConsultation(onlineConsultationId)` — [src/services/onlineConsultationService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:12)
- `joinOnlineConsultation(onlineConsultationId)` — [src/services/onlineConsultationService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:16)
- `endOnlineConsultation(onlineConsultationId)` — [src/services/onlineConsultationService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:20)
- `submitOnlineConsultationDiagnosis(onlineConsultationId, payload)` — [src/services/onlineConsultationService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js:24)

### paymentMethodService — service

Definition: [src/services/paymentMethodService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js:1) · diagram tab 36.

- `fetchPaymentMethods(params, options)` — [src/services/paymentMethodService.js:15](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js:15)
- `requestPaymentMethodsOtp(payload)` — [src/services/paymentMethodService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js:19)
- `updatePaymentMethods(payload)` — [src/services/paymentMethodService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js:23)

### petCatalogService — service

Definition: [src/services/petCatalogService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCatalogService.js:1) · diagram tab 19.

- `fetchPetCatalog()` — [src/services/petCatalogService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCatalogService.js:3)

### petCertificateService — service

Definition: [src/services/petCertificateService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js:1) · diagram tab 30.

- `fetchPetCertificates(petId, options)` — [src/services/petCertificateService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js:3)
- `issuePetMedicalCertificate(petId, payload)` — [src/services/petCertificateService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js:12)
- `markPetMedicalCertificateViewed(petId, certificateId)` — [src/services/petCertificateService.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/petCertificateService.js:22)

### petMediaMonitoringService — service

Definition: [src/services/petMediaMonitoringService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/petMediaMonitoringService.js:1) · diagram tab 41.

- `fetchPetMediaMonitoring(params, options)` — [src/services/petMediaMonitoringService.js:15](C:/Users/Admin/WebstormProjects/untitled1/src/services/petMediaMonitoringService.js:15)

### petService — service

Definition: [src/services/petService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:1) · diagram tab 20.

- `fetchUserPets(userId)` — [src/services/petService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:3)
- `fetchAllPets(options)` — [src/services/petService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:7)
- `searchPetDirectory(query, options)` — [src/services/petService.js:15](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:15)
- `fetchPetDetails(petId)` — [src/services/petService.js:25](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:25)
- `updatePetDetails(petId, payload)` — [src/services/petService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:29)
- `updatePetStatus(petId, payload)` — [src/services/petService.js:33](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:33)
- `fetchPetQueues(petId)` — [src/services/petService.js:37](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:37)
- `fetchPetBookings(petId)` — [src/services/petService.js:41](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:41)
- `cancelPetOverdueActivity(petId)` — [src/services/petService.js:45](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:45)
- `fetchPetMedicalRecords(petId, options)` — [src/services/petService.js:49](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:49)
- `emailPetMedicalRecords(petId)` — [src/services/petService.js:54](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:54)
- `savePetMedicalRecord(petId, payload)` — [src/services/petService.js:58](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:58)
- `createPetMedicalRecordGroup(petId, payload)` — [src/services/petService.js:62](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:62)
- `updatePetMedicalRecordGroup(petId, payload)` — [src/services/petService.js:66](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:66)
- `deletePetMedicalRecordGroup(petId, groupId, payload)` — [src/services/petService.js:70](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:70)
- `addPetMedicalRecordGroupItem(petId, payload)` — [src/services/petService.js:74](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:74)
- `updatePetMedicalRecordGroupItem(petId, payload)` — [src/services/petService.js:78](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:78)
- `removePetMedicalRecordGroupItem(petId, itemId, payload)` — [src/services/petService.js:82](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js:82)

### prescriptionDocumentPdf — service

Definition: [src/services/prescriptionDocumentPdf.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionDocumentPdf.js:1) · diagram tab 29.

- `createPrescriptionDocumentPdfBlob(input)` — [src/services/prescriptionDocumentPdf.js:283](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionDocumentPdf.js:283)
- `createPrescriptionDocumentPdfFile(payload)` — [src/services/prescriptionDocumentPdf.js:309](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionDocumentPdf.js:309)

### prescriptionService — service

Definition: [src/services/prescriptionService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:1) · diagram tab 29.

- `fetchPrescriptions(params, options)` — [src/services/prescriptionService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:3)
- `startPrescriptionPlan(planId, payload, options)` — [src/services/prescriptionService.js:14](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:14)
- `amendPrescriptionPlan(planId, payload, options)` — [src/services/prescriptionService.js:18](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:18)
- `updatePrescriptionOccurrence(occurrenceId, payload, options)` — [src/services/prescriptionService.js:22](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js:22)

### problemReportService — service

Definition: [src/services/problemReportService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/problemReportService.js:1) · diagram tab 11.

- `sendMaintenanceProblemReport(serverStatus)` — [src/services/problemReportService.js:77](C:/Users/Admin/WebstormProjects/untitled1/src/services/problemReportService.js:77)

### profileService — service

Definition: [src/services/profileService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js:1) · diagram tab 15.

- `fetchProfile({…})` — [src/services/profileService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js:3)
- `updateProfile({…})` — [src/services/profileService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js:12)

### pushNotificationService — service

Definition: [src/services/pushNotificationService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:1) · diagram tab 38.

- `syncPushContext(userId, {…})` — [src/services/pushNotificationService.js:133](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:133)
- `clearPushContext()` — [src/services/pushNotificationService.js:165](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:165)
- `getBrowserPushState(userId)` — [src/services/pushNotificationService.js:179](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:179)
- `enableBrowserPush(userId)` — [src/services/pushNotificationService.js:234](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:234)
- `disableBrowserPush(userId)` — [src/services/pushNotificationService.js:309](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:309)
- `setBrowserPushEnabledForAccount(userId, enabled, currentPreferences)` — [src/services/pushNotificationService.js:340](C:/Users/Admin/WebstormProjects/untitled1/src/services/pushNotificationService.js:340)

### queueService — service

Definition: [src/services/queueService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:1) · diagram tab 25.

- `fetchQueues()` — [src/services/queueService.js:4](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:4)
- `fetchQueuePets()` — [src/services/queueService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:8)
- `addQueueItem(payload, options)` — [src/services/queueService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:12)
- `updateQueueStatus(payload, options)` — [src/services/queueService.js:17](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:17)
- `assignQueueToVeterinarian(payload)` — [src/services/queueService.js:21](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:21)
- `receiveQueue(payload)` — [src/services/queueService.js:25](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:25)
- `returnQueue(payload)` — [src/services/queueService.js:29](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:29)
- `reenterQueue(payload)` — [src/services/queueService.js:33](C:/Users/Admin/WebstormProjects/untitled1/src/services/queueService.js:33)

### recordUpdateRequestService — service

Definition: [src/services/recordUpdateRequestService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js:1) · diagram tab 30.

- `fetchRecordUpdateRequests(params)` — [src/services/recordUpdateRequestService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js:16)
- `createRecordUpdateRequest(payload)` — [src/services/recordUpdateRequestService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js:20)
- `updateRecordUpdateRequest(requestId, payload)` — [src/services/recordUpdateRequestService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js:24)

### registerUser — service

Definition: [src/services/registerUser.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/registerUser.js:1) · diagram tab 13.

- `registerUser(payload)` — [src/services/registerUser.js:4](C:/Users/Admin/WebstormProjects/untitled1/src/services/registerUser.js:4)

### reportService — service

Definition: [src/services/reportService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:1) · diagram tab 39.

- `fetchReportsDashboard(params, options)` — [src/services/reportService.js:41](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:41)
- `generateReport(payload, options)` — [src/services/reportService.js:46](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js:46)

### selfServiceService — service

Definition: [src/services/selfServiceService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/selfServiceService.js:1) · diagram tab 25.

- `fetchPublicWanIp()` — [src/services/selfServiceService.js:4](C:/Users/Admin/WebstormProjects/untitled1/src/services/selfServiceService.js:4)
- `checkSelfServiceAccess(publicWanIp)` — [src/services/selfServiceService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/selfServiceService.js:19)

### serviceCatalogService — service

Definition: [src/services/serviceCatalogService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:1) · diagram tab 37.

- `fetchServiceCatalog({…})` — [src/services/serviceCatalogService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:3)
- `saveServiceCatalogItem(serviceId, payload)` — [src/services/serviceCatalogService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:8)
- `updateServiceCatalogMaterials(serviceId, payload)` — [src/services/serviceCatalogService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:16)
- `deactivateServiceCatalogItem(serviceId)` — [src/services/serviceCatalogService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:20)
- `deleteServiceCatalogItem(serviceId)` — [src/services/serviceCatalogService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:24)
- `fetchServiceDisplaySettings()` — [src/services/serviceCatalogService.js:28](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:28)
- `saveServiceDisplaySettings(config)` — [src/services/serviceCatalogService.js:32](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js:32)

### specialServicesService — service

Definition: [src/services/specialServicesService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js:1) · diagram tab 37.

- `fetchSpecialServices({…})` — [src/services/specialServicesService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js:3)
- `createSpecialService(payload)` — [src/services/specialServicesService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js:8)
- `updateSpecialService(specialServiceId, payload)` — [src/services/specialServicesService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/specialServicesService.js:12)

### staffActivityService — service

Definition: [src/services/staffActivityService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/staffActivityService.js:1) · diagram tab 39.

- `fetchStaffActivity({…})` — [src/services/staffActivityService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/staffActivityService.js:3)
- `fetchStaffActivityOptions()` — [src/services/staffActivityService.js:13](C:/Users/Admin/WebstormProjects/untitled1/src/services/staffActivityService.js:13)

### statusDisplayService — service

Definition: [src/services/statusDisplayService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/statusDisplayService.js:1) · diagram tab 11.

- `fetchStatusDisplay({…})` — [src/services/statusDisplayService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/statusDisplayService.js:8)

### systemBackupService — service

Definition: [src/services/systemBackupService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js:1) · diagram tab 42.

- `fetchSystemBackups(options)` — [src/services/systemBackupService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js:3)
- `downloadLocalSystemBackup({…})` — [src/services/systemBackupService.js:76](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js:76)

### todoService — service

Definition: [src/services/todoService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:1) · diagram tab 38.

- `fetchPetOwnerTodos(userId, params, options)` — [src/services/todoService.js:15](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:15)
- `createPetOwnerTodo(userId, payload, options)` — [src/services/todoService.js:19](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:19)
- `updatePetOwnerTodo(todoId, userId, payload, options)` — [src/services/todoService.js:23](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:23)
- `deletePetOwnerTodo(todoId, userId, options)` — [src/services/todoService.js:27](C:/Users/Admin/WebstormProjects/untitled1/src/services/todoService.js:27)

### uploadService — service

Definition: [src/services/uploadService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:1) · diagram tab 41.

- `uploadImageFile(file, type, options)` — [src/services/uploadService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:3)
- `uploadDocumentFile(file, type, options)` — [src/services/uploadService.js:17](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:17)
- `dataUrlToFile(dataUrl, fileName)` — [src/services/uploadService.js:50](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:50)
- `uploadDataUrlImage(dataUrl, type, fileNamePrefix, options)` — [src/services/uploadService.js:64](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:64)
- `uploadFormData(formData, options)` — [src/services/uploadService.js:79](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:79)
- `deleteUpload(payload)` — [src/services/uploadService.js:87](C:/Users/Admin/WebstormProjects/untitled1/src/services/uploadService.js:87)

### userLogin — service

Definition: [src/services/userLogin.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js:1) · diagram tab 13.

- `loginUser(payload)` — [src/services/userLogin.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js:16)
- Actual class: `LoginError` extends `Error` — [src/services/userLogin.js:4](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js:4)
  - `constructor(message, details)` — [src/services/userLogin.js:5](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js:5)

### userService — service

Definition: [src/services/userService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/userService.js:1) · diagram tab 15.

- `fetchUser(userId)` — [src/services/userService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/userService.js:3)
- `updateUser(userId, payload)` — [src/services/userService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/userService.js:7)
- `updateUserPassword(userId, payload)` — [src/services/userService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/userService.js:11)

### vetBookingScheduleService — service

Definition: [src/services/vetBookingScheduleService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js:1) · diagram tab 17.

- `fetchVetBookingSchedule(veterinarianId, params)` — [src/services/vetBookingScheduleService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js:3)
- `saveVetBookingSchedule(veterinarianId, payload)` — [src/services/vetBookingScheduleService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js:11)

### vetDiagnosisService — service

Definition: [src/services/vetDiagnosisService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js:1) · diagram tab 27.

- `fetchVetDiagnoses(params)` — [src/services/vetDiagnosisService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js:3)
- `fetchVetDiagnosis(diagnosisId)` — [src/services/vetDiagnosisService.js:11](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js:11)
- `createVetDiagnosis(payload)` — [src/services/vetDiagnosisService.js:15](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetDiagnosisService.js:15)

### vetPresenceService — service

Definition: [src/services/vetPresenceService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetPresenceService.js:1) · diagram tab 17.

- `fetchVetPresence()` — [src/services/vetPresenceService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetPresenceService.js:3)
- `updateVetPresence(isIn)` — [src/services/vetPresenceService.js:7](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetPresenceService.js:7)

### vetScheduleService — service

Definition: [src/services/vetScheduleService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js:1) · diagram tab 17.

- `fetchVetSchedules(userId)` — [src/services/vetScheduleService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js:3)
- `updateVetSchedules(payload)` — [src/services/vetScheduleService.js:8](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js:8)

### visitBillingService — service

Definition: [src/services/visitBillingService.js:1](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:1) · diagram tab 36.

- `fetchVisits(params)` — [src/services/visitBillingService.js:3](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:3)
- `createVisit(payload)` — [src/services/visitBillingService.js:12](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:12)
- `saveVisitCharges(visitId, payload)` — [src/services/visitBillingService.js:16](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:16)
- `postVisitPayment(visitId, payload)` — [src/services/visitBillingService.js:20](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:20)
- `postVisitRefund(visitId, payload)` — [src/services/visitBillingService.js:24](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js:24)

### account_google — backend

Definition: [php/account_google.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/account_google.php:1) · diagram tab 13.


### account_status_helpers — backend

Definition: [php/account_status_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/account_status_helpers.php:1) · diagram tab 15.

- `accountColumnExists()` — [php/account_status_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/account_status_helpers.php:3)
- `ensureAdminAccountStatusColumn()` — [php/account_status_helpers.php:21](C:/Users/Admin/WebstormProjects/untitled1/php/account_status_helpers.php:21)
- `accountRevokeAccessTokens()` — [php/account_status_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/account_status_helpers.php:26)

### add_booking — backend

Definition: [php/add_booking.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:1) · diagram tab 22.

- `tableExists()` — [php/add_booking.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:16)
- `columnExists()` — [php/add_booking.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:28)
- `jsonColumnValue()` — [php/add_booking.php:42](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:42)
- `specialServiceDateColumnsExist()` — [php/add_booking.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:57)
- `resolvePetId()` — [php/add_booking.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:64)
- `normalizePetIds()` — [php/add_booking.php:91](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:91)
- `isDeceasedPetStatus()` — [php/add_booking.php:114](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:114)
- `getDeceasedPetNames()` — [php/add_booking.php:120](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:120)
- `normalizeSpecies()` — [php/add_booking.php:144](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:144)
- `normalizeBookingTime()` — [php/add_booking.php:155](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:155)
- `getSpeciesPetLimit()` — [php/add_booking.php:176](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:176)
- `getRoomPetLimit()` — [php/add_booking.php:185](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:185)
- `getSpeciesLabel()` — [php/add_booking.php:195](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:195)
- `bookingServiceKey()` — [php/add_booking.php:205](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:205)
- `isBookingDateTimeInPast()` — [php/add_booking.php:218](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:218)
- `requestedBookingPetCount()` — [php/add_booking.php:232](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:232)
- `homeServiceActiveBookingCount()` — [php/add_booking.php:241](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:241)
- `homeServiceAfternoonPetCount()` — [php/add_booking.php:255](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:255)
- `getActiveBoardingConflict()` — [php/add_booking.php:296](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:296)
- `getOverlappingBoardingBookingConflict()` — [php/add_booking.php:341](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:341)
- `getSpecialServiceBookedPetCount()` — [php/add_booking.php:390](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:390)
- `isSpecialServiceDateAllowed()` — [php/add_booking.php:430](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:430)
- `getSpecialServiceDateRestrictionMessage()` — [php/add_booking.php:451](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:451)
- `hasVetSlotConflict()` — [php/add_booking.php:469](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:469)
- `normalizeSpecialServiceItemIds()` — [php/add_booking.php:502](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:502)
- `bookingOfficialCatalogPrice()` — [php/add_booking.php:527](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:527)
- `bookingStayDays()` — [php/add_booking.php:576](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:576)
- `bookingOfficialBoardingPrice()` — [php/add_booking.php:588](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:588)
- `bookingOfficialBoardingOverstayDailyRate()` — [php/add_booking.php:631](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:631)
- `bookingOfficialPrice()` — [php/add_booking.php:660](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:660)
- `bookingExactPriceFromLabel()` — [php/add_booking.php:686](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:686)
- `bookingSpecialServicePrice()` — [php/add_booking.php:719](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:719)

### add_consent_file — backend

Definition: [php/add_consent_file.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_consent_file.php:1) · diagram tab 31.


### add_pet — backend

Definition: [php/add_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_pet.php:1) · diagram tab 19.


### add_to_queue — backend

Definition: [php/add_to_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:1) · diagram tab 25.

- `getEnvValue()` — [php/add_to_queue.php:12](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:12)
- `getClientIpAddress()` — [php/add_to_queue.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:20)
- `getPublicIpForRestriction()` — [php/add_to_queue.php:38](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:38)
- `ipMatchesRule()` — [php/add_to_queue.php:53](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:53)
- `isIpAllowedForSelfService()` — [php/add_to_queue.php:78](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:78)
- `queueActiveBookingsForPet()` — [php/add_to_queue.php:91](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:91)
- `queueActiveBookingSummary()` — [php/add_to_queue.php:126](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:126)
- `queueRespondWithActiveBookingConflict()` — [php/add_to_queue.php:140](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:140)

### admin_feature_access — backend

Definition: [php/admin_feature_access.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/admin_feature_access.php:1) · diagram tab 15.

- `admin_feature_access_error()` — [php/admin_feature_access.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/admin_feature_access.php:8)
- `admin_feature_access_require_schema()` — [php/admin_feature_access.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/admin_feature_access.php:15)
- `admin_feature_access_target()` — [php/admin_feature_access.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/admin_feature_access.php:26)
- `admin_feature_access_response()` — [php/admin_feature_access.php:44](C:/Users/Admin/WebstormProjects/untitled1/php/admin_feature_access.php:44)

### api_error_response — backend

Definition: [php/api_error_response.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:1) · diagram tab 11.

- `ipawcus_error_response_is_http()` — [php/api_error_response.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:11)
- `ipawcus_error_response_reference_id()` — [php/api_error_response.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:16)
- `ipawcus_error_response_request_context()` — [php/api_error_response.php:34](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:34)
- `ipawcus_error_response_log()` — [php/api_error_response.php:43](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:43)
- `ipawcus_error_response_log_throwable()` — [php/api_error_response.php:58](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:58)
- `ipawcus_error_response_public_message()` — [php/api_error_response.php:73](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:73)
- `ipawcus_error_response_contains_technical_details()` — [php/api_error_response.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:80)
- `ipawcus_error_response_is_list()` — [php/api_error_response.php:126](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:126)
- `ipawcus_error_response_is_error_key()` — [php/api_error_response.php:139](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:139)
- `ipawcus_error_response_is_private_diagnostic_key()` — [php/api_error_response.php:159](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:159)
- `ipawcus_error_response_log_value()` — [php/api_error_response.php:188](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:188)
- `ipawcus_error_response_sanitize_array()` — [php/api_error_response.php:196](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:196)
- `ipawcus_error_response_sanitize_payload()` — [php/api_error_response.php:242](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:242)
- `ipawcus_error_response_filter_json()` — [php/api_error_response.php:265](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:265)
- `ipawcus_error_response_is_binary_media_route()` — [php/api_error_response.php:370](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:370)
- `ipawcus_error_response_discard_own_buffer()` — [php/api_error_response.php:393](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:393)
- `ipawcus_error_response_rollback_transaction()` — [php/api_error_response.php:407](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:407)
- `ipawcus_error_response_emit_internal_error()` — [php/api_error_response.php:419](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:419)
- `ipawcus_error_response_handle_exception()` — [php/api_error_response.php:440](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:440)
- `ipawcus_error_response_handle_shutdown()` — [php/api_error_response.php:447](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:447)
- `ipawcus_error_response_bootstrap()` — [php/api_error_response.php:475](C:/Users/Admin/WebstormProjects/untitled1/php/api_error_response.php:475)

### assign_queue_vet — backend

Definition: [php/assign_queue_vet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/assign_queue_vet.php:1) · diagram tab 25.


### auth_access_helpers — backend

Definition: [php/auth_access_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:1) · diagram tab 13.

- `ipawcus_access_normalize_role()` — [php/auth_access_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:3)
- `ipawcus_access_ensure_schema()` — [php/auth_access_helpers.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:16)
- `ipawcus_access_token_hash()` — [php/auth_access_helpers.php:37](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:37)
- `ipawcus_create_access_token()` — [php/auth_access_helpers.php:42](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:42)
- `ipawcus_read_authorization_header()` — [php/auth_access_helpers.php:70](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:70)
- `ipawcus_request_access_token()` — [php/auth_access_helpers.php:90](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:90)
- `ipawcus_fetch_user_by_access_token()` — [php/auth_access_helpers.php:110](C:/Users/Admin/WebstormProjects/untitled1/php/auth_access_helpers.php:110)

### auth_forgot_password — backend

Definition: [php/auth_forgot_password.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_forgot_password.php:1) · diagram tab 13.


### auth_google — backend

Definition: [php/auth_google.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_google.php:1) · diagram tab 13.


### auth_google_complete — backend

Definition: [php/auth_google_complete.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_google_complete.php:1) · diagram tab 13.


### auth_otp_helpers — backend

Definition: [php/auth_otp_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:1) · diagram tab 13.

- `authOtpColumnExists()` — [php/auth_otp_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:10)
- `authOtpTableExists()` — [php/auth_otp_helpers.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:32)
- `authOtpRequireSchema()` — [php/auth_otp_helpers.php:52](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:52)
- `authOtpInput()` — [php/auth_otp_helpers.php:61](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:61)
- `authOtpNormalizeEmail()` — [php/auth_otp_helpers.php:68](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:68)
- `authOtpClientIp()` — [php/auth_otp_helpers.php:73](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:73)
- `authOtpUserAgent()` — [php/auth_otp_helpers.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:80)
- `authOtpSecret()` — [php/auth_otp_helpers.php:87](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:87)
- `authOtpHash()` — [php/auth_otp_helpers.php:98](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:98)
- `authOtpGenerateCode()` — [php/auth_otp_helpers.php:103](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:103)
- `authOtpExpiresMinutes()` — [php/auth_otp_helpers.php:108](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:108)
- `authOtpFetchUserByEmail()` — [php/auth_otp_helpers.php:113](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:113)
- `authOtpDisplayName()` — [php/auth_otp_helpers.php:127](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:127)
- `authOtpInvalidateActive()` — [php/auth_otp_helpers.php:138](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:138)
- `authOtpCanSend()` — [php/auth_otp_helpers.php:151](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:151)
- `authOtpCreate()` — [php/auth_otp_helpers.php:175](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:175)
- `authOtpVerify()` — [php/auth_otp_helpers.php:208](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:208)
- `authOtpMarkUsed()` — [php/auth_otp_helpers.php:249](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:249)
- `authOtpIssueAndSend()` — [php/auth_otp_helpers.php:255](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:255)
- `authOtpSendCodeEmail()` — [php/auth_otp_helpers.php:271](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:271)
- `authOtpSendPasswordChangedEmail()` — [php/auth_otp_helpers.php:304](C:/Users/Admin/WebstormProjects/untitled1/php/auth_otp_helpers.php:304)

### auth_resend_verification — backend

Definition: [php/auth_resend_verification.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_resend_verification.php:1) · diagram tab 13.


### auth_reset_password — backend

Definition: [php/auth_reset_password.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_reset_password.php:1) · diagram tab 14.


### auth_verify_email — backend

Definition: [php/auth_verify_email.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_verify_email.php:1) · diagram tab 14.


### auth_verify_reset_code — backend

Definition: [php/auth_verify_reset_code.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_verify_reset_code.php:1) · diagram tab 14.


### boarding_management — backend

Definition: [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) · diagram tab 33.

- `boarding_table_exists()` — [php/boarding_management.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:19)
- `boarding_column_exists()` — [php/boarding_management.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:40)
- `boarding_calculate_overstay_daily_rate()` — [php/boarding_management.php:62](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:62)
- `boarding_calculate_overdue_days()` — [php/boarding_management.php:96](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:96)
- `boarding_index_exists()` — [php/boarding_management.php:116](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:116)
- `boarding_unique_index_matches()` — [php/boarding_management.php:137](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:137)
- `boarding_constraint_exists()` — [php/boarding_management.php:160](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:160)
- `boarding_current_actor()` — [php/boarding_management.php:181](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:181)
- `boarding_json_input()` — [php/boarding_management.php:224](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:224)
- `boarding_branch_id()` — [php/boarding_management.php:229](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:229)
- `boarding_assert_booking_branch_access()` — [php/boarding_management.php:245](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:245)
- `boarding_error()` — [php/boarding_management.php:253](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:253)
- `boarding_named_lock_acquire()` — [php/boarding_management.php:267](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:267)
- `boarding_named_lock_release()` — [php/boarding_management.php:277](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:277)
- `boarding_release_all_named_locks()` — [php/boarding_management.php:284](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:284)
- `boarding_internal_failure()` — [php/boarding_management.php:295](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:295)
- `require_boarding_tables()` — [php/boarding_management.php:309](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:309)
- `ensure_boarding_rooms_schema()` — [php/boarding_management.php:319](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:319)
- `normalize_room_type()` — [php/boarding_management.php:365](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:365)
- `split_room_type()` — [php/boarding_management.php:381](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:381)
- `room_type_label()` — [php/boarding_management.php:391](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:391)
- `normalize_room_type_input()` — [php/boarding_management.php:399](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:399)
- `boarding_count_stay_days()` — [php/boarding_management.php:414](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:414)
- `boarding_format_currency()` — [php/boarding_management.php:427](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:427)
- `get_room_capacity()` — [php/boarding_management.php:432](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:432)
- `get_maintenance_room_numbers()` — [php/boarding_management.php:440](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:440)
- `get_room_unit_status_map()` — [php/boarding_management.php:453](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:453)
- `get_unavailable_room_numbers()` — [php/boarding_management.php:469](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:469)
- `get_available_room_numbers()` — [php/boarding_management.php:487](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:487)
- `fetch_boarding_booking()` — [php/boarding_management.php:509](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:509)
- `fetch_active_assignment()` — [php/boarding_management.php:542](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:542)
- `fetch_latest_assignment()` — [php/boarding_management.php:563](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:563)
- `fetch_booking_pet_ids()` — [php/boarding_management.php:578](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:578)
- `boarding_requested_pet_id()` — [php/boarding_management.php:600](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:600)
- `boarding_resolve_assignment_pet_id()` — [php/boarding_management.php:615](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:615)
- `assert_pets_not_in_active_boarding()` — [php/boarding_management.php:639](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:639)
- `assert_pets_no_overlapping_boarding_booking()` — [php/boarding_management.php:695](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:695)
- `assignment_response()` — [php/boarding_management.php:752](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:752)
- `upsert_assignment()` — [php/boarding_management.php:831](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:831)
- `boarding_consent_candidate_path()` — [php/boarding_management.php:871](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:871)
- `boarding_consent_pdf_path()` — [php/boarding_management.php:887](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:887)
- `boarding_secure_database_now()` — [php/boarding_management.php:911](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:911)
- `boarding_secure_template_by_id()` — [php/boarding_management.php:917](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:917)
- `boarding_secure_selected_template()` — [php/boarding_management.php:932](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:932)
- `boarding_secure_consent_context()` — [php/boarding_management.php:950](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:950)
- `boarding_secure_path_references()` — [php/boarding_management.php:986](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:986)
- `boarding_secure_reference_scope_matches()` — [php/boarding_management.php:1015](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1015)
- `boarding_secure_assert_reference_scope()` — [php/boarding_management.php:1044](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1044)
- `boarding_secure_existing_template()` — [php/boarding_management.php:1054](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1054)
- `boarding_secure_existing_candidate()` — [php/boarding_management.php:1088](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1088)
- `boarding_secure_existing_consent()` — [php/boarding_management.php:1128](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1128)
- `boarding_secure_input_receipt()` — [php/boarding_management.php:1193](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1193)
- `boarding_secure_consent_payload()` — [php/boarding_management.php:1206](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1206)
- `boarding_secure_save_consent_records()` — [php/boarding_management.php:1294](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1294)
- `boarding_secure_preserved_forms()` — [php/boarding_management.php:1333](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1333)
- `boarding_secure_store_booking_consent()` — [php/boarding_management.php:1378](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1378)
- `assign_room_action()` — [php/boarding_management.php:1403](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1403)
- `check_in_action()` — [php/boarding_management.php:1491](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1491)
- `desired_check_out_action()` — [php/boarding_management.php:1598](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1598)
- `boarding_assert_checkout_billing_ready()` — [php/boarding_management.php:1683](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1683)
- `check_out_action()` — [php/boarding_management.php:1862](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1862)
- `get_active_assignments_by_room()` — [php/boarding_management.php:1930](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1930)
- `rooms_action()` — [php/boarding_management.php:1997](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1997)
- `resolve_boarding_pet_id()` — [php/boarding_management.php:2241](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2241)
- `boarding_direct_check_in_owner()` — [php/boarding_management.php:2264](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2264)
- `boarding_repair_direct_check_in_owner_link()` — [php/boarding_management.php:2313](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2313)
- `direct_check_in_action()` — [php/boarding_management.php:2342](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2342)
- `fetch_assignment_for_monitoring()` — [php/boarding_management.php:2571](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2571)
- `boarding_documents_schema_ready()` — [php/boarding_management.php:2645](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2645)
- `boarding_document_missing_message()` — [php/boarding_management.php:2650](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2650)
- `boarding_document_nullable_text()` — [php/boarding_management.php:2655](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2655)
- `boarding_optional_status()` — [php/boarding_management.php:2661](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2661)
- `boarding_optional_measurement()` — [php/boarding_management.php:2677](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2677)
- `boarding_optional_boolean()` — [php/boarding_management.php:2704](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2704)
- `boarding_normalize_document_path()` — [php/boarding_management.php:2723](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2723)
- `boarding_document_file_metadata()` — [php/boarding_management.php:2738](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2738)
- `boarding_cleanup_unstored_document()` — [php/boarding_management.php:2759](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2759)
- `boarding_fetch_document_subject()` — [php/boarding_management.php:2787](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2787)
- `boarding_format_document()` — [php/boarding_management.php:2853](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2853)
- `boarding_fetch_documents()` — [php/boarding_management.php:2876](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2876)
- `boarding_documents_action()` — [php/boarding_management.php:2924](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:2924)
- `boarding_monitoring_filters()` — [php/boarding_management.php:3022](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3022)
- `boarding_monitoring_scope()` — [php/boarding_management.php:3031](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3031)
- `boarding_monitoring_pagination()` — [php/boarding_management.php:3052](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3052)
- `monitoring_action()` — [php/boarding_management.php:3078](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3078)
- `owner_stays_action()` — [php/boarding_management.php:3227](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3227)
- `observation_action()` — [php/boarding_management.php:3404](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3404)
- `task_action()` — [php/boarding_management.php:3490](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3490)
- `boarding_materials_schema_ready()` — [php/boarding_management.php:3546](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3546)
- `boarding_material_billing_trace_ready()` — [php/boarding_management.php:3586](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3586)
- `boarding_materials_missing_message()` — [php/boarding_management.php:3595](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3595)
- `boarding_lock_visits_and_assert_materials_mutable()` — [php/boarding_management.php:3600](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3600)
- `boarding_format_material_usage()` — [php/boarding_management.php:3650](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3650)
- `boarding_fetch_material_usages()` — [php/boarding_management.php:3697](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3697)
- `boarding_materials_action()` — [php/boarding_management.php:3776](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:3776)
- `boarding_material_item_action()` — [php/boarding_management.php:4083](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:4083)
- `task_complete_action()` — [php/boarding_management.php:4185](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:4185)

### booking_availability — backend

Definition: [php/booking_availability.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:1) · diagram tab 22.

- `booking_availability_services()` — [php/booking_availability.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:14)
- `booking_availability_date()` — [php/booking_availability.php:31](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:31)
- `booking_availability_month()` — [php/booking_availability.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:39)
- `booking_availability_branch_service_key()` — [php/booking_availability.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:47)
- `booking_availability_hours()` — [php/booking_availability.php:56](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:56)
- `booking_availability_base_times()` — [php/booking_availability.php:101](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:101)
- `booking_availability_slots_for_date()` — [php/booking_availability.php:121](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:121)
- `booking_availability_room_configuration()` — [php/booking_availability.php:182](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:182)
- `booking_availability_boarding_reservations()` — [php/booking_availability.php:199](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:199)
- `booking_availability_rooms_for_date()` — [php/booking_availability.php:209](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:209)

### booking_billing_context — backend

Definition: [php/booking_billing_context.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_billing_context.php:1) · diagram tab 22.

- `booking_billing_context_error()` — [php/booking_billing_context.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/booking_billing_context.php:13)
- `booking_billing_context_table_exists()` — [php/booking_billing_context.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/booking_billing_context.php:20)
- `booking_billing_context_submission_amount()` — [php/booking_billing_context.php:33](C:/Users/Admin/WebstormProjects/untitled1/php/booking_billing_context.php:33)

### booking_daily_guard — backend

Definition: [php/booking_daily_guard.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:1) · diagram tab 22.

- `booking_daily_table_exists()` — [php/booking_daily_guard.php:12](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:12)
- `booking_daily_normalize_pet_ids()` — [php/booking_daily_guard.php:33](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:33)
- `booking_daily_normalize_pet_name()` — [php/booking_daily_guard.php:45](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:45)
- `booking_daily_pet_ids_for_booking()` — [php/booking_daily_guard.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:55)
- `booking_daily_lock_subjects()` — [php/booking_daily_guard.php:76](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:76)
- `booking_daily_find_conflict()` — [php/booking_daily_guard.php:114](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:114)
- `booking_daily_conflict_payload()` — [php/booking_daily_guard.php:199](C:/Users/Admin/WebstormProjects/untitled1/php/booking_daily_guard.php:199)

### booking_maintenance — backend

Definition: [php/booking_maintenance.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:1) · diagram tab 22.

- `maintenance_table_exists()` — [php/booking_maintenance.php:12](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:12)
- `maintenance_column_exists()` — [php/booking_maintenance.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:25)
- `maintenance_use_clinic_timezone()` — [php/booking_maintenance.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:39)
- `maintenance_today()` — [php/booking_maintenance.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:50)
- `maintenance_now()` — [php/booking_maintenance.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:57)
- `maintenance_date_add()` — [php/booking_maintenance.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:64)
- `maintenance_is_after()` — [php/booking_maintenance.php:71](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:71)
- `maintenance_append_note()` — [php/booking_maintenance.php:76](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:76)
- `maintenance_original_booking_date_from_notes()` — [php/booking_maintenance.php:88](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:88)
- `maintenance_booking_start_date()` — [php/booking_maintenance.php:97](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:97)
- `maintenance_booking_original_date()` — [php/booking_maintenance.php:118](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:118)
- `maintenance_append_original_booking_note_if_missing()` — [php/booking_maintenance.php:124](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:124)
- `maintenance_is_booking_reschedule_excluded()` — [php/booking_maintenance.php:138](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:138)
- `maintenance_is_booking_auto_cancel_eligible()` — [php/booking_maintenance.php:161](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:161)
- `maintenance_booking_reached_service()` — [php/booking_maintenance.php:180](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:180)
- `maintenance_return_active_queue_assignment()` — [php/booking_maintenance.php:232](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:232)
- `maintenance_cancel_queue()` — [php/booking_maintenance.php:249](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:249)
- `maintenance_fetch_expired_queue_ids()` — [php/booking_maintenance.php:295](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:295)
- `maintenance_cancel_expired_queues()` — [php/booking_maintenance.php:320](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:320)
- `maintenance_fetch_active_bookings()` — [php/booking_maintenance.php:374](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:374)
- `maintenance_cancel_booking()` — [php/booking_maintenance.php:405](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:405)
- `maintenance_auto_reschedule_booking()` — [php/booking_maintenance.php:454](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:454)
- `maintenance_process_bookings()` — [php/booking_maintenance.php:558](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:558)
- `runLifecycleMaintenance()` — [php/booking_maintenance.php:686](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:686)
- `autoCancelOverdueBookingsDetailed()` — [php/booking_maintenance.php:702](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:702)
- `autoCancelOverdueBookings()` — [php/booking_maintenance.php:714](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:714)
- `autoCancelStaleQueuesDetailed()` — [php/booking_maintenance.php:719](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:719)
- `autoCancelStaleQueues()` — [php/booking_maintenance.php:729](C:/Users/Admin/WebstormProjects/untitled1/php/booking_maintenance.php:729)

### booking_payment_helpers — backend

Definition: [php/booking_payment_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:1) · diagram tab 22.

- `booking_payment_table_exists()` — [php/booking_payment_helpers.php:4](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:4)
- `booking_payment_schema_ready()` — [php/booking_payment_helpers.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:24)
- `booking_payment_nullable_text()` — [php/booking_payment_helpers.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:29)
- `booking_payment_purpose()` — [php/booking_payment_helpers.php:35](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:35)
- `booking_payment_amount()` — [php/booking_payment_helpers.php:51](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:51)
- `booking_payment_record_submission()` — [php/booking_payment_helpers.php:60](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:60)
- `booking_payment_find_matching_visit_payment()` — [php/booking_payment_helpers.php:142](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:142)
- `booking_payment_find_visit_payment_by_credentials()` — [php/booking_payment_helpers.php:185](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:185)
- `booking_payment_conflict()` — [php/booking_payment_helpers.php:240](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:240)
- `booking_payment_assert_verification_credentials_unique()` — [php/booking_payment_helpers.php:252](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:252)
- `booking_payment_verify_for_booking()` — [php/booking_payment_helpers.php:320](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:320)
- `booking_payment_apply_verified_to_visit()` — [php/booking_payment_helpers.php:385](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_helpers.php:385)

### booking_payment_refund — backend

Definition: [php/booking_payment_refund.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_refund.php:1) · diagram tab 22.


### booking_payment_review — backend

Definition: [php/booking_payment_review.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_review.php:1) · diagram tab 23.


### booking_queue_helpers — backend

Definition: [php/booking_queue_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:1) · diagram tab 25.

- `queueTableColumns()` — [php/booking_queue_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:3)
- `bookingQueueMarker()` — [php/booking_queue_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:10)
- `bookingNumberFromQueueComplaint()` — [php/booking_queue_helpers.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:15)
- `bookingIdForQueue()` — [php/booking_queue_helpers.php:30](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:30)
- `bookingNotesHaveRescheduleTag()` — [php/booking_queue_helpers.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:49)
- `bookingNormalizeVisibleNotes()` — [php/booking_queue_helpers.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:57)
- `bookingStripLifecycleNotes()` — [php/booking_queue_helpers.php:70](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:70)
- `bookingCleanVisibleNotes()` — [php/booking_queue_helpers.php:90](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:90)
- `bookingTaggedNoteValue()` — [php/booking_queue_helpers.php:102](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:102)
- `bookingRemoveTaggedNotes()` — [php/booking_queue_helpers.php:119](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:119)
- `bookingOnlineConsultationNoteDetails()` — [php/booking_queue_helpers.php:136](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:136)
- `bookingMergeReviewNotesPreservingMetadata()` — [php/booking_queue_helpers.php:161](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:161)
- `cleanBookingQueueComplaint()` — [php/booking_queue_helpers.php:205](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:205)
- `buildBookingQueueComplaint()` — [php/booking_queue_helpers.php:220](C:/Users/Admin/WebstormProjects/untitled1/php/booking_queue_helpers.php:220)

### booking_slot_helpers — backend

Definition: [php/booking_slot_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:1) · diagram tab 23.

- `booking_slot_table_exists()` — [php/booking_slot_helpers.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:13)
- `booking_slot_service_key()` — [php/booking_slot_helpers.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:28)
- `booking_slot_duration_minutes()` — [php/booking_slot_helpers.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:55)
- `booking_slot_normalize_time()` — [php/booking_slot_helpers.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:64)
- `booking_slot_overlaps_lunch()` — [php/booking_slot_helpers.php:83](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:83)
- `booking_slot_assert_aligned()` — [php/booking_slot_helpers.php:95](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:95)
- `booking_slot_reserves_status()` — [php/booking_slot_helpers.php:122](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:122)
- `booking_slot_vet_schedule_rows()` — [php/booking_slot_helpers.php:127](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:127)
- `booking_slot_vet_times_for_date()` — [php/booking_slot_helpers.php:146](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:146)
- `booking_slot_online_vet_is_available()` — [php/booking_slot_helpers.php:170](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:170)
- `booking_slot_special_service_id_for_booking()` — [php/booking_slot_helpers.php:177](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:177)
- `booking_slot_fetch_reservations()` — [php/booking_slot_helpers.php:190](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:190)
- `booking_slot_record_matches_scope()` — [php/booking_slot_helpers.php:211](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:211)
- `booking_slot_records_find_conflict()` — [php/booking_slot_helpers.php:239](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:239)
- `booking_slot_find_conflict()` — [php/booking_slot_helpers.php:289](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:289)
- `booking_slot_lock_name()` — [php/booking_slot_helpers.php:321](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:321)
- `booking_slot_acquire()` — [php/booking_slot_helpers.php:348](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:348)
- `booking_slot_release()` — [php/booking_slot_helpers.php:359](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:359)
- `booking_slot_conflict_message()` — [php/booking_slot_helpers.php:375](C:/Users/Admin/WebstormProjects/untitled1/php/booking_slot_helpers.php:375)

### branch_helpers — backend

Definition: [php/branch_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:1) · diagram tab 17.

- `branch_table_exists()` — [php/branch_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:3)
- `branch_column_exists()` — [php/branch_helpers.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:16)
- `branch_schema_ready()` — [php/branch_helpers.php:30](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:30)
- `branch_visible_codes()` — [php/branch_helpers.php:38](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:38)
- `branch_is_visible()` — [php/branch_helpers.php:45](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:45)
- `branch_require_schema()` — [php/branch_helpers.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:50)
- `branch_normalize_role()` — [php/branch_helpers.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:64)
- `branch_main_id()` — [php/branch_helpers.php:74](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:74)
- `branch_service_key()` — [php/branch_helpers.php:91](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:91)
- `branch_fetch()` — [php/branch_helpers.php:119](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:119)
- `branch_user_ids()` — [php/branch_helpers.php:127](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:127)
- `branch_user_primary_id()` — [php/branch_helpers.php:187](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:187)
- `branch_user_can_access()` — [php/branch_helpers.php:193](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:193)
- `branch_admin_recipient_ids()` — [php/branch_helpers.php:211](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:211)
- `branch_active_veterinarian_ids()` — [php/branch_helpers.php:234](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:234)
- `branch_is_open()` — [php/branch_helpers.php:251](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:251)
- `branch_find_vet_visit()` — [php/branch_helpers.php:287](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:287)
- `branch_resolve_booking()` — [php/branch_helpers.php:326](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:326)
- `branch_fetch_catalog()` — [php/branch_helpers.php:380](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php:380)

### branches — backend

Definition: [php/branches.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/branches.php:1) · diagram tab 17.


### check_self_service_access — backend

Definition: [php/check_self_service_access.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:1) · diagram tab 25.

- `getEnvValue()` — [php/check_self_service_access.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:6)
- `getClientIpAddress()` — [php/check_self_service_access.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:14)
- `getPublicIpForRestriction()` — [php/check_self_service_access.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:32)
- `ipMatchesRule()` — [php/check_self_service_access.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:47)
- `isIpAllowedForSelfService()` — [php/check_self_service_access.php:75](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:75)

### clinic_booking_helpers — backend

Definition: [php/clinic_booking_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:1) · diagram tab 23.

- `clinic_booking_is_medical()` — [php/clinic_booking_helpers.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:6)
- `clinic_booking_schema_ready()` — [php/clinic_booking_helpers.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:11)
- `clinic_booking_require_schema()` — [php/clinic_booking_helpers.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:19)
- `clinic_booking_roster()` — [php/clinic_booking_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:26)
- `clinic_booking_online_schedules()` — [php/clinic_booking_helpers.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:55)
- `clinic_booking_online_veterinarians()` — [php/clinic_booking_helpers.php:66](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:66)
- `clinic_booking_online_times()` — [php/clinic_booking_helpers.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:80)
- `clinic_booking_online_slot_selected()` — [php/clinic_booking_helpers.php:98](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:98)
- `clinic_booking_reservations()` — [php/clinic_booking_helpers.php:113](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:113)
- `clinic_booking_interval()` — [php/clinic_booking_helpers.php:126](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:126)
- `clinic_booking_capacity_from_rows()` — [php/clinic_booking_helpers.php:136](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:136)
- `clinic_booking_capacity()` — [php/clinic_booking_helpers.php:198](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:198)
- `clinic_booking_reserve_vet()` — [php/clinic_booking_helpers.php:216](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php:216)

### clinical_confinement_helpers — backend

Definition: [php/clinical_confinement_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:1) · diagram tab 27.

- `clinical_confinement_column_exists()` — [php/clinical_confinement_helpers.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:5)
- `clinical_confinement_require_schema()` — [php/clinical_confinement_helpers.php:12](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:12)
- `clinical_confinement_text()` — [php/clinical_confinement_helpers.php:21](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:21)
- `clinical_confinement_date()` — [php/clinical_confinement_helpers.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:29)
- `clinical_confinement_service()` — [php/clinical_confinement_helpers.php:42](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:42)
- `clinical_confinement_stay_days()` — [php/clinical_confinement_helpers.php:65](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:65)
- `clinical_confinement_save()` — [php/clinical_confinement_helpers.php:76](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_confinement_helpers.php:76)

### clinical_intakes — backend

Definition: [php/clinical_intakes.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:1) · diagram tab 25.

- `clinical_intake_schema_ready()` — [php/clinical_intakes.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:10)
- `clinical_intake_require_schema()` — [php/clinical_intakes.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:15)
- `clinical_intake_nullable_int()` — [php/clinical_intakes.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:25)
- `clinical_intake_text()` — [php/clinical_intakes.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:32)
- `clinical_intake_json_array()` — [php/clinical_intakes.php:41](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:41)
- `clinical_intake_vital_signs()` — [php/clinical_intakes.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:50)
- `clinical_intake_attachments()` — [php/clinical_intakes.php:61](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:61)
- `clinical_intake_staff_position()` — [php/clinical_intakes.php:87](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:87)
- `clinical_intake_format()` — [php/clinical_intakes.php:98](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:98)
- `clinical_intake_fetch()` — [php/clinical_intakes.php:123](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:123)
- `clinical_intake_assert_branch_access()` — [php/clinical_intakes.php:131](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:131)

### clinical_record_helpers — backend

Definition: [php/clinical_record_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_record_helpers.php:1) · diagram tab 27.

- `clinical_record_nullable_text()` — [php/clinical_record_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_record_helpers.php:3)
- `clinical_record_normalized_text()` — [php/clinical_record_helpers.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_record_helpers.php:14)
- `clinical_record_text_length()` — [php/clinical_record_helpers.php:21](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_record_helpers.php:21)
- `clinical_record_sanitize_repeated_fields()` — [php/clinical_record_helpers.php:37](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_record_helpers.php:37)
- `clinical_record_sanitize_response_record()` — [php/clinical_record_helpers.php:83](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_record_helpers.php:83)

### consent_file_helpers — backend

Definition: [php/consent_file_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/consent_file_helpers.php:1) · diagram tab 31.

- `consent_file_column_exists()` — [php/consent_file_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/consent_file_helpers.php:3)
- `consent_file_ensure_schema()` — [php/consent_file_helpers.php:17](C:/Users/Admin/WebstormProjects/untitled1/php/consent_file_helpers.php:17)
- `consent_file_normalize_contexts()` — [php/consent_file_helpers.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/consent_file_helpers.php:24)
- `consent_file_context_array()` — [php/consent_file_helpers.php:48](C:/Users/Admin/WebstormProjects/untitled1/php/consent_file_helpers.php:48)
- `consent_file_enforce_unique_context()` — [php/consent_file_helpers.php:56](C:/Users/Admin/WebstormProjects/untitled1/php/consent_file_helpers.php:56)

### consent_form_records — backend

Definition: [php/consent_form_records.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/consent_form_records.php:1) · diagram tab 31.

- `consent_form_records_input()` — [php/consent_form_records.php:7](C:/Users/Admin/WebstormProjects/untitled1/php/consent_form_records.php:7)

### consent_record_helpers — backend

Definition: [php/consent_record_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:1) · diagram tab 31.

- `consent_record_table_exists_raw()` — [php/consent_record_helpers.php:7](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:7)
- `consent_record_column_exists()` — [php/consent_record_helpers.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:20)
- `consent_record_column_type()` — [php/consent_record_helpers.php:34](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:34)
- `consent_record_apply_schema_change()` — [php/consent_record_helpers.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:49)
- `consent_record_ensure_columns()` — [php/consent_record_helpers.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:55)
- `consent_record_ensure_table()` — [php/consent_record_helpers.php:104](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:104)
- `consent_record_table_exists()` — [php/consent_record_helpers.php:114](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:114)
- `consent_record_nullable_text()` — [php/consent_record_helpers.php:119](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:119)
- `consent_record_nullable_int()` — [php/consent_record_helpers.php:130](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:130)
- `consent_record_datetime_or_null()` — [php/consent_record_helpers.php:139](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:139)
- `consent_record_normalize_document_path()` — [php/consent_record_helpers.php:151](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:151)
- `consent_record_acquire_document_lock()` — [php/consent_record_helpers.php:169](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:169)
- `consent_record_document_references()` — [php/consent_record_helpers.php:188](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:188)
- `consent_record_assert_document_scope()` — [php/consent_record_helpers.php:219](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:219)
- `consent_record_status()` — [php/consent_record_helpers.php:251](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:251)
- `consent_record_source()` — [php/consent_record_helpers.php:263](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:263)
- `consent_record_file_id()` — [php/consent_record_helpers.php:271](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:271)
- `consent_record_find_existing()` — [php/consent_record_helpers.php:278](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:278)
- `consent_record_save()` — [php/consent_record_helpers.php:336](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:336)
- `consent_record_forms_from_value()` — [php/consent_record_helpers.php:424](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:424)
- `consent_record_form_path()` — [php/consent_record_helpers.php:452](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:452)
- `consent_record_form_signed_document_path()` — [php/consent_record_helpers.php:464](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:464)
- `consent_record_form_physical_document_path()` — [php/consent_record_helpers.php:482](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:482)
- `consent_record_form_legacy_signature_path()` — [php/consent_record_helpers.php:496](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:496)
- `consent_record_demote_signature_only_paths()` — [php/consent_record_helpers.php:512](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:512)
- `consent_record_first_signed_document_path()` — [php/consent_record_helpers.php:541](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:541)
- `consent_record_first_physical_document_path()` — [php/consent_record_helpers.php:553](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:553)
- `consent_record_first_legacy_signature_path()` — [php/consent_record_helpers.php:565](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:565)
- `consent_record_normalize_booking_forms()` — [php/consent_record_helpers.php:577](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:577)
- `consent_record_forms_for_response()` — [php/consent_record_helpers.php:615](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:615)
- `consent_record_queue_response_row()` — [php/consent_record_helpers.php:638](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:638)
- `consent_record_fetch_queue_records()` — [php/consent_record_helpers.php:671](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:671)
- `consent_record_queue_compatibility_fields()` — [php/consent_record_helpers.php:725](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:725)
- `consent_record_capture_booking()` — [php/consent_record_helpers.php:768](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:768)
- `consent_record_capture_queue()` — [php/consent_record_helpers.php:854](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php:854)

### coparent_request_helpers — backend

Definition: [php/coparent_request_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:1) · diagram tab 19.

- `coparent_column_exists()` — [php/coparent_request_helpers.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:5)
- `coparent_ensure_ownership_metadata()` — [php/coparent_request_helpers.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:23)
- `coparent_table_exists()` — [php/coparent_request_helpers.php:36](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:36)
- `coparent_index_exists()` — [php/coparent_request_helpers.php:53](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:53)
- `coparent_single_pet_unique_indexes()` — [php/coparent_request_helpers.php:67](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:67)
- `coparent_ensure_ownership_indexes()` — [php/coparent_request_helpers.php:85](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:85)
- `coparent_ensure_schema()` — [php/coparent_request_helpers.php:103](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:103)
- `coparent_user_display_name()` — [php/coparent_request_helpers.php:139](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:139)
- `coparent_pet_display_name()` — [php/coparent_request_helpers.php:149](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:149)
- `coparent_app_url()` — [php/coparent_request_helpers.php:154](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:154)
- `coparent_find_primary_owner()` — [php/coparent_request_helpers.php:174](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:174)
- `coparent_request_detail()` — [php/coparent_request_helpers.php:202](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:202)
- `coparent_find_pending_request()` — [php/coparent_request_helpers.php:253](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:253)
- `coparent_create_or_refresh_request()` — [php/coparent_request_helpers.php:270](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:270)
- `coparent_insert_ownership()` — [php/coparent_request_helpers.php:297](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:297)
- `coparent_notify_request_created()` — [php/coparent_request_helpers.php:331](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:331)
- `coparent_notify_requester_result()` — [php/coparent_request_helpers.php:370](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:370)
- `coparent_notify_requester_pending()` — [php/coparent_request_helpers.php:394](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_request_helpers.php:394)

### coparent_requests — backend

Definition: [php/coparent_requests.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:1) · diagram tab 19.

- `coparent_request_error()` — [php/coparent_requests.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:8)
- `coparent_request_current_user_id()` — [php/coparent_requests.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:15)
- `coparent_request_current_role()` — [php/coparent_requests.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:20)
- `coparent_request_can_view()` — [php/coparent_requests.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:25)
- `coparent_request_can_decide()` — [php/coparent_requests.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:32)

### create_account — backend

Definition: [php/create_account.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/create_account.php:1) · diagram tab 15.

- `createAccountUserColumnExists()` — [php/create_account.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/create_account.php:9)
- `createAccountNormalizeRole()` — [php/create_account.php:30](C:/Users/Admin/WebstormProjects/untitled1/php/create_account.php:30)

### db — backend

Definition: [php/db.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:1) · diagram tab 11.

- `createDatabaseConnection()` — [php/db.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:5)
- `reconnectDatabase()` — [php/db.php:33](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:33)
- `ipawcus_get_pdo()` — [php/db.php:43](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:43)
- `ipawcus_current_pdo()` — [php/db.php:67](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:67)
- `ipawcus_rollback_current_transaction()` — [php/db.php:78](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:78)
- `ipawcus_json_error()` — [php/db.php:87](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:87)
- `ipawcus_database_unavailable_payload()` — [php/db.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:94)
- `ipawcus_send_database_connection_error()` — [php/db.php:103](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:103)
- `ipawcus_recover_pdo()` — [php/db.php:114](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:114)
- `ipawcus_with_recovered_pdo()` — [php/db.php:123](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:123)
- `ipawcus_refresh_pdo_if_needed()` — [php/db.php:133](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:133)
- `ipawcus_set_pdo()` — [php/db.php:145](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:145)
- `isRecoverableDatabaseConnectionError()` — [php/db.php:155](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:155)
- `sendDatabaseConnectionError()` — [php/db.php:169](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:169)

### delete_account — backend

Definition: [php/delete_account.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:1) · diagram tab 15.

- `delete_account_json()` — [php/delete_account.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:8)
- `delete_account_column_exists()` — [php/delete_account.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:15)
- `delete_account_required_sql()` — [php/delete_account.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:29)
- `delete_account_normalize_role()` — [php/delete_account.php:34](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:34)
- `delete_account_name()` — [php/delete_account.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:39)
- `delete_account_email_text()` — [php/delete_account.php:45](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:45)
- `delete_account_notify_removed_user()` — [php/delete_account.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:57)
- `delete_account_notify_super_admins()` — [php/delete_account.php:92](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:92)

### delete_consent_file — backend

Definition: [php/delete_consent_file.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/delete_consent_file.php:1) · diagram tab 31.


### delete_upload — backend

Definition: [php/delete_upload.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/delete_upload.php:1) · diagram tab 41.


### get_accounts — backend

Definition: [php/get_accounts.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_accounts.php:1) · diagram tab 15.


### get_bookings — backend

Definition: [php/get_bookings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:1) · diagram tab 23.

- `tableExists()` — [php/get_bookings.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:13)
- `normalizePriceLabel()` — [php/get_bookings.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:25)
- `decodeJsonArray()` — [php/get_bookings.php:46](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:46)

### get_consent_files — backend

Definition: [php/get_consent_files.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_consent_files.php:1) · diagram tab 31.


### get_pet — backend

Definition: [php/get_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet.php:1) · diagram tab 19.

- `getPetColumnExists()` — [php/get_pet.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet.php:14)
- `getPetTableExists()` — [php/get_pet.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet.php:28)
- `getPetPrescriptionDocuments()` — [php/get_pet.php:41](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet.php:41)

### get_pet_bookings — backend

Definition: [php/get_pet_bookings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_bookings.php:1) · diagram tab 19.

- `tableExists()` — [php/get_pet_bookings.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_bookings.php:11)
- `normalizePriceLabel()` — [php/get_pet_bookings.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_bookings.php:23)
- `normalizeServiceName()` — [php/get_pet_bookings.php:44](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_bookings.php:44)
- `resolveNumericPetId()` — [php/get_pet_bookings.php:67](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_bookings.php:67)

### get_pet_queues — backend

Definition: [php/get_pet_queues.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_queues.php:1) · diagram tab 19.


### get_pets — backend

Definition: [php/get_pets.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pets.php:1) · diagram tab 19.


### get_pets_for_queue — backend

Definition: [php/get_pets_for_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pets_for_queue.php:1) · diagram tab 25.


### get_queues — backend

Definition: [php/get_queues.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_queues.php:1) · diagram tab 25.

- `queue_table_exists()` — [php/get_queues.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/get_queues.php:14)

### get_room_availability — backend

Definition: [php/get_room_availability.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_room_availability.php:1) · diagram tab 33.

- `tableExists()` — [php/get_room_availability.php:7](C:/Users/Admin/WebstormProjects/untitled1/php/get_room_availability.php:7)
- `parseRoomAvailabilityDate()` — [php/get_room_availability.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/get_room_availability.php:19)

### get_user — backend

Definition: [php/get_user.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_user.php:1) · diagram tab 11.


### get_user_pets — backend

Definition: [php/get_user_pets.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_user_pets.php:1) · diagram tab 20.

- `fetchUserPetRows()` — [php/get_user_pets.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/get_user_pets.php:23)

### get_user_profile — backend

Definition: [php/get_user_profile.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_user_profile.php:1) · diagram tab 15.


### get_vet_schedules — backend

Definition: [php/get_vet_schedules.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_vet_schedules.php:1) · diagram tab 17.


### get_veterinarians — backend

Definition: [php/get_veterinarians.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_veterinarians.php:1) · diagram tab 15.


### google_auth_helpers — backend

Definition: [php/google_auth_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:1) · diagram tab 14.

- `__construct()` — [php/google_auth_helpers.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:14)
- `googleAuthJsonResponse()` — [php/google_auth_helpers.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:22)
- `googleAuthRequirePost()` — [php/google_auth_helpers.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:29)
- `googleAuthNormalizeOrigin()` — [php/google_auth_helpers.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:40)
- `googleAuthRequestOrigin()` — [php/google_auth_helpers.php:54](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:54)
- `googleAuthServerOrigin()` — [php/google_auth_helpers.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:64)
- `googleAuthRequireTrustedOrigin()` — [php/google_auth_helpers.php:76](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:76)
- `googleAuthReadJsonInput()` — [php/google_auth_helpers.php:103](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:103)
- `googleAuthRequireLibrary()` — [php/google_auth_helpers.php:116](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:116)
- `googleAuthVerifyCredential()` — [php/google_auth_helpers.php:137](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:137)
- `googleAuthRequireSchema()` — [php/google_auth_helpers.php:186](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:186)
- `googleAuthHandleSetupException()` — [php/google_auth_helpers.php:200](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:200)
- `googleAuthColumnExists()` — [php/google_auth_helpers.php:213](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:213)
- `googleAuthFetchUser()` — [php/google_auth_helpers.php:228](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:228)
- `googleAuthAssertUserCanSignIn()` — [php/google_auth_helpers.php:241](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:241)
- `googleAuthPublicUser()` — [php/google_auth_helpers.php:263](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:263)
- `googleAuthIssueSession()` — [php/google_auth_helpers.php:283](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:283)
- `googleAuthCreateOnboardingToken()` — [php/google_auth_helpers.php:298](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:298)
- `googleAuthFindUserByEmail()` — [php/google_auth_helpers.php:333](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:333)
- `googleAuthLinkRequiredResponse()` — [php/google_auth_helpers.php:342](C:/Users/Admin/WebstormProjects/untitled1/php/google_auth_helpers.php:342)

### grooming — backend

Definition: [php/grooming.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming.php:1) · diagram tab 32.


### grooming_helpers — backend

Definition: [php/grooming_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:1) · diagram tab 32.

- `grooming_require_schema()` — [php/grooming_helpers.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:6)
- `grooming_booking()` — [php/grooming_helpers.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:13)
- `grooming_event()` — [php/grooming_helpers.php:34](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:34)
- `grooming_apply_catalog_service()` — [php/grooming_helpers.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:40)
- `grooming_ensure_job()` — [php/grooming_helpers.php:91](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:91)
- `grooming_media_access()` — [php/grooming_helpers.php:107](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_helpers.php:107)

### grooming_media — backend

Definition: [php/grooming_media.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_media.php:1) · diagram tab 32.

- `grooming_default_photo_directory()` — [php/grooming_media.php:4](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_media.php:4)
- `grooming_website_roots()` — [php/grooming_media.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_media.php:28)
- `grooming_resolved_future_path()` — [php/grooming_media.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_media.php:49)
- `grooming_photo_filename()` — [php/grooming_media.php:73](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_media.php:73)
- `grooming_photo_directory()` — [php/grooming_media.php:93](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_media.php:93)

### grooming_notifications — backend

Definition: [php/grooming_notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_notifications.php:1) · diagram tab 32.

- `grooming_notify()` — [php/grooming_notifications.php:4](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_notifications.php:4)

### grooming_rules — backend

Definition: [php/grooming_rules.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:1) · diagram tab 32.

- `grooming_is_service()` — [php/grooming_rules.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:3)
- `grooming_validate_details()` — [php/grooming_rules.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:8)
- `grooming_assert_transition()` — [php/grooming_rules.php:59](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:59)
- `grooming_completion_summary()` — [php/grooming_rules.php:81](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:81)
- `grooming_handler_name()` — [php/grooming_rules.php:88](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:88)
- `grooming_default_pickup_person()` — [php/grooming_rules.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:94)
- `grooming_form_details()` — [php/grooming_rules.php:100](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_rules.php:100)

### grooming_upload — backend

Definition: [php/grooming_upload.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming_upload.php:1) · diagram tab 32.


### index — backend

Definition: [php/index.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:1) · diagram tab 11.


### inventory — backend

Definition: [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) · diagram tab 34.

- `inventoryRequestedBranchId()` — [php/inventory.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:8)
- `inventoryAssertLocationAccess()` — [php/inventory.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:24)
- `inventoryAssertItemMutationAccess()` — [php/inventory.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:39)
- `inventoryInput()` — [php/inventory.php:59](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:59)
- `inventoryColumnExists()` — [php/inventory.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:64)
- `inventoryBranchCatalogReady()` — [php/inventory.php:85](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:85)
- `inventoryRequireBranchCatalog()` — [php/inventory.php:108](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:108)
- `inventoryActivateBranchItem()` — [php/inventory.php:118](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:118)
- `inventoryAssertBranchItemActive()` — [php/inventory.php:144](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:144)
- `inventoryUser()` — [php/inventory.php:163](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:163)
- `inventoryConfirmResponsibility()` — [php/inventory.php:180](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:180)
- `inventoryWriteAudit()` — [php/inventory.php:213](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:213)
- `inventoryStockStatus()` — [php/inventory.php:245](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:245)
- `inventoryExpiryStatus()` — [php/inventory.php:252](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:252)
- `inventoryText()` — [php/inventory.php:263](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:263)
- `inventoryOptionalText()` — [php/inventory.php:268](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:268)
- `inventoryCodePart()` — [php/inventory.php:274](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:274)
- `inventorySkuExists()` — [php/inventory.php:284](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:284)
- `inventoryBatchExists()` — [php/inventory.php:291](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:291)
- `inventoryGenerateSku()` — [php/inventory.php:298](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:298)
- `inventoryGenerateBatchNumber()` — [php/inventory.php:316](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:316)
- `inventoryResolveLocationId()` — [php/inventory.php:333](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:333)
- `inventoryResolveSupplierId()` — [php/inventory.php:389](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:389)
- `getInventoryItems()` — [php/inventory.php:448](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:448)
- `getInventoryMeta()` — [php/inventory.php:629](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:629)
- `createInventoryItem()` — [php/inventory.php:678](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:678)
- `createStockIn()` — [php/inventory.php:843](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:843)
- `createStockOut()` — [php/inventory.php:1046](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1046)
- `updateInventoryItem()` — [php/inventory.php:1132](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1132)
- `deleteInventoryItem()` — [php/inventory.php:1299](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1299)
- `transferInventoryStock()` — [php/inventory.php:1443](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1443)

### inventory_invoice_helpers — backend

Definition: [php/inventory_invoice_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory_invoice_helpers.php:1) · diagram tab 34.

- `inventoryDetachInvoiceReferences()` — [php/inventory_invoice_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/inventory_invoice_helpers.php:10)

### lifecycle_recovery_report — backend

Definition: [php/lifecycle_recovery_report.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/lifecycle_recovery_report.php:1) · diagram tab 11.

- `lifecycle_report_table_exists()` — [php/lifecycle_recovery_report.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/lifecycle_recovery_report.php:6)
- `lifecycle_report_schema_ready()` — [php/lifecycle_recovery_report.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/lifecycle_recovery_report.php:19)

### link_pet — backend

Definition: [php/link_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/link_pet.php:1) · diagram tab 20.


### login — backend

Definition: [php/login.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/login.php:1) · diagram tab 14.

- `isUserAccountArchived()` — [php/login.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/login.php:6)
- `isStaffAccountDeactivated()` — [php/login.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/login.php:18)
- `isPetOwnerAccountDeactivated()` — [php/login.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/login.php:50)
- `loginColumnExists()` — [php/login.php:70](C:/Users/Admin/WebstormProjects/untitled1/php/login.php:70)

### mail_helpers — backend

Definition: [php/mail_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:1) · diagram tab 38.

- `mail_env_value()` — [php/mail_helpers.php:4](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:4)
- `mail_env_bool()` — [php/mail_helpers.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:15)
- `mail_smtp_config()` — [php/mail_helpers.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:22)
- `mail_smtp_is_configured()` — [php/mail_helpers.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:39)
- `mail_clean_header()` — [php/mail_helpers.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:50)
- `mail_encode_header()` — [php/mail_helpers.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:55)
- `mail_format_address()` — [php/mail_helpers.php:66](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:66)
- `mail_domain_from_address()` — [php/mail_helpers.php:78](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:78)
- `mail_text_from_html()` — [php/mail_helpers.php:85](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:85)
- `mail_normalize_attachments()` — [php/mail_helpers.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:94)
- `mail_queue_enabled()` — [php/mail_helpers.php:145](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:145)
- `mail_queue_table_exists()` — [php/mail_helpers.php:150](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:150)
- `mail_queue_column_exists()` — [php/mail_helpers.php:163](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:163)
- `mail_queue_ensure_schema()` — [php/mail_helpers.php:177](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:177)
- `mail_queue_options()` — [php/mail_helpers.php:226](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:226)
- `mail_queue_email()` — [php/mail_helpers.php:247](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:247)
- `mail_queue_reset_stale()` — [php/mail_helpers.php:301](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:301)
- `mail_queue_claim()` — [php/mail_helpers.php:328](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:328)
- `mail_queue_mark_sent()` — [php/mail_helpers.php:362](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:362)
- `mail_queue_mark_failed()` — [php/mail_helpers.php:387](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:387)
- `mail_process_queue()` — [php/mail_helpers.php:421](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:421)
- `mail_build_mime_message()` — [php/mail_helpers.php:518](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:518)
- `mail_smtp_read_response()` — [php/mail_helpers.php:605](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:605)
- `mail_smtp_expect()` — [php/mail_helpers.php:626](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:626)
- `mail_smtp_command()` — [php/mail_helpers.php:637](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:637)
- `mail_smtp_open_socket()` — [php/mail_helpers.php:646](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:646)
- `mail_smtp_start_session()` — [php/mail_helpers.php:679](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:679)
- `mail_smtp_send_on_session()` — [php/mail_helpers.php:715](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:715)
- `mail_smtp_close_session()` — [php/mail_helpers.php:750](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:750)
- `send_smtp_email()` — [php/mail_helpers.php:769](C:/Users/Admin/WebstormProjects/untitled1/php/mail_helpers.php:769)

### mail_queue_worker — backend

Definition: [php/mail_queue_worker.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/mail_queue_worker.php:1) · diagram tab 38.

- `mail_queue_worker_limit()` — [php/mail_queue_worker.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/mail_queue_worker.php:6)
- `mail_queue_worker_is_quiet()` — [php/mail_queue_worker.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/mail_queue_worker.php:23)
- `mail_queue_worker_web_authorized()` — [php/mail_queue_worker.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/mail_queue_worker.php:32)

### notification_helpers — backend

Definition: [php/notification_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1) · diagram tab 38.

- `notification_clinic_timezone()` — [php/notification_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:10)
- `notification_now()` — [php/notification_helpers.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:20)
- `notification_use_clinic_timezone()` — [php/notification_helpers.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:25)
- `notification_column_exists()` — [php/notification_helpers.php:36](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:36)
- `notification_column_type()` — [php/notification_helpers.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:50)
- `notification_table_exists()` — [php/notification_helpers.php:65](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:65)
- `notification_ensure_schema()` — [php/notification_helpers.php:78](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:78)
- `notification_bool()` — [php/notification_helpers.php:172](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:172)
- `notification_default_preferences()` — [php/notification_helpers.php:185](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:185)
- `notification_normalize_preferences()` — [php/notification_helpers.php:204](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:204)
- `notification_fetch_preferences()` — [php/notification_helpers.php:216](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:216)
- `notification_save_preferences()` — [php/notification_helpers.php:233](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:233)
- `notification_category_enabled()` — [php/notification_helpers.php:260](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:260)
- `notification_fetch_user()` — [php/notification_helpers.php:269](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:269)
- `notification_user_name()` — [php/notification_helpers.php:283](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:283)
- `notification_normalize_role()` — [php/notification_helpers.php:293](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:293)
- `notification_is_operational_category()` — [php/notification_helpers.php:298](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:298)
- `notification_fetch_users_by_roles()` — [php/notification_helpers.php:310](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:310)
- `notification_create_event_for_roles()` — [php/notification_helpers.php:338](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:338)
- `notification_send_super_admin_governance_event()` — [php/notification_helpers.php:373](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:373)
- `notification_create()` — [php/notification_helpers.php:387](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:387)
- `notification_email_template()` — [php/notification_helpers.php:469](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:469)
- `notification_send_email_if_enabled()` — [php/notification_helpers.php:533](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:533)
- `notification_push_env()` — [php/notification_helpers.php:618](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:618)
- `notification_push_public_key()` — [php/notification_helpers.php:632](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:632)
- `notification_push_ca_bundle_path()` — [php/notification_helpers.php:637](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:637)
- `notification_push_base64url_decode()` — [php/notification_helpers.php:661](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:661)
- `notification_push_build_ec_private_key_pem()` — [php/notification_helpers.php:667](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:667)
- `notification_push_private_key_pem()` — [php/notification_helpers.php:679](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:679)
- `notification_push_subject()` — [php/notification_helpers.php:727](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:727)
- `notification_push_is_configured()` — [php/notification_helpers.php:742](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:742)
- `notification_push_config_status()` — [php/notification_helpers.php:749](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:749)
- `notification_push_base64url()` — [php/notification_helpers.php:764](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:764)
- `notification_push_asn1_length()` — [php/notification_helpers.php:769](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:769)
- `notification_push_der_signature_to_jose()` — [php/notification_helpers.php:785](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:785)
- `notification_push_audience()` — [php/notification_helpers.php:815](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:815)
- `notification_push_vapid_jwt()` — [php/notification_helpers.php:830](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:830)
- `notification_push_post()` — [php/notification_helpers.php:854](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:854)
- `notification_push_deactivate_subscription()` — [php/notification_helpers.php:927](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:927)
- `notification_push_endpoint_is_safe()` — [php/notification_helpers.php:938](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:938)
- `notification_push_save_subscription()` — [php/notification_helpers.php:986](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:986)
- `notification_push_disable_subscription()` — [php/notification_helpers.php:1054](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1054)
- `notification_push_user_status()` — [php/notification_helpers.php:1080](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1080)
- `notification_send_push_to_subscription()` — [php/notification_helpers.php:1101](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1101)
- `notification_send_push_if_enabled()` — [php/notification_helpers.php:1145](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1145)
- `notification_create_event()` — [php/notification_helpers.php:1215](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1215)
- `notification_dedupe_email_already_handled()` — [php/notification_helpers.php:1270](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1270)
- `notification_format_datetime()` — [php/notification_helpers.php:1289](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1289)
- `notification_service_name()` — [php/notification_helpers.php:1306](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1306)
- `notification_pet_redirect_path()` — [php/notification_helpers.php:1321](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1321)
- `notification_app_url()` — [php/notification_helpers.php:1327](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1327)
- `notification_task_datetime()` — [php/notification_helpers.php:1356](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1356)
- `notification_todo_occurrence_window_minutes()` — [php/notification_helpers.php:1370](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1370)
- `notification_todo_reminder_slot()` — [php/notification_helpers.php:1376](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1376)
- `notification_todo_reminder_task()` — [php/notification_helpers.php:1438](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1438)
- `notification_fetch_todo_reminder_tasks()` — [php/notification_helpers.php:1462](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1462)
- `notification_todo_email_rows()` — [php/notification_helpers.php:1861](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1861)
- `notification_todo_email_text()` — [php/notification_helpers.php:1878](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1878)
- `notification_todo_occurrence_slots()` — [php/notification_helpers.php:1890](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1890)
- `notification_todo_occurrence_dedupe_key()` — [php/notification_helpers.php:1935](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1935)
- `notification_send_todo_occurrence()` — [php/notification_helpers.php:1947](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1947)
- `notification_send_todo_reminder()` — [php/notification_helpers.php:1994](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:1994)
- `notification_run_todo_reminders()` — [php/notification_helpers.php:2055](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2055)
- `notification_fetch_booking()` — [php/notification_helpers.php:2107](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2107)
- `notification_send_booking_event()` — [php/notification_helpers.php:2128](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2128)
- `notification_booking_schedule_datetime()` — [php/notification_helpers.php:2328](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2328)
- `notification_booking_reminder_slot()` — [php/notification_helpers.php:2344](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2344)
- `notification_send_booking_reminder()` — [php/notification_helpers.php:2385](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2385)
- `notification_run_booking_reminders()` — [php/notification_helpers.php:2448](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2448)
- `notification_fetch_queue()` — [php/notification_helpers.php:2502](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2502)
- `notification_send_queue_event()` — [php/notification_helpers.php:2527](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2527)
- `notification_send_queue_assignment_to_vet()` — [php/notification_helpers.php:2694](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2694)
- `notification_fetch_record_update_request()` — [php/notification_helpers.php:2723](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2723)
- `notification_record_update_email()` — [php/notification_helpers.php:2746](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2746)
- `notification_send_record_update_request_event()` — [php/notification_helpers.php:2780](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2780)
- `notification_send_record_update_request_staff_event()` — [php/notification_helpers.php:2832](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2832)
- `notification_send_record_update_request_owner_event()` — [php/notification_helpers.php:2915](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2915)
- `notification_send_record_update_request_completed_to_owner()` — [php/notification_helpers.php:2989](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2989)
- `notification_send_medical_certificate_issued()` — [php/notification_helpers.php:2994](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:2994)
- `notification_send_boarding_event()` — [php/notification_helpers.php:3070](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3070)
- `notification_fetch_online_consultation_summary()` — [php/notification_helpers.php:3123](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3123)
- `notification_send_online_consultation_event()` — [php/notification_helpers.php:3145](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3145)
- `notification_fetch_visit_summary()` — [php/notification_helpers.php:3210](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3210)
- `notification_money()` — [php/notification_helpers.php:3270](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3270)
- `notification_quantity()` — [php/notification_helpers.php:3275](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3275)
- `notification_visit_purchase_summary()` — [php/notification_helpers.php:3281](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3281)
- `notification_visit_receipt()` — [php/notification_helpers.php:3308](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3308)
- `notification_send_visit_event()` — [php/notification_helpers.php:3359](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3359)
- `notification_fetch_diagnosis_summary()` — [php/notification_helpers.php:3473](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3473)
- `notification_send_diagnosis_event()` — [php/notification_helpers.php:3501](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php:3501)

### notifications — backend

Definition: [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) · diagram tab 38.

- `notifications_input()` — [php/notifications.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:8)
- `notifications_user_id()` — [php/notifications.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:13)
- `notifications_effective_user_id()` — [php/notifications.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:18)
- `notifications_error()` — [php/notifications.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:40)
- `notifications_reminder_authorized()` — [php/notifications.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:47)
- `notifications_pet_redirect()` — [php/notifications.php:66](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:66)
- `notifications_lookup_pet_id()` — [php/notifications.php:72](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:72)
- `notifications_resolve_pet_redirect()` — [php/notifications.php:81](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:81)

### online_consultation_helpers — backend

Definition: [php/online_consultation_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:1) · diagram tab 28.

- `onlineConsultationTableExists()` — [php/online_consultation_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:3)
- `buildOnlineConsultationDateTime()` — [php/online_consultation_helpers.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:15)
- `fetchOnlineConsultationRow()` — [php/online_consultation_helpers.php:51](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:51)
- `fetchOnlineConsultationByBooking()` — [php/online_consultation_helpers.php:60](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:60)
- `fetchOnlineConsultationRescheduleHistoryMap()` — [php/online_consultation_helpers.php:69](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:69)
- `fetchOnlineConsultationRescheduleHistory()` — [php/online_consultation_helpers.php:121](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:121)
- `onlineConsultationWithReschedules()` — [php/online_consultation_helpers.php:128](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:128)
- `getJitsiBaseUrl()` — [php/online_consultation_helpers.php:142](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:142)
- `getJaaSAppId()` — [php/online_consultation_helpers.php:157](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:157)
- `getJitsiMeetingProvider()` — [php/online_consultation_helpers.php:183](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:183)
- `resolveJitsiMeetingUrl()` — [php/online_consultation_helpers.php:189](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:189)
- `jaasBase64UrlEncode()` — [php/online_consultation_helpers.php:200](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:200)
- `getJaaSPrivateKeyMaterial()` — [php/online_consultation_helpers.php:205](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:205)
- `getJaaSJwtConfiguration()` — [php/online_consultation_helpers.php:230](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:230)
- `createJaaSMeetingJwt()` — [php/online_consultation_helpers.php:263](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:263)
- `createJitsiRoomForBooking()` — [php/online_consultation_helpers.php:341](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:341)
- `createOnlineConsultationForBooking()` — [php/online_consultation_helpers.php:354](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:354)
- `rescheduleOnlineConsultationForBooking()` — [php/online_consultation_helpers.php:414](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:414)
- `cancelOnlineConsultationForBooking()` — [php/online_consultation_helpers.php:498](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultation_helpers.php:498)

### online_consultations — backend

Definition: [php/online_consultations.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:1) · diagram tab 28.

- `getJsonInput()` — [php/online_consultations.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:20)
- `onlineConsultationNullableText()` — [php/online_consultations.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:25)
- `onlineConsultationCleanJsonValue()` — [php/online_consultations.php:35](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:35)
- `normalizeNullableJson()` — [php/online_consultations.php:61](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:61)
- `onlineConsultationDecodeJson()` — [php/online_consultations.php:76](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:76)
- `onlineConsultationImagePaths()` — [php/online_consultations.php:86](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:86)
- `ensureMissingConfirmedOnlineConsultations()` — [php/online_consultations.php:98](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:98)
- `formatOnlineConsultation()` — [php/online_consultations.php:137](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:137)
- `attachOnlineConsultationMeetingAccess()` — [php/online_consultations.php:205](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:205)
- `fetchOnlineConsultationResponse()` — [php/online_consultations.php:221](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:221)
- `fetchOnlineConsultations()` — [php/online_consultations.php:229](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:229)
- `fetchOnlineConsultationActionRow()` — [php/online_consultations.php:311](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:311)
- `onlineConsultationEnsureVetActor()` — [php/online_consultations.php:327](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:327)
- `onlineConsultationEnsureOwnerOrVetActor()` — [php/online_consultations.php:338](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:338)
- `onlineConsultationRejectClosed()` — [php/online_consultations.php:349](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:349)
- `onlineConsultationEnsureOwnerJoinWindow()` — [php/online_consultations.php:361](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:361)

### password_policy_helpers — backend

Definition: [php/password_policy_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/password_policy_helpers.php:1) · diagram tab 14.

- `ipawcus_password_meets_policy()` — [php/password_policy_helpers.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/password_policy_helpers.php:5)
- `ipawcus_password_policy_error()` — [php/password_policy_helpers.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/password_policy_helpers.php:13)

### payment_method_helpers — backend

Definition: [php/payment_method_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/payment_method_helpers.php:1) · diagram tab 11.

- `ipawcus_payment_method_key()` — [php/payment_method_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/payment_method_helpers.php:3)
- `ipawcus_payment_method_is_allowed()` — [php/payment_method_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/payment_method_helpers.php:10)
- `ipawcus_payment_method_require()` — [php/payment_method_helpers.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/payment_method_helpers.php:32)

### payment_methods — backend

Definition: [php/payment_methods.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:1) · diagram tab 36.

- `__construct()` — [php/payment_methods.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:14)
- `payment_methods_input()` — [php/payment_methods.php:21](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:21)
- `payment_methods_error()` — [php/payment_methods.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:28)
- `payment_methods_is_list()` — [php/payment_methods.php:35](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:35)
- `payment_methods_throw()` — [php/payment_methods.php:44](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:44)
- `payment_methods_column_type()` — [php/payment_methods.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:49)
- `payment_methods_table_exists()` — [php/payment_methods.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:64)
- `payment_methods_column_exists()` — [php/payment_methods.php:77](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:77)
- `payment_methods_ensure_schema()` — [php/payment_methods.php:91](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:91)
- `payment_methods_text_length()` — [php/payment_methods.php:155](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:155)
- `payment_methods_encryption_key()` — [php/payment_methods.php:160](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:160)
- `payment_methods_encrypt()` — [php/payment_methods.php:173](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:173)
- `payment_methods_decrypt()` — [php/payment_methods.php:199](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:199)
- `payment_methods_type()` — [php/payment_methods.php:238](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:238)
- `payment_methods_validate_account_number()` — [php/payment_methods.php:248](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:248)
- `payment_methods_ensure_otp_purpose()` — [php/payment_methods.php:262](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:262)
- `payment_methods_user()` — [php/payment_methods.php:299](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:299)
- `payment_methods_mask_account_number()` — [php/payment_methods.php:331](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:331)
- `payment_methods_row()` — [php/payment_methods.php:342](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:342)
- `payment_methods_fetch()` — [php/payment_methods.php:373](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:373)
- `payment_methods_revision()` — [php/payment_methods.php:388](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:388)
- `payment_methods_request_otp()` — [php/payment_methods.php:418](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:418)
- `payment_methods_acquire_configuration_lock()` — [php/payment_methods.php:455](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:455)
- `payment_methods_release_configuration_lock()` — [php/payment_methods.php:464](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:464)
- `payment_methods_all_rows_by_key()` — [php/payment_methods.php:474](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:474)
- `payment_methods_has_unresolved_references()` — [php/payment_methods.php:485](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:485)
- `payment_methods_canonical_qr_path()` — [php/payment_methods.php:524](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:524)
- `payment_methods_consume_otp()` — [php/payment_methods.php:551](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:551)
- `payment_methods_save()` — [php/payment_methods.php:567](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:567)

### pet_allergy_helpers — backend

Definition: [php/pet_allergy_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:1) · diagram tab 20.

- `pet_allergy_table_exists()` — [php/pet_allergy_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:3)
- `pet_allergy_column_exists()` — [php/pet_allergy_helpers.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:24)
- `pet_allergy_clean_text()` — [php/pet_allergy_helpers.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:47)
- `pet_allergy_compare_text()` — [php/pet_allergy_helpers.php:52](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:52)
- `pet_allergy_forget_cache()` — [php/pet_allergy_helpers.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:57)
- `pet_allergy_normalized_entries()` — [php/pet_allergy_helpers.php:63](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:63)
- `pet_allergy_effective_entries()` — [php/pet_allergy_helpers.php:125](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:125)
- `pet_allergy_effective_text()` — [php/pet_allergy_helpers.php:165](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:165)
- `pet_allergy_sync_legacy_summary()` — [php/pet_allergy_helpers.php:188](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:188)
- `pet_allergy_insert()` — [php/pet_allergy_helpers.php:201](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:201)
- `pet_allergy_import_legacy()` — [php/pet_allergy_helpers.php:256](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:256)
- `pet_allergy_merge_from_legacy()` — [php/pet_allergy_helpers.php:286](C:/Users/Admin/WebstormProjects/untitled1/php/pet_allergy_helpers.php:286)

### pet_catalog — backend

Definition: [php/pet_catalog.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_catalog.php:1) · diagram tab 20.


### pet_certificates — backend

Definition: [php/pet_certificates.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:1) · diagram tab 30.

- `pet_certificate_input()` — [php/pet_certificates.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:11)
- `pet_certificate_error()` — [php/pet_certificates.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:16)
- `pet_certificate_resolve_pet()` — [php/pet_certificates.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:32)
- `pet_certificate_owner()` — [php/pet_certificates.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:55)
- `pet_certificate_clinic()` — [php/pet_certificates.php:83](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:83)
- `pet_certificate_pet_payload()` — [php/pet_certificates.php:123](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:123)
- `pet_certificate_registration()` — [php/pet_certificates.php:141](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:141)
- `pet_certificate_effective_status()` — [php/pet_certificates.php:159](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:159)
- `pet_certificate_medical_payload()` — [php/pet_certificates.php:169](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:169)
- `pet_certificate_fetch_latest()` — [php/pet_certificates.php:203](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:203)
- `pet_certificate_parse_date()` — [php/pet_certificates.php:236](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:236)
- `pet_certificate_number()` — [php/pet_certificates.php:248](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:248)

### pet_directory_search — backend

Definition: [php/pet_directory_search.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:1) · diagram tab 20.

- `pet_directory_table_exists()` — [php/pet_directory_search.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:3)
- `pet_directory_column_exists()` — [php/pet_directory_search.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:18)
- `pet_directory_clean_text()` — [php/pet_directory_search.php:33](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:33)
- `pet_directory_contains()` — [php/pet_directory_search.php:41](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:41)
- `pet_directory_snippet()` — [php/pet_directory_search.php:53](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:53)
- `pet_directory_pet()` — [php/pet_directory_search.php:77](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:77)
- `pet_directory_add_match()` — [php/pet_directory_search.php:99](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:99)
- `pet_directory_profile_matches()` — [php/pet_directory_search.php:133](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:133)
- `pet_directory_allergy_matches()` — [php/pet_directory_search.php:175](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:175)
- `pet_directory_diagnosis_matches()` — [php/pet_directory_search.php:203](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:203)
- `pet_directory_online_diagnosis_matches()` — [php/pet_directory_search.php:244](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:244)
- `pet_directory_organized_matches()` — [php/pet_directory_search.php:284](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:284)
- `pet_directory_search()` — [php/pet_directory_search.php:339](C:/Users/Admin/WebstormProjects/untitled1/php/pet_directory_search.php:339)

### pet_media_monitoring — backend

Definition: [php/pet_media_monitoring.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:1) · diagram tab 41.

- `pet_media_json()` — [php/pet_media_monitoring.php:7](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:7)
- `pet_media_normalize_role()` — [php/pet_media_monitoring.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:14)
- `pet_media_payload()` — [php/pet_media_monitoring.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:19)
- `pet_media_require_media_access()` — [php/pet_media_monitoring.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:26)
- `pet_media_table_exists()` — [php/pet_media_monitoring.php:38](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:38)
- `pet_media_column_exists()` — [php/pet_media_monitoring.php:51](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:51)
- `pet_media_date_or_null()` — [php/pet_media_monitoring.php:72](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:72)
- `pet_media_date_range()` — [php/pet_media_monitoring.php:84](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:84)
- `pet_media_decode_json()` — [php/pet_media_monitoring.php:154](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:154)
- `pet_media_file_name()` — [php/pet_media_monitoring.php:169](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:169)
- `pet_media_public_url()` — [php/pet_media_monitoring.php:177](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:177)
- `pet_media_is_image()` — [php/pet_media_monitoring.php:189](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:189)
- `pet_media_is_pdf()` — [php/pet_media_monitoring.php:209](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:209)
- `pet_media_kind()` — [php/pet_media_monitoring.php:223](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:223)
- `pet_media_split_paths()` — [php/pet_media_monitoring.php:232](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:232)
- `pet_media_extract_uploads()` — [php/pet_media_monitoring.php:255](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:255)
- `pet_media_owner_name()` — [php/pet_media_monitoring.php:332](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:332)
- `pet_media_base()` — [php/pet_media_monitoring.php:344](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:344)
- `pet_media_add()` — [php/pet_media_monitoring.php:360](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:360)
- `pet_media_is_within_range()` — [php/pet_media_monitoring.php:397](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:397)
- `pet_media_fetch()` — [php/pet_media_monitoring.php:413](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:413)

### pet_medical_records — backend

Definition: [php/pet_medical_records.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1) · diagram tab 20.

- `pet_medical_input()` — [php/pet_medical_records.php:12](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:12)
- `pet_medical_error()` — [php/pet_medical_records.php:17](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:17)
- `pet_medical_run_atomic()` — [php/pet_medical_records.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:24)
- `pet_medical_table_exists()` — [php/pet_medical_records.php:46](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:46)
- `pet_medical_column_exists()` — [php/pet_medical_records.php:59](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:59)
- `pet_medical_decode_json()` — [php/pet_medical_records.php:73](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:73)
- `pet_medical_json_display_text()` — [php/pet_medical_records.php:84](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:84)
- `pet_medical_json()` — [php/pet_medical_records.php:114](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:114)
- `pet_medical_nullable_int()` — [php/pet_medical_records.php:125](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:125)
- `pet_medical_nullable_text()` — [php/pet_medical_records.php:134](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:134)
- `pet_medical_date()` — [php/pet_medical_records.php:141](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:141)
- `pet_medical_compare_value()` — [php/pet_medical_records.php:155](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:155)
- `pet_medical_changed_fields()` — [php/pet_medical_records.php:168](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:168)
- `pet_medical_notify_owner_record_updated()` — [php/pet_medical_records.php:182](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:182)
- `pet_medical_ensure_schema()` — [php/pet_medical_records.php:246](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:246)
- `pet_medical_resolve_pet_id()` — [php/pet_medical_records.php:253](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:253)
- `pet_medical_pet_summary()` — [php/pet_medical_records.php:287](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:287)
- `pet_medical_fetch_vaccinations()` — [php/pet_medical_records.php:335](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:335)
- `pet_medical_vaccination_record_summary()` — [php/pet_medical_records.php:390](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:390)
- `pet_medical_vaccination_group_record()` — [php/pet_medical_records.php:406](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:406)
- `pet_medical_fetch_allergies()` — [php/pet_medical_records.php:448](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:448)
- `pet_medical_normalize_attachments()` — [php/pet_medical_records.php:453](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:453)
- `pet_medical_sanitize_revision_snapshot()` — [php/pet_medical_records.php:518](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:518)
- `pet_medical_effective_item_source()` — [php/pet_medical_records.php:586](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:586)
- `pet_medical_attachment_mime()` — [php/pet_medical_records.php:595](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:595)
- `pet_medical_grooming_attachment()` — [php/pet_medical_records.php:607](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:607)
- `pet_medical_diagnosis_summary()` — [php/pet_medical_records.php:623](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:623)
- `pet_medical_fetch_visit_charges()` — [php/pet_medical_records.php:655](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:655)
- `pet_medical_fetch_visit_paid_totals()` — [php/pet_medical_records.php:695](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:695)
- `pet_medical_fetch_boarding_documents()` — [php/pet_medical_records.php:734](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:734)
- `pet_medical_fetch_boarding_activity()` — [php/pet_medical_records.php:771](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:771)
- `pet_medical_fetch_grooming_history()` — [php/pet_medical_records.php:836](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:836)
- `pet_medical_fetch_boarding_history()` — [php/pet_medical_records.php:959](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:959)
- `pet_medical_source_group_map()` — [php/pet_medical_records.php:1109](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1109)
- `pet_medical_fetch_service_history()` — [php/pet_medical_records.php:1138](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1138)
- `pet_medical_fetch_prescription_documents()` — [php/pet_medical_records.php:1373](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1373)
- `pet_medical_fetch_groups()` — [php/pet_medical_records.php:1410](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1410)
- `pet_medical_escape()` — [php/pet_medical_records.php:1501](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1501)
- `pet_medical_format_date_label()` — [php/pet_medical_records.php:1506](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1506)
- `pet_medical_editor_label()` — [php/pet_medical_records.php:1517](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1517)
- `pet_medical_source_note_rows()` — [php/pet_medical_records.php:1527](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1527)
- `pet_medical_prescription_label()` — [php/pet_medical_records.php:1591](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1591)
- `pet_medical_item_prescriptions()` — [php/pet_medical_records.php:1603](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1603)
- `pet_medical_email_copy_html()` — [php/pet_medical_records.php:1627](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1627)
- `pet_medical_send_email_copy()` — [php/pet_medical_records.php:1759](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1759)
- `pet_medical_service_record_by_source()` — [php/pet_medical_records.php:1811](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1811)
- `pet_medical_merge_group_source_files()` — [php/pet_medical_records.php:1832](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1832)
- `pet_medical_create_group()` — [php/pet_medical_records.php:1873](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1873)
- `pet_medical_update_group()` — [php/pet_medical_records.php:1913](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1913)
- `pet_medical_delete_group()` — [php/pet_medical_records.php:1984](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1984)
- `pet_medical_add_item()` — [php/pet_medical_records.php:1997](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1997)
- `pet_medical_update_item()` — [php/pet_medical_records.php:2070](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:2070)
- `pet_medical_remove_item()` — [php/pet_medical_records.php:2168](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:2168)
- `pet_medical_save_vaccination()` — [php/pet_medical_records.php:2187](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:2187)
- `pet_medical_save_allergy()` — [php/pet_medical_records.php:2243](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:2243)

### pet_overdue_cancellations — backend

Definition: [php/pet_overdue_cancellations.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_overdue_cancellations.php:1) · diagram tab 20.

- `pet_overdue_resolve_pet_id()` — [php/pet_overdue_cancellations.php:7](C:/Users/Admin/WebstormProjects/untitled1/php/pet_overdue_cancellations.php:7)

### pet_owner_accounts — backend

Definition: [php/pet_owner_accounts.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:1) · diagram tab 16.

- `owner_accounts_input()` — [php/pet_owner_accounts.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:9)
- `owner_accounts_json()` — [php/pet_owner_accounts.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:15)
- `owner_accounts_normalize_role()` — [php/pet_owner_accounts.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:22)
- `owner_accounts_require_super_admin()` — [php/pet_owner_accounts.php:27](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:27)
- `owner_accounts_column_exists()` — [php/pet_owner_accounts.php:35](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:35)
- `owner_accounts_required_status_sql()` — [php/pet_owner_accounts.php:48](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:48)
- `owner_accounts_status_supported()` — [php/pet_owner_accounts.php:53](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:53)
- `owner_accounts_list()` — [php/pet_owner_accounts.php:58](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:58)
- `owner_accounts_update_status()` — [php/pet_owner_accounts.php:273](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:273)
- `owner_accounts_remove_ownership()` — [php/pet_owner_accounts.php:351](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:351)

### pet_owner_todos — backend

Definition: [php/pet_owner_todos.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:1) · diagram tab 38.

- `pet_owner_todos_input()` — [php/pet_owner_todos.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:10)
- `pet_owner_todos_error()` — [php/pet_owner_todos.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:15)
- `pet_owner_todos_table_exists()` — [php/pet_owner_todos.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:22)
- `pet_owner_todos_ensure_schema()` — [php/pet_owner_todos.php:35](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:35)
- `pet_owner_todos_user_id()` — [php/pet_owner_todos.php:77](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:77)
- `pet_owner_todos_current_user()` — [php/pet_owner_todos.php:82](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:82)
- `pet_owner_todos_effective_user_id()` — [php/pet_owner_todos.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:94)
- `pet_owner_todos_normalize_role()` — [php/pet_owner_todos.php:112](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:112)
- `pet_owner_todos_user_role()` — [php/pet_owner_todos.php:117](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:117)
- `pet_owner_todos_is_veterinarian_role()` — [php/pet_owner_todos.php:131](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:131)
- `pet_owner_todos_datetime()` — [php/pet_owner_todos.php:136](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:136)
- `pet_owner_todos_range()` — [php/pet_owner_todos.php:151](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:151)
- `pet_owner_todos_service_label()` — [php/pet_owner_todos.php:165](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:165)
- `pet_owner_todos_format_task()` — [php/pet_owner_todos.php:180](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:180)
- `pet_owner_todos_booking_tasks()` — [php/pet_owner_todos.php:209](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:209)
- `pet_owner_todos_personal_tasks()` — [php/pet_owner_todos.php:282](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:282)
- `pet_owner_todos_diagnosis_tasks()` — [php/pet_owner_todos.php:312](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:312)
- `pet_owner_todos_medication_tasks()` — [php/pet_owner_todos.php:363](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:363)
- `pet_owner_todos_payment_tasks()` — [php/pet_owner_todos.php:428](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:428)
- `pet_owner_todos_boarding_tasks()` — [php/pet_owner_todos.php:514](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:514)
- `pet_owner_todos_vet_booking_tasks()` — [php/pet_owner_todos.php:561](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:561)
- `pet_owner_todos_vet_follow_up_tasks()` — [php/pet_owner_todos.php:600](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:600)
- `pet_owner_todos_summary()` — [php/pet_owner_todos.php:649](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:649)
- `pet_owner_todos_list()` — [php/pet_owner_todos.php:691](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:691)
- `pet_owner_todos_create()` — [php/pet_owner_todos.php:730](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:730)
- `pet_owner_todos_update()` — [php/pet_owner_todos.php:763](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:763)
- `pet_owner_todos_delete()` — [php/pet_owner_todos.php:831](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:831)

### phone_number_helpers — backend

Definition: [php/phone_number_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/phone_number_helpers.php:1) · diagram tab 11.

- `normalizePhilippinePhoneNumber()` — [php/phone_number_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/phone_number_helpers.php:3)
- `philippinePhoneDigits()` — [php/phone_number_helpers.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/phone_number_helpers.php:18)
- `isPhilippinePhonePrefixOnly()` — [php/phone_number_helpers.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/phone_number_helpers.php:23)
- `isValidPhilippinePhoneNumber()` — [php/phone_number_helpers.php:31](C:/Users/Admin/WebstormProjects/untitled1/php/phone_number_helpers.php:31)
- `rejectInvalidPhilippinePhoneNumber()` — [php/phone_number_helpers.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/phone_number_helpers.php:47)

### prescription_helpers — backend

Definition: [php/prescription_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:1) · diagram tab 29.

- `prescription_table_exists()` — [php/prescription_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:3)
- `prescription_column_exists()` — [php/prescription_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:10)
- `prescription_schema_ready()` — [php/prescription_helpers.php:17](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:17)
- `prescription_schema_message()` — [php/prescription_helpers.php:27](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:27)
- `prescription_json_array()` — [php/prescription_helpers.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:32)
- `prescription_nullable_text()` — [php/prescription_helpers.php:44](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:44)
- `prescription_schedule_type()` — [php/prescription_helpers.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:50)
- `prescription_default_time_slots()` — [php/prescription_helpers.php:66](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:66)
- `prescription_normalize_time_slots()` — [php/prescription_helpers.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:80)
- `prescription_normalize_days()` — [php/prescription_helpers.php:95](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:95)
- `prescription_normalize_item()` — [php/prescription_helpers.php:103](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:103)
- `prescription_normalize_items()` — [php/prescription_helpers.php:150](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:150)
- `prescription_flatten_diagnosis_items()` — [php/prescription_helpers.php:165](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:165)
- `prescription_owner_id()` — [php/prescription_helpers.php:181](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:181)
- `prescription_event()` — [php/prescription_helpers.php:198](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:198)
- `prescription_insert_plan_items()` — [php/prescription_helpers.php:204](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:204)
- `prescription_sync_plan()` — [php/prescription_helpers.php:235](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:235)
- `prescription_notify_plan()` — [php/prescription_helpers.php:311](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:311)
- `prescription_format_item()` — [php/prescription_helpers.php:347](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:347)
- `prescription_fetch_plans()` — [php/prescription_helpers.php:373](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:373)
- `prescription_duration_end()` — [php/prescription_helpers.php:460](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:460)
- `prescription_generate_occurrences()` — [php/prescription_helpers.php:471](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:471)
- `prescription_refresh_plan_status()` — [php/prescription_helpers.php:531](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php:531)

### prescriptions — backend

Definition: [php/prescriptions.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:1) · diagram tab 29.

- `prescriptions_input()` — [php/prescriptions.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:9)
- `prescriptions_error()` — [php/prescriptions.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:14)
- `prescriptions_current_actor()` — [php/prescriptions.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:19)
- `prescriptions_plan_row()` — [php/prescriptions.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:28)
- `prescriptions_owner_has_pet()` — [php/prescriptions.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:40)
- `prescriptions_assert_access()` — [php/prescriptions.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:47)
- `prescriptions_list()` — [php/prescriptions.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:64)
- `prescriptions_start()` — [php/prescriptions.php:84](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:84)
- `prescriptions_update_occurrence()` — [php/prescriptions.php:152](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:152)
- `prescriptions_amend()` — [php/prescriptions.php:195](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:195)

### queue_assignment_helpers — backend

Definition: [php/queue_assignment_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/queue_assignment_helpers.php:1) · diagram tab 26.

- `vetQueueAssignmentsTableExists()` — [php/queue_assignment_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/queue_assignment_helpers.php:3)
- `requireVetQueueAssignmentsTable()` — [php/queue_assignment_helpers.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/queue_assignment_helpers.php:10)
- `normalizeVetName()` — [php/queue_assignment_helpers.php:17](C:/Users/Admin/WebstormProjects/untitled1/php/queue_assignment_helpers.php:17)

### receive_booking — backend

Definition: [php/receive_booking.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/receive_booking.php:1) · diagram tab 23.


### receive_queue — backend

Definition: [php/receive_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/receive_queue.php:1) · diagram tab 26.


### record_update_requests — backend

Definition: [php/record_update_requests.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:1) · diagram tab 30.

- `record_request_input()` — [php/record_update_requests.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:10)
- `record_request_error()` — [php/record_update_requests.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:15)
- `record_request_table_exists()` — [php/record_update_requests.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:28)
- `record_request_nullable_int()` — [php/record_update_requests.php:41](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:41)
- `record_request_nullable_text()` — [php/record_update_requests.php:50](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:50)
- `record_request_resolve_pet_id()` — [php/record_update_requests.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:57)
- `record_request_ensure_schema()` — [php/record_update_requests.php:89](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:89)
- `record_request_allowed_statuses()` — [php/record_update_requests.php:96](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:96)
- `record_request_allowed_payment_statuses()` — [php/record_update_requests.php:101](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:101)
- `record_request_validate_status()` — [php/record_update_requests.php:106](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:106)
- `record_request_validate_payment_status()` — [php/record_update_requests.php:119](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:119)
- `record_request_payment_is_cleared()` — [php/record_update_requests.php:132](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:132)
- `record_request_require_cleared_payment()` — [php/record_update_requests.php:137](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:137)
- `record_request_require_action_status()` — [php/record_update_requests.php:147](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:147)
- `record_request_require_veterinarian()` — [php/record_update_requests.php:158](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:158)
- `record_request_write_transition_event()` — [php/record_update_requests.php:199](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:199)
- `record_request_snapshot_supported()` — [php/record_update_requests.php:236](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:236)
- `record_request_snapshot_rows()` — [php/record_update_requests.php:251](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:251)
- `record_request_pet_snapshot_hash()` — [php/record_update_requests.php:273](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:273)
- `record_request_number()` — [php/record_update_requests.php:368](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:368)
- `record_request_row()` — [php/record_update_requests.php:379](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:379)
- `record_request_fetch()` — [php/record_update_requests.php:420](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:420)
- `record_request_create()` — [php/record_update_requests.php:548](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:548)
- `record_request_update()` — [php/record_update_requests.php:675](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:675)

### reenter_queue — backend

Definition: [php/reenter_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reenter_queue.php:1) · diagram tab 26.


### reference_number_helpers — backend

Definition: [php/reference_number_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reference_number_helpers.php:1) · diagram tab 12.

- `ipawcus_reference_timestamp()` — [php/reference_number_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/reference_number_helpers.php:3)
- `ipawcus_reference_suffix()` — [php/reference_number_helpers.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/reference_number_helpers.php:9)
- `ipawcus_format_queue_reference()` — [php/reference_number_helpers.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/reference_number_helpers.php:15)
- `ipawcus_reference_sequence()` — [php/reference_number_helpers.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/reference_number_helpers.php:20)
- `ipawcus_generate_booking_number()` — [php/reference_number_helpers.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/reference_number_helpers.php:26)

### register — backend

Definition: [php/register.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/register.php:1) · diagram tab 14.


### reports_common — backend

Definition: [php/reports_common.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1) · diagram tab 39.

- `reports_payload()` — [php/reports_common.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:8)
- `reports_json()` — [php/reports_common.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:16)
- `reports_normalize_role()` — [php/reports_common.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:23)
- `reports_require_super_admin()` — [php/reports_common.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:28)
- `reports_date_or_null()` — [php/reports_common.php:43](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:43)
- `reports_date_range()` — [php/reports_common.php:58](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:58)
- `reports_previous_comparison_range()` — [php/reports_common.php:121](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:121)
- `reports_filters()` — [php/reports_common.php:158](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:158)
- `reports_append_branch_filter()` — [php/reports_common.php:193](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:193)
- `reports_table_exists()` — [php/reports_common.php:202](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:202)
- `reports_column_exists()` — [php/reports_common.php:221](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:221)
- `reports_has_tables()` — [php/reports_common.php:242](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:242)
- `reports_fetch_all()` — [php/reports_common.php:255](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:255)
- `reports_money()` — [php/reports_common.php:267](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:267)
- `reports_int()` — [php/reports_common.php:272](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:272)
- `reports_full_name()` — [php/reports_common.php:277](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:277)
- `reports_metric()` — [php/reports_common.php:287](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:287)
- `reports_empty_chart()` — [php/reports_common.php:305](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:305)
- `reports_bar_chart()` — [php/reports_common.php:314](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:314)
- `reports_line_chart()` — [php/reports_common.php:326](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:326)
- `reports_doughnut_chart()` — [php/reports_common.php:338](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:338)
- `reports_revenue_breakdown_trend()` — [php/reports_common.php:350](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:350)
- `reports_period_expression()` — [php/reports_common.php:378](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:378)
- `reports_period_label_for_datetime()` — [php/reports_common.php:411](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:411)
- `reports_merge_period_values()` — [php/reports_common.php:440](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:440)
- `reports_revenue_diagnosis_trend()` — [php/reports_common.php:462](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:462)
- `reports_online_appointment_trend()` — [php/reports_common.php:503](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:503)
- `reports_queue_booking_trend()` — [php/reports_common.php:546](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:546)
- `reports_boarding_trend()` — [php/reports_common.php:591](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:591)
- `reports_pet_distribution_chart()` — [php/reports_common.php:629](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:629)
- `reports_staff_monitoring()` — [php/reports_common.php:670](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:670)
- `reports_title_map()` — [php/reports_common.php:763](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:763)
- `reports_allowed_type()` — [php/reports_common.php:784](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:784)
- `reports_financial_visit_rows()` — [php/reports_common.php:807](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:807)
- `reports_unlinked_booking_billing_rows()` — [php/reports_common.php:920](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:920)
- `reports_record_update_payment_rows()` — [php/reports_common.php:979](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:979)
- `reports_collection_rows()` — [php/reports_common.php:1031](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1031)
- `reports_financial_totals()` — [php/reports_common.php:1222](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1222)
- `reports_sales_chart_details()` — [php/reports_common.php:1251](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1251)
- `reports_sales_report()` — [php/reports_common.php:1346](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1346)
- `reports_billing_report()` — [php/reports_common.php:1443](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1443)
- `reports_invoice_receipt_report()` — [php/reports_common.php:1481](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1481)
- `reports_service_utilization_report()` — [php/reports_common.php:1657](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1657)
- `reports_appointment_report()` — [php/reports_common.php:1770](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1770)
- `reports_queue_report()` — [php/reports_common.php:1862](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1862)
- `reports_consultation_report()` — [php/reports_common.php:1961](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:1961)
- `reports_follow_up_report()` — [php/reports_common.php:2063](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2063)
- `reports_emr_request_report()` — [php/reports_common.php:2135](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2135)
- `reports_inventory_status_report()` — [php/reports_common.php:2195](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2195)
- `reports_stock_movement_report()` — [php/reports_common.php:2349](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2349)
- `reports_medicine_product_sales_report()` — [php/reports_common.php:2427](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2427)
- `reports_confinement_pet_hotel_report()` — [php/reports_common.php:2551](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2551)
- `reports_consent_record_date_expression()` — [php/reports_common.php:2673](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2673)
- `reports_consent_legacy_booking_rows()` — [php/reports_common.php:2708](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2708)
- `reports_consent_legacy_queue_rows()` — [php/reports_common.php:2754](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2754)
- `reports_consent_record_response()` — [php/reports_common.php:2798](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2798)
- `reports_consent_form_report()` — [php/reports_common.php:2850](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2850)
- `reports_veterinarian_activity_report()` — [php/reports_common.php:2974](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:2974)
- `reports_blank_report()` — [php/reports_common.php:3101](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3101)
- `reports_humanize_key()` — [php/reports_common.php:3120](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3120)
- `reports_humanize_value()` — [php/reports_common.php:3125](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3125)
- `reports_payment_method_labels()` — [php/reports_common.php:3135](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3135)
- `reports_currency_label()` — [php/reports_common.php:3157](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3157)
- `reports_metric_is_currency()` — [php/reports_common.php:3165](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3165)
- `reports_metric_display()` — [php/reports_common.php:3183](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3183)
- `reports_numeric_or_null()` — [php/reports_common.php:3207](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3207)
- `reports_percent_label()` — [php/reports_common.php:3212](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3212)
- `reports_report_profile()` — [php/reports_common.php:3224](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3224)
- `reports_filter_summary()` — [php/reports_common.php:3311](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3311)
- `reports_metric_detail()` — [php/reports_common.php:3336](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3336)
- `reports_key_breakdowns()` — [php/reports_common.php:3400](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3400)
- `reports_management_actions()` — [php/reports_common.php:3420](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3420)
- `reports_metric_delta_display()` — [php/reports_common.php:3485](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3485)
- `reports_comparison_summary()` — [php/reports_common.php:3503](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3503)
- `reports_enrich_report()` — [php/reports_common.php:3567](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3567)
- `reports_build_report()` — [php/reports_common.php:3609](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3609)
- `reports_consent_management_count()` — [php/reports_common.php:3663](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3663)
- `reports_clinic_visit_count()` — [php/reports_common.php:3678](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3678)
- `reports_inventory_material_type_overview()` — [php/reports_common.php:3701](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3701)
- `reports_dashboard()` — [php/reports_common.php:3734](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php:3734)

### reports_dashboard — backend

Definition: [php/reports_dashboard.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reports_dashboard.php:1) · diagram tab 39.


### reports_generate — backend

Definition: [php/reports_generate.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reports_generate.php:1) · diagram tab 39.


### return_queue — backend

Definition: [php/return_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/return_queue.php:1) · diagram tab 26.


### role_access — backend

Definition: [php/role_access.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:1) · diagram tab 12.

- `ipawcus_access_json()` — [php/role_access.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:5)
- `ipawcus_role_groups()` — [php/role_access.php:17](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:17)
- `ipawcus_roles()` — [php/role_access.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:32)
- `ipawcus_admin_feature_keys()` — [php/role_access.php:38](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:38)
- `ipawcus_admin_feature_permissions_table_exists()` — [php/role_access.php:56](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:56)
- `ipawcus_admin_feature_permissions()` — [php/role_access.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:80)
- `ipawcus_admin_feature_for_mutation()` — [php/role_access.php:110](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:110)
- `ipawcus_public_route()` — [php/role_access.php:133](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:133)
- `ipawcus_route_access_policy()` — [php/role_access.php:149](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:149)
- `ipawcus_require_current_api_user()` — [php/role_access.php:399](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:399)
- `ipawcus_enforce_route_access()` — [php/role_access.php:419](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:419)
- `ipawcus_media_access_roles()` — [php/role_access.php:460](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:460)
- `ipawcus_media_table_exists()` — [php/role_access.php:476](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:476)
- `ipawcus_media_column_exists()` — [php/role_access.php:489](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:489)
- `ipawcus_media_path_patterns()` — [php/role_access.php:503](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:503)
- `ipawcus_media_path_condition()` — [php/role_access.php:517](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:517)
- `ipawcus_owner_can_view_media()` — [php/role_access.php:536](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:536)
- `ipawcus_enforce_media_access()` — [php/role_access.php:759](C:/Users/Admin/WebstormProjects/untitled1/php/role_access.php:759)

### runtime_media — backend

Definition: [php/runtime_media.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/runtime_media.php:1) · diagram tab 41.

- `ipawcus_runtime_media_root()` — [php/runtime_media.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/runtime_media.php:18)
- `ipawcus_runtime_media_directory()` — [php/runtime_media.php:79](C:/Users/Admin/WebstormProjects/untitled1/php/runtime_media.php:79)
- `ipawcus_runtime_media_path()` — [php/runtime_media.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/runtime_media.php:94)

### service_catalog — backend

Definition: [php/service_catalog.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:1) · diagram tab 37.

- `service_catalog_input()` — [php/service_catalog.php:8](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:8)
- `service_catalog_table_exists()` — [php/service_catalog.php:13](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:13)
- `service_catalog_column_exists()` — [php/service_catalog.php:26](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:26)
- `service_catalog_schema_ready()` — [php/service_catalog.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:40)
- `service_catalog_table_readable()` — [php/service_catalog.php:47](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:47)
- `service_catalog_missing_message()` — [php/service_catalog.php:63](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:63)
- `service_catalog_text()` — [php/service_catalog.php:68](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:68)
- `service_catalog_nullable_text()` — [php/service_catalog.php:73](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:73)
- `service_catalog_error()` — [php/service_catalog.php:79](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:79)
- `service_catalog_require_schema()` — [php/service_catalog.php:88](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:88)
- `service_catalog_require_admin()` — [php/service_catalog.php:95](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:95)
- `service_catalog_notify_super_admin()` — [php/service_catalog.php:105](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:105)
- `service_catalog_format_material()` — [php/service_catalog.php:122](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:122)
- `service_catalog_list()` — [php/service_catalog.php:142](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:142)
- `service_catalog_validate_type()` — [php/service_catalog.php:222](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:222)
- `service_catalog_save()` — [php/service_catalog.php:243](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:243)
- `service_catalog_save_materials()` — [php/service_catalog.php:326](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:326)
- `service_catalog_reference_count()` — [php/service_catalog.php:446](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:446)
- `service_catalog_delete()` — [php/service_catalog.php:458](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:458)

### service_display_settings — backend

Definition: [php/service_display_settings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/service_display_settings.php:1) · diagram tab 37.

- `service_display_json()` — [php/service_display_settings.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/service_display_settings.php:9)
- `service_display_table_exists()` — [php/service_display_settings.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/service_display_settings.php:16)

### special_services — backend

Definition: [php/special_services.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:1) · diagram tab 37.

- `tableExists()` — [php/special_services.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:6)
- `columnExists()` — [php/special_services.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:18)
- `specialServiceDateColumnsExist()` — [php/special_services.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:32)
- `specialServiceBasePriceColumnExists()` — [php/special_services.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:39)
- `specialServiceBasePricePayload()` — [php/special_services.php:44](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:44)
- `normalizeSpecialServiceBasePrice()` — [php/special_services.php:61](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:61)
- `normalizeServiceCode()` — [php/special_services.php:96](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:96)
- `generateUniqueServiceCode()` — [php/special_services.php:104](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:104)
- `fetchSpecialService()` — [php/special_services.php:131](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:131)
- `getSpecialServiceBookedPets()` — [php/special_services.php:158](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:158)
- `attachSpecialServiceUsage()` — [php/special_services.php:204](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:204)
- `normalizePriceLabel()` — [php/special_services.php:214](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:214)
- `serializeSpecialService()` — [php/special_services.php:235](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:235)
- `isSpecialServiceAdmin()` — [php/special_services.php:270](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:270)
- `nullableTrimmedString()` — [php/special_services.php:283](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:283)
- `normalizeDateRestrictionType()` — [php/special_services.php:293](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:293)
- `normalizeDateValue()` — [php/special_services.php:299](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:299)
- `payloadRequestsDateRestriction()` — [php/special_services.php:313](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:313)
- `normalizeDateRestrictionFields()` — [php/special_services.php:321](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:321)
- `seedDefaultSpecialServices()` — [php/special_services.php:375](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:375)

### staff_activity — backend

Definition: [php/staff_activity.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity.php:1) · diagram tab 39.


### staff_activity_helpers — backend

Definition: [php/staff_activity_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:1) · diagram tab 39.

- `staff_activity_tracked_role()` — [php/staff_activity_helpers.php:6](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:6)
- `staff_activity_require_column()` — [php/staff_activity_helpers.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:15)
- `staff_activity_log_directory()` — [php/staff_activity_helpers.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:24)
- `staff_activity_branch()` — [php/staff_activity_helpers.php:56](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:56)
- `staff_activity_detail_text()` — [php/staff_activity_helpers.php:67](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:67)
- `staff_activity_enrich_inventory_input()` — [php/staff_activity_helpers.php:96](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:96)
- `staff_activity_booking_subject()` — [php/staff_activity_helpers.php:161](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:161)
- `staff_activity_pet_subject()` — [php/staff_activity_helpers.php:175](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:175)
- `staff_activity_apply_subject()` — [php/staff_activity_helpers.php:184](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:184)
- `staff_activity_enrich_clinical_input()` — [php/staff_activity_helpers.php:197](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:197)
- `staff_activity_action_details()` — [php/staff_activity_helpers.php:321](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:321)
- `staff_activity_action_summary()` — [php/staff_activity_helpers.php:438](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:438)
- `staff_activity_target_label()` — [php/staff_activity_helpers.php:451](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:451)
- `staff_activity_planning_status()` — [php/staff_activity_helpers.php:466](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:466)
- `staff_activity_record()` — [php/staff_activity_helpers.php:529](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:529)
- `staff_activity_lines_newest()` — [php/staff_activity_helpers.php:576](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:576)
- `staff_activity_entries()` — [php/staff_activity_helpers.php:607](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:607)
- `staff_activity_is_pos_billing_entry()` — [php/staff_activity_helpers.php:657](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:657)
- `staff_activity_action_key()` — [php/staff_activity_helpers.php:672](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:672)
- `staff_activity_is_medical_record_update_entry()` — [php/staff_activity_helpers.php:680](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:680)
- `staff_activity_reference_without_id()` — [php/staff_activity_helpers.php:686](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:686)
- `staff_activity_grooming_booking_id()` — [php/staff_activity_helpers.php:711](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:711)
- `staff_activity_enrich_list_entry()` — [php/staff_activity_helpers.php:736](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:736)
- `staff_activity_list()` — [php/staff_activity_helpers.php:780](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:780)
- `staff_activity_options()` — [php/staff_activity_helpers.php:826](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:826)
- `staff_activity_input_number()` — [php/staff_activity_helpers.php:865](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:865)
- `staff_activity_lookup_branch()` — [php/staff_activity_helpers.php:876](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:876)
- `staff_activity_is_global_path()` — [php/staff_activity_helpers.php:888](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:888)
- `staff_activity_request_branch()` — [php/staff_activity_helpers.php:894](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:894)
- `staff_activity_describe_mutation()` — [php/staff_activity_helpers.php:1036](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:1036)
- `staff_activity_register_mutation()` — [php/staff_activity_helpers.php:1198](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php:1198)

### status_display — backend

Definition: [php/status_display.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:1) · diagram tab 12.

- `status_display_table_exists()` — [php/status_display.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:9)
- `status_display_text()` — [php/status_display.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:22)
- `status_display_service_label()` — [php/status_display.php:28](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:28)
- `status_display_reference()` — [php/status_display.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:39)
- `status_display_pet_name()` — [php/status_display.php:53](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:53)
- `status_display_queue_stage()` — [php/status_display.php:58](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:58)
- `status_display_booking_stage()` — [php/status_display.php:89](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:89)
- `status_display_billing_stage()` — [php/status_display.php:109](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:109)
- `status_display_public_pet()` — [php/status_display.php:133](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:133)
- `status_display_queue_item()` — [php/status_display.php:142](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:142)
- `status_display_booking_item()` — [php/status_display.php:158](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:158)
- `status_display_billing_item()` — [php/status_display.php:173](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:173)

### system_backup_common — backend

Definition: [php/system_backup_common.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:1) · diagram tab 42.

- `ipawcus_backup_module_enabled()` — [php/system_backup_common.php:15](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:15)
- `ipawcus_backup_begin_local_download_storage()` — [php/system_backup_common.php:20](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:20)
- `ipawcus_backup_base_storage_root()` — [php/system_backup_common.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:39)
- `ipawcus_backup_storage_root()` — [php/system_backup_common.php:54](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:54)
- `ipawcus_backup_path()` — [php/system_backup_common.php:68](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:68)
- `ipawcus_backup_table_exists()` — [php/system_backup_common.php:77](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:77)
- `ipawcus_backup_require_schema()` — [php/system_backup_common.php:84](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:84)
- `ipawcus_backup_relative_path()` — [php/system_backup_common.php:91](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:91)
- `ipawcus_backup_resolve_stored_path()` — [php/system_backup_common.php:99](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:99)
- `ipawcus_backup_uuid()` — [php/system_backup_common.php:117](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:117)
- `ipawcus_backup_quote_identifier()` — [php/system_backup_common.php:126](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:126)
- `ipawcus_backup_list_tables()` — [php/system_backup_common.php:134](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:134)
- `ipawcus_backup_table_metadata()` — [php/system_backup_common.php:145](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:145)
- `ipawcus_backup_schema()` — [php/system_backup_common.php:163](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:163)
- `ipawcus_backup_schema_hash()` — [php/system_backup_common.php:183](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:183)
- `ipawcus_backup_schema_extras()` — [php/system_backup_common.php:201](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:201)
- `ipawcus_backup_binary_columns()` — [php/system_backup_common.php:235](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:235)
- `ipawcus_backup_sql_value()` — [php/system_backup_common.php:247](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:247)
- `ipawcus_backup_write()` — [php/system_backup_common.php:262](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:262)
- `ipawcus_backup_row_key()` — [php/system_backup_common.php:275](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:275)
- `ipawcus_backup_row_hash()` — [php/system_backup_common.php:284](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:284)
- `ipawcus_backup_write_insert()` — [php/system_backup_common.php:289](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:289)
- `ipawcus_backup_write_delete()` — [php/system_backup_common.php:311](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:311)
- `ipawcus_backup_previous()` — [php/system_backup_common.php:325](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:325)
- `ipawcus_backup_base()` — [php/system_backup_common.php:332](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:332)
- `ipawcus_backup_load_state()` — [php/system_backup_common.php:339](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:339)
- `ipawcus_backup_write_database()` — [php/system_backup_common.php:352](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:352)
- `ipawcus_backup_scan_media()` — [php/system_backup_common.php:477](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:477)
- `ipawcus_backup_update_progress()` — [php/system_backup_common.php:535](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:535)
- `ipawcus_backup_format_row()` — [php/system_backup_common.php:541](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:541)
- `ipawcus_backup_list()` — [php/system_backup_common.php:572](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:572)
- `ipawcus_backup_restore_instructions()` — [php/system_backup_common.php:593](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:593)
- `ipawcus_backup_public_failure_stage()` — [php/system_backup_common.php:605](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:605)
- `ipawcus_backup_safe_failure_message()` — [php/system_backup_common.php:617](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:617)
- `ipawcus_backup_create()` — [php/system_backup_common.php:638](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:638)
- `ipawcus_backup_archive_for_download()` — [php/system_backup_common.php:878](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:878)
- `ipawcus_backup_cleanup_temporary_root()` — [php/system_backup_common.php:895](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:895)
- `ipawcus_backup_mark_local_download_finished()` — [php/system_backup_common.php:926](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php:926)

### system_backup_excel — backend

Definition: [php/system_backup_excel.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:1) · diagram tab 42.

- `ipawcus_backup_excel_escape()` — [php/system_backup_excel.php:7](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:7)
- `ipawcus_backup_excel_column_name()` — [php/system_backup_excel.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:22)
- `ipawcus_backup_excel_table_exists()` — [php/system_backup_excel.php:33](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:33)
- `ipawcus_backup_excel_columns()` — [php/system_backup_excel.php:40](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:40)
- `ipawcus_backup_excel_has_columns()` — [php/system_backup_excel.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:49)
- `ipawcus_backup_excel_rows()` — [php/system_backup_excel.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:55)
- `ipawcus_backup_excel_query_sheet()` — [php/system_backup_excel.php:66](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:66)
- `ipawcus_backup_excel_message_sheet()` — [php/system_backup_excel.php:77](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:77)
- `ipawcus_backup_excel_raw_sheet()` — [php/system_backup_excel.php:90](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:90)
- `ipawcus_backup_excel_heading()` — [php/system_backup_excel.php:115](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:115)
- `ipawcus_backup_excel_definitions()` — [php/system_backup_excel.php:140](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:140)
- `ipawcus_backup_excel_action_sheet()` — [php/system_backup_excel.php:342](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:342)
- `ipawcus_create_emergency_workbook()` — [php/system_backup_excel.php:382](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:382)
- `ipawcus_create_workbook_from_definitions()` — [php/system_backup_excel.php:388](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:388)
- `ipawcus_backup_excel_write_sheet()` — [php/system_backup_excel.php:432](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:432)
- `ipawcus_backup_excel_content_types()` — [php/system_backup_excel.php:503](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:503)
- `ipawcus_backup_excel_root_relationships()` — [php/system_backup_excel.php:520](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:520)
- `ipawcus_backup_excel_workbook()` — [php/system_backup_excel.php:530](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:530)
- `ipawcus_backup_excel_workbook_relationships()` — [php/system_backup_excel.php:540](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:540)
- `ipawcus_backup_excel_styles()` — [php/system_backup_excel.php:551](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:551)
- `ipawcus_backup_excel_core_properties()` — [php/system_backup_excel.php:564](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:564)
- `ipawcus_backup_excel_app_properties()` — [php/system_backup_excel.php:574](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_excel.php:574)

### system_backup_zip — backend

Definition: [php/system_backup_zip.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:1) · diagram tab 42.

- `__construct()` — [php/system_backup_zip.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:18)
- `addString()` — [php/system_backup_zip.php:27](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:27)
- `addFile()` — [php/system_backup_zip.php:45](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:45)
- `close()` — [php/system_backup_zip.php:63](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:63)
- `__destruct()` — [php/system_backup_zip.php:130](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:130)
- `addStream()` — [php/system_backup_zip.php:138](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:138)
- `normalizeArchivePath()` — [php/system_backup_zip.php:227](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:227)
- `dosDateTime()` — [php/system_backup_zip.php:236](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:236)
- `write()` — [php/system_backup_zip.php:245](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_zip.php:245)

### system_backups — backend

Definition: [php/system_backups.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_backups.php:1) · diagram tab 42.

- `ipawcus_system_backups_json()` — [php/system_backups.php:25](C:/Users/Admin/WebstormProjects/untitled1/php/system_backups.php:25)
- `ipawcus_system_backups_cleanup_temporary_files()` — [php/system_backups.php:34](C:/Users/Admin/WebstormProjects/untitled1/php/system_backups.php:34)
- `ipawcus_system_backups_stream_local_export()` — [php/system_backups.php:43](C:/Users/Admin/WebstormProjects/untitled1/php/system_backups.php:43)

### system_problem_report — backend

Definition: [php/system_problem_report.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:1) · diagram tab 12.

- `problem_report_response()` — [php/system_problem_report.php:12](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:12)
- `problem_report_text()` — [php/system_problem_report.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:19)
- `problem_report_path()` — [php/system_problem_report.php:36](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:36)
- `problem_report_id()` — [php/system_problem_report.php:55](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:55)
- `problem_report_rate_limit_allowed()` — [php/system_problem_report.php:65](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:65)
- `problem_report_database_diagnostic()` — [php/system_problem_report.php:119](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:119)
- `problem_report_html_row()` — [php/system_problem_report.php:236](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:236)

### update_account_profile — backend

Definition: [php/update_account_profile.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_profile.php:1) · diagram tab 16.

- `account_profile_json()` — [php/update_account_profile.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_profile.php:11)
- `account_profile_normalize_role()` — [php/update_account_profile.php:18](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_profile.php:18)
- `account_profile_require_super_admin()` — [php/update_account_profile.php:23](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_profile.php:23)

### update_account_status — backend

Definition: [php/update_account_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_status.php:1) · diagram tab 16.


### update_booking_branch — backend

Definition: [php/update_booking_branch.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_branch.php:1) · diagram tab 17.


### update_booking_schedule — backend

Definition: [php/update_booking_schedule.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_schedule.php:1) · diagram tab 23.


### update_booking_status — backend

Definition: [php/update_booking_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:1) · diagram tab 23.

- `booking_status_column_exists()` — [php/update_booking_status.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:19)
- `booking_status_ensure_payment_columns()` — [php/update_booking_status.php:33](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:33)
- `booking_status_service_key()` — [php/update_booking_status.php:42](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:42)
- `booking_status_is_deceased_pet()` — [php/update_booking_status.php:51](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:51)
- `booking_status_pet_ids()` — [php/update_booking_status.php:56](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:56)
- `booking_status_has_online_vet_conflict()` — [php/update_booking_status.php:74](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:74)
- `booking_status_home_service_limit_conflict()` — [php/update_booking_status.php:109](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:109)
- `booking_status_revalidate_confirmation()` — [php/update_booking_status.php:154](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:154)

### update_consent_file — backend

Definition: [php/update_consent_file.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_consent_file.php:1) · diagram tab 31.


### update_password — backend

Definition: [php/update_password.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_password.php:1) · diagram tab 16.


### update_pet — backend

Definition: [php/update_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_pet.php:1) · diagram tab 21.


### update_pet_status — backend

Definition: [php/update_pet_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_pet_status.php:1) · diagram tab 21.


### update_queue_status — backend

Definition: [php/update_queue_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_queue_status.php:1) · diagram tab 26.


### update_user — backend

Definition: [php/update_user.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_user.php:1) · diagram tab 16.


### update_user_profile — backend

Definition: [php/update_user_profile.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_user_profile.php:1) · diagram tab 16.

- `addFieldIfPresent()` — [php/update_user_profile.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/update_user_profile.php:24)
- `addJsonFieldIfPresent()` — [php/update_user_profile.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/update_user_profile.php:32)

### update_vet_schedule — backend

Definition: [php/update_vet_schedule.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_vet_schedule.php:1) · diagram tab 17.


### upload — backend

Definition: [php/upload.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/upload.php:1) · diagram tab 34.

- `ipawcus_upload_name_token()` — [php/upload.php:10](C:/Users/Admin/WebstormProjects/untitled1/php/upload.php:10)
- `ipawcus_upload_readable_file_name()` — [php/upload.php:32](C:/Users/Admin/WebstormProjects/untitled1/php/upload.php:32)

### upload_media — backend

Definition: [php/upload_media.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/upload_media.php:1) · diagram tab 41.


### upload_receipt_helpers — backend

Definition: [php/upload_receipt_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:1) · diagram tab 41.

- `ipawcus_upload_receipt_base64url_encode()` — [php/upload_receipt_helpers.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:9)
- `ipawcus_upload_receipt_base64url_decode()` — [php/upload_receipt_helpers.php:14](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:14)
- `ipawcus_upload_receipt_secret()` — [php/upload_receipt_helpers.php:30](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:30)
- `ipawcus_upload_receipt_normalize_path()` — [php/upload_receipt_helpers.php:45](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:45)
- `ipawcus_upload_receipt_normalize_claims()` — [php/upload_receipt_helpers.php:64](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:64)
- `ipawcus_upload_receipt_issue()` — [php/upload_receipt_helpers.php:82](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:82)
- `ipawcus_upload_receipt_verify()` — [php/upload_receipt_helpers.php:116](C:/Users/Admin/WebstormProjects/untitled1/php/upload_receipt_helpers.php:116)

### vet_diagnoses — backend

Definition: [php/vet_diagnoses.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:1) · diagram tab 27.

- `vetDiagnosisTableExists()` — [php/vet_diagnoses.php:22](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:22)
- `vetDiagnosisColumnExists()` — [php/vet_diagnoses.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:29)
- `vetDiagnosisMigrationMessage()` — [php/vet_diagnoses.php:43](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:43)
- `vetDiagnosisNullableText()` — [php/vet_diagnoses.php:48](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:48)
- `vetDiagnosisNullableInt()` — [php/vet_diagnoses.php:59](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:59)
- `vetDiagnosisDate()` — [php/vet_diagnoses.php:68](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:68)
- `vetDiagnosisCleanJsonValue()` — [php/vet_diagnoses.php:83](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:83)
- `vetDiagnosisJsonValue()` — [php/vet_diagnoses.php:109](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:109)
- `vetDiagnosisChargesFromInput()` — [php/vet_diagnoses.php:125](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:125)
- `vetDiagnosisDecodeJson()` — [php/vet_diagnoses.php:137](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:137)
- `vetDiagnosisWeightValue()` — [php/vet_diagnoses.php:148](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:148)
- `vetDiagnosisUpdatePetWeight()` — [php/vet_diagnoses.php:171](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:171)
- `vetDiagnosisVaccinationSelect()` — [php/vet_diagnoses.php:186](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:186)
- `vetDiagnosisVaccinationJoin()` — [php/vet_diagnoses.php:220](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:220)
- `vetDiagnosisFormatVaccinationRecord()` — [php/vet_diagnoses.php:229](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:229)
- `vetDiagnosisFormatRow()` — [php/vet_diagnoses.php:253](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:253)
- `vetDiagnosisBookingId()` — [php/vet_diagnoses.php:311](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:311)
- `vetDiagnosisFetchQueue()` — [php/vet_diagnoses.php:328](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:328)
- `vetDiagnosisRecordExists()` — [php/vet_diagnoses.php:342](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:342)
- `vetDiagnosisFetchBooking()` — [php/vet_diagnoses.php:350](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:350)
- `vetDiagnosisResolveAssignment()` — [php/vet_diagnoses.php:359](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:359)
- `vetDiagnosisHasCustomContent()` — [php/vet_diagnoses.php:425](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:425)
- `vetDiagnosisCompleteQueue()` — [php/vet_diagnoses.php:447](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:447)
- `vetDiagnosisCompleteBooking()` — [php/vet_diagnoses.php:487](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:487)
- `vetDiagnosisFetchFormattedById()` — [php/vet_diagnoses.php:497](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:497)
- `vetDiagnosisSaveVaccinationRecord()` — [php/vet_diagnoses.php:528](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:528)

### vet_presence — backend

Definition: [php/vet_presence.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/vet_presence.php:1) · diagram tab 17.


### vet_presence_helpers — backend

Definition: [php/vet_presence_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/vet_presence_helpers.php:1) · diagram tab 17.

- `vet_presence_state()` — [php/vet_presence_helpers.php:3](C:/Users/Admin/WebstormProjects/untitled1/php/vet_presence_helpers.php:3)

### veterinarian_booking_schedule — backend

Definition: [php/veterinarian_booking_schedule.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_booking_schedule.php:1) · diagram tab 18.

- `vet_booking_schedule_data()` — [php/veterinarian_booking_schedule.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_booking_schedule.php:11)

### veterinarian_booking_todo_helpers — backend

Definition: [php/veterinarian_booking_todo_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_booking_todo_helpers.php:1) · diagram tab 38.

- `veterinarian_booking_todo()` — [php/veterinarian_booking_todo_helpers.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_booking_todo_helpers.php:5)

### veterinarian_branch_schedules — backend

Definition: [php/veterinarian_branch_schedules.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_branch_schedules.php:1) · diagram tab 18.

- `vet_visit_normalize_services()` — [php/veterinarian_branch_schedules.php:9](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_branch_schedules.php:9)
- `vet_visit_parse_date()` — [php/veterinarian_branch_schedules.php:21](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_branch_schedules.php:21)
- `vet_visit_range_occurrences()` — [php/veterinarian_branch_schedules.php:30](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_branch_schedules.php:30)

### visit_billing — backend

Definition: [php/visit_billing.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1) · diagram tab 36.

- `visit_billing_input()` — [php/visit_billing.php:11](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:11)
- `visit_billing_table_exists()` — [php/visit_billing.php:16](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:16)
- `visit_billing_column_exists()` — [php/visit_billing.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:29)
- `visit_billing_api_user()` — [php/visit_billing.php:43](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:43)
- `visit_billing_assert_branch_access()` — [php/visit_billing.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:49)
- `visit_billing_resolve_branch_id()` — [php/visit_billing.php:62](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:62)
- `visit_billing_single_column_unique_index_exists()` — [php/visit_billing.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:94)
- `visit_billing_foreign_key_exists()` — [php/visit_billing.php:123](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:123)
- `visit_billing_column_type()` — [php/visit_billing.php:152](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:152)
- `visit_billing_schema_ready()` — [php/visit_billing.php:167](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:167)
- `visit_billing_missing_message()` — [php/visit_billing.php:178](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:178)
- `visit_billing_error()` — [php/visit_billing.php:183](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:183)
- `visit_billing_require_schema()` — [php/visit_billing.php:197](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:197)
- `visit_billing_invoice_document_schema_ready()` — [php/visit_billing.php:204](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:204)
- `visit_billing_require_invoice_document_schema()` — [php/visit_billing.php:232](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:232)
- `visit_billing_ensure_payment_method_schema()` — [php/visit_billing.php:242](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:242)
- `visit_billing_nullable_int()` — [php/visit_billing.php:258](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:258)
- `visit_billing_requested_id()` — [php/visit_billing.php:267](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:267)
- `visit_billing_nullable_text()` — [php/visit_billing.php:289](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:289)
- `visit_billing_invoice_relative_path()` — [php/visit_billing.php:295](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:295)
- `visit_billing_assert_invoice_pdf_file()` — [php/visit_billing.php:330](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:330)
- `visit_billing_save_invoice_document()` — [php/visit_billing.php:349](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:349)
- `visit_billing_fetch_invoice_documents()` — [php/visit_billing.php:448](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:448)
- `visit_billing_allowed()` — [php/visit_billing.php:482](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:482)
- `visit_billing_require_allowed()` — [php/visit_billing.php:487](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:487)
- `visit_billing_is_duplicate_key()` — [php/visit_billing.php:496](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:496)
- `visit_billing_decode_json()` — [php/visit_billing.php:505](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:505)
- `visit_billing_ensure_walk_in_patient()` — [php/visit_billing.php:516](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:516)
- `visit_billing_resolve_visit_context()` — [php/visit_billing.php:623](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:623)
- `visit_billing_fetch_visit_identity()` — [php/visit_billing.php:776](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:776)
- `visit_billing_assert_visit_identity()` — [php/visit_billing.php:803](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:803)
- `visit_billing_fetch_visit_id()` — [php/visit_billing.php:847](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:847)
- `visit_billing_net_paid_amount()` — [php/visit_billing.php:920](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:920)
- `visit_billing_complete_paid_grooming()` — [php/visit_billing.php:945](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:945)
- `visit_billing_update_status()` — [php/visit_billing.php:1054](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1054)
- `visit_billing_is_whole_quantity()` — [php/visit_billing.php:1099](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1099)
- `visit_billing_fetch_user()` — [php/visit_billing.php:1104](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1104)
- `visit_billing_current_actor()` — [php/visit_billing.php:1132](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1132)
- `visit_billing_require_actor()` — [php/visit_billing.php:1146](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1146)
- `visit_billing_lock_visit()` — [php/visit_billing.php:1156](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1156)
- `visit_billing_assert_charges_mutable()` — [php/visit_billing.php:1175](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1175)
- `visit_billing_resolve_stock_performer()` — [php/visit_billing.php:1198](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1198)
- `visit_billing_fetch_inventory_item()` — [php/visit_billing.php:1238](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1238)
- `visit_billing_consume_inventory_item()` — [php/visit_billing.php:1276](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1276)
- `visit_billing_reverse_visit_charge_stock()` — [php/visit_billing.php:1377](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1377)
- `visit_billing_fetch_service_materials()` — [php/visit_billing.php:1461](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1461)
- `visit_billing_expand_required_separate_materials()` — [php/visit_billing.php:1498](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1498)
- `visit_billing_boarding_material_usage_id()` — [php/visit_billing.php:1576](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1576)
- `visit_billing_validate_boarding_material_charge()` — [php/visit_billing.php:1620](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1620)
- `visit_billing_boarding_overstay_daily_rate()` — [php/visit_billing.php:1735](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1735)
- `visit_billing_boarding_overdue_days()` — [php/visit_billing.php:1767](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1767)
- `visit_billing_assert_boarding_invoice_complete()` — [php/visit_billing.php:1786](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1786)
- `visit_billing_assert_catalog_service_price()` — [php/visit_billing.php:1940](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1940)
- `visit_billing_save_charges()` — [php/visit_billing.php:1991](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1991)
- `visit_billing_validate_existing_and_collect_new_charges()` — [php/visit_billing.php:2179](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2179)
- `visit_billing_catalog_key()` — [php/visit_billing.php:2261](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2261)
- `visit_billing_booking_catalog_service()` — [php/visit_billing.php:2269](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2269)
- `visit_billing_booking_service_label()` — [php/visit_billing.php:2309](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2309)
- `visit_billing_exact_price_from_label()` — [php/visit_billing.php:2349](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2349)
- `visit_billing_booking_special_service()` — [php/visit_billing.php:2382](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2382)
- `visit_billing_default_booking_charges()` — [php/visit_billing.php:2429](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2429)
- `visit_billing_merge_booking_charges()` — [php/visit_billing.php:2560](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2560)
- `visit_billing_apply_confirmed_home_transport_payment()` — [php/visit_billing.php:2607](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2607)
- `visit_billing_save_visit_payload()` — [php/visit_billing.php:2789](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2789)
- `visit_billing_ensure_online_consultation_visit()` — [php/visit_billing.php:2961](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:2961)
- `visit_billing_upsert_visit()` — [php/visit_billing.php:3119](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3119)
- `visit_billing_fetch_visit()` — [php/visit_billing.php:3360](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3360)
- `visit_billing_list()` — [php/visit_billing.php:3526](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3526)
- `visit_billing_replace_charges()` — [php/visit_billing.php:3612](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3612)
- `visit_billing_insert_payment_payload()` — [php/visit_billing.php:3641](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3641)
- `visit_billing_add_payment()` — [php/visit_billing.php:3789](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3789)
- `visit_billing_add_refund()` — [php/visit_billing.php:3866](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:3866)

### workflow_guard_helpers — backend

Definition: [php/workflow_guard_helpers.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:1) · diagram tab 12.

- `ipawcus_guard_error()` — [php/workflow_guard_helpers.php:5](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:5)
- `ipawcus_guard_current_user()` — [php/workflow_guard_helpers.php:19](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:19)
- `ipawcus_guard_role()` — [php/workflow_guard_helpers.php:24](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:24)
- `ipawcus_guard_user_id()` — [php/workflow_guard_helpers.php:29](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:29)
- `ipawcus_guard_is_admin_role()` — [php/workflow_guard_helpers.php:34](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:34)
- `ipawcus_guard_is_clinic_role()` — [php/workflow_guard_helpers.php:39](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:39)
- `ipawcus_guard_is_vet_role()` — [php/workflow_guard_helpers.php:44](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:44)
- `ipawcus_guard_table_exists()` — [php/workflow_guard_helpers.php:49](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:49)
- `ipawcus_guard_column_exists()` — [php/workflow_guard_helpers.php:62](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:62)
- `ipawcus_guard_require_columns()` — [php/workflow_guard_helpers.php:76](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:76)
- `ipawcus_guard_pet_access()` — [php/workflow_guard_helpers.php:94](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:94)
- `ipawcus_guard_first_forbidden_pet()` — [php/workflow_guard_helpers.php:111](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:111)
- `ipawcus_guard_booking_access()` — [php/workflow_guard_helpers.php:122](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:122)
- `ipawcus_guard_validate_booking_transition()` — [php/workflow_guard_helpers.php:166](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:166)
- `ipawcus_guard_validate_queue_transition()` — [php/workflow_guard_helpers.php:196](C:/Users/Admin/WebstormProjects/untitled1/php/workflow_guard_helpers.php:196)

## HTTP dispatcher index

| Route / pattern | PHP handler(s) | Dispatcher evidence |
| --- | --- | --- |
| `/login` | [php/login.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/login.php:1) | [php/index.php:54](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:54) |
| `/auth/google` | [php/auth_google.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_google.php:1) | [php/index.php:57](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:57) |
| `/auth/google/complete` | [php/auth_google_complete.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_google_complete.php:1) | [php/index.php:60](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:60) |
| `/account/google` | [php/account_google.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/account_google.php:1) | [php/index.php:63](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:63) |
| `/activity` | [php/staff_activity.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity.php:1) | [php/index.php:66](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:66) |
| `/activity/options` | [php/staff_activity.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity.php:1) | [php/index.php:67](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:67) |
| `/activity/view` | [php/staff_activity.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity.php:1) | [php/index.php:68](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:68) |
| `/auth/verify-email` | [php/auth_verify_email.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_verify_email.php:1) | [php/index.php:71](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:71) |
| `/auth/resend-verification` | [php/auth_resend_verification.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_resend_verification.php:1) | [php/index.php:74](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:74) |
| `/auth/forgot-password` | [php/auth_forgot_password.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_forgot_password.php:1) | [php/index.php:77](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:77) |
| `/auth/verify-reset-code` | [php/auth_verify_reset_code.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_verify_reset_code.php:1) | [php/index.php:80](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:80) |
| `/auth/reset-password` | [php/auth_reset_password.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/auth_reset_password.php:1) | [php/index.php:83](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:83) |
| `/register` | [php/register.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/register.php:1) | [php/index.php:86](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:86) |
| `/users` | [php/register.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/register.php:1) | [php/index.php:87](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:87) |
| `/pet_information` | [php/add_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_pet.php:1), [php/get_pets.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pets.php:1) | [php/index.php:90](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:90) |
| `/pet_ownership/link` | [php/link_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/link_pet.php:1) | [php/index.php:98](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:98) |
| `/pet_ownership/coparent-requests` | [php/coparent_requests.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:1) | [php/index.php:101](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:101) |
| `/upload` | [php/upload.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/upload.php:1) | [php/index.php:104](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:104) |
| `/upload/delete` | [php/delete_upload.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/delete_upload.php:1) | [php/index.php:107](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:107) |
| `/uploads/media` | [php/upload_media.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/upload_media.php:1) | [php/index.php:110](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:110) |
| `/payment-methods` | [php/payment_methods.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:1) | [php/index.php:113](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:113) |
| `/payment-methods/otp` | [php/payment_methods.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/payment_methods.php:1) | [php/index.php:116](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:116) |
| `/bookings` | [php/add_booking.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_booking.php:1), [php/get_bookings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:1) | [php/index.php:120](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:120) |
| `/pet-catalog` | [php/pet_catalog.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_catalog.php:1) | [php/index.php:127](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:127) |
| `/booking-availability` | [php/booking_availability.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_availability.php:1) | [php/index.php:130](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:130) |
| `/online-consultations` | [php/online_consultations.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:1) | [php/index.php:133](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:133) |
| `/notifications` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:136](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:136) |
| `/notifications/preferences` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:139](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:139) |
| `/notifications/push/public-key` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:143](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:143) |
| `/notifications/push/status` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:147](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:147) |
| `/notifications/push/subscribe` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:151](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:151) |
| `/notifications/push/unsubscribe` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:155](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:155) |
| `/notifications/reminders/run` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:159](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:159) |
| `/todos` | [php/pet_owner_todos.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:1) | [php/index.php:163](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:163) |
| `/prescriptions` | [php/prescriptions.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:1) | [php/index.php:166](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:166) |
| `/lifecycle/recovery-report` | [php/lifecycle_recovery_report.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/lifecycle_recovery_report.php:1) | [php/index.php:169](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:169) |
| `/system-backups` | [php/system_backups.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_backups.php:1) | [php/index.php:172](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:172) |
| `/reports/dashboard` | [php/reports_dashboard.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reports_dashboard.php:1) | [php/index.php:175](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:175) |
| `/reports/generate` | [php/reports_generate.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reports_generate.php:1) | [php/index.php:178](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:178) |
| `/pet-media-monitoring` | [php/pet_media_monitoring.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_media_monitoring.php:1) | [php/index.php:181](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:181) |
| `/special_services` | [php/special_services.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:1) | [php/index.php:184](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:184) |
| `/service-catalog` | [php/service_catalog.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:1) | [php/index.php:187](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:187) |
| `/service-display-settings` | [php/service_display_settings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/service_display_settings.php:1) | [php/index.php:190](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:190) |
| `/vet-presence` | [php/vet_presence.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/vet_presence.php:1) | [php/index.php:193](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:193) |
| `/branches` | [php/branches.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/branches.php:1) | [php/index.php:196](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:196) |
| `/veterinarian-branch-schedules` | [php/veterinarian_branch_schedules.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_branch_schedules.php:1) | [php/index.php:199](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:199) |
| `/veterinarian-booking-schedule` | [php/veterinarian_booking_schedule.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/veterinarian_booking_schedule.php:1) | [php/index.php:202](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:202) |
| `/visits` | [php/visit_billing.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1) | [php/index.php:205](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:205) |
| `/rooms/availability` | [php/get_room_availability.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_room_availability.php:1) | [php/index.php:208](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:208) |
| `/grooming` | [php/grooming.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/grooming.php:1) | [php/index.php:211](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:211) |
| `/boarding/rooms` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:214](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:214) |
| `/boarding/direct-check-in` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:218](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:218) |
| `/boarding/monitoring` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:222](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:222) |
| `/boarding/owner-stays` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:226](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:226) |
| `/boarding/observations` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:230](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:230) |
| `/boarding/tasks` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:234](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:234) |
| `/boarding/documents` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:238](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:238) |
| `/boarding/materials` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:242](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:242) |
| `/record-update-requests` | [php/record_update_requests.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:1) | [php/index.php:246](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:246) |
| `/inventory` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:249](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:249) |
| `/inventory/meta` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:253](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:253) |
| `/inventory/items` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:257](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:257) |
| `/inventory/stock-in` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:261](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:261) |
| `/inventory/stock-out` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:265](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:265) |
| `/inventory/transfer` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:269](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:269) |
| `/inventory/delete` | [php/inventory.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/inventory.php:1) | [php/index.php:273](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:273) |
| `/accounts` | [php/get_accounts.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_accounts.php:1) | [php/index.php:277](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:277) |
| `/veterinarians` | [php/get_veterinarians.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_veterinarians.php:1) | [php/index.php:280](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:280) |
| `/pet-owner-accounts` | [php/pet_owner_accounts.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:1) | [php/index.php:283](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:283) |
| `/accounts/create` | [php/create_account.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/create_account.php:1) | [php/index.php:286](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:286) |
| `/consent_files` | [php/add_consent_file.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_consent_file.php:1), [php/get_consent_files.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_consent_files.php:1) | [php/index.php:293](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:293) |
| `/consent-form-records` | [php/consent_form_records.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/consent_form_records.php:1) | [php/index.php:300](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:300) |
| `/consent_form_records` | [php/consent_form_records.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/consent_form_records.php:1) | [php/index.php:301](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:301) |
| `/queues` | [php/add_to_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/add_to_queue.php:1), [php/get_queues.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_queues.php:1) | [php/index.php:304](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:304) |
| `/queues/pets` | [php/get_pets_for_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pets_for_queue.php:1) | [php/index.php:311](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:311) |
| `/queues/status` | [php/update_queue_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_queue_status.php:1) | [php/index.php:314](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:314) |
| `/queues/receive` | [php/receive_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/receive_queue.php:1) | [php/index.php:317](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:317) |
| `/queues/assign` | [php/assign_queue_vet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/assign_queue_vet.php:1) | [php/index.php:320](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:320) |
| `/queues/return` | [php/return_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/return_queue.php:1) | [php/index.php:323](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:323) |
| `/queues/reenter` | [php/reenter_queue.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/reenter_queue.php:1) | [php/index.php:326](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:326) |
| `/clinical-intakes` | [php/clinical_intakes.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php:1) | [php/index.php:329](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:329) |
| `/vet-diagnoses` | [php/vet_diagnoses.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:1) | [php/index.php:332](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:332) |
| `/self-service/access` | [php/check_self_service_access.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/check_self_service_access.php:1) | [php/index.php:335](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:335) |
| `/status-display` | [php/status_display.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:1) | [php/index.php:338](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:338) |
| `/tv-status` | [php/status_display.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/status_display.php:1) | [php/index.php:339](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:339) |
| `/vet_schedules` | [php/update_vet_schedule.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_vet_schedule.php:1), [php/get_vet_schedules.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_vet_schedules.php:1) | [php/index.php:342](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:342) |
| `/profile` | [php/update_user_profile.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_user_profile.php:1), [php/get_user_profile.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_user_profile.php:1) | [php/index.php:349](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:349) |
| `/admin-feature-access` | [php/admin_feature_access.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/admin_feature_access.php:1) | [php/index.php:356](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:356) |
| `/system/problem-report` | [php/system_problem_report.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/system_problem_report.php:1) | [php/index.php:359](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:359) |
| `/health` | [php/db.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/db.php:1) | [php/index.php:362](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:362) |
| `/users/{id}/pets` | [php/get_user_pets.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_user_pets.php:1) | [php/index.php:378](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:378) |
| `/pet_ownership/coparent-requests/{id}` | [php/coparent_requests.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/coparent_requests.php:1) | [php/index.php:381](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:381) |
| `/users/{id}/bookings` | [php/get_bookings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php:1) | [php/index.php:384](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:384) |
| `/users/{id}/todos` | [php/pet_owner_todos.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:1) | [php/index.php:387](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:387) |
| `/todos/{id}` | [php/pet_owner_todos.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_todos.php:1) | [php/index.php:390](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:390) |
| `/prescriptions/{id}/{id}` | [php/prescriptions.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:1) | [php/index.php:393](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:393) |
| `/prescription-occurrences/{id}` | [php/prescriptions.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php:1) | [php/index.php:397](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:397) |
| `/uploads/media/{id}` | [php/upload_media.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/upload_media.php:1) | [php/index.php:401](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:401) |
| `/pets/{id}/queues` | [php/get_pet_queues.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_queues.php:1) | [php/index.php:404](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:404) |
| `/pets/{id}/bookings` | [php/get_pet_bookings.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/get_pet_bookings.php:1) | [php/index.php:407](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:407) |
| `/pets/{id}/overdue/cancel` | [php/pet_overdue_cancellations.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_overdue_cancellations.php:1) | [php/index.php:410](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:410) |
| `/pets/{id}/certificates` | [php/pet_certificates.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_certificates.php:1) | [php/index.php:413](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:413) |
| `/pets/{id}/medical` | [php/pet_medical_records.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_medical_records.php:1) | [php/index.php:416](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:416) |
| `/record-update-requests/{id}` | [php/record_update_requests.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/record_update_requests.php:1) | [php/index.php:419](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:419) |
| `/vet-diagnoses/{id}` | [php/vet_diagnoses.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php:1) | [php/index.php:422](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:422) |
| `/users/{id}/password` | [php/update_password.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_password.php:1) | [php/index.php:425](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:425) |
| `/users/{id}` | [php/update_user.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_user.php:1) | [php/index.php:433](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:433) |
| `/accounts/{id}/status` | [php/update_account_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_status.php:1) | [php/index.php:440](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:440) |
| `/accounts/{id}/profile` | [php/update_account_profile.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_account_profile.php:1) | [php/index.php:448](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:448) |
| `/accounts/{id}` | [php/delete_account.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/delete_account.php:1) | [php/index.php:456](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:456) |
| `/pet-owner-accounts/{id}/status` | [php/pet_owner_accounts.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:1) | [php/index.php:464](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:464) |
| `/pet-owner-accounts/{id}/pets/{id}` | [php/pet_owner_accounts.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/pet_owner_accounts.php:1) | [php/index.php:468](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:468) |
| `/notifications/read-all` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:473](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:473) |
| `/notifications/{id}/read` | [php/notifications.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/notifications.php:1) | [php/index.php:476](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:476) |
| `/bookings/{id}/status` | [php/update_booking_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_status.php:1) | [php/index.php:480](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:480) |
| `/bookings/{id}/billing-context` | [php/booking_billing_context.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_billing_context.php:1) | [php/index.php:483](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:483) |
| `/bookings/{id}/payment-review` | [php/booking_payment_review.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_review.php:1) | [php/index.php:486](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:486) |
| `/bookings/{id}/payment-refunds` | [php/booking_payment_refund.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/booking_payment_refund.php:1) | [php/index.php:489](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:489) |
| `/bookings/{id}/receive` | [php/receive_booking.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/receive_booking.php:1) | [php/index.php:492](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:492) |
| `/bookings/{id}/schedule` | [php/update_booking_schedule.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_schedule.php:1) | [php/index.php:495](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:495) |
| `/bookings/{id}/branch` | [php/update_booking_branch.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_booking_branch.php:1) | [php/index.php:498](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:498) |
| `/boarding/bookings/{id}/assign-room` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:501](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:501) |
| `/boarding/bookings/{id}/check-in` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:505](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:505) |
| `/boarding/bookings/{id}/check-out` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:509](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:509) |
| `/boarding/bookings/{id}/desired-check-out` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:513](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:513) |
| `/boarding/bookings/{id}/documents` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:517](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:517) |
| `/boarding/tasks/{id}/complete` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:521](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:521) |
| `/boarding/materials/{id}` | [php/boarding_management.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/boarding_management.php:1) | [php/index.php:525](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:525) |
| `/service-catalog/{id}/materials` | [php/service_catalog.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:1) | [php/index.php:529](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:529) |
| `/service-catalog/{id}` | [php/service_catalog.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/service_catalog.php:1) | [php/index.php:533](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:533) |
| `/visits/{id}/charges` | [php/visit_billing.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1) | [php/index.php:536](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:536) |
| `/visits/{id}/payments` | [php/visit_billing.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1) | [php/index.php:540](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:540) |
| `/visits/{id}/refunds` | [php/visit_billing.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1) | [php/index.php:544](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:544) |
| `/visits/{id}` | [php/visit_billing.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php:1) | [php/index.php:548](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:548) |
| `/special_services/{id}` | [php/special_services.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/special_services.php:1) | [php/index.php:551](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:551) |
| `/online-consultations/{id}` | [php/online_consultations.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:1) | [php/index.php:559](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:559) |
| `/online-consultations/{id}/{id}` | [php/online_consultations.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php:1) | [php/index.php:562](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:562) |
| `/consent_files/{id}` | [php/update_consent_file.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_consent_file.php:1) | [php/index.php:566](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:566) |
| `/pet_information/{id}/status` | [php/update_pet_status.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_pet_status.php:1) | [php/index.php:573](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:573) |
| `/pet_information/{id}` | [php/update_pet.php:1](C:/Users/Admin/WebstormProjects/untitled1/php/update_pet.php:1) | [php/index.php:576](C:/Users/Admin/WebstormProjects/untitled1/php/index.php:576) |
