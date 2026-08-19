import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.join(repositoryRoot, 'docs', 'IPAWCUS-Class-Diagram.drawio');

const classBox = (id, name, x, y, attributes, methods, width = 310) => ({
    id,
    name,
    x,
    y,
    width,
    attributes,
    methods,
});

const relationship = (id, source, target, sourceMultiplicity, targetMultiplicity, label = '') => ({
    id,
    source,
    target,
    sourceMultiplicity,
    targetMultiplicity,
    label,
});

const pages = [
    {
        id: 'core-clinical',
        name: '01 - Core Clinical Workflow',
        title: 'IPAWCUS Class Diagram - Core Clinical Workflow',
        subtitle: 'Editable UML model based on the current SQL schema, PHP endpoints, and React service operations',
        width: 3560,
        height: 1900,
        classes: [
            classBox('branch', 'Branch', 40, 130,
                ['+ branchId: int', '+ branchCode: string', '+ branchName: string', '+ branchType: string', '+ address: text', '+ status: string'],
                ['+ listBranches()', '+ checkAvailability()', '+ relocateBooking()']),
            classBox('user', 'User', 40, 520,
                ['+ userId: int', '+ firstName: string', '+ lastName: string', '+ email: string', '+ phoneNumber: string', '+ role: string', '+ accountStatus: string', '+ preferredBranchId: int?'],
                ['+ login()', '+ logout()', '+ updateProfile()', '+ updatePassword()']),
            classBox('vetProfile', 'VeterinarianProfile', 390, 850,
                ['+ profileId: int', '+ userId: int', '+ veterinarianId: string', '+ licenseNumber: string', '+ specialization: text', '+ consultationRate: decimal', '+ isAcceptingPatients: bool'],
                ['+ updateProfile()', '+ updateSchedule()', '+ acceptQueue()']),
            classBox('ownership', 'PetOwnership', 390, 430,
                ['+ linkId: int', '+ userId: int', '+ petId: int', '+ relationship: string', '+ isPrimary: bool', '+ linkedAt: datetime'],
                ['+ linkPet()', '+ requestCoParent()', '+ removeOwnership()']),
            classBox('pet', 'Pet', 760, 410,
                ['+ petId: int', '+ petName: string', '+ species: string', '+ breed: string', '+ birthDate: date', '+ gender: string', '+ weight: decimal', '+ status: string', '+ sharableId: string'],
                ['+ registerPet()', '+ updateDetails()', '+ updateStatus()', '+ viewMedicalHistory()']),
            classBox('vaccination', 'PetVaccination', 760, 90,
                ['+ vaccinationId: int', '+ petId: int', '+ vaccineName: string', '+ vaccinationDate: date', '+ nextDueDate: date', '+ applicator: string', '+ status: string'],
                ['+ recordVaccination()', '+ calculateNextDue()', '+ viewHistory()']),
            classBox('recordGroup', 'MedicalRecordGroup', 1110, 70,
                ['+ groupId: int', '+ petId: int', '+ title: string', '+ summary: text', '+ visibleToOwner: bool', '+ sortOrder: int'],
                ['+ createGroup()', '+ updateGroup()', '+ deleteGroup()']),
            classBox('recordItem', 'MedicalRecordItem', 1460, 70,
                ['+ itemId: int', '+ groupId: int', '+ sourceType: string', '+ sourceId: int?', '+ title: string', '+ summary: text', '+ serviceDate: datetime'],
                ['+ addItem()', '+ updateItem()', '+ removeItem()']),
            classBox('bookingPet', 'BookingPet', 1110, 430,
                ['+ bookingPetId: int', '+ bookingId: int', '+ petId: int', '+ createdAt: datetime'],
                ['+ attachPet()', '+ removePet()']),
            classBox('booking', 'Booking', 1460, 390,
                ['+ bookingId: int', '+ bookingNumber: string', '+ userId: int', '+ branchId: int', '+ serviceType: string', '+ bookingDate: date', '+ bookingTime: time', '+ status: string', '+ price: decimal', '+ paymentMethod: string?'],
                ['+ createBooking()', '+ updateSchedule()', '+ updateStatus()', '+ receiveBooking()', '+ cancelBooking()']),
            classBox('onlineConsultation', 'OnlineConsultation', 1840, 70,
                ['+ consultationId: int', '+ bookingId: int', '+ ownerUserId: int', '+ veterinarianUserId: int', '+ scheduledStart: datetime', '+ scheduledEnd: datetime', '+ meetingUrl: text', '+ status: string'],
                ['+ start()', '+ join()', '+ end()', '+ submitDiagnosis()']),
            classBox('queue', 'QueueEntry', 1110, 890,
                ['+ queueId: int', '+ petId: int', '+ userId: int', '+ bookingId: int?', '+ branchId: int', '+ queueNumber: int', '+ queueDate: date', '+ status: string', '+ priority: string'],
                ['+ enqueue()', '+ updateStatus()', '+ assignVeterinarian()', '+ reenterQueue()']),
            classBox('vetAssignment', 'VetQueueAssignment', 1460, 890,
                ['+ assignmentId: int', '+ queueId: int', '+ veterinarianUserId: int', '+ status: string', '+ receivedAt: datetime', '+ returnedAt: datetime?', '+ completedAt: datetime?'],
                ['+ receive()', '+ returnToQueue()', '+ complete()']),
            classBox('diagnosis', 'Diagnosis', 1840, 820,
                ['+ diagnosisId: int', '+ queueId: int?', '+ bookingId: int?', '+ assignmentId: int?', '+ petId: int', '+ veterinarianUserId: int', '+ chiefComplaint: text', '+ diagnosis: text', '+ treatment: text', '+ prescriptions: json'],
                ['+ recordDiagnosis()', '+ finalize()', '+ viewDiagnosis()']),
            classBox('visit', 'Visit', 2240, 820,
                ['+ visitId: int', '+ petId: int', '+ ownerUserId: int', '+ veterinarianUserId: int?', '+ queueId: int?', '+ bookingId: int?', '+ diagnosisId: int?', '+ branchId: int', '+ visitStatus: string', '+ billingStatus: string'],
                ['+ createVisit()', '+ updateStatus()', '+ calculateBalance()']),
            classBox('service', 'ServiceCatalog', 2620, 230,
                ['+ serviceId: int', '+ serviceCode: string', '+ serviceName: string', '+ serviceType: string', '+ basePrice: decimal', '+ isMajorService: bool', '+ isActive: bool'],
                ['+ saveService()', '+ updateMaterials()', '+ deactivate()']),
            classBox('inventoryItem', 'InventoryItem', 3030, 230,
                ['+ itemId: int', '+ itemName: string', '+ sku: string', '+ category: string', '+ unit: string', '+ reorderLevel: int', '+ unitCost: decimal', '+ status: string'],
                ['+ createItem()', '+ updateItem()', '+ stockOut()', '+ checkReorderLevel()']),
            classBox('visitCharge', 'VisitCharge', 2620, 700,
                ['+ chargeId: int', '+ visitId: int', '+ chargeType: string', '+ serviceId: int?', '+ itemId: int?', '+ description: string', '+ quantity: decimal', '+ unitPrice: decimal', '+ subtotal: decimal'],
                ['+ addCharge()', '+ updateCharge()', '+ calculateSubtotal()']),
            classBox('visitPayment', 'VisitPayment', 2620, 1120,
                ['+ paymentId: int', '+ visitId: int', '+ paymentMethod: string', '+ paymentStatus: string', '+ amount: decimal', '+ referenceNumber: string?', '+ proofUrl: string?', '+ paidAt: datetime'],
                ['+ recordPayment()', '+ verifyPayment()', '+ requestRefund()']),
            classBox('paymentRefund', 'VisitPaymentRefund', 3030, 1120,
                ['+ refundId: int', '+ visitPaymentId: int', '+ visitId: int', '+ amount: decimal', '+ refundMethod: string', '+ referenceNumber: string?', '+ reason: string', '+ refundStatus: string'],
                ['+ processRefund()', '+ voidRefund()']),
        ],
        relationships: [
            relationship('r01', 'branch', 'user', '0..1', '0..*', 'preferred by'),
            relationship('r02', 'user', 'vetProfile', '1', '0..1', 'has profile'),
            relationship('r03', 'user', 'ownership', '1', '0..*', 'owns / co-owns'),
            relationship('r04', 'pet', 'ownership', '1', '0..*', 'ownership links'),
            relationship('r05', 'pet', 'vaccination', '1', '0..*', 'vaccinations'),
            relationship('r06', 'pet', 'recordGroup', '1', '0..*', 'record groups'),
            relationship('r07', 'recordGroup', 'recordItem', '1', '0..*', 'contains'),
            relationship('r08', 'booking', 'bookingPet', '1', '1..*', 'includes'),
            relationship('r09', 'pet', 'bookingPet', '1', '0..*', 'booked through'),
            relationship('r10', 'user', 'booking', '1', '0..*', 'places'),
            relationship('r11', 'branch', 'booking', '1', '0..*', 'accepts'),
            relationship('r12', 'booking', 'onlineConsultation', '1', '0..1', 'creates'),
            relationship('r13', 'booking', 'queue', '0..1', '0..*', 'check-in queues'),
            relationship('r14', 'pet', 'queue', '1', '0..*', 'enters'),
            relationship('r15', 'user', 'queue', '1', '0..*', 'owner'),
            relationship('r16', 'branch', 'queue', '1', '0..*', 'manages'),
            relationship('r17', 'queue', 'vetAssignment', '1', '0..*', 'assigned through'),
            relationship('r18', 'user', 'vetAssignment', '1', '0..*', 'veterinarian'),
            relationship('r19', 'queue', 'diagnosis', '0..1', '0..1', 'results in'),
            relationship('r20', 'vetAssignment', 'diagnosis', '0..1', '0..*', 'documents'),
            relationship('r21', 'pet', 'diagnosis', '1', '0..*', 'receives'),
            relationship('r22', 'user', 'diagnosis', '1', '0..*', 'recorded by vet'),
            relationship('r23', 'pet', 'visit', '1', '0..*', 'has visits'),
            relationship('r24', 'user', 'visit', '1', '0..*', 'owner'),
            relationship('r25', 'booking', 'visit', '0..1', '0..*', 'produces'),
            relationship('r26', 'queue', 'visit', '0..1', '0..1', 'opens'),
            relationship('r27', 'diagnosis', 'visit', '0..1', '0..1', 'clinical record'),
            relationship('r28', 'branch', 'visit', '1', '0..*', 'hosts'),
            relationship('r29', 'visit', 'visitCharge', '1', '0..*', 'charges'),
            relationship('r30', 'service', 'visitCharge', '0..1', '0..*', 'service charge'),
            relationship('r31', 'inventoryItem', 'visitCharge', '0..1', '0..*', 'item charge'),
            relationship('r32', 'visit', 'visitPayment', '1', '0..*', 'payments'),
            relationship('r33', 'visitPayment', 'paymentRefund', '1', '0..*', 'refunds'),
        ],
    },
    {
        id: 'inventory-services',
        name: '02 - Services, Inventory and Billing',
        title: 'IPAWCUS Class Diagram - Services, Inventory and Billing',
        subtitle: 'Detailed association classes show service materials, stock batches, receipts, transfers, charges, and payments',
        width: 3260,
        height: 1800,
        classes: [
            classBox('branch', 'Branch', 40, 130,
                ['+ branchId: int', '+ branchCode: string', '+ branchName: string', '+ branchType: string', '+ status: string'],
                ['+ listBranches()', '+ getOperatingHours()']),
            classBox('user', 'User', 40, 610,
                ['+ userId: int', '+ fullName: string', '+ email: string', '+ role: string', '+ accountStatus: string'],
                ['+ login()', '+ updateProfile()']),
            classBox('location', 'InventoryLocation', 390, 130,
                ['+ locationId: int', '+ branchId: int', '+ locationName: string', '+ storageArea: string?', '+ locationType: string', '+ address: text', '+ status: string'],
                ['+ createLocation()', '+ updateLocation()', '+ listStock()']),
            classBox('item', 'InventoryItem', 750, 130,
                ['+ itemId: int', '+ itemName: string', '+ genericName: string?', '+ sku: string', '+ category: string', '+ unit: string', '+ reorderLevel: int', '+ unitCost: decimal', '+ status: string'],
                ['+ createItem()', '+ updateItem()', '+ checkReorderLevel()']),
            classBox('batch', 'InventoryBatch', 1110, 130,
                ['+ batchId: int', '+ itemId: int', '+ locationId: int', '+ batchNumber: string', '+ quantity: int', '+ manufacturingDate: date?', '+ expiryDate: date?', '+ unitCost: decimal'],
                ['+ receiveStock()', '+ adjustQuantity()', '+ checkExpiration()']),
            classBox('movement', 'StockMovement', 1470, 130,
                ['+ movementId: int', '+ itemId: int', '+ batchId: int?', '+ locationId: int?', '+ movementType: string', '+ quantityChange: int', '+ quantityBefore: int', '+ quantityAfter: int', '+ performedByUserId: int'],
                ['+ recordMovement()', '+ traceReference()']),
            classBox('receipt', 'StockReceipt', 390, 700,
                ['+ receiptId: int', '+ branchId: int', '+ receivingDate: date', '+ deliveryNoteNumber: string?', '+ proofImagePath: string?', '+ receivedByUserId: int', '+ notes: text'],
                ['+ createReceipt()', '+ uploadProof()', '+ finalizeReceipt()']),
            classBox('receiptItem', 'StockReceiptItem', 750, 700,
                ['+ receiptItemId: int', '+ receiptId: int', '+ itemId: int', '+ supplierId: int', '+ batchId: int?', '+ locationId: int', '+ quantityReceived: int', '+ unitCost: decimal'],
                ['+ addReceiptItem()', '+ createBatch()']),
            classBox('supplier', 'InventorySupplier', 1110, 700,
                ['+ supplierId: int', '+ supplierName: string', '+ contactNumber: string?', '+ email: string?', '+ address: text', '+ status: string'],
                ['+ createSupplier()', '+ updateSupplier()']),
            classBox('transfer', 'InventoryTransfer', 390, 1190,
                ['+ transferId: int', '+ transferNumber: string', '+ fromLocationId: int', '+ toLocationId: int', '+ status: string', '+ createdByUserId: int', '+ receivedByUserId: int?', '+ receivedAt: datetime?'],
                ['+ createTransfer()', '+ dispatch()', '+ receive()', '+ cancel()']),
            classBox('transferItem', 'InventoryTransferItem', 750, 1190,
                ['+ transferItemId: int', '+ transferId: int', '+ itemId: int', '+ sourceBatchId: int', '+ quantity: int'],
                ['+ addItem()', '+ validateStock()']),
            classBox('service', 'ServiceCatalog', 1910, 130,
                ['+ serviceId: int', '+ serviceCode: string', '+ serviceName: string', '+ serviceType: string', '+ description: text', '+ basePrice: decimal', '+ isMajorService: bool', '+ isActive: bool'],
                ['+ saveService()', '+ updateMaterials()', '+ deactivateService()']),
            classBox('serviceMaterial', 'ServiceMaterial', 1550, 650,
                ['+ serviceMaterialId: int', '+ serviceId: int', '+ itemId: int?', '+ materialName: string', '+ quantityUsed: decimal', '+ billablePolicy: string'],
                ['+ addMaterial()', '+ updateQuantity()', '+ removeMaterial()']),
            classBox('visit', 'Visit', 2290, 130,
                ['+ visitId: int', '+ branchId: int', '+ petId: int', '+ ownerUserId: int', '+ visitStatus: string', '+ billingStatus: string'],
                ['+ createVisit()', '+ updateStatus()', '+ calculateBalance()']),
            classBox('charge', 'VisitCharge', 2290, 650,
                ['+ chargeId: int', '+ visitId: int', '+ chargeType: string', '+ serviceId: int?', '+ itemId: int?', '+ description: string', '+ quantity: decimal', '+ unitPrice: decimal', '+ subtotal: decimal'],
                ['+ addCharge()', '+ updateCharge()', '+ calculateSubtotal()']),
            classBox('payment', 'VisitPayment', 2670, 650,
                ['+ paymentId: int', '+ visitId: int', '+ paymentMethod: string', '+ paymentStatus: string', '+ amount: decimal', '+ referenceNumber: string?', '+ proofUrl: string?', '+ paidAt: datetime'],
                ['+ recordPayment()', '+ verifyPayment()', '+ requestRefund()']),
            classBox('refund', 'VisitPaymentRefund', 2670, 1120,
                ['+ refundId: int', '+ visitPaymentId: int', '+ visitId: int', '+ amount: decimal', '+ refundMethod: string', '+ referenceNumber: string?', '+ reason: string', '+ refundStatus: string'],
                ['+ processRefund()', '+ voidRefund()']),
        ],
        relationships: [
            relationship('r01', 'branch', 'location', '1', '0..*', 'contains'),
            relationship('r02', 'location', 'batch', '1', '0..*', 'stores'),
            relationship('r03', 'item', 'batch', '1', '0..*', 'batches'),
            relationship('r04', 'item', 'movement', '1', '0..*', 'stock history'),
            relationship('r05', 'batch', 'movement', '0..1', '0..*', 'batch movements'),
            relationship('r06', 'location', 'movement', '0..1', '0..*', 'location movements'),
            relationship('r07', 'user', 'movement', '1', '0..*', 'performs'),
            relationship('r08', 'branch', 'receipt', '1', '0..*', 'receives'),
            relationship('r09', 'user', 'receipt', '1', '0..*', 'received by'),
            relationship('r10', 'receipt', 'receiptItem', '1', '1..*', 'contains'),
            relationship('r11', 'item', 'receiptItem', '1', '0..*', 'received item'),
            relationship('r12', 'supplier', 'receiptItem', '1', '0..*', 'supplies'),
            relationship('r13', 'batch', 'receiptItem', '0..1', '0..*', 'creates/updates'),
            relationship('r14', 'location', 'receiptItem', '1', '0..*', 'destination'),
            relationship('r15', 'location', 'transfer', '2', '0..*', 'from / to'),
            relationship('r16', 'transfer', 'transferItem', '1', '1..*', 'contains'),
            relationship('r17', 'item', 'transferItem', '1', '0..*', 'moves'),
            relationship('r18', 'batch', 'transferItem', '1', '0..*', 'source batch'),
            relationship('r19', 'user', 'transfer', '1..2', '0..*', 'creates / receives'),
            relationship('r20', 'service', 'serviceMaterial', '1', '0..*', 'requires'),
            relationship('r21', 'item', 'serviceMaterial', '0..1', '0..*', 'material item'),
            relationship('r22', 'visit', 'charge', '1', '0..*', 'charges'),
            relationship('r23', 'service', 'charge', '0..1', '0..*', 'service charge'),
            relationship('r24', 'item', 'charge', '0..1', '0..*', 'inventory charge'),
            relationship('r25', 'visit', 'payment', '1', '0..*', 'payments'),
            relationship('r26', 'payment', 'refund', '1', '0..*', 'refunds'),
            relationship('r27', 'user', 'refund', '1', '0..*', 'processed by'),
        ],
    },
    {
        id: 'booking-boarding',
        name: '03 - Booking, Payments and Boarding',
        title: 'IPAWCUS Class Diagram - Booking, Payments and Boarding',
        subtitle: 'Booking lifecycle, multi-pet association, payment review/refund, room assignment, monitoring, and material use',
        width: 3260,
        height: 1800,
        classes: [
            classBox('branch', 'Branch', 40, 130,
                ['+ branchId: int', '+ branchCode: string', '+ branchName: string', '+ branchType: string', '+ address: text', '+ status: string'],
                ['+ listBranches()', '+ checkAvailability()', '+ relocateBooking()']),
            classBox('user', 'User', 40, 620,
                ['+ userId: int', '+ fullName: string', '+ email: string', '+ phoneNumber: string', '+ role: string', '+ accountStatus: string'],
                ['+ login()', '+ updateProfile()', '+ manageBookings()']),
            classBox('pet', 'Pet', 410, 620,
                ['+ petId: int', '+ petName: string', '+ species: string', '+ breed: string', '+ birthDate: date', '+ gender: string', '+ weight: decimal', '+ status: string'],
                ['+ registerPet()', '+ updateDetails()', '+ viewHistory()']),
            classBox('bookingPet', 'BookingPet', 790, 470,
                ['+ bookingPetId: int', '+ bookingId: int', '+ petId: int', '+ createdAt: datetime'],
                ['+ attachPet()', '+ removePet()']),
            classBox('booking', 'Booking', 1180, 390,
                ['+ bookingId: int', '+ bookingNumber: string', '+ userId: int', '+ branchId: int', '+ originalBranchId: int?', '+ serviceType: string', '+ bookingDate: date', '+ bookingTime: time', '+ status: string', '+ price: decimal'],
                ['+ createBooking()', '+ updateSchedule()', '+ updateStatus()', '+ receiveBooking()', '+ cancelBooking()']),
            classBox('online', 'OnlineConsultation', 790, 90,
                ['+ consultationId: int', '+ bookingId: int', '+ ownerUserId: int', '+ veterinarianUserId: int', '+ scheduledStart: datetime', '+ scheduledEnd: datetime', '+ meetingUrl: text', '+ status: string'],
                ['+ start()', '+ join()', '+ end()', '+ submitDiagnosis()']),
            classBox('paymentSubmission', 'BookingPaymentSubmission', 1550, 70,
                ['+ submissionId: int', '+ bookingId: int', '+ purpose: string', '+ amount: decimal', '+ paymentMethod: string', '+ referenceNumber: string?', '+ submissionStatus: string', '+ reviewedByUserId: int?'],
                ['+ submitProof()', '+ review()', '+ verify()', '+ reject()']),
            classBox('bookingRefund', 'BookingPaymentRefund', 1940, 70,
                ['+ refundId: int', '+ submissionId: int', '+ bookingId: int', '+ amount: decimal', '+ refundMethod: string', '+ referenceNumber: string?', '+ reason: string', '+ refundStatus: string'],
                ['+ processRefund()', '+ voidRefund()']),
            classBox('assignment', 'BoardingAssignment', 1550, 520,
                ['+ assignmentId: int', '+ bookingId: int', '+ branchId: int', '+ roomType: string', '+ roomNumber: int', '+ status: string', '+ actualCheckInAt: datetime?', '+ actualCheckOutAt: datetime?', '+ desiredCheckOutDate: date?'],
                ['+ assignRoom()', '+ checkIn()', '+ updateDesiredCheckout()', '+ checkOut()']),
            classBox('observation', 'BoardingObservation', 1940, 430,
                ['+ observationId: int', '+ assignmentId: int?', '+ bookingId: int', '+ petId: int?', '+ observationType: string', '+ notes: text', '+ observedAt: datetime', '+ createdByUserId: int?'],
                ['+ recordObservation()', '+ listObservations()']),
            classBox('task', 'BoardingTask', 2320, 430,
                ['+ taskId: int', '+ assignmentId: int?', '+ bookingId: int', '+ petId: int?', '+ taskType: string', '+ dueAt: datetime', '+ status: string', '+ assignedTo: string?'],
                ['+ createTask()', '+ completeTask()', '+ cancelTask()']),
            classBox('document', 'BoardingDocument', 1940, 910,
                ['+ documentId: int', '+ assignmentId: int?', '+ bookingId: int', '+ petId: int?', '+ documentType: string', '+ title: string', '+ documentPath: string', '+ uploadedByUserId: int?'],
                ['+ uploadDocument()', '+ downloadDocument()', '+ deleteDocument()']),
            classBox('materialUsage', 'BoardingMaterialUsage', 1550, 1070,
                ['+ usageId: int', '+ assignmentId: int', '+ bookingId: int', '+ petId: int?', '+ itemId: int?', '+ quantity: decimal', '+ unitPrice: decimal', '+ status: string', '+ recordedByUserId: int?'],
                ['+ recordUsage()', '+ createVisitCharge()', '+ voidUsage()']),
            classBox('inventoryItem', 'InventoryItem', 1180, 1130,
                ['+ itemId: int', '+ itemName: string', '+ sku: string', '+ category: string', '+ unit: string', '+ reorderLevel: int', '+ unitCost: decimal', '+ status: string'],
                ['+ updateItem()', '+ stockOut()', '+ checkReorderLevel()']),
            classBox('visitCharge', 'VisitCharge', 1940, 1390,
                ['+ chargeId: int', '+ visitId: int', '+ boardingMaterialUsageId: int?', '+ chargeType: string', '+ description: string', '+ quantity: decimal', '+ unitPrice: decimal', '+ subtotal: decimal'],
                ['+ addCharge()', '+ calculateSubtotal()']),
        ],
        relationships: [
            relationship('r01', 'branch', 'booking', '1', '0..*', 'accepts'),
            relationship('r02', 'user', 'booking', '1', '0..*', 'places'),
            relationship('r03', 'booking', 'bookingPet', '1', '1..*', 'includes'),
            relationship('r04', 'pet', 'bookingPet', '1', '0..*', 'booked through'),
            relationship('r05', 'booking', 'online', '1', '0..1', 'online session'),
            relationship('r06', 'user', 'online', '2', '0..*', 'owner / vet'),
            relationship('r07', 'booking', 'paymentSubmission', '1', '0..*', 'payment proofs'),
            relationship('r08', 'user', 'paymentSubmission', '0..1', '0..*', 'reviews'),
            relationship('r09', 'paymentSubmission', 'bookingRefund', '1', '0..*', 'refunds'),
            relationship('r10', 'booking', 'bookingRefund', '1', '0..*', 'booking refunds'),
            relationship('r11', 'user', 'bookingRefund', '1', '0..*', 'processed by'),
            relationship('r12', 'booking', 'assignment', '1', '0..*', 'boarding stays'),
            relationship('r13', 'branch', 'assignment', '1', '0..*', 'hosts'),
            relationship('r14', 'assignment', 'observation', '0..1', '0..*', 'observations'),
            relationship('r15', 'assignment', 'task', '0..1', '0..*', 'care tasks'),
            relationship('r16', 'assignment', 'document', '0..1', '0..*', 'documents'),
            relationship('r17', 'assignment', 'materialUsage', '1', '0..*', 'materials used'),
            relationship('r18', 'pet', 'observation', '0..1', '0..*', 'observed pet'),
            relationship('r19', 'pet', 'task', '0..1', '0..*', 'care recipient'),
            relationship('r20', 'pet', 'document', '0..1', '0..*', 'documented pet'),
            relationship('r21', 'pet', 'materialUsage', '0..1', '0..*', 'used for'),
            relationship('r22', 'inventoryItem', 'materialUsage', '0..1', '0..*', 'consumed item'),
            relationship('r23', 'materialUsage', 'visitCharge', '0..1', '0..1', 'billed as'),
            relationship('r24', 'user', 'observation', '0..1', '0..*', 'recorded by'),
            relationship('r25', 'user', 'task', '0..1', '0..*', 'created by'),
            relationship('r26', 'user', 'document', '0..1', '0..*', 'uploaded by'),
            relationship('r27', 'user', 'materialUsage', '0..1', '0..*', 'recorded by'),
        ],
    },
];

// Keep every page organized as a top-to-bottom reading flow. The overrides are
// intentionally separate from the domain data so future schema changes do not
// require rewriting class definitions just to preserve a clean layout.
const layoutOverrides = {
    'core-clinical': {
        width: 3660,
        height: 2220,
        positions: {
            branch: [40, 120],
            user: [390, 120],
            pet: [760, 120],
            service: [2870, 120],
            inventoryItem: [3260, 120],
            vetProfile: [390, 540],
            ownership: [760, 540],
            vaccination: [1110, 540],
            recordGroup: [1460, 540],
            booking: [1810, 540],
            recordItem: [1460, 1000],
            bookingPet: [1810, 1000],
            onlineConsultation: [2160, 1000],
            queue: [2510, 1000],
            vetAssignment: [2160, 1410],
            diagnosis: [2510, 1410],
            visit: [2870, 1410],
            visitCharge: [3260, 1410],
            visitPayment: [2870, 1810],
            paymentRefund: [3260, 1810],
        },
    },
    'inventory-services': {
        width: 3260,
        height: 2050,
        positions: {
            branch: [40, 120],
            user: [390, 120],
            item: [760, 120],
            supplier: [1130, 120],
            service: [1910, 120],
            visit: [2300, 120],
            location: [40, 510],
            receipt: [390, 510],
            batch: [760, 510],
            serviceMaterial: [1540, 510],
            charge: [2300, 510],
            receiptItem: [390, 920],
            movement: [900, 920],
            payment: [2300, 920],
            transfer: [40, 1360],
            transferItem: [760, 1360],
            refund: [2300, 1360],
        },
    },
    'booking-boarding': {
        width: 3260,
        height: 2140,
        positions: {
            branch: [40, 120],
            user: [410, 120],
            pet: [780, 120],
            bookingPet: [780, 500],
            booking: [1180, 500],
            online: [780, 950],
            paymentSubmission: [1180, 950],
            assignment: [1580, 950],
            inventoryItem: [2750, 950],
            bookingRefund: [1180, 1360],
            observation: [1580, 1360],
            task: [1970, 1360],
            document: [2360, 1360],
            materialUsage: [2750, 1360],
            visitCharge: [2750, 1740],
        },
    },
};

for (const page of pages) {
    const override = layoutOverrides[page.id];
    if (!override) {
        continue;
    }

    page.width = override.width;
    page.height = override.height;
    for (const box of page.classes) {
        const position = override.positions[box.id];
        if (position) {
            [box.x, box.y] = position;
        }
    }
}

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const lineHeight = 21;
const headerHeight = 32;
const sectionPadding = 20;
const routingGrid = 10;
const routingClearance = 18;

function getBoxHeight(box) {
    const attributeHeight = Math.max(42, box.attributes.length * lineHeight + sectionPadding);
    const methodHeight = Math.max(42, box.methods.length * lineHeight + sectionPadding);
    return headerHeight + attributeHeight + methodHeight;
}

function renderClass(box) {
    const attributeHeight = Math.max(42, box.attributes.length * lineHeight + sectionPadding);
    const methodHeight = Math.max(42, box.methods.length * lineHeight + sectionPadding);
    const totalHeight = getBoxHeight(box);
    // XML normalizes literal newlines inside attributes into spaces. Draw.io's
    // explicit line-feed entity keeps every UML member on its own visible row.
    const attributes = box.attributes.map(escapeXml).join('&#xa;');
    const methods = box.methods.map(escapeXml).join('&#xa;');
    const parentStyle = [
        'swimlane',
        'html=0',
        'startSize=32',
        'horizontal=1',
        'fontStyle=1',
        'fontSize=13',
        'align=center',
        'verticalAlign=middle',
        'fillColor=#ffffff',
        'swimlaneFillColor=#ffffff',
        'strokeColor=#111827',
        'fontColor=#111827',
        'strokeWidth=1.5',
        'rounded=0',
        'shadow=0',
        'collapsible=0',
    ].join(';');
    const sectionStyle = [
        'text',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'align=left',
        'verticalAlign=top',
        'spacingTop=9',
        'spacingLeft=10',
        'spacingRight=10',
        'fillColor=#ffffff',
        'strokeColor=#111827',
        'fontColor=#111827',
        'fontSize=12',
        'rounded=0',
    ].join(';');

    return [
        `        <mxCell id="${box.id}" value="${escapeXml(box.name)}" style="${parentStyle}" vertex="1" parent="1">`,
        `          <mxGeometry x="${box.x}" y="${box.y}" width="${box.width}" height="${totalHeight}" as="geometry"/>`,
        '        </mxCell>',
        `        <mxCell id="${box.id}-attributes" value="${attributes}" style="${sectionStyle}" vertex="1" parent="${box.id}">`,
        `          <mxGeometry y="${headerHeight}" width="${box.width}" height="${attributeHeight}" as="geometry"/>`,
        '        </mxCell>',
        `        <mxCell id="${box.id}-methods" value="${methods}" style="${sectionStyle}" vertex="1" parent="${box.id}">`,
        `          <mxGeometry y="${headerHeight + attributeHeight}" width="${box.width}" height="${methodHeight}" as="geometry"/>`,
        '        </mxCell>',
    ].join('\n');
}

const directions = [
    { name: 'right', dx: routingGrid, dy: 0 },
    { name: 'down', dx: 0, dy: routingGrid },
    { name: 'left', dx: -routingGrid, dy: 0 },
    { name: 'up', dx: 0, dy: -routingGrid },
];

class MinHeap {
    constructor() {
        this.items = [];
    }

    push(item) {
        this.items.push(item);
        let index = this.items.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.items[parent].priority <= item.priority) {
                break;
            }
            this.items[index] = this.items[parent];
            index = parent;
        }
        this.items[index] = item;
    }

    pop() {
        if (this.items.length === 0) {
            return null;
        }
        const root = this.items[0];
        const tail = this.items.pop();
        if (this.items.length === 0) {
            return root;
        }
        let index = 0;
        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            if (left >= this.items.length) {
                break;
            }
            const next = right < this.items.length && this.items[right].priority < this.items[left].priority
                ? right
                : left;
            if (this.items[next].priority >= tail.priority) {
                break;
            }
            this.items[index] = this.items[next];
            index = next;
        }
        this.items[index] = tail;
        return root;
    }

    get size() {
        return this.items.length;
    }
}

const pointKey = (point) => `${point.x},${point.y}`;
const stateKey = (point, direction) => `${point.x},${point.y},${direction}`;
const segmentKey = (a, b) => [pointKey(a), pointKey(b)].sort().join('|');
const snap = (value) => Math.round(value / routingGrid) * routingGrid;

function boxRectangle(box, padding = 0) {
    return {
        x: box.x - padding,
        y: box.y - padding,
        width: box.width + padding * 2,
        height: getBoxHeight(box) + padding * 2,
    };
}

function pointInsideRectangle(point, rectangle) {
    return point.x >= rectangle.x
        && point.x <= rectangle.x + rectangle.width
        && point.y >= rectangle.y
        && point.y <= rectangle.y + rectangle.height;
}

function choosePortSides(source, target) {
    const sourceCenterX = source.x + source.width / 2;
    const targetCenterX = target.x + target.width / 2;
    const sourceCenterY = source.y + getBoxHeight(source) / 2;
    const targetCenterY = target.y + getBoxHeight(target) / 2;
    const horizontalDistance = Math.abs(targetCenterX - sourceCenterX);
    const verticalDistance = Math.abs(targetCenterY - sourceCenterY);

    if (verticalDistance >= horizontalDistance * 0.42) {
        return sourceCenterY <= targetCenterY
            ? { sourceSide: 'bottom', targetSide: 'top' }
            : { sourceSide: 'top', targetSide: 'bottom' };
    }

    return sourceCenterX <= targetCenterX
        ? { sourceSide: 'right', targetSide: 'left' }
        : { sourceSide: 'left', targetSide: 'right' };
}

function createPort(box, side, slotIndex, slotCount) {
    const height = getBoxHeight(box);
    const fraction = (slotIndex + 1) / (slotCount + 1);
    let boundary;
    let extension;
    let anchor;

    if (side === 'top' || side === 'bottom') {
        const x = snap(box.x + Math.max(28, Math.min(box.width - 28, box.width * fraction)));
        const y = side === 'top' ? box.y : box.y + height;
        const extensionY = side === 'top'
            ? Math.floor((y - routingClearance - routingGrid) / routingGrid) * routingGrid
            : Math.ceil((y + routingClearance + routingGrid) / routingGrid) * routingGrid;
        boundary = { x, y };
        extension = { x, y: extensionY };
        anchor = { x: (x - box.x) / box.width, y: side === 'top' ? 0 : 1 };
    } else {
        const y = snap(box.y + Math.max(28, Math.min(height - 28, height * fraction)));
        const x = side === 'left' ? box.x : box.x + box.width;
        const extensionX = side === 'left'
            ? Math.floor((x - routingClearance - routingGrid) / routingGrid) * routingGrid
            : Math.ceil((x + routingClearance + routingGrid) / routingGrid) * routingGrid;
        boundary = { x, y };
        extension = { x: extensionX, y };
        anchor = { x: side === 'left' ? 0 : 1, y: (y - box.y) / height };
    }

    return { boundary, extension, anchor };
}

function simplifyRoute(points) {
    if (points.length <= 2) {
        return points;
    }
    const simplified = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
        const previous = simplified[simplified.length - 1];
        const current = points[index];
        const next = points[index + 1];
        const collinear = (previous.x === current.x && current.x === next.x)
            || (previous.y === current.y && current.y === next.y);
        if (!collinear) {
            simplified.push(current);
        }
    }
    simplified.push(points.at(-1));
    return simplified;
}

function findRoute(start, end, obstacles, page, usedSegments, usedPoints) {
    const minX = routingGrid;
    const minY = 100;
    const maxX = Math.floor((page.width - routingGrid) / routingGrid) * routingGrid;
    const maxY = Math.floor((page.height - routingGrid) / routingGrid) * routingGrid;
    const isBlocked = (point) => obstacles.some((rectangle) => pointInsideRectangle(point, rectangle));
    const open = new MinHeap();
    const costs = new Map();
    const previous = new Map();
    const startState = { point: start, direction: 'start', cost: 0 };
    open.push({ ...startState, priority: Math.abs(start.x - end.x) + Math.abs(start.y - end.y) });
    costs.set(stateKey(start, 'start'), 0);
    let finalState = null;

    while (open.size > 0) {
        const current = open.pop();
        const currentKey = stateKey(current.point, current.direction);
        if (current.cost !== costs.get(currentKey)) {
            continue;
        }
        if (current.point.x === end.x && current.point.y === end.y) {
            finalState = current;
            break;
        }

        for (const direction of directions) {
            const next = {
                x: current.point.x + direction.dx,
                y: current.point.y + direction.dy,
            };
            if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY) {
                continue;
            }
            if (!(next.x === end.x && next.y === end.y) && isBlocked(next)) {
                continue;
            }

            const reusedSegment = usedSegments.has(segmentKey(current.point, next));
            const occupiedPoint = usedPoints.get(pointKey(next)) || 0;
            const bendPenalty = current.direction !== 'start' && current.direction !== direction.name ? 4 : 0;
            const lanePenalty = reusedSegment ? 120 : occupiedPoint * 5;
            const nextCost = current.cost + 1 + bendPenalty + lanePenalty;
            const nextKey = stateKey(next, direction.name);
            if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
                continue;
            }

            costs.set(nextKey, nextCost);
            previous.set(nextKey, currentKey);
            const heuristic = (Math.abs(next.x - end.x) + Math.abs(next.y - end.y)) / routingGrid;
            open.push({ point: next, direction: direction.name, cost: nextCost, priority: nextCost + heuristic });
        }
    }

    if (!finalState) {
        throw new Error(`Unable to route connector from ${pointKey(start)} to ${pointKey(end)}`);
    }

    const route = [];
    let key = stateKey(finalState.point, finalState.direction);
    while (key) {
        const [x, y] = key.split(',', 2).map(Number);
        route.push({ x, y });
        key = previous.get(key);
    }
    route.reverse();
    return simplifyRoute(route);
}

function segmentIntersectsRectangle(a, b, rectangle) {
    if (a.x === b.x) {
        return a.x > rectangle.x
            && a.x < rectangle.x + rectangle.width
            && Math.max(a.y, b.y) > rectangle.y
            && Math.min(a.y, b.y) < rectangle.y + rectangle.height;
    }
    if (a.y === b.y) {
        return a.y > rectangle.y
            && a.y < rectangle.y + rectangle.height
            && Math.max(a.x, b.x) > rectangle.x
            && Math.min(a.x, b.x) < rectangle.x + rectangle.width;
    }
    return true;
}

const routingSideOverrides = {
    // Pet sits directly above PetOwnership, so the User association enters
    // from the left instead of trying to pass through the Pet class box.
    'core-clinical:r03': { sourceSide: 'right', targetSide: 'left' },
};

function createRelationshipRoutes(page, classesById) {
    const specifications = page.relationships.map((edge) => {
        const override = routingSideOverrides[`${page.id}:${edge.id}`];
        return {
            edge,
            ...(override || choosePortSides(classesById.get(edge.source), classesById.get(edge.target))),
        };
    });
    const portCounts = new Map();
    for (const specification of specifications) {
        for (const [classId, side] of [
            [specification.edge.source, specification.sourceSide],
            [specification.edge.target, specification.targetSide],
        ]) {
            const key = `${classId}:${side}`;
            portCounts.set(key, (portCounts.get(key) || 0) + 1);
        }
    }

    const portIndexes = new Map();
    const obstacles = [
        { x: 0, y: 0, width: page.width, height: 95 },
        ...page.classes.map((box) => boxRectangle(box, routingClearance)),
    ];
    const usedSegments = new Set();
    const usedPoints = new Map();
    const routes = new Map();

    for (const specification of specifications) {
        const { edge, sourceSide, targetSide } = specification;
        const source = classesById.get(edge.source);
        const target = classesById.get(edge.target);
        const sourceKey = `${edge.source}:${sourceSide}`;
        const targetKey = `${edge.target}:${targetSide}`;
        const sourceIndex = portIndexes.get(sourceKey) || 0;
        const targetIndex = portIndexes.get(targetKey) || 0;
        portIndexes.set(sourceKey, sourceIndex + 1);
        portIndexes.set(targetKey, targetIndex + 1);
        const sourcePort = createPort(source, sourceSide, sourceIndex, portCounts.get(sourceKey));
        const targetPort = createPort(target, targetSide, targetIndex, portCounts.get(targetKey));
        const routeObstacles = obstacles.filter((_, index) => index === 0 || (page.classes[index - 1].id !== edge.source && page.classes[index - 1].id !== edge.target));
        const routedPoints = findRoute(
            sourcePort.extension,
            targetPort.extension,
            routeObstacles,
            page,
            usedSegments,
            usedPoints,
        );
        const allPoints = [sourcePort.boundary, ...routedPoints, targetPort.boundary];

        for (let index = 0; index < routedPoints.length - 1; index += 1) {
            const a = routedPoints[index];
            const b = routedPoints[index + 1];
            const stepCount = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / routingGrid;
            for (let step = 0; step < stepCount; step += 1) {
                const from = {
                    x: a.x + Math.sign(b.x - a.x) * routingGrid * step,
                    y: a.y + Math.sign(b.y - a.y) * routingGrid * step,
                };
                const to = {
                    x: a.x + Math.sign(b.x - a.x) * routingGrid * (step + 1),
                    y: a.y + Math.sign(b.y - a.y) * routingGrid * (step + 1),
                };
                usedSegments.add(segmentKey(from, to));
                usedPoints.set(pointKey(to), (usedPoints.get(pointKey(to)) || 0) + 1);
            }
        }

        for (const box of page.classes) {
            if (box.id === edge.source || box.id === edge.target) {
                continue;
            }
            const rectangle = boxRectangle(box);
            for (let index = 0; index < allPoints.length - 1; index += 1) {
                if (segmentIntersectsRectangle(allPoints[index], allPoints[index + 1], rectangle)) {
                    throw new Error(`Connector ${edge.id} intersects class box ${box.id} on page ${page.name}`);
                }
            }
        }

        routes.set(edge.id, {
            sourceAnchor: sourcePort.anchor,
            targetAnchor: targetPort.anchor,
            points: simplifyRoute(routedPoints),
        });
    }

    return routes;
}

function renderRelationship(edge, route) {
    const anchors = [
        `exitX=${route.sourceAnchor.x.toFixed(4)}`,
        `exitY=${route.sourceAnchor.y.toFixed(4)}`,
        `entryX=${route.targetAnchor.x.toFixed(4)}`,
        `entryY=${route.targetAnchor.y.toFixed(4)}`,
    ];

    const edgeStyle = [
        'edgeStyle=orthogonalEdgeStyle',
        'rounded=0',
        'orthogonalLoop=1',
        'jettySize=auto',
        'jumpStyle=arc',
        'jumpSize=10',
        'html=0',
        'endArrow=none',
        'startArrow=none',
        'strokeColor=#374151',
        'strokeWidth=1.4',
        'fontColor=#111827',
        'fontSize=11',
        'exitDx=0',
        'exitDy=0',
        'entryDx=0',
        'entryDy=0',
        ...anchors,
    ].join(';');
    const labelStyle = [
        'edgeLabel',
        'html=0',
        'align=center',
        'verticalAlign=middle',
        'resizable=0',
        'points=[]',
        'fontColor=#111827',
        'fontSize=11',
        'fontStyle=1',
        'labelBackgroundColor=#ffffff',
    ].join(';');

    return [
        `        <mxCell id="${edge.id}" value="" style="${edgeStyle}" edge="1" parent="1" source="${edge.source}" target="${edge.target}">`,
        '          <mxGeometry relative="1" as="geometry">',
        '            <Array as="points">',
        ...route.points.map((point) => `              <mxPoint x="${point.x}" y="${point.y}"/>`),
        '            </Array>',
        '          </mxGeometry>',
        '        </mxCell>',
        `        <mxCell id="${edge.id}-source-label" value="${escapeXml(edge.sourceMultiplicity)}" style="${labelStyle}" vertex="1" connectable="0" parent="${edge.id}">`,
        '          <mxGeometry x="-0.86" y="-14" relative="1" as="geometry"><mxPoint x="4" y="0" as="offset"/></mxGeometry>',
        '        </mxCell>',
        `        <mxCell id="${edge.id}-target-label" value="${escapeXml(edge.targetMultiplicity)}" style="${labelStyle}" vertex="1" connectable="0" parent="${edge.id}">`,
        '          <mxGeometry x="0.86" y="14" relative="1" as="geometry"><mxPoint x="-4" y="0" as="offset"/></mxGeometry>',
        '        </mxCell>',
    ].join('\n');
}

function renderPage(page) {
    const titleStyle = 'text;html=0;align=left;verticalAlign=middle;fontColor=#111827;fontSize=24;fontStyle=1;strokeColor=none;fillColor=none;';
    const subtitleStyle = 'text;html=0;align=left;verticalAlign=middle;fontColor=#4b5563;fontSize=12;strokeColor=none;fillColor=none;';
    const legendStyle = 'rounded=0;html=0;whiteSpace=wrap;align=left;verticalAlign=middle;spacing=8;fillColor=#ffffff;strokeColor=#9ca3af;fontColor=#111827;fontSize=11;';
    const classesById = new Map(page.classes.map((box) => [box.id, box]));
    const relationshipRoutes = createRelationshipRoutes(page, classesById);
    const classes = page.classes.map(renderClass).join('\n');
    const relationships = page.relationships
        .map((edge) => renderRelationship(edge, relationshipRoutes.get(edge.id)))
        .join('\n');

    return [
        `  <diagram id="${escapeXml(page.id)}" name="${escapeXml(page.name)}">`,
        `    <mxGraphModel dx="1400" dy="850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${page.width}" pageHeight="${page.height}" math="0" shadow="0" background="#ffffff">`,
        '      <root>',
        '        <mxCell id="0"/>',
        '        <mxCell id="1" parent="0"/>',
        `        <mxCell id="page-title" value="${escapeXml(page.title)}" style="${titleStyle}" vertex="1" parent="1"><mxGeometry x="30" y="20" width="900" height="34" as="geometry"/></mxCell>`,
        `        <mxCell id="page-subtitle" value="${escapeXml(page.subtitle)}" style="${subtitleStyle}" vertex="1" parent="1"><mxGeometry x="30" y="58" width="1200" height="24" as="geometry"/></mxCell>`,
        `        <mxCell id="page-legend" value="Multiplicity: 1 = exactly one   |   0..1 = optional one   |   1..* = one or more   |   0..* = zero or more" style="${legendStyle}" vertex="1" parent="1"><mxGeometry x="${page.width - 870}" y="25" width="820" height="48" as="geometry"/></mxCell>`,
        classes,
        relationships,
        '      </root>',
        '    </mxGraphModel>',
        '  </diagram>',
    ].join('\n');
}

const documentXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="app.diagrams.net" modified="2026-08-10T00:00:00.000Z" agent="Codex" version="24.7.17" type="device" compressed="false">',
    pages.map(renderPage).join('\n'),
    '</mxfile>',
    '',
].join('\n');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, documentXml, 'utf8');
console.log(`Generated ${outputPath}`);
