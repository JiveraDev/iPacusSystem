# Simplified iPawcus system class diagram

iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic

## Paper-ready explanation

The class diagram presents the main objects and responsibilities of iPawcus using sixteen conceptual classes. Each class contains a name, selected typed attributes and public operations. Associations describe important connections between objects, while the dashed dependency arrow identifies role-authorized use of the cross-cutting system service. Small bridges at wire crossings mean the wires are not joined. This is a system-level UML model based on the database reference and application behavior, not an entity-relationship diagram containing every table and not a claim that the procedural PHP backend declares sixteen matching object-oriented classes.

UserAccount represents the four user roles: Pet Owner, Admin, Veterinarian and Super Admin. Pet stores the patient identity, while MedicalRecord organizes the patient's health information. Clinic and Booking represent location-based service requests and calendar availability. Veterinarian clinic acceptance is separate from online-call availability, and overlapping appointments for the same veterinarian are prevented across both calendars.

PatientExamination represents the admin-led assessment before onsite diagnosis. It retains clinical signs, urgent symptoms, vital signs, physical findings and image evidence, together with the identity of the examiner and the assigned veterinarian. ConsentRecord retains signed owner authorization. Diagnosis represents the veterinarian's clinical assessment, treatment and prescription decisions; additional consent remains available during diagnosis. OnlineConsultation represents the remote-call workflow and its own diagnostic record.

PrescriptionPlan groups versioned prescriptions for a particular pet. PrescriptionItem is deliberately separate because every medicine has its own start date, frequency, duration and dated completion checklist. This preserves the essential per-item scheduling behavior without displaying a separate box for every occurrence or audit event. Online and onsite diagnoses both support prescriptions. A diagnosis with no prescription content does not trigger prescription printing or create an empty plan.

CareSession summarizes grooming and boarding/confinement while retaining their different operational rules. InventoryItem represents products and supplies with auditable stock records. BillingRecord summarizes visit charges, payment proofs, invoices, payments and refunds. Notification delivers actionable updates to the appropriate user. SystemOperations represents authorized reporting, monitoring, media and backup functions. Supporting records remain implemented separately and are documented in the mapping appendix.

## Main-class responsibilities

### Clinic

Represents a clinic and its operating calendar. Onsite medical capacity is determined by active veterinarians assigned to that clinic who accept bookings, with conflicts checked across sites and online calls. Three eligible veterinarians allow three simultaneous medical appointments, including the same service. Grooming and boarding retain their separate capacity rules. Legacy veterinarian working-hours, time-off and clinic-visit tables are reference data only; they are not current onsite scheduling gates.

### UserAccount

Represents Pet Owner, Admin, Veterinarian and Super Admin accounts using a role property rather than four duplicated classes. Role-specific profiles retain staff position and veterinarian license details. Super Admin assigns clinic access; veterinarians independently toggle booking acceptance at their assigned clinics and select a separate online-call calendar. Authentication, permissions and account tasks are supporting objects. Fields and operations are role-dependent: a pet owner cannot assign clinics or edit veterinarian availability. Today's My List and future booking tasks are views of assigned records, not new entity classes.

### Pet

Represents a patient independently of a single owner account. Ownership links and co-parent requests support shared pet access. Registration details, species/breed choices and status remain part of the patient identity. The same pet identifier links bookings, examinations, medical history, prescriptions and billing, so updated prescription plans remain synchronized to the correct pet.

### Notification

Represents a user-directed message and its navigation target. Booking changes, care updates and prescription-plan updates can direct the recipient to the related record or checklist. Read state, delivery preferences, push subscriptions and outgoing email are retained as supporting records rather than separate boxes. A notification is not itself a medication occurrence or proof that a dose was taken.

### BillingRecord

Represents the visit-centered financial record, not a single payment. Charge lines, invoices, booking payment proofs, reviewed payments and refunds remain distinct supporting records within this simplified explanation. Service catalogues define available service prices and required materials; they are referenced by booking, care and billing rather than becoming extra overview classes. Walk-in billing may exist without a booking. Calculate balance uses recorded charges, payments and refunds; it does not silently erase payment history.

### Booking

Represents a scheduled service request. Supporting pet links allow multiple registered patients, while legacy/unregistered-pet booking details are retained in the implementation. Onsite bookings use clinic hours and a reserved eligible veterinarian. Online consultations use the veterinarian's separate call slots, although both calendars prevent an individual veterinarian from overlapping appointments. Branch transfers, status changes and service details remain covered. Online, grooming and boarding bookings lead to their corresponding workflows; not every booking requires a physical examination.

### MedicalRecord

Represents a pet-linked record group and its supporting clinical entries. Diagnosis results, prior history, vaccination records, allergies and medical certificates remain available in the electronic record. Owner update requests and their review history are supporting records, not automatic edits to verified clinical history. This is a logical record aggregate; it does not claim that vaccinations or certificates are columns in one SQL table.

### SystemOperations

A conceptual service facade for cross-cutting administration, not a new database table or a literal PHP class declaration. It summarizes role-authorized report generation, dashboard charts, staff activity history, media management and backup creation/download. Reporting reads existing records rather than maintaining a duplicate reporting database. Backup endpoints require an active Super Admin. The diagram shows authorized account use of the service; report inputs such as bookings, billing, inventory and care records are documented here rather than connecting this service to every class.

### CareSession

A common overview abstraction for grooming jobs and boarding/confinement stays. It is not a request to merge their tables or workflows. Grooming keeps job details, photos, events and veterinarian review. Boarding/confinement keeps room reservations, check-in/out, observations, documents, tasks and material use. Room-related fields and operations apply only to boarding/confinement; grooming uses its own service capacity. sourceId is interpreted together with careType, so unrelated table IDs are not treated as globally unique.

### PatientExamination

Represents the admin/assistant-led physical examination and its queue/assignment context. It retains chief complaint, symptoms and clinical signs, major/urgent symptoms, vital signs, physical findings and images. Starting examination marks the patient as undergoing physical examination in the assigned veterinarian's current-day list. examinedBy preserves who performed the assessment; assignedVet remains separately adjustable. Consent must be captured before completion. Walk-ins are supported without a booking. The physical-examination table comes from the current clinical_intakes migration, which is absent from the supplied SQL export.

### Diagnosis

A shared conceptual abstraction for onsite and online diagnostic records. Findings include assessment, treatment, laboratory-result entries, notes, attachments and follow-up information where the corresponding workflow supports them. The veterinarian can retain/add consent during diagnosis; moving initial consent to admin examination does not remove that capability. Finalization synchronizes nonempty prescription content to the patient's plan. Automatic prescription printing runs only when printable medicine rows exist. sourceType and sourceId distinguish onsite and online records, so this overview does not imply that their tables share an identifier namespace or a declared inheritance hierarchy.

### OnlineConsultation

Represents the remote call attached to an online booking. It keeps the scheduled call interval, meeting details, participation/status timestamps and reschedule history. Online availability remains distinct from clinic operating hours and clinic booking acceptance, while shared veterinarian conflict checking prevents overlapping onsite and remote appointments. Its diagnostic record can issue prescription plans and per-item schedules, just like an onsite diagnosis; a call does not require an onsite physical examination.

### InventoryItem

Represents a medicine, supply or product together with its stock-management details. Branch/location balances, batches, receipts, suppliers, stock movements, transfers and audit history remain supporting records. Care sessions and service material definitions reference inventory for consumption. Billing may reference an inventory item for a product charge. This simplification does not replace auditable movements with an untracked editable total.

### ConsentRecord

Represents a consent instance and its signed/physical document, template, patient/owner context and processing staff. Admin captures the initial owner consent during examination; the veterinarian can handle additional consent in diagnosis. Consent can also be tied to booking or visit context without an examination, so the optional association in the diagram is not a requirement that every consent record originated at intake. Signer, examined-by staff and assigned veterinarian are different responsibilities.

### PrescriptionPlan

Represents a pet-specific, versioned prescription linked to an onsite or online diagnosis. New or amended content is synchronized to pet/veterinarian views; replacement versions supersede previous plans while keeping history. Owners can start selected medicines or all medicines and receive a navigation-linked update notification. The plan contains item definitions, but it does not force all medicines to share one start date or frequency. Empty diagnostic prescription content does not create a new plan.

### PrescriptionItem

Represents one medicine and its own dosing rules, instructions, duration, selected start date and dated completion occurrences. Daily time slots, hourly intervals or selected weekdays belong to the item, not the entire plan. Three-times-a-day defaults can use morning, noon and evening slots, with item-specific times retained. Starting an item generates its due checklist/calendar occurrences. Completing or skipping an occurrence updates that dated dose, not every medicine or every day. Occurrence rows remain stored separately in the implementation even though this paper diagram nests them under PrescriptionItem.

## Relationship meanings and multiplicities

Read a number at an endpoint as the number of instances of that endpoint class allowed for one instance at the other endpoint. For example, UserAccount `1` — Booking `0..*` means each booking has one requesting account, and that account may request many bookings. Counts in this overview describe the conceptual associations; they do not assert new SQL foreign-key constraints. Some counts are deliberately optional because the combined class includes multiple workflows or legacy records.

| Relationship | Multiplicities at the named ends | Meaning |
| --- | --- | --- |
| Clinic — UserAccount | 0..* / 0..* | Staff clinic assignments; role-specific booking acceptance is stored on the account. |
| UserAccount — Pet | 0..* / 0..* | Owner/co-parent access; imported or unlinked patient records may have no linked account. |
| UserAccount — Booking | 1 / 0..* | Each booking has one requesting account; an account may have many bookings. |
| Clinic — Booking | 1 / 0..* | Each booking retains one clinic; online clinic metadata does not control call hours. |
| UserAccount — Notification | 1 / 0..* | A notification is addressed to one account. |
| Pet — MedicalRecord | 1 / 0..* | A patient may have multiple record groups and clinical entries. |
| Booking — BillingRecord | 0..1 / 0..* | Visit billing may optionally refer to a booking, including multi-pet visits. |
| Booking — CareSession | 1 / 0..* | Grooming/boarding care records belong to a booking; not every booking has them. |
| Booking — PatientExamination | 0..1 / 0..* | Examination may follow a booking; walk-in examination does not require one. |
| Booking — OnlineConsultation | 1 / 0..1 | An online booking may have one consultation record. |
| PatientExamination — Diagnosis | 0..1 / 0..* | Onsite diagnoses can use intake findings through queue context; online diagnoses have no onsite examination. |
| OnlineConsultation — Diagnosis | 0..1 / 0..1 | The online diagnostic subtype has one consultation; onsite records have none. |
| PatientExamination — ConsentRecord | 0..1 / 0..* | Queue-scoped consent can accompany intake; other consent contexts do not require an intake. |
| Diagnosis — PrescriptionPlan | 1 / 0..* | A diagnostic source may issue multiple prescription versions, or none. |
| Pet — PrescriptionPlan | 1 / 0..* | All versions remain linked to the same patient. |
| PrescriptionPlan — PrescriptionItem | 1 / 0..* | A prescription plan groups individually scheduled medicines; archived/cleared states are allowed. |
| CareSession — InventoryItem | 0..* / 0..* | Recorded material use connects care work to stocked supplies. |
| UserAccount — SystemOperations | Dependency: uses | Authorized roles request reports, monitoring, media and backups; operation-specific permissions still apply. |

## Rules retained by the simplification

- All four user roles share UserAccount; permissions and role-specific profile fields remain distinct.
- Clinic assignments are set by Super Admin. A vet toggles acceptance only for assigned sites.
- Onsite hours follow the clinic. Online availability is separately selected; one vet cannot overlap appointments.
- Grooming uses service slots; boarding/confinement uses room and date-range capacity.
- Admin starts examination and records findings/images/consent; examiner identity differs from assigned vet.
- Initial consent is required before completing intake. Vet additional consent remains supported.
- Today's My List excludes future bookings; future schedules remain in To-dos and next-booking preview.
- Prescription plans are pet-specific and versioned; each item has its own start date and recurrence.
- Online diagnosis also synchronizes prescriptions. Empty prescriptions neither create a plan nor trigger printing.
- Backup creation/download is Super Admin-only. Reporting does not imply an additional reporting database.

## What was simplified, not removed

The previous main overview displayed 35 classes; this paper overview displays 16. The detailed reference still contains 91 modeled responsibilities (89 persistent objects and 2 stateless services). Every one is mapped exactly once in IMPLEMENTATION-MAPPING.md. Queue/assignment records are grouped with examination; onsite/online diagnostic records share a conceptual Diagnosis abstraction; prescription occurrences are grouped with their item; payment/charge/refund records are grouped with BillingRecord; grooming and boarding supporting records are grouped with CareSession.

Not every foreign key, actor reference or reporting input is redrawn. For example, patient and veterinarian references also appear as typed attributes, and role authorization applies to operations throughout the system. This deliberate selection keeps the overview readable; it does not remove those relationships from the implementation. The original detailed class diagram remains available for database and implementation-level questions.

## Modeling boundaries

- Collections such as `charges`, `occurrences`, `findings` and `clinicAcceptance` are conceptual properties backed by several fields/tables, not newly added SQL columns.
- Methods summarize existing application responsibilities. Some responsibilities are grouped into a conceptual operation rather than matching a function name verbatim.
- `Diagnosis` and `CareSession` are overview abstractions; no inheritance hierarchy, merged storage table or new global ID namespace is claimed.
- `SystemOperations` is a conceptual service facade. Report history/media/staff history can be implemented through files or services; no extra persistence table is invented.
- The table coverage is based on the previously parsed supplied SQL reference plus the current clinical_intakes migration, not inspection of a live deployed database.
- No app, database, debug bypass, original class diagram, context diagram or role-activity diagram was changed.

## Using this figure in the paper

Suggested caption: “Simplified system class diagram of iPawcus showing the principal domain objects, their attributes, operations and selected associations.” Use the SVG for sharp scaling and a landscape page if possible. Place the main-class responsibility explanation after the figure; keep IMPLEMENTATION-MAPPING.md as an appendix rather than crowding the diagram with every SQL table.

