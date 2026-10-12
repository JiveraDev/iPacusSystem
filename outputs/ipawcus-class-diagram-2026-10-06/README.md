# iPawcus system class diagram

The revised diagram is **`ipawcus-system-class-diagram.drawio`**. It models domain objects, their typed attributes, operations, and relationships in the three-compartment UML style of the supplied example.

- Main preview: `00-system-class-diagram.png` / `.svg` — 35 core classes.
- Complete model: `01-complete-domain-model.png` / `.svg` — all 91 domain classes, 1,069 persistent attributes, and 174 source-backed operations.
- Editable document: 11 sheets — main diagram, complete model, and nine domain detail sheets.
- Explanation and implementation mappings: `DOMAIN-REFERENCE.md`.
- Independent coverage, geometry, and source checks: `domain-validation.json`.

Connectors avoid class boxes. Each multiplicity is individually above its own line near the class; labels do not touch other lines. The original project diagram and supplied SQL remain unchanged. No application or database changes were made.

The earlier `ipawcus-system-and-database.drawio` is an implementation architecture reference, **not** the revised domain class diagram. The old DB-only exports are retained below as supporting schema documentation.

## Earlier DB-only documentation

Source: `C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql` (2026-10-06).

Coverage: **88 tables, 1050 attributes, 184 declared foreign keys**.

Open `ipawcus-class-diagram.drawio` in diagrams.net for an editable, ten-page class diagram. Open `00-overview.svg` for the main diagram; the remaining SVG files show all module details. The original schema and existing project diagram are not modified.

## Reading the diagram

- Class names are UML-friendly aliases of the exact SQL table names shown underneath.
- Attributes preserve SQL column names and types. `?` means nullable; `PK`, `FK`, and `UK` identify primary, foreign, and single-column unique keys.
- Enum values and composite unique constraints are preserved in the schema metadata, not expanded inside every class box.
- Multiplicities come from nullability and uniqueness in the SQL. SQL does not require parents to have children, so the minimum child count is zero.
- Association arrows point from the class holding the foreign key to the referenced parent class.
- Dashed boxes are references to classes whose full definition is on another module page, not additional tables.
- Every declared foreign key appears on its source class's module page. Core associations are repeated in the overview for context.
- This is a persistent-entity UML class model, not a claim that the PHP backend contains matching object-oriented classes. Methods are omitted because SQL does not define application operations.

## Layout validation

Each relation is routed on an orthogonal, obstacle-aware grid. All class rectangles are treated as obstacles with 22-pixel routing clearance. An independent segment/rectangle check rejects any line entering a class box; source and target endpoints only touch their boundaries. Every multiplicity is placed above its own horizontal relationship segment, 12 pixels from the adjacent class box. Source and target captions each have their own docking row; labels are never combined into a grouped list. Each caption is reserved as a routing obstacle with 2-pixel clearance, so text cannot touch another connector, caption, or class box. The editable diagram attaches each caption to its own relationship endpoint. The compact class-box arrangement is preserved. The saved initial layout is collision-checked. Moving a box manually may require rerouting its connectors.

## Source limitations

- `clinical_intakes` is absent from this schema even though the current application uses it for admin physical examinations; no fictional SQL class was added.
- `bookings.veterinarian_id` is `varchar(50)` and has no declared foreign key to `users.user_id`. The application's assigned-vet relationship is not represented as a declared SQL association.
- `consent_form_records` has reference-like ID columns but no declared foreign keys in this file. The class is shown without invented associations.
- Legacy `veterinarian_working_hours`, `veterinarian_booking_time_off`, and `veterinarian_branch_schedules` tables remain in the supplied schema and are retained in the diagram; the current booking flow no longer uses them for scheduling.

## Pages

0. Core class overview — 16 full classes (overview uses selected attributes)
1. Identity and access — 9 full classes
2. Clinics and scheduling — 10 full classes
3. Pets and medical records — 12 full classes
4. Bookings and clinical workflow — 8 full classes
5. Online consultations and prescriptions — 8 full classes
6. Grooming and boarding — 11 full classes
7. Inventory and materials — 12 full classes
8. Billing and service catalogues — 12 full classes
9. Notifications and system operations — 6 full classes

## Exact table-to-class mapping

| SQL table | UML class | Module page |
| --- | --- | --- |
| admin_feature_permissions | AdminFeaturePermission | 01 |
| admin_feature_permission_audit | AdminFeaturePermissionAudit | 01 |
| admin_profiles | AdminProfile | 01 |
| api_access_tokens | ApiAccessToken | 01 |
| boarding_assignments | BoardingAssignment | 06 |
| boarding_documents | BoardingDocument | 06 |
| boarding_material_usages | BoardingMaterialUsage | 06 |
| boarding_observations | BoardingObservation | 06 |
| boarding_tasks | BoardingTask | 06 |
| bookings | Booking | 04 |
| booking_branch_transfers | BookingBranchTransfer | 04 |
| booking_payment_refunds | BookingPaymentRefund | 08 |
| booking_payment_submissions | BookingPaymentSubmission | 08 |
| booking_pets | BookingPet | 04 |
| branches | Branch | 02 |
| branch_closures | BranchClosure | 02 |
| branch_operating_hours | BranchOperatingHour | 02 |
| branch_service_availability | BranchServiceAvailability | 02 |
| consent_files | ConsentFile | 04 |
| consent_form_records | ConsentFormRecord | 04 |
| email_otp_tokens | EmailOtpToken | 01 |
| google_auth_onboarding_tokens | GoogleAuthOnboardingToken | 01 |
| grooming_events | GroomingEvent | 06 |
| grooming_jobs | GroomingJob | 06 |
| grooming_photos | GroomingPhoto | 06 |
| grooming_reviews | GroomingReview | 06 |
| history_before_registration | HistoryBeforeRegistration | 03 |
| inventory_action_audit | InventoryActionAudit | 07 |
| inventory_batches | InventoryBatch | 07 |
| inventory_branch_items | InventoryBranchItem | 07 |
| inventory_items | InventoryItem | 07 |
| inventory_locations | InventoryLocation | 07 |
| inventory_stock_movements | InventoryStockMovement | 07 |
| inventory_stock_receipts | InventoryStockReceipt | 07 |
| inventory_stock_receipt_items | InventoryStockReceiptItem | 07 |
| inventory_suppliers | InventorySupplier | 07 |
| inventory_transfers | InventoryTransfer | 07 |
| inventory_transfer_items | InventoryTransferItem | 07 |
| mail_queue | MailQueue | 09 |
| notification_preferences | NotificationPreference | 09 |
| notification_push_subscriptions | NotificationPushSubscription | 09 |
| online_consultations | OnlineConsultation | 05 |
| online_consultation_diagnoses | OnlineConsultationDiagnosis | 05 |
| online_consultation_reschedules | OnlineConsultationReschedule | 05 |
| payment_methods | PaymentMethod | 08 |
| pets_information | Pet | 03 |
| pet_allergies | PetAllergy | 03 |
| pet_catalog_options | PetCatalogOption | 03 |
| pet_coparent_requests | PetCoparentRequest | 03 |
| pet_medical_certificates | PetMedicalCertificate | 03 |
| pet_medical_record_groups | PetMedicalRecordGroup | 03 |
| pet_medical_record_group_items | PetMedicalRecordGroupItem | 03 |
| pet_ownership | PetOwnership | 03 |
| pet_owner_todos | PetOwnerTodo | 05 |
| pet_record_update_requests | PetRecordUpdateRequest | 03 |
| pet_record_update_request_events | PetRecordUpdateRequestEvent | 03 |
| pet_vaccinations | PetVaccination | 03 |
| prescription_events | PrescriptionEvent | 05 |
| prescription_items | PrescriptionItem | 05 |
| prescription_occurrences | PrescriptionOccurrence | 05 |
| prescription_plans | PrescriptionPlan | 05 |
| queues | Queue | 04 |
| rooms | Room | 06 |
| room_unit_statuses | RoomUnitStatus | 06 |
| service_catalog | ServiceCatalog | 08 |
| service_display_settings | ServiceDisplaySetting | 08 |
| service_materials | ServiceMaterial | 07 |
| special_service_booking_items | SpecialServiceBookingItem | 08 |
| special_service_catalog | SpecialServiceCatalog | 08 |
| system_backups | SystemBackup | 09 |
| system_backup_settings | SystemBackupSetting | 09 |
| users | User | 01 |
| user_auth_identities | UserAuthIdentity | 01 |
| user_branch_assignments | UserBranchAssignment | 02 |
| user_notifications | UserNotification | 09 |
| veterinarian_booking_clinics | VetClinicBookingPreference | 02 |
| veterinarian_booking_time_off | LegacyVetTimeOff | 02 |
| veterinarian_branch_schedules | LegacyVetClinicVisit | 02 |
| veterinarian_profiles | VeterinarianProfile | 01 |
| veterinarian_working_hours | LegacyVetWorkingHours | 02 |
| vet_diagnoses | VetDiagnosis | 04 |
| vet_queue_assignments | VetQueueAssignment | 04 |
| vet_schedules | OnlineVetSchedule | 02 |
| visits | Visit | 08 |
| visit_charges | VisitCharge | 08 |
| visit_invoice_documents | VisitInvoiceDocument | 08 |
| visit_payments | VisitPayment | 08 |
| visit_payment_refunds | VisitPaymentRefund | 08 |

## Declared relationships

| Child / foreign-key fields | Parent / key fields | Child count | Parent count | Constraint |
| --- | --- | --- | --- | --- |
| admin_profiles.user_id | users.user_id | 0..* | 1 | admin_profiles_ibfk_1 |
| boarding_assignments.booking_id | bookings.booking_id | 0..* | 1 | boarding_assignment_booking_fk |
| boarding_assignments.branch_id | branches.branch_id | 0..* | 1 | boarding_assignment_branch_fk |
| boarding_documents.assignment_id | boarding_assignments.assignment_id | 0..* | 0..1 | boarding_documents_assignment_fk |
| boarding_documents.booking_id | bookings.booking_id | 0..* | 1 | boarding_documents_booking_fk |
| boarding_documents.pet_id | pets_information.pet_id | 0..* | 0..1 | boarding_documents_pet_fk |
| boarding_documents.uploaded_by_user_id | users.user_id | 0..* | 0..1 | boarding_documents_uploaded_by_fk |
| boarding_material_usages.assignment_id | boarding_assignments.assignment_id | 0..* | 1 | boarding_material_assignment_fk |
| boarding_material_usages.booking_id | bookings.booking_id | 0..* | 1 | boarding_material_booking_fk |
| boarding_material_usages.item_id | inventory_items.item_id | 0..* | 0..1 | boarding_material_item_fk |
| boarding_material_usages.pet_id | pets_information.pet_id | 0..* | 0..1 | boarding_material_pet_fk |
| boarding_material_usages.recorded_by_user_id | users.user_id | 0..* | 0..1 | boarding_material_recorded_by_fk |
| boarding_material_usages.voided_by_user_id | users.user_id | 0..* | 0..1 | boarding_material_voided_by_fk |
| boarding_observations.assignment_id | boarding_assignments.assignment_id | 0..* | 0..1 | boarding_observation_assignment_fk |
| boarding_observations.booking_id | bookings.booking_id | 0..* | 1 | boarding_observation_booking_fk |
| boarding_observations.pet_id | pets_information.pet_id | 0..* | 0..1 | boarding_observation_pet_fk |
| boarding_observations.created_by_user_id | users.user_id | 0..* | 0..1 | boarding_observation_user_fk |
| boarding_tasks.assignment_id | boarding_assignments.assignment_id | 0..* | 0..1 | boarding_task_assignment_fk |
| boarding_tasks.booking_id | bookings.booking_id | 0..* | 1 | boarding_task_booking_fk |
| boarding_tasks.pet_id | pets_information.pet_id | 0..* | 0..1 | boarding_task_pet_fk |
| boarding_tasks.created_by_user_id | users.user_id | 0..* | 0..1 | boarding_task_user_fk |
| bookings.branch_id | branches.branch_id | 0..* | 1 | bookings_branch_fk |
| bookings.user_id | users.user_id | 0..* | 1 | bookings_ibfk_1 |
| bookings.pet_id | pets_information.pet_id | 0..* | 0..1 | bookings_ibfk_2 |
| bookings.original_branch_id | branches.branch_id | 0..* | 0..1 | bookings_original_branch_fk |
| booking_branch_transfers.transferred_by_user_id | users.user_id | 0..* | 1 | booking_branch_transfer_actor_fk |
| booking_branch_transfers.booking_id | bookings.booking_id | 0..* | 1 | booking_branch_transfer_booking_fk |
| booking_branch_transfers.from_branch_id | branches.branch_id | 0..* | 1 | booking_branch_transfer_from_fk |
| booking_branch_transfers.to_branch_id | branches.branch_id | 0..* | 1 | booking_branch_transfer_to_fk |
| booking_payment_refunds.booking_id | bookings.booking_id | 0..* | 1 | booking_payment_refund_booking_fk |
| booking_payment_refunds.booking_payment_submission_id | booking_payment_submissions.submission_id | 0..* | 1 | booking_payment_refund_submission_fk |
| booking_payment_refunds.processed_by_user_id | users.user_id | 0..* | 1 | booking_payment_refund_user_fk |
| booking_payment_submissions.booking_id | bookings.booking_id | 0..* | 1 | booking_payment_booking_fk |
| booking_payment_submissions.reviewed_by_user_id | users.user_id | 0..* | 0..1 | booking_payment_reviewer_fk |
| booking_payment_submissions.linked_visit_payment_id | visit_payments.payment_id | 0..1 | 0..1 | booking_payment_visit_payment_fk |
| booking_pets.booking_id | bookings.booking_id | 0..* | 1 | booking_pets_booking_fk |
| booking_pets.pet_id | pets_information.pet_id | 0..* | 1 | booking_pets_pet_fk |
| branch_closures.branch_id | branches.branch_id | 0..* | 1 | branch_closures_branch_fk |
| branch_closures.created_by_user_id | users.user_id | 0..* | 0..1 | branch_closures_user_fk |
| branch_operating_hours.branch_id | branches.branch_id | 0..* | 1 | branch_operating_hours_branch_fk |
| branch_service_availability.branch_id | branches.branch_id | 0..* | 1 | branch_service_branch_fk |
| email_otp_tokens.user_id | users.user_id | 0..* | 0..1 | email_otp_user_fk |
| grooming_events.booking_id | grooming_jobs.booking_id | 0..* | 1 | grooming_event_job_fk |
| grooming_jobs.booking_id | bookings.booking_id | 0..1 | 1 | grooming_booking_fk |
| grooming_photos.booking_id | grooming_jobs.booking_id | 0..* | 1 | grooming_photo_job_fk |
| grooming_reviews.booking_id | grooming_jobs.booking_id | 0..* | 1 | grooming_review_job_fk |
| grooming_reviews.veterinarian_id | users.user_id | 0..* | 1 | grooming_review_vet_fk |
| history_before_registration.pet_id | pets_information.pet_id | 0..* | 0..1 | history_before_registration_ibfk_1 |
| inventory_action_audit.batch_id | inventory_batches.batch_id | 0..* | 0..1 | inventory_audit_batch_fk |
| inventory_action_audit.item_id | inventory_items.item_id | 0..* | 0..1 | inventory_audit_item_fk |
| inventory_action_audit.location_id | inventory_locations.location_id | 0..* | 0..1 | inventory_audit_location_fk |
| inventory_action_audit.performed_by_user_id | users.user_id | 0..* | 1 | inventory_audit_user_fk |
| inventory_batches.item_id | inventory_items.item_id | 0..* | 1 | inventory_batches_item_fk |
| inventory_batches.location_id | inventory_locations.location_id | 0..* | 1 | inventory_batches_location_fk |
| inventory_branch_items.branch_id | branches.branch_id | 0..* | 1 | inventory_branch_items_branch_fk |
| inventory_branch_items.item_id | inventory_items.item_id | 0..* | 1 | inventory_branch_items_item_fk |
| inventory_branch_items.primary_location_id | inventory_locations.location_id | 0..* | 1 | inventory_branch_items_location_fk |
| inventory_branch_items.removed_by_user_id | users.user_id | 0..* | 0..1 | inventory_branch_items_removed_by_fk |
| inventory_items.created_by_user_id | users.user_id | 0..* | 1 | inventory_items_created_by_fk |
| inventory_items.location_id | inventory_locations.location_id | 0..* | 1 | inventory_items_location_fk |
| inventory_locations.branch_id | branches.branch_id | 0..* | 1 | inventory_locations_branch_fk |
| inventory_stock_movements.batch_id | inventory_batches.batch_id | 0..* | 0..1 | inventory_movements_batch_fk |
| inventory_stock_movements.item_id | inventory_items.item_id | 0..* | 1 | inventory_movements_item_fk |
| inventory_stock_movements.location_id | inventory_locations.location_id | 0..* | 0..1 | inventory_movements_location_fk |
| inventory_stock_movements.performed_by_user_id | users.user_id | 0..* | 1 | inventory_movements_user_fk |
| inventory_stock_receipts.branch_id | branches.branch_id | 0..* | 1 | inventory_receipts_branch_fk |
| inventory_stock_receipts.received_by_user_id | users.user_id | 0..* | 1 | inventory_receipts_received_by_fk |
| inventory_stock_receipt_items.batch_id | inventory_batches.batch_id | 0..* | 0..1 | inventory_receipt_items_batch_fk |
| inventory_stock_receipt_items.item_id | inventory_items.item_id | 0..* | 1 | inventory_receipt_items_item_fk |
| inventory_stock_receipt_items.location_id | inventory_locations.location_id | 0..* | 1 | inventory_receipt_items_location_fk |
| inventory_stock_receipt_items.receipt_id | inventory_stock_receipts.receipt_id | 0..* | 1 | inventory_receipt_items_receipt_fk |
| inventory_stock_receipt_items.supplier_id | inventory_suppliers.supplier_id | 0..* | 1 | inventory_receipt_items_supplier_fk |
| inventory_transfers.created_by_user_id | users.user_id | 0..* | 1 | inventory_transfer_creator_fk |
| inventory_transfers.from_location_id | inventory_locations.location_id | 0..* | 1 | inventory_transfer_from_fk |
| inventory_transfers.received_by_user_id | users.user_id | 0..* | 0..1 | inventory_transfer_receiver_fk |
| inventory_transfers.to_location_id | inventory_locations.location_id | 0..* | 1 | inventory_transfer_to_fk |
| inventory_transfer_items.source_batch_id | inventory_batches.batch_id | 0..* | 1 | inventory_transfer_items_batch_fk |
| inventory_transfer_items.item_id | inventory_items.item_id | 0..* | 1 | inventory_transfer_items_item_fk |
| inventory_transfer_items.inventory_transfer_id | inventory_transfers.inventory_transfer_id | 0..* | 1 | inventory_transfer_items_transfer_fk |
| notification_preferences.user_id | users.user_id | 0..1 | 1 | notification_preferences_user_fk |
| notification_push_subscriptions.user_id | users.user_id | 0..* | 1 | notification_push_user_fk |
| online_consultations.booking_id | bookings.booking_id | 0..1 | 1 | online_consultations_ibfk_1 |
| online_consultations.owner_user_id | users.user_id | 0..* | 1 | online_consultations_ibfk_2 |
| online_consultations.veterinarian_user_id | users.user_id | 0..* | 1 | online_consultations_ibfk_3 |
| online_consultation_diagnoses.online_consultation_id | online_consultations.online_consultation_id | 0..1 | 1 | online_consultation_diagnoses_ibfk_1 |
| online_consultation_diagnoses.booking_id | bookings.booking_id | 0..* | 1 | online_consultation_diagnoses_ibfk_2 |
| online_consultation_diagnoses.veterinarian_user_id | users.user_id | 0..* | 1 | online_consultation_diagnoses_ibfk_3 |
| online_consultation_reschedules.online_consultation_id | online_consultations.online_consultation_id | 0..* | 1 | online_consultation_reschedules_ibfk_1 |
| online_consultation_reschedules.changed_by_user_id | users.user_id | 0..* | 0..1 | online_consultation_reschedules_ibfk_2 |
| pet_allergies.created_by_user_id | users.user_id | 0..* | 0..1 | pet_allergies_created_by_fk |
| pet_allergies.pet_id | pets_information.pet_id | 0..* | 1 | pet_allergies_ibfk_1 |
| pet_allergies.updated_by_user_id | users.user_id | 0..* | 0..1 | pet_allergies_updated_by_fk |
| pet_allergies.verified_by_user_id | users.user_id | 0..* | 0..1 | pet_allergies_verified_by_fk |
| pet_medical_certificates.pet_id | pets_information.pet_id | 0..* | 1 | pet_medical_certificate_pet_fk |
| pet_medical_certificates.request_id | pet_record_update_requests.request_id | 0..* | 0..1 | pet_medical_certificate_request_fk |
| pet_medical_certificates.veterinarian_user_id | users.user_id | 0..* | 1 | pet_medical_certificate_vet_fk |
| pet_medical_record_groups.pet_id | pets_information.pet_id | 0..* | 1 | pet_medical_record_groups_pet_fk |
| pet_medical_record_group_items.group_id | pet_medical_record_groups.group_id | 0..* | 1 | pet_medical_record_group_items_group_fk |
| pet_ownership.user_id | users.user_id | 0..* | 0..1 | pet_ownership_ibfk_1 |
| pet_ownership.pet_id | pets_information.pet_id | 0..* | 0..1 | pet_ownership_ibfk_2 |
| pet_owner_todos.user_id | users.user_id | 0..* | 1 | pet_owner_todos_user_fk |
| pet_record_update_requests.branch_id | branches.branch_id | 0..* | 1 | record_requests_branch_fk |
| pet_record_update_requests.assigned_veterinarian_user_id | users.user_id | 0..* | 0..1 | record_update_assigned_vet_fk |
| pet_record_update_requests.completed_by_user_id | users.user_id | 0..* | 0..1 | record_update_completed_by_fk |
| pet_record_update_requests.owner_user_id | users.user_id | 0..* | 0..1 | record_update_owner_fk |
| pet_record_update_requests.pet_id | pets_information.pet_id | 0..* | 1 | record_update_pet_fk |
| pet_record_update_requests.reviewed_by_user_id | users.user_id | 0..* | 0..1 | record_update_reviewed_by_fk |
| pet_record_update_request_events.actor_user_id | users.user_id | 0..* | 0..1 | record_update_event_actor_fk |
| pet_record_update_request_events.request_id | pet_record_update_requests.request_id | 0..* | 1 | record_update_event_request_fk |
| pet_vaccinations.pet_id | pets_information.pet_id | 0..* | 1 | pet_vaccinations_ibfk_1 |
| prescription_events.actor_user_id | users.user_id | 0..* | 0..1 | prescription_event_actor_fk |
| prescription_events.item_id | prescription_items.item_id | 0..* | 0..1 | prescription_event_item_fk |
| prescription_events.plan_id | prescription_plans.plan_id | 0..* | 1 | prescription_event_plan_fk |
| prescription_items.plan_id | prescription_plans.plan_id | 0..* | 1 | prescription_item_plan_fk |
| prescription_items.replaces_item_id | prescription_items.item_id | 0..* | 0..1 | prescription_item_replaces_fk |
| prescription_occurrences.completed_by_user_id | users.user_id | 0..* | 0..1 | prescription_occurrence_completed_by_fk |
| prescription_occurrences.item_id | prescription_items.item_id | 0..* | 1 | prescription_occurrence_item_fk |
| prescription_plans.owner_user_id | users.user_id | 0..* | 0..1 | prescription_plan_owner_fk |
| prescription_plans.pet_id | pets_information.pet_id | 0..* | 1 | prescription_plan_pet_fk |
| prescription_plans.supersedes_plan_id | prescription_plans.plan_id | 0..* | 0..1 | prescription_plan_supersedes_fk |
| prescription_plans.veterinarian_user_id | users.user_id | 0..* | 1 | prescription_plan_vet_fk |
| queues.booking_id | bookings.booking_id | 0..* | 0..1 | queues_booking_fk |
| queues.branch_id | branches.branch_id | 0..* | 1 | queues_branch_fk |
| queues.pet_id | pets_information.pet_id | 0..* | 1 | queues_ibfk_1 |
| queues.user_id | users.user_id | 0..* | 1 | queues_ibfk_2 |
| rooms.branch_id | branches.branch_id | 0..* | 1 | rooms_branch_fk |
| room_unit_statuses.branch_id | branches.branch_id | 0..* | 1 | room_unit_status_branch_fk |
| service_catalog.created_by_user_id | users.user_id | 0..* | 0..1 | service_catalog_created_by_fk |
| service_display_settings.updated_by_user_id | users.user_id | 0..* | 0..1 | fk_service_display_settings_user |
| service_materials.service_id | service_catalog.service_id | 0..* | 1 | service_materials_ibfk_1 |
| service_materials.item_id | inventory_items.item_id | 0..* | 0..1 | service_materials_ibfk_2 |
| special_service_booking_items.booking_id | bookings.booking_id | 0..* | 1 | special_service_booking_items_booking_fk |
| special_service_booking_items.special_service_id | special_service_catalog.special_service_id | 0..* | 0..1 | special_service_booking_items_catalog_fk |
| special_service_catalog.created_by_user_id | users.user_id | 0..* | 0..1 | special_service_catalog_user_fk |
| system_backups.created_by_user_id | users.user_id | 0..* | 0..1 | fk_system_backups_actor |
| system_backups.base_backup_id | system_backups.backup_id | 0..* | 0..1 | fk_system_backups_base |
| system_backups.parent_backup_id | system_backups.backup_id | 0..* | 0..1 | fk_system_backups_parent |
| system_backup_settings.updated_by_user_id | users.user_id | 0..* | 0..1 | fk_system_backup_settings_actor |
| system_backup_settings.last_automatic_backup_id | system_backups.backup_id | 0..* | 0..1 | fk_system_backup_settings_last_backup |
| users.preferred_branch_id | branches.branch_id | 0..* | 0..1 | users_preferred_branch_fk |
| user_auth_identities.user_id | users.user_id | 0..* | 1 | fk_user_auth_identity_user |
| user_branch_assignments.assigned_by_user_id | users.user_id | 0..* | 0..1 | user_branch_assignment_actor_fk |
| user_branch_assignments.branch_id | branches.branch_id | 0..* | 1 | user_branch_assignment_branch_fk |
| user_branch_assignments.user_id | users.user_id | 0..* | 1 | user_branch_assignment_user_fk |
| user_notifications.branch_id | branches.branch_id | 0..* | 0..1 | user_notifications_branch_fk |
| user_notifications.user_id | users.user_id | 0..* | 1 | user_notifications_user_fk |
| veterinarian_booking_clinics.branch_id | branches.branch_id | 0..* | 1 | vet_booking_clinic_branch_fk |
| veterinarian_booking_clinics.veterinarian_user_id | users.user_id | 0..* | 1 | vet_booking_clinic_user_fk |
| veterinarian_booking_time_off.veterinarian_user_id | users.user_id | 0..* | 1 | vet_booking_time_off_user_fk |
| veterinarian_branch_schedules.branch_id | branches.branch_id | 0..* | 1 | vet_branch_schedule_branch_fk |
| veterinarian_branch_schedules.created_by_user_id | users.user_id | 0..* | 1 | vet_branch_schedule_creator_fk |
| veterinarian_branch_schedules.veterinarian_user_id | users.user_id | 0..* | 1 | vet_branch_schedule_vet_fk |
| veterinarian_profiles.user_id | users.user_id | 0..* | 1 | veterinarian_profiles_ibfk_1 |
| veterinarian_working_hours.branch_id | branches.branch_id | 0..* | 1 | vet_working_hours_branch_fk |
| veterinarian_working_hours.veterinarian_user_id | users.user_id | 0..* | 1 | vet_working_hours_user_fk |
| vet_diagnoses.assignment_id | vet_queue_assignments.assignment_id | 0..* | 0..1 | vet_diagnoses_assignment_fk |
| vet_diagnoses.booking_id | bookings.booking_id | 0..* | 0..1 | vet_diagnoses_booking_fk |
| vet_diagnoses.pet_id | pets_information.pet_id | 0..* | 1 | vet_diagnoses_pet_fk |
| vet_diagnoses.queue_id | queues.queue_id | 0..1 | 0..1 | vet_diagnoses_queue_fk |
| vet_diagnoses.veterinarian_user_id | users.user_id | 0..* | 1 | vet_diagnoses_vet_fk |
| vet_queue_assignments.queue_id | queues.queue_id | 0..* | 1 | vet_queue_assignments_queue_fk |
| vet_queue_assignments.veterinarian_user_id | users.user_id | 0..* | 1 | vet_queue_assignments_vet_fk |
| vet_schedules.user_id | users.user_id | 0..* | 1 | vet_schedules_fk |
| visits.branch_id | branches.branch_id | 0..* | 1 | visits_branch_fk |
| visits.diagnosis_id | vet_diagnoses.diagnosis_id | 0..1 | 0..1 | visits_diagnosis_fk |
| visits.pet_id | pets_information.pet_id | 0..* | 1 | visits_ibfk_1 |
| visits.owner_user_id | users.user_id | 0..* | 1 | visits_ibfk_2 |
| visits.veterinarian_user_id | users.user_id | 0..* | 0..1 | visits_ibfk_3 |
| visits.queue_id | queues.queue_id | 0..* | 0..1 | visits_ibfk_4 |
| visits.booking_id | bookings.booking_id | 0..* | 0..1 | visits_ibfk_5 |
| visit_charges.boarding_material_usage_id | boarding_material_usages.usage_id | 0..1 | 0..1 | visit_charges_boarding_material_fk |
| visit_charges.created_by_user_id | users.user_id | 0..* | 0..1 | visit_charges_created_by_fk |
| visit_charges.visit_id | visits.visit_id | 0..* | 1 | visit_charges_ibfk_1 |
| visit_charges.service_id | service_catalog.service_id | 0..* | 0..1 | visit_charges_ibfk_2 |
| visit_charges.item_id | inventory_items.item_id | 0..* | 0..1 | visit_charges_ibfk_3 |
| visit_invoice_documents.created_by_user_id | users.user_id | 0..* | 0..1 | visit_invoice_documents_creator_fk |
| visit_invoice_documents.payment_id | visit_payments.payment_id | 0..1 | 1 | visit_invoice_documents_payment_fk |
| visit_invoice_documents.pet_id | pets_information.pet_id | 0..* | 1 | visit_invoice_documents_pet_fk |
| visit_invoice_documents.visit_id | visits.visit_id | 0..* | 1 | visit_invoice_documents_visit_fk |
| visit_payments.received_by_user_id | users.user_id | 0..* | 0..1 | visit_payments_received_by_fk |
| visit_payments.visit_id | visits.visit_id | 0..* | 1 | visit_payments_visit_fk |
| visit_payment_refunds.visit_payment_id | visit_payments.payment_id | 0..* | 1 | visit_payment_refund_payment_fk |
| visit_payment_refunds.processed_by_user_id | users.user_id | 0..* | 1 | visit_payment_refund_user_fk |
| visit_payment_refunds.visit_id | visits.visit_id | 0..* | 1 | visit_payment_refund_visit_fk |
