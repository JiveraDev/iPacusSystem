import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Minus,
  Package,
  PawPrint,
  Pill,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Stethoscope,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { formatPhpCurrency } from '../../lib/currency';
import ipawcusLogo from '../../assets/logo-no-bg.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const INVOICE_DATE = 'May 30, 2026';

const CLASSIFICATIONS = [
  {
    id: 'services',
    label: 'Services',
    receiptType: 'SERVICE',
    icon: Stethoscope,
    accent: 'blue',
    description: 'Consultation, vaccination, surgery, grooming, boarding, and home service.',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    receiptType: 'LAB',
    icon: Stethoscope,
    accent: 'emerald',
    description: 'CBC, blood chemistry, urinalysis, fecalysis, X-ray, ultrasound, and ECG.',
  },
  {
    id: 'medications',
    label: 'Medication',
    receiptType: 'MEDICINE',
    icon: Pill,
    accent: 'rose',
    description: 'Medicine dispensed or sold after the veterinarian prescribes it.',
  },
  {
    id: 'products',
    label: 'Products',
    receiptType: 'PRODUCT',
    icon: ShoppingBag,
    accent: 'amber',
    description: 'Retail products such as food, shampoo, collars, supplements, and treats.',
  },
];

const CLASSIFICATION_BY_ID = CLASSIFICATIONS.reduce((map, classification) => {
  map[classification.id] = classification;
  return map;
}, {});

const BILLING_CLASSIFICATIONS = CLASSIFICATIONS.filter((classification) => (
  ['services', 'medications', 'products'].includes(classification.id)
));

const WALK_IN_SALE_ID = 'walk-in-sale';

const WALK_IN_SALE_VISIT = {
  id: WALK_IN_SALE_ID,
  source: 'walk_in',
  petName: 'Walk-in Customer',
  ownerName: 'Counter Sale',
  species: 'No patient visit',
  visitType: 'Walk-in / Retail Invoice',
  veterinarian: 'POS Counter',
  complaint: 'No ready-for-billing visit is required for direct sales.',
  status: 'Optional visit',
  initialCharges: [],
};

const INITIAL_INVENTORY = [
  { id: 'inv-rabies-vaccine', name: 'Rabies Vaccine Dose', category: 'MEDICATION', stock: 0, unit: 'dose', cost: 280, sellingPrice: 0, sellable: false },
  { id: 'inv-5in1-vaccine', name: '5-in-1 Vaccine Dose', category: 'MEDICATION', stock: 12, unit: 'dose', cost: 390, sellingPrice: 0, sellable: false },
  { id: 'inv-syringe-3ml', name: 'Syringe 3ml', category: 'CONSUMABLE', stock: 28, unit: 'pcs', cost: 8, sellingPrice: 0, sellable: false },
  { id: 'inv-alcohol-swab', name: 'Alcohol Swab', category: 'CONSUMABLE', stock: 84, unit: 'pcs', cost: 2, sellingPrice: 0, sellable: false },
  { id: 'inv-cotton-roll', name: 'Cotton Roll', category: 'CONSUMABLE', stock: 16, unit: 'rolls', cost: 45, sellingPrice: 0, sellable: false },
  { id: 'inv-gloves-pair', name: 'Surgical Gloves Pair', category: 'CONSUMABLE', stock: 40, unit: 'pairs', cost: 12, sellingPrice: 0, sellable: false },
  { id: 'inv-cbc-kit', name: 'CBC Test Kit', category: 'CONSUMABLE', stock: 5, unit: 'kits', cost: 260, sellingPrice: 0, sellable: false },
  { id: 'inv-edta-tube', name: 'EDTA Tube', category: 'CONSUMABLE', stock: 10, unit: 'pcs', cost: 18, sellingPrice: 0, sellable: false },
  { id: 'inv-chem-cartridge', name: 'Blood Chemistry Cartridge', category: 'CONSUMABLE', stock: 3, unit: 'cartridges', cost: 520, sellingPrice: 0, sellable: false },
  { id: 'inv-serum-tube', name: 'Serum Tube', category: 'CONSUMABLE', stock: 9, unit: 'pcs', cost: 18, sellingPrice: 0, sellable: false },
  { id: 'inv-urine-strip', name: 'Urinalysis Test Strip', category: 'CONSUMABLE', stock: 14, unit: 'strips', cost: 30, sellingPrice: 0, sellable: false },
  { id: 'inv-xray-film', name: 'X-Ray Film', category: 'CONSUMABLE', stock: 0, unit: 'sheets', cost: 160, sellingPrice: 0, sellable: false },
  { id: 'inv-sterile-surgery-pack', name: 'Sterile Surgery Pack', category: 'CONSUMABLE', stock: 0, unit: 'packs', cost: 480, sellingPrice: 0, sellable: false },
  { id: 'inv-suture', name: 'Suture Pack', category: 'CONSUMABLE', stock: 6, unit: 'packs', cost: 110, sellingPrice: 0, sellable: false },
  { id: 'med-amoxicillin', name: 'Amoxicillin 250mg Tablet', category: 'MEDICATION', stock: 80, unit: 'tabs', cost: 12, sellingPrice: 30, sellable: true },
  { id: 'med-vitamin-syrup', name: 'Vitamin Syrup 120ml', category: 'MEDICATION', stock: 7, unit: 'bottles', cost: 130, sellingPrice: 250, sellable: true },
  { id: 'med-meloxicam', name: 'Meloxicam Tablet', category: 'MEDICATION', stock: 18, unit: 'tabs', cost: 18, sellingPrice: 45, sellable: true },
  { id: 'med-dewormer', name: 'Dewormer Tablet', category: 'MEDICATION', stock: 22, unit: 'tabs', cost: 60, sellingPrice: 120, sellable: true },
  { id: 'ret-pet-food', name: 'Adult Dog Food 2kg', category: 'RETAIL', stock: 9, unit: 'bags', cost: 420, sellingPrice: 650, sellable: true },
  { id: 'ret-shampoo', name: 'Medicated Pet Shampoo', category: 'RETAIL', stock: 6, unit: 'bottles', cost: 180, sellingPrice: 320, sellable: true },
  { id: 'ret-leash', name: 'Nylon Leash', category: 'RETAIL', stock: 4, unit: 'pcs', cost: 95, sellingPrice: 180, sellable: true },
  { id: 'ret-treats', name: 'Training Treats', category: 'RETAIL', stock: 15, unit: 'packs', cost: 75, sellingPrice: 150, sellable: true },
];

const SERVICE_PACKAGES = [
  {
    id: 'svc-consultation',
    classificationId: 'services',
    name: 'Consultation Fee',
    group: 'Consultation',
    price: 500,
    description: 'Doctor examination and medical assessment.',
    materials: [],
  },
  {
    id: 'svc-rabies',
    classificationId: 'services',
    name: 'Rabies Vaccination Package',
    group: 'Vaccination',
    price: 600,
    description: 'Client sees one vaccination charge; vaccine and materials are deducted internally.',
    materials: [
      { inventoryId: 'inv-rabies-vaccine', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-syringe-3ml', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-alcohol-swab', quantity: 1, role: 'Consumable' },
    ],
  },
  {
    id: 'svc-5in1',
    classificationId: 'services',
    name: '5-in-1 Vaccination Package',
    group: 'Vaccination',
    price: 850,
    description: 'Core vaccine package with syringe and swab consumption hidden from invoice.',
    materials: [
      { inventoryId: 'inv-5in1-vaccine', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-syringe-3ml', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-alcohol-swab', quantity: 1, role: 'Consumable' },
    ],
  },
  {
    id: 'svc-wound-suture',
    classificationId: 'services',
    name: 'Wound Suturing',
    group: 'Surgery',
    price: 2200,
    description: 'Minor wound closure with sterile pack and suture materials.',
    materials: [
      { inventoryId: 'inv-sterile-surgery-pack', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-suture', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-gloves-pair', quantity: 2, role: 'Consumable' },
    ],
  },
  {
    id: 'svc-spay-small',
    classificationId: 'services',
    name: 'Spay Surgery - Small Pet',
    group: 'Surgery',
    price: 3500,
    description: 'Surgical package for pets under 10kg.',
    materials: [
      { inventoryId: 'inv-sterile-surgery-pack', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-suture', quantity: 2, role: 'Main material' },
      { inventoryId: 'inv-syringe-3ml', quantity: 2, role: 'Consumable' },
      { inventoryId: 'inv-gloves-pair', quantity: 3, role: 'Consumable' },
    ],
  },
  {
    id: 'svc-grooming',
    classificationId: 'services',
    name: 'Full Grooming - Small Pet',
    group: 'Grooming',
    price: 1200,
    description: 'Bath, trim, nail care, and ear cleaning.',
    materials: [],
  },
  {
    id: 'svc-home-visit',
    classificationId: 'services',
    name: 'Home Visit Consultation',
    group: 'Home Service',
    price: 1500,
    description: 'Veterinarian home visit and examination.',
    materials: [],
  },
  {
    id: 'svc-boarding',
    classificationId: 'services',
    name: 'Standard Boarding - Per Day',
    group: 'Boarding',
    price: 800,
    description: 'Basic accommodation and patient monitoring.',
    materials: [],
  },
];

const DIAGNOSTIC_PACKAGES = [
  {
    id: 'lab-cbc',
    classificationId: 'diagnostics',
    name: 'CBC Test',
    group: 'Laboratory',
    price: 800,
    description: 'Complete blood count with CBC kit, syringe, and EDTA tube.',
    materials: [
      { inventoryId: 'inv-cbc-kit', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-syringe-3ml', quantity: 1, role: 'Consumable' },
      { inventoryId: 'inv-edta-tube', quantity: 1, role: 'Main material' },
    ],
  },
  {
    id: 'lab-blood-chem',
    classificationId: 'diagnostics',
    name: 'Blood Chemistry',
    group: 'Laboratory',
    price: 1500,
    description: 'Blood chemistry test with chemistry cartridge and serum tube.',
    materials: [
      { inventoryId: 'inv-chem-cartridge', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-serum-tube', quantity: 1, role: 'Main material' },
      { inventoryId: 'inv-syringe-3ml', quantity: 1, role: 'Consumable' },
    ],
  },
  {
    id: 'lab-urinalysis',
    classificationId: 'diagnostics',
    name: 'Urinalysis',
    group: 'Laboratory',
    price: 700,
    description: 'Urine screening using diagnostic strip.',
    materials: [
      { inventoryId: 'inv-urine-strip', quantity: 1, role: 'Main material' },
    ],
  },
  {
    id: 'lab-xray',
    classificationId: 'diagnostics',
    name: 'X-Ray - Single View',
    group: 'Imaging',
    price: 1200,
    description: 'Radiographic imaging with one film sheet.',
    materials: [
      { inventoryId: 'inv-xray-film', quantity: 1, role: 'Main material' },
    ],
  },
  {
    id: 'lab-ultrasound',
    classificationId: 'diagnostics',
    name: 'Ultrasound Examination',
    group: 'Imaging',
    price: 2500,
    description: 'Abdominal ultrasound examination.',
    materials: [],
  },
];

let lineSequence = 0;

function nextLineId(prefix = 'line') {
  lineSequence += 1;
  return `${prefix}-${lineSequence}`;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function groupById(items) {
  return items.reduce((map, item) => {
    map[String(item.id)] = item;
    return map;
  }, {});
}

function getCatalogClassification(serviceType) {
  if (serviceType === 'laboratory') {
    return 'diagnostics';
  }

  return 'services';
}

function serviceTypeLabel(value) {
  const labels = {
    consultation: 'Consultation',
    vaccination: 'Vaccination',
    laboratory: 'Laboratory',
    surgery: 'Surgery',
    grooming: 'Grooming',
    boarding: 'Boarding',
    dental: 'Dental',
    home_service: 'Home Service',
    other: 'Other',
  };

  return labels[value] || 'Service';
}

function normalizeServiceCatalogItem(service) {
  const classificationId = getCatalogClassification(service.serviceType);

  return {
    id: `service-${service.serviceId}`,
    serviceId: service.serviceId,
    classificationId,
    inventoryId: null,
    name: service.serviceName,
    group: serviceTypeLabel(service.serviceType),
    price: Number(service.basePrice) || 0,
    description: service.description || '',
    materials: (service.materials || []).map((material) => ({
      inventoryId: material.itemId !== null && material.itemId !== undefined ? String(material.itemId) : '',
      quantity: Number(material.qtyUsed) || 1,
      role: material.billablePolicy === 'separate' ? 'Separate material' : 'Included material',
    })).filter((material) => material.inventoryId),
  };
}

function normalizeInventoryItems(data) {
  return (Array.isArray(data?.items) ? data.items : []).map((item) => {
    const category = String(item.category || '').trim().toUpperCase();
    const itemId = String(item.itemId || item.id || '');
    const costPrice = Number(item.costPrice || item.unitCost || 0);
    const sellingPrice = Number(item.sellingPrice || item.salePrice || item.retailPrice || costPrice || 0);

    return {
      id: itemId,
      itemId: Number(item.itemId || item.id || 0),
      name: item.name || item.itemName || 'Inventory item',
      category,
      stock: Number(item.quantity || item.stock || 0),
      unit: item.unit || 'pcs',
      cost: costPrice,
      sellingPrice,
      sellable: category !== 'CONSUMABLE' && sellingPrice > 0,
    };
  }).filter((item) => item.id);
}

function buildCatalog(inventory, serviceCatalog = []) {
  const activeCatalogItems = serviceCatalog
    .filter((service) => service.isActive !== false)
    .map(normalizeServiceCatalogItem);
  const catalogServices = activeCatalogItems.filter((item) => item.classificationId === 'services');

  const medicationItems = inventory
    .filter((item) => item.category === 'MEDICATION' && item.sellable)
    .map((item) => ({
      id: item.id,
      classificationId: 'medications',
      inventoryId: item.id,
      name: item.name,
      group: 'Medication',
      price: item.sellingPrice,
      description: `${item.stock} ${item.unit} available`,
      materials: [],
    }));

  const productItems = inventory
    .filter((item) => item.category !== 'MEDICATION' && item.category !== 'CONSUMABLE' && item.sellable)
    .map((item) => ({
      id: item.id,
      classificationId: 'products',
      inventoryId: item.id,
      name: item.name,
      group: item.category ? item.category.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : 'Inventory',
      price: item.sellingPrice,
      description: `${item.stock} ${item.unit} available`,
      materials: [],
    }));

  return {
    services: catalogServices.length > 0 ? catalogServices : SERVICE_PACKAGES,
    diagnostics: DIAGNOSTIC_PACKAGES,
    medications: medicationItems,
    products: productItems,
  };
}

function flattenCatalog(catalog) {
  return Object.values(catalog).flat().reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
}

function createCharge(item, quantity = 1) {
  const classification = CLASSIFICATION_BY_ID[item.classificationId];

  return {
    lineId: nextLineId(item.id),
    catalogId: item.id,
    classificationId: item.classificationId,
    receiptType: classification.receiptType,
    name: item.name,
    group: item.group,
    quantity,
    price: item.price,
    inventoryId: item.inventoryId || null,
    includedMaterials: (item.materials || []).map((material) => ({ ...material })),
    extraMaterials: [],
  };
}

function createPrefillCharge(charge, index = 0) {
  const classificationId = charge.classificationId || 'services';
  const classification = CLASSIFICATION_BY_ID[classificationId] || CLASSIFICATION_BY_ID.services;
  const quantity = Number(charge.quantity);
  const price = Number(charge.price);

  return {
    lineId: nextLineId(charge.catalogId || `prefill-${index + 1}`),
    catalogId: charge.catalogId || null,
    classificationId,
    receiptType: charge.receiptType || classification.receiptType,
    name: charge.name || 'Boarding stay',
    group: charge.group || 'Boarding',
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    inventoryId: charge.inventoryId || null,
    includedMaterials: Array.isArray(charge.includedMaterials) ? charge.includedMaterials : [],
    extraMaterials: Array.isArray(charge.extraMaterials) ? charge.extraMaterials : [],
  };
}

function createInitialCharges(catalogMap, visit) {
  return visit.initialCharges
    .map((charge) => {
      const item = catalogMap[charge.id];
      return item ? createCharge(item, charge.quantity) : null;
    })
    .filter(Boolean);
}

function getChargeConsumption(charge) {
  const rows = [];

  if (charge.inventoryId) {
    rows.push({
      inventoryId: charge.inventoryId,
      quantity: charge.quantity,
      lineName: charge.name,
      source: 'Sold item',
    });
  }

  charge.includedMaterials.forEach((material) => {
    rows.push({
      inventoryId: material.inventoryId,
      quantity: material.quantity * charge.quantity,
      lineName: charge.name,
      source: material.role || 'Package material',
    });
  });

  charge.extraMaterials.forEach((material) => {
    rows.push({
      inventoryId: material.inventoryId,
      quantity: material.quantity,
      lineName: charge.name,
      source: material.note || 'Additional material',
    });
  });

  return rows;
}

function getCatalogConsumption(item, quantity = 1) {
  const rows = [];

  if (item.inventoryId) {
    rows.push({ inventoryId: item.inventoryId, quantity });
  }

  (item.materials || []).forEach((material) => {
    rows.push({
      inventoryId: material.inventoryId,
      quantity: material.quantity * quantity,
    });
  });

  return rows;
}

function groupConsumption(rows) {
  return rows.reduce((map, row) => {
    if (!map[row.inventoryId]) {
      map[row.inventoryId] = {
        inventoryId: row.inventoryId,
        quantity: 0,
        sources: new Set(),
      };
    }

    map[row.inventoryId].quantity += row.quantity;
    if (row.lineName) {
      map[row.inventoryId].sources.add(row.lineName);
    }
    return map;
  }, {});
}

function buildUsageByInventory(charges) {
  return groupConsumption(charges.flatMap(getChargeConsumption));
}

function getShortageMessages(consumptionRows, usageByInventory, inventoryById) {
  const grouped = groupConsumption(consumptionRows);

  return Object.values(grouped)
    .map((row) => {
      const item = inventoryById[row.inventoryId];
      const alreadyReserved = usageByInventory[row.inventoryId]?.quantity || 0;
      const available = Math.max(0, (item?.stock || 0) - alreadyReserved);

      if (!item || available >= row.quantity) {
        return null;
      }

      return `${item.name}: needs ${row.quantity} ${item.unit}, ${available} available`;
    })
    .filter(Boolean);
}

function getStockProblems(charges, inventoryById) {
  return Object.values(buildUsageByInventory(charges))
    .map((row) => {
      const item = inventoryById[row.inventoryId];
      if (!item || row.quantity <= item.stock) {
        return null;
      }

      return `${item.name}: needs ${row.quantity} ${item.unit}, ${item.stock} in stock`;
    })
    .filter(Boolean);
}

function getInventoryImpact(charges, inventoryById) {
  return Object.values(buildUsageByInventory(charges))
    .map((row) => {
      const item = inventoryById[row.inventoryId];
      return {
        inventoryId: row.inventoryId,
        name: item?.name || 'Unknown item',
        category: item?.category || 'Inventory',
        unit: item?.unit || 'pcs',
        stock: item?.stock || 0,
        quantity: row.quantity,
        remaining: Math.max(0, (item?.stock || 0) - row.quantity),
        sources: Array.from(row.sources),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getLineSubtotal(charge) {
  return charge.price * charge.quantity;
}

function getInvoiceTotal(charges) {
  return charges.reduce((total, charge) => total + getLineSubtotal(charge), 0);
}

function nextInvoiceNumber(invoiceNumber) {
  const match = invoiceNumber.match(/(\d+)$/);
  if (!match) {
    return `${invoiceNumber}-001`;
  }

  const nextNumber = String(Number(match[1]) + 1).padStart(match[1].length, '0');
  return invoiceNumber.replace(/\d+$/, nextNumber);
}

function readPosPrefill() {
  try {
    const rawPrefill = localStorage.getItem('ipawcus-pos-prefill');
    if (!rawPrefill) {
      return null;
    }

    return JSON.parse(rawPrefill);
  } catch (error) {
    console.error('Failed to read POS prefill:', error);
    return null;
  }
}

function createPrefillVisit(prefill) {
  const visit = prefill?.visit || {};

  return {
    id: visit.id || `BOARD-${Date.now()}`,
    petName: visit.petName || 'Boarding Pet',
    ownerName: visit.ownerName || 'Pet Owner',
    species: visit.species || 'Pet',
    visitType: visit.visitType || 'Pet Boarding Stay',
    veterinarian: visit.veterinarian || 'Boarding Team',
    complaint: visit.complaint || 'Pet hotel or boarding payment',
    status: visit.status || 'Ready for payment',
    initialCharges: [],
  };
}

function cloneCharge(charge) {
  return {
    ...charge,
    includedMaterials: (charge.includedMaterials || []).map((material) => ({ ...material })),
    extraMaterials: (charge.extraMaterials || []).map((material) => ({ ...material })),
  };
}

function getChargeClassification(chargeType) {
  if (chargeType === 'diagnostic') {
    return 'diagnostics';
  }

  if (chargeType === 'medication') {
    return 'medications';
  }

  if (chargeType === 'retail_product') {
    return 'products';
  }

  return 'services';
}

function createVisitCharge(charge, index = 0) {
  const classificationId = getChargeClassification(charge.chargeType);
  const classification = CLASSIFICATION_BY_ID[classificationId] || CLASSIFICATION_BY_ID.services;
  const quantity = Number(charge.quantity);
  const price = Number(charge.unitPrice);

  return {
    lineId: nextLineId(`visit-charge-${charge.chargeId || index + 1}`),
    catalogId: charge.serviceId ? `service-${charge.serviceId}` : null,
    classificationId,
    receiptType: classification.receiptType,
    name: charge.description || charge.serviceName || charge.itemName || 'Visit charge',
    group: charge.serviceName || charge.itemName || 'Visit Billing',
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    inventoryId: null,
    includedMaterials: [],
    extraMaterials: [],
    visitChargeId: charge.chargeId || null,
  };
}

function getVisitChargeType(charge) {
  if (charge.classificationId === 'diagnostics') {
    return 'diagnostic';
  }

  if (charge.classificationId === 'medications') {
    return 'medication';
  }

  if (charge.classificationId === 'products') {
    return 'retail_product';
  }

  if (charge.group === 'Boarding') {
    return 'boarding';
  }

  return 'service';
}

function serializeChargeForVisit(charge, inventoryById, currentUser) {
  const inventoryItem = charge.inventoryId ? inventoryById[String(charge.inventoryId)] : null;
  const serviceId = charge.catalogId && String(charge.catalogId).startsWith('service-')
    ? Number(String(charge.catalogId).replace('service-', ''))
    : null;

  return {
    chargeType: getVisitChargeType(charge),
    serviceId: Number.isFinite(serviceId) && serviceId > 0 ? serviceId : null,
    itemId: inventoryItem?.itemId || null,
    description: charge.name,
    quantity: Number(charge.quantity) || 1,
    unitPrice: Number(charge.price) || 0,
    createdByUserId: getUserIdentifier(currentUser),
  };
}

function normalizeVisitPrescriptions(prescriptions) {
  return (Array.isArray(prescriptions) ? prescriptions : []).map((prescription, index) => ({
    id: prescription.id || `rx-${index + 1}`,
    medicine: prescription.medicine || prescription.itemName || '',
    times: Number(prescription.times) || 1,
    frequency: prescription.frequency || 'per day',
    durationNumber: Number(prescription.durationNumber) || 0,
    durationUnit: prescription.durationUnit || 'week',
    instructions: prescription.instructions || prescription.notes || '',
  })).filter((prescription) => prescription.medicine.trim());
}

function getPrescriptionQuantity(prescription) {
  const times = Math.max(1, Number(prescription.times) || 1);
  const duration = Math.max(1, Number(prescription.durationNumber) || 1);
  const durationUnit = prescription.durationUnit || 'week';
  const days = durationUnit === 'month'
    ? duration * 30
    : durationUnit === 'week'
      ? duration * 7
      : durationUnit === 'day'
        ? duration
        : 1;

  return Math.max(1, Math.ceil(times * days));
}

function formatPrescriptionLine(prescription) {
  const durationUnit = prescription.durationUnit === 'as needed'
    ? 'as needed'
    : `${prescription.durationUnit}${Number(prescription.durationNumber) === 1 ? '' : '(s)'}`;

  return `${prescription.medicine} - ${prescription.times} time(s) ${prescription.frequency} for ${prescription.durationNumber} ${durationUnit}`;
}

function findPrescriptionInventoryItem(prescription, inventory) {
  const medicine = normalizeText(prescription.medicine);
  if (!medicine) {
    return null;
  }

  return inventory.find((item) => {
    const itemName = normalizeText(item.name);
    return itemName === medicine || itemName.includes(medicine) || medicine.includes(itemName);
  }) || null;
}

function getVisitSourceLabel(visit) {
  if (visit.queueNumber) {
    return `Queue #${visit.queueNumber}`;
  }

  if (visit.bookingNumber) {
    return `Booking ${visit.bookingNumber}`;
  }

  return `${visit.sourceType || 'manual'} visit`.replace(/_/g, ' ');
}

function formatVisitBillingStatus(status) {
  const labels = {
    unbilled: 'Unbilled',
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
    refunded: 'Refunded',
  };

  return labels[status] || 'Ready for payment';
}

function createDatabaseVisit(visit) {
  const charges = Array.isArray(visit.charges) ? visit.charges.map(createVisitCharge) : [];
  const total = Number(visit.totals?.charges);
  const paid = Number(visit.totals?.paid);
  const balance = Number(visit.totals?.balance);
  const prescriptions = normalizeVisitPrescriptions(visit.prescriptions || visit.diagnosisPrescriptions);

  return {
    id: `visit-${visit.visitId}`,
    visitId: visit.visitId,
    source: 'database',
    petName: visit.petName || 'Patient',
    ownerName: visit.ownerName || 'Pet Owner',
    species: visit.petSpecies || 'Pet',
    visitType: getVisitSourceLabel(visit),
    veterinarian: visit.veterinarianName || 'Clinic Team',
    complaint: charges[0]?.name || 'Diagnosis visit billing',
    status: formatVisitBillingStatus(visit.billingStatus),
    billingStatus: visit.billingStatus,
    total: Number.isFinite(total) ? total : getInvoiceTotal(charges),
    paid: Number.isFinite(paid) ? paid : 0,
    balance: Number.isFinite(balance) ? balance : Math.max(0, getInvoiceTotal(charges)),
    diagnosisSummary: visit.diagnosisSummary || visit.diagnosis || '',
    diagnosisNotes: visit.diagnosisNotes || '',
    prescriptions,
    initialCharges: charges,
  };
}

function getUserIdentifier(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function getUserDisplayName(user) {
  return [
    user?.first_Name || user?.firstName || user?.first_name,
    user?.last_Name || user?.lastName || user?.last_name,
  ].filter(Boolean).join(' ').trim() || user?.name || user?.email || null;
}

function StockBadge({ item, inventoryById, charges }) {
  const usageByInventory = buildUsageByInventory(charges);
  const shortages = getShortageMessages(getCatalogConsumption(item, 1), usageByInventory, inventoryById);

  if (shortages.length > 0) {
    return (
      <Badge className="border-0 bg-red-50 text-red-700">
        <AlertTriangle className="mr-1 size-3" />
        Blocked
      </Badge>
    );
  }

  return (
    <Badge className="border-0 bg-green-50 text-green-700">
      <CheckCircle2 className="mr-1 size-3" />
      Available
    </Badge>
  );
}

export default function ServicePOS() {
  const currentUser = useDashboardUser();
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [visitBills, setVisitBills] = useState([]);
  const [visitSchemaMessage, setVisitSchemaMessage] = useState('');
  const [catalogSchemaMessage, setCatalogSchemaMessage] = useState('');
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [isPostingPayment, setIsPostingPayment] = useState(false);
  const [posPrefill] = useState(() => readPosPrefill());
  const catalog = useMemo(() => buildCatalog(inventory, serviceCatalog), [inventory, serviceCatalog]);
  const catalogMap = useMemo(() => flattenCatalog(catalog), [catalog]);
  const inventoryById = useMemo(() => groupById(inventory), [inventory]);
  const databaseVisitOptions = useMemo(() => visitBills.map(createDatabaseVisit), [visitBills]);
  const visitOptions = useMemo(() => {
    const prefillOptions = posPrefill?.visit ? [createPrefillVisit(posPrefill)] : [];

    return [WALK_IN_SALE_VISIT, ...databaseVisitOptions, ...prefillOptions];
  }, [databaseVisitOptions, posPrefill]);
  const [selectedVisitId, setSelectedVisitId] = useState(posPrefill?.visit?.id || WALK_IN_SALE_ID);
  const selectedVisit = visitOptions.find((visit) => visit.id === selectedVisitId) || visitOptions[0];
  const [charges, setCharges] = useState(() => (
    Array.isArray(posPrefill?.charges) && posPrefill.charges.length > 0
      ? posPrefill.charges.map(createPrefillCharge)
      : []
  ));
  const [activeTab, setActiveTab] = useState('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [chargeSheetOpen, setChargeSheetOpen] = useState(true);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState('58mm');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-0530-001');
  const [notification, setNotification] = useState(() => (
    posPrefill ? 'Boarding payment summary loaded. Review the invoice before posting payment.' : ''
  ));
  const [selectedChargeId, setSelectedChargeId] = useState(charges[0]?.lineId || '');
  const [extraMaterialId, setExtraMaterialId] = useState('');
  const [extraMaterialQty, setExtraMaterialQty] = useState('1');

  const loadVisitBills = useCallback(async ({ isAutoRefresh = false } = {}) => {
    if (!API_BASE) {
      return;
    }

    if (!isAutoRefresh) {
      setIsLoadingVisits(true);
    }

    try {
      const response = await fetch(`${API_BASE}/visits`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Failed to load visit bills.');
      }

      if (data.schemaReady === false) {
        setVisitBills([]);
        setVisitSchemaMessage(data.message || 'Visit billing schema is not ready.');
        return;
      }

      setVisitBills(Array.isArray(data.visits) ? data.visits : []);
      setVisitSchemaMessage('');
    } catch (error) {
      if (!isAutoRefresh) {
        setVisitSchemaMessage(error.message || 'Failed to load visit bills.');
      }
    } finally {
      if (!isAutoRefresh) {
        setIsLoadingVisits(false);
      }
    }
  }, []);

  const loadServiceCatalog = useCallback(async ({ isAutoRefresh = false } = {}) => {
    if (!API_BASE) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/service-catalog`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Failed to load service catalog.');
      }

      if (data.schemaReady === false) {
        setServiceCatalog([]);
        setCatalogSchemaMessage(data.message || 'Service catalog schema is not ready.');
        return;
      }

      setServiceCatalog(Array.isArray(data.services) ? data.services : []);
      setCatalogSchemaMessage('');
    } catch (error) {
      if (!isAutoRefresh) {
        setCatalogSchemaMessage(error.message || 'Failed to load service catalog.');
      }
    }
  }, []);

  const loadInventory = useCallback(async () => {
    if (!API_BASE) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/inventory`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load inventory.');
      }

      const items = normalizeInventoryItems(data);
      if (items.length > 0) {
        setInventory(items);
      }
    } catch {
      // Keep local fallback inventory so POS remains usable without the inventory module.
    }
  }, []);

  useAutoRefresh(loadVisitBills, { refreshKey: 'pos-visit-payments' });
  useAutoRefresh(loadServiceCatalog, { refreshKey: 'pos-service-catalog' });
  useAutoRefresh(loadInventory, { intervalMs: 12000, refreshKey: 'pos-inventory' });

  useEffect(() => {
    if (!posPrefill) {
      return;
    }

    localStorage.removeItem('ipawcus-pos-prefill');
  }, [posPrefill]);

  const paymentMethod = 'cash';
  const invoiceTotal = getInvoiceTotal(charges);
  const stockProblems = getStockProblems(charges, inventoryById);
  const visitBalance = selectedVisit?.source === 'database'
    ? Math.max(0, invoiceTotal - Number(selectedVisit.paid || 0))
    : invoiceTotal;
  const canCreateInvoice = charges.length > 0
    && stockProblems.length === 0
    && !isPostingPayment
    && (selectedVisit?.source !== 'database' || visitBalance > 0);
  const inventoryImpact = getInventoryImpact(charges, inventoryById);
  const selectedCharge = charges.find((charge) => charge.lineId === selectedChargeId);
  const materialOptions = inventory.filter((item) => !['RETAIL', 'PRODUCT', 'PRODUCTS'].includes(item.category));
  const selectedVisitPrescriptions = selectedVisit?.prescriptions || [];
  const visibleCatalog = (catalog[activeTab] || []).filter((item) => {
    const query = normalizeText(searchQuery);
    return !query ||
      normalizeText(item.name).includes(query) ||
      normalizeText(item.group).includes(query);
  });

  const handleVisitChange = (visitId) => {
    const nextVisit = visitOptions.find((visit) => visit.id === visitId) || visitOptions[0];
    const isPrefillVisit = posPrefill?.visit && visitId === createPrefillVisit(posPrefill).id;
    let nextCharges = [];

    if (nextVisit?.source === 'database') {
      nextCharges = (nextVisit.initialCharges || []).map(cloneCharge);
    } else if (isPrefillVisit && Array.isArray(posPrefill?.charges)) {
      nextCharges = posPrefill.charges.map(createPrefillCharge);
    } else {
      nextCharges = createInitialCharges(catalogMap, nextVisit);
    }

    setSelectedVisitId(visitId);
    setCharges(nextCharges);
    setSelectedChargeId(nextCharges[0]?.lineId || '');
    setNotification('');
  };

  const addCatalogItem = (item) => {
    const existingCharge = charges.find((charge) => charge.catalogId === item.id);
    const nextCharges = existingCharge
      ? charges.map((charge) => (
        charge.lineId === existingCharge.lineId
          ? { ...charge, quantity: charge.quantity + 1 }
          : charge
      ))
      : [...charges, createCharge(item, 1)];

    const problems = getStockProblems(nextCharges, inventoryById);
    if (problems.length > 0) {
      setNotification(problems[0]);
      return;
    }

    setCharges(nextCharges);
    setSelectedChargeId(existingCharge?.lineId || nextCharges[nextCharges.length - 1]?.lineId || '');
    setNotification('');
  };

  const addPrescriptionToInvoice = (prescription, inventoryItem) => {
    if (!inventoryItem) {
      setNotification('This prescription is not matched to clinic inventory.');
      return;
    }

    const quantity = getPrescriptionQuantity(prescription);
    const existingCharge = charges.find((charge) => charge.inventoryId === inventoryItem.id && charge.prescriptionId === prescription.id);
    const prescriptionCharge = {
      lineId: nextLineId('rx'),
      catalogId: null,
      classificationId: 'medications',
      receiptType: CLASSIFICATION_BY_ID.medications.receiptType,
      name: inventoryItem.name,
      group: 'Prescription',
      quantity,
      price: Number(inventoryItem.sellingPrice || inventoryItem.cost || 0),
      inventoryId: inventoryItem.id,
      includedMaterials: [],
      extraMaterials: [],
      prescriptionId: prescription.id,
    };
    const nextCharges = existingCharge
      ? charges.map((charge) => (
        charge.lineId === existingCharge.lineId
          ? { ...charge, quantity: charge.quantity + quantity }
          : charge
      ))
      : [...charges, prescriptionCharge];
    const problems = getStockProblems(nextCharges, inventoryById);

    if (problems.length > 0) {
      setNotification(problems[0]);
      return;
    }

    setCharges(nextCharges);
    setSelectedChargeId(existingCharge?.lineId || prescriptionCharge.lineId);
    setNotification(`${inventoryItem.name} added from prescription.`);
  };

  const updateChargeQuantity = (lineId, delta) => {
    const targetCharge = charges.find((charge) => charge.lineId === lineId);
    if (!targetCharge) return;

    const nextQuantity = targetCharge.quantity + delta;
    const nextCharges = nextQuantity <= 0
      ? charges.filter((charge) => charge.lineId !== lineId)
      : charges.map((charge) => (
        charge.lineId === lineId ? { ...charge, quantity: nextQuantity } : charge
      ));

    const problems = getStockProblems(nextCharges, inventoryById);
    if (problems.length > 0) {
      setNotification(problems[0]);
      return;
    }

    setCharges(nextCharges);
    if (!nextCharges.some((charge) => charge.lineId === selectedChargeId)) {
      setSelectedChargeId(nextCharges[0]?.lineId || '');
    }
    setNotification('');
  };

  const removeCharge = (lineId) => {
    const nextCharges = charges.filter((charge) => charge.lineId !== lineId);
    setCharges(nextCharges);
    if (selectedChargeId === lineId) {
      setSelectedChargeId(nextCharges[0]?.lineId || '');
    }
  };

  const addExtraMaterial = () => {
    const quantity = Number(extraMaterialQty);
    if (!selectedCharge || !extraMaterialId || !Number.isFinite(quantity) || quantity <= 0) {
      setNotification('Select a charge, material, and valid quantity.');
      return;
    }

    const nextCharges = charges.map((charge) => {
      if (charge.lineId !== selectedCharge.lineId) {
        return charge;
      }

      const existingMaterial = charge.extraMaterials.find((material) => material.inventoryId === extraMaterialId);
      if (existingMaterial) {
        return {
          ...charge,
          extraMaterials: charge.extraMaterials.map((material) => (
            material.inventoryId === extraMaterialId
              ? { ...material, quantity: material.quantity + quantity }
              : material
          )),
        };
      }

      return {
        ...charge,
        extraMaterials: [
          ...charge.extraMaterials,
          { inventoryId: extraMaterialId, quantity, note: 'Additional material' },
        ],
      };
    });

    const problems = getStockProblems(nextCharges, inventoryById);
    if (problems.length > 0) {
      setNotification(problems[0]);
      return;
    }

    setCharges(nextCharges);
    setExtraMaterialId('');
    setExtraMaterialQty('1');
    setNotification('');
  };

  const openInvoice = () => {
    if (charges.length === 0) {
      setNotification('Add at least one billable item before creating an invoice.');
      return;
    }

    if (stockProblems.length > 0) {
      setNotification(stockProblems[0]);
      return;
    }

    if (selectedVisit?.source === 'database' && visitBalance <= 0) {
      setNotification('This visit has no remaining balance to invoice.');
      return;
    }

    setInvoiceOpen(true);
  };

  const toggleProductsPanel = () => {
    setActiveTab('products');
    setChargeSheetOpen((current) => !current);
  };

  const openProductsPanel = () => {
    setActiveTab('products');
    setChargeSheetOpen(true);
  };

  const postPayment = async () => {
    const problems = getStockProblems(charges, inventoryById);
    if (problems.length > 0) {
      setNotification(problems[0]);
      return;
    }

    if (selectedVisit?.source === 'database') {
      if (!API_BASE || !selectedVisit.visitId) {
        setNotification('Visit payment endpoint is not available.');
        return;
      }

      const amountToPost = visitBalance > 0 ? visitBalance : invoiceTotal;
      if (amountToPost <= 0) {
        setNotification('This visit has no remaining balance to post.');
        return;
      }

      const postedInvoiceNumber = invoiceNumber;
      setIsPostingPayment(true);

      try {
        const chargesResponse = await fetch(`${API_BASE}/visits/${selectedVisit.visitId}/charges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            charges: charges.map((charge) => serializeChargeForVisit(charge, inventoryById, currentUser)),
          }),
        });
        const chargesData = await chargesResponse.json().catch(() => ({}));

        if (!chargesResponse.ok || chargesData.success === false) {
          throw new Error(chargesData.message || 'Failed to update draft invoice lines.');
        }

        const response = await fetch(`${API_BASE}/visits/${selectedVisit.visitId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountToPost,
            payment_method: paymentMethod,
            payment_status: 'verified',
            reference_number: postedInvoiceNumber,
            received_by_user_id: getUserIdentifier(currentUser),
            received_by_name: getUserDisplayName(currentUser),
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
          throw new Error(data.message || 'Failed to post visit payment.');
        }

        if (data.visit) {
          const updatedCharges = (data.visit.charges || []).map(createVisitCharge);
          setVisitBills((currentBills) => [
            data.visit,
            ...currentBills.filter((visit) => visit.visitId !== data.visit.visitId),
          ]);
          setCharges(updatedCharges);
          setSelectedChargeId(updatedCharges[0]?.lineId || '');
        } else {
          await loadVisitBills({ isAutoRefresh: true });
        }

        setInvoiceOpen(false);
        setInvoiceNumber((current) => nextInvoiceNumber(current));
        setNotification(`${postedInvoiceNumber} posted. Visit billing status was updated.`);
      } catch (error) {
        setNotification(error.message || 'Failed to post visit payment.');
      } finally {
        setIsPostingPayment(false);
      }
      return;
    }

    const usageByInventory = buildUsageByInventory(charges);
    setInventory((currentInventory) => currentInventory.map((item) => ({
      ...item,
      stock: Math.max(0, item.stock - (usageByInventory[item.id]?.quantity || 0)),
    })));
    setCharges([]);
    setSelectedChargeId('');
    setInvoiceOpen(false);
    setInvoiceNumber((current) => nextInvoiceNumber(current));
    setNotification(`${invoiceNumber} posted. Inventory was deducted internally.`);
  };

  return (
    <div className="space-y-5">
      <style>
        {`
          @media print {
            @page {
              size: ${receiptPaperWidth} 297mm;
              margin: 0;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${receiptPaperWidth} !important;
              min-width: ${receiptPaperWidth} !important;
              background: #fff !important;
              overflow: visible !important;
            }

            body * {
              visibility: hidden !important;
            }

            .pos-receipt-print-area,
            .pos-receipt-print-area * {
              visibility: visible !important;
            }

            .pos-receipt-print-area {
              display: block !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: ${receiptPaperWidth} !important;
              max-width: ${receiptPaperWidth} !important;
              margin: 0 !important;
              padding: 2mm !important;
              box-sizing: border-box !important;
              color: #000 !important;
              background: #fff !important;
              overflow: visible !important;
              z-index: 999999 !important;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .pos-receipt-print-area .thermal-print-root {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
            }

            .pos-receipt-print-area .thermal-print-root img {
              filter: grayscale(1) contrast(1.15);
            }

            .thermal-print-hidden {
              display: none !important;
            }
          }
        `}
      </style>
      {invoiceOpen && (
        <div className="pos-receipt-print-area hidden" aria-hidden="true">
          <ThermalReceipt
            paperWidth={receiptPaperWidth}
            logo={ipawcusLogo}
            invoiceNumber={invoiceNumber}
            invoiceDate={INVOICE_DATE}
            visit={selectedVisit}
            charges={charges}
            total={invoiceTotal}
          />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-['Montserrat:Bold',sans-serif] text-[30px] font-bold text-[#101828]">
            Veterinary POS
          </h1>
          <p className="font-['Arimo:Regular',sans-serif] text-[15px] text-[#4a5565]">
            Patient visit billing with invoice preview, prescriptions, retail sales, and internal stock deduction.
          </p>
        </div>
        <Button
          type="button"
          onClick={toggleProductsPanel}
          aria-expanded={chargeSheetOpen}
          aria-controls="pos-products-panel"
          className="w-fit bg-[#155dfc] text-white hover:bg-[#0d4acf]"
        >
          <ShoppingBag className="mr-1.5 size-4" />
          {chargeSheetOpen ? 'Hide Products' : 'Products'}
        </Button>
      </div>

      {notification && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {notification}
          </span>
          <button type="button" onClick={() => setNotification('')} className="rounded p-1 hover:bg-amber-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {(visitSchemaMessage || isLoadingVisits) && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
          {isLoadingVisits ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{isLoadingVisits ? 'Loading visit payments...' : visitSchemaMessage}</span>
        </div>
      )}

      {catalogSchemaMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{catalogSchemaMessage} POS is using fallback prices until the catalog is available.</span>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-5 ${chargeSheetOpen ? 'xl:grid-cols-[310px_minmax(0,1fr)_400px]' : 'xl:grid-cols-[310px_minmax(0,1fr)]'}`}>
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Patient Visit
              </h2>
              <Badge className="border-0 bg-green-50 text-green-700">{selectedVisit.status}</Badge>
            </div>

            <Select value={selectedVisitId} onValueChange={handleVisitChange}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visitOptions.map((visit) => (
                  <SelectItem key={visit.id} value={visit.id}>
                    {visit.id === WALK_IN_SALE_ID
                      ? 'Walk-in / No ready billing'
                      : `${visit.source === 'database' ? `Visit #${visit.visitId}` : visit.id} - ${visit.petName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-700">
                    <PawPrint className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-[#101828]">{selectedVisit.petName}</p>
                    <p className="text-sm font-semibold text-blue-700">{selectedVisit.species}</p>
                  </div>
                </div>
              </div>

              <InfoRow icon={User} label="Owner" value={selectedVisit.ownerName} />
              <InfoRow icon={Stethoscope} label="Veterinarian" value={selectedVisit.veterinarian} />
              <InfoRow icon={ClipboardList} label="Visit Type" value={selectedVisit.visitType} />

              {selectedVisit.diagnosisSummary && (
                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">Diagnosis Summary</p>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    {selectedVisit.diagnosisSummary}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">Complaint</p>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  {selectedVisit.complaint}
                </p>
              </div>
            </div>
          </section>

          {selectedVisitPrescriptions.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Prescriptions
                </h2>
                <Badge className="border-0 bg-blue-50 text-blue-700">{selectedVisitPrescriptions.length}</Badge>
              </div>
              <div className="space-y-3">
                {selectedVisitPrescriptions.map((prescription) => {
                  const matchedItem = findPrescriptionInventoryItem(prescription, inventory);
                  const alreadyAdded = charges.some((charge) => charge.prescriptionId === prescription.id);

                  return (
                    <div key={prescription.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-900">{formatPrescriptionLine(prescription)}</p>
                      {prescription.instructions && (
                        <p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-slate-500">{prescription.instructions}</p>
                      )}
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className={`text-xs font-black ${matchedItem ? 'text-green-700' : 'text-amber-700'}`}>
                          {matchedItem
                            ? `${matchedItem.stock} ${matchedItem.unit} in inventory`
                            : 'No inventory match'}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addPrescriptionToInvoice(prescription, matchedItem)}
                          disabled={!matchedItem || alreadyAdded}
                          className="w-full sm:w-fit"
                        >
                          <Plus className="size-4" />
                          {alreadyAdded ? 'Added' : 'Add to Draft'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>

        <main className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#155dfc] p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Receipt className="size-5" />
                  Draft Invoice
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={chargeSheetOpen ? () => setChargeSheetOpen(false) : openProductsPanel}
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    {chargeSheetOpen ? 'Hide Products' : 'Products'}
                  </Button>
                  <Badge className="border border-white/20 bg-white/15 text-white">{charges.length} items</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm font-semibold text-blue-100">{selectedVisit.id}</p>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {charges.length === 0 ? (
                <div className="p-8 text-center">
                  <Receipt className="mx-auto mb-3 size-9 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500">No billable items selected.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {charges.map((charge) => (
                    <InvoiceLine
                      key={charge.lineId}
                      charge={charge}
                      onDecrease={() => updateChargeQuantity(charge.lineId, -1)}
                      onIncrease={() => updateChargeQuantity(charge.lineId, 1)}
                      onRemove={() => removeCharge(charge.lineId)}
                      onSelect={() => setSelectedChargeId(charge.lineId)}
                      selected={charge.lineId === selectedChargeId}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-base font-black text-slate-900">Total</span>
                <span className="text-2xl font-black text-[#155dfc]">{formatPhpCurrency(invoiceTotal)}</span>
              </div>

              {selectedVisit?.source === 'database' && (
                <div className="mb-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Paid</span>
                    <span>{formatPhpCurrency(selectedVisit.paid || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-900">
                    <span>Balance</span>
                    <span>{formatPhpCurrency(visitBalance)}</span>
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={openInvoice}
                disabled={!canCreateInvoice}
                className="h-11 w-full bg-[#0c6a3c] text-white hover:bg-[#09522f] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FileText className="mr-2 size-5" />
                {isPostingPayment ? 'Posting Payment...' : 'Preview Invoice Receipt'}
              </Button>
            </div>
          </section>
        </main>

        {chargeSheetOpen && (
          <aside id="pos-products-panel" className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="text-lg font-black text-[#101828]">Products</h2>
                  <p className="text-sm font-semibold text-slate-500">Show or hide treatment items and internal usage.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChargeSheetOpen(false)}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Hide products panel"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-4 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search item"
                    className="h-10 pl-9"
                  />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 gap-1">
                    {BILLING_CLASSIFICATIONS.map((classification) => {
                      const Icon = classification.icon;
                      return (
                        <TabsTrigger key={classification.id} value={classification.id} className="gap-2">
                          <Icon className="size-4" />
                          {classification.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {BILLING_CLASSIFICATIONS.map((classification) => (
                    <TabsContent key={classification.id} value={classification.id} className="mt-4">
                      <div className="grid gap-3">
                        {visibleCatalog.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
                            No matching items.
                          </div>
                        ) : (
                          visibleCatalog.map((item) => (
                            <CatalogItemCard
                              key={item.id}
                              item={item}
                              charges={charges}
                              inventoryById={inventoryById}
                              onAdd={() => addCatalogItem(item)}
                            />
                          ))
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Extra Material Used
              </h2>
              <div className="space-y-3">
                <Select value={selectedChargeId} onValueChange={setSelectedChargeId} disabled={charges.length === 0}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select invoice line" />
                  </SelectTrigger>
                  <SelectContent>
                    {charges.map((charge) => (
                      <SelectItem key={charge.lineId} value={charge.lineId}>
                        {charge.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={extraMaterialId} onValueChange={setExtraMaterialId} disabled={charges.length === 0}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Material used" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.stock} {item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={extraMaterialQty}
                    onChange={(event) => setExtraMaterialQty(event.target.value)}
                    className="h-10"
                  />
                  <Button type="button" onClick={addExtraMaterial} className="h-10 bg-slate-900 text-white hover:bg-slate-800">
                    <Plus className="mr-2 size-4" />
                    Add
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Inventory Impact
                </h2>
                <Badge className="border-0 bg-slate-100 text-slate-700">Internal</Badge>
              </div>

              {inventoryImpact.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
                  No stock will be deducted.
                </p>
              ) : (
                <div className="space-y-2">
                  {inventoryImpact.map((row) => (
                    <div key={row.inventoryId} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">{row.name}</p>
                          <p className="text-xs font-semibold text-slate-500">{row.category}</p>
                        </div>
                        <Badge className={`border-0 ${row.quantity > row.stock ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          -{row.quantity} {row.unit}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Stock: {row.stock}</span>
                        <span>After: {row.remaining}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        )}
      </div>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader className="thermal-print-hidden">
            <DialogTitle>Invoice Receipt</DialogTitle>
            <DialogDescription>
              Customer receipt shows main classifications only. Use the portable receipt preview for thermal printers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="thermal-print-hidden rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <img src={ipawcusLogo} alt="Ipawcus logo" className="size-14 rounded-lg object-contain" />
                  <div>
                    <p className="text-xl font-black text-slate-900">Ipawcus</p>
                    <p className="text-sm font-semibold text-slate-500">Veterinary Clinic</p>
                    <p className="text-xs font-semibold text-slate-400">Official Invoice Receipt</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-black text-slate-900">{invoiceNumber}</p>
                  <p className="text-sm font-semibold text-slate-500">{INVOICE_DATE}</p>
                  <p className="text-sm font-semibold text-slate-500">{selectedVisit.id}</p>
                </div>
              </div>

              <div className="grid gap-3 border-b border-slate-200 py-4 sm:grid-cols-2">
                <ReceiptInfo label="Pet" value={`${selectedVisit.petName} (${selectedVisit.species})`} />
                <ReceiptInfo label="Owner" value={selectedVisit.ownerName} />
                <ReceiptInfo label="Veterinarian" value={selectedVisit.veterinarian} />
                <ReceiptInfo label="Visit Type" value={selectedVisit.visitType} />
              </div>

              {selectedVisitPrescriptions.length > 0 && (
                <div className="border-b border-slate-200 py-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Prescription Summary</p>
                  <div className="space-y-2">
                    {selectedVisitPrescriptions.map((prescription) => (
                      <div key={prescription.id} className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                        <p>{formatPrescriptionLine(prescription)}</p>
                        {prescription.instructions && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{prescription.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-widest text-slate-400">
                      <th className="py-3 pr-3">Category</th>
                      <th className="py-3 pr-3">Item</th>
                      <th className="py-3 pr-3 text-center">Qty</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((charge) => (
                      <tr key={charge.lineId} className="border-b border-slate-100 text-sm">
                        <td className="py-3 pr-3 font-black text-slate-700">{charge.receiptType}</td>
                        <td className="py-3 pr-3 font-semibold text-slate-700">{charge.name}</td>
                        <td className="py-3 pr-3 text-center font-semibold text-slate-600">{charge.quantity}</td>
                        <td className="py-3 text-right font-black text-slate-900">{formatPhpCurrency(getLineSubtotal(charge))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:items-end">
                <div className="w-full rounded-lg bg-slate-50 p-4 sm:max-w-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">Total</span>
                    <span className="text-2xl font-black text-[#155dfc]">{formatPhpCurrency(invoiceTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="thermal-print-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">Portable POS Printer</p>
                    <p className="text-xs font-semibold text-slate-500">Soft-copy thermal receipt preview</p>
                  </div>
                  <Printer className="size-5 text-slate-500" />
                </div>
                <Select value={receiptPaperWidth} onValueChange={setReceiptPaperWidth}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm paper</SelectItem>
                    <SelectItem value="80mm">80mm paper</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ThermalReceipt
                paperWidth={receiptPaperWidth}
                logo={ipawcusLogo}
                invoiceNumber={invoiceNumber}
                invoiceDate={INVOICE_DATE}
                visit={selectedVisit}
                charges={charges}
                total={invoiceTotal}
              />
            </div>
          </div>

          <DialogFooter className="thermal-print-hidden">
            <Button type="button" variant="outline" onClick={() => setInvoiceOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" />
              Print Portable Receipt
            </Button>
            <Button
              type="button"
              onClick={postPayment}
              disabled={!canCreateInvoice}
              className="bg-[#0c6a3c] text-white hover:bg-[#09522f] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isPostingPayment ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 size-4" />
              )}
              {isPostingPayment ? 'Posting...' : 'Post Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  const Icon = icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="truncate text-sm font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function CatalogItemCard({ item, charges, inventoryById, onAdd }) {
  const usageByInventory = buildUsageByInventory(charges);
  const shortages = getShortageMessages(getCatalogConsumption(item, 1), usageByInventory, inventoryById);
  const isBlocked = shortages.length > 0;
  const materialCount = (item.materials || []).length;

  return (
    <div className={`rounded-lg border p-4 transition ${isBlocked ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-slate-100 text-slate-700">{item.group}</Badge>
            <StockBadge item={item} inventoryById={inventoryById} charges={charges} />
          </div>
          <h3 className="text-base font-black text-[#101828]">{item.name}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black text-[#155dfc]">{formatPhpCurrency(item.price)}</p>
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            disabled={isBlocked}
            className="mt-2 h-8 bg-[#155dfc] text-white hover:bg-[#0d4acf] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {materialCount > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400">
            <Package className="size-3.5" />
            Package Materials
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.materials.map((material) => {
              const inventoryItem = inventoryById[material.inventoryId];
              return (
                <Badge key={`${item.id}-${material.inventoryId}`} className="border-0 bg-white text-slate-700">
                  {inventoryItem?.name || 'Inventory item'} x{material.quantity}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {isBlocked && (
        <p className="mt-3 rounded-lg bg-red-100 p-2 text-xs font-bold text-red-700">
          {shortages[0]}
        </p>
      )}
    </div>
  );
}

function InvoiceLine({ charge, onDecrease, onIncrease, onRemove, onSelect, selected }) {
  const hiddenMaterialCount = charge.includedMaterials.length + charge.extraMaterials.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full p-3 text-left transition ${selected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge className="border-0 bg-slate-100 text-slate-700">{charge.receiptType}</Badge>
            {hiddenMaterialCount > 0 && (
              <Badge className="border-0 bg-amber-50 text-amber-700">
                {hiddenMaterialCount} hidden materials
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-sm font-black text-slate-900">{charge.name}</p>
          <p className="text-xs font-semibold text-slate-500">{formatPhpCurrency(charge.price)} each</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDecrease();
            }}
            className="flex size-8 items-center justify-center text-slate-600 hover:bg-slate-100"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-9 text-center text-sm font-black text-slate-900">{charge.quantity}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIncrease();
            }}
            className="flex size-8 items-center justify-center text-slate-600 hover:bg-slate-100"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <span className="text-base font-black text-[#155dfc]">{formatPhpCurrency(getLineSubtotal(charge))}</span>
      </div>
    </button>
  );
}

function ReceiptInfo({ label, value }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function ThermalReceipt({ paperWidth, logo, invoiceNumber, invoiceDate, visit, charges, total }) {
  const isNarrow = paperWidth === '58mm';
  const previewWidth = isNarrow ? '232px' : '302px';

  return (
    <div
      className="thermal-print-root mx-auto rounded-lg border border-slate-300 bg-white p-3 font-mono text-black shadow-sm"
      style={{ width: previewWidth, maxWidth: previewWidth }}
    >
      <div className="text-center">
        <img src={logo} alt="Ipawcus logo" className="mx-auto mb-1 h-10 w-10 object-contain" />
        <p className="text-[13px] font-black uppercase leading-tight">Ipawcus</p>
        <p className="text-[10px] font-bold leading-tight">Veterinary Clinic</p>
        <p className="text-[9px] leading-tight">Official Invoice Receipt</p>
      </div>

      <ReceiptDivider />

      <div className="space-y-0.5 text-[9px] leading-tight">
        <ThermalMeta label="Invoice" value={invoiceNumber} />
        <ThermalMeta label="Date" value={invoiceDate} />
        <ThermalMeta label="Visit" value={visit.id} />
        <ThermalMeta label="Pet" value={`${visit.petName} (${visit.species})`} />
        <ThermalMeta label="Owner" value={visit.ownerName} />
        <ThermalMeta label="Vet" value={visit.veterinarian} />
      </div>

      <ReceiptDivider />

      <div className="space-y-2 text-[9px] leading-tight">
        {charges.map((charge) => (
          <div key={charge.lineId}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-black uppercase">{charge.receiptType}</p>
                <p className="break-words font-bold">{charge.name}</p>
              </div>
              <p className="shrink-0 font-black">{formatPhpCurrency(getLineSubtotal(charge))}</p>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[8px]">
              <span>Qty {charge.quantity} x {formatPhpCurrency(charge.price)}</span>
            </div>
          </div>
        ))}
      </div>

      <ReceiptDivider />

      <div className="space-y-1 text-[10px] font-black">
        <div className="flex items-center justify-between text-[12px]">
          <span>TOTAL</span>
          <span>{formatPhpCurrency(total)}</span>
        </div>
      </div>

      <ReceiptDivider />

      <div className="text-center text-[8px] font-bold leading-tight">
        <p>Child materials are recorded internally.</p>
        <p>Thank you for trusting Ipawcus.</p>
      </div>
    </div>
  );
}

function ReceiptDivider() {
  return <div className="my-2 border-t border-dashed border-black" />;
}

function ThermalMeta({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 font-black uppercase">{label}</span>
      <span className="break-words text-right font-bold">{value}</span>
    </div>
  );
}
