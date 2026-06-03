import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
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
import { formatPhpCurrency } from '../../lib/currency';
import ipawcusLogo from '../../assets/logo-no-bg.png';

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
    icon: FlaskConical,
    accent: 'emerald',
    description: 'CBC, blood chemistry, urinalysis, fecalysis, X-ray, ultrasound, and ECG.',
  },
  {
    id: 'medications',
    label: 'Medications',
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

const SAMPLE_VISITS = [
  {
    id: 'VIS-2026-0530-001',
    petName: 'Max',
    ownerName: 'John Doe',
    species: 'Dog',
    visitType: 'Walk-in Consultation',
    veterinarian: 'Dr. Santos',
    complaint: 'Vomiting and low appetite',
    status: 'Ready for billing',
    initialCharges: [
      { id: 'svc-consultation', quantity: 1 },
      { id: 'lab-cbc', quantity: 1 },
      { id: 'med-amoxicillin', quantity: 10 },
      { id: 'med-vitamin-syrup', quantity: 1 },
    ],
  },
  {
    id: 'VIS-2026-0530-002',
    petName: 'Bella',
    ownerName: 'Jane Smith',
    species: 'Cat',
    visitType: 'Vaccination',
    veterinarian: 'Dr. Reyes',
    complaint: 'Annual vaccine update',
    status: 'In treatment',
    initialCharges: [
      { id: 'svc-consultation', quantity: 1 },
      { id: 'svc-5in1', quantity: 1 },
    ],
  },
  {
    id: 'VIS-2026-0530-003',
    petName: 'Luna',
    ownerName: 'Sarah Williams',
    species: 'Dog',
    visitType: 'Surgery',
    veterinarian: 'Dr. Cruz',
    complaint: 'Laceration on right paw',
    status: 'Awaiting procedure',
    initialCharges: [
      { id: 'svc-consultation', quantity: 1 },
    ],
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
    map[item.id] = item;
    return map;
  }, {});
}

function buildCatalog(inventory) {
  const medicationItems = inventory
    .filter((item) => item.category === 'MEDICATION' && item.sellable)
    .map((item) => ({
      id: item.id,
      classificationId: 'medications',
      inventoryId: item.id,
      name: item.name,
      group: 'Prescription',
      price: item.sellingPrice,
      description: `${item.stock} ${item.unit} available`,
      materials: [],
    }));

  const productItems = inventory
    .filter((item) => item.category === 'RETAIL' && item.sellable)
    .map((item) => ({
      id: item.id,
      classificationId: 'products',
      inventoryId: item.id,
      name: item.name,
      group: 'Retail',
      price: item.sellingPrice,
      description: `${item.stock} ${item.unit} available`,
      materials: [],
    }));

  return {
    services: SERVICE_PACKAGES,
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

function getAccentClasses(accent) {
  const classes = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-green-100 bg-green-50 text-green-700',
    rose: 'border-red-100 bg-red-50 text-red-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  };

  return classes[accent] || classes.blue;
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

function PaymentIcon({ method }) {
  if (method === 'card') {
    return <CreditCard className="size-4" />;
  }

  if (method === 'online') {
    return <FileText className="size-4" />;
  }

  return <Banknote className="size-4" />;
}

export default function ServicePOS() {
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [posPrefill] = useState(() => readPosPrefill());
  const catalog = useMemo(() => buildCatalog(inventory), [inventory]);
  const catalogMap = useMemo(() => flattenCatalog(catalog), [catalog]);
  const inventoryById = useMemo(() => groupById(inventory), [inventory]);
  const visitOptions = useMemo(() => {
    if (!posPrefill?.visit) {
      return SAMPLE_VISITS;
    }

    return [createPrefillVisit(posPrefill), ...SAMPLE_VISITS];
  }, [posPrefill]);
  const [selectedVisitId, setSelectedVisitId] = useState(posPrefill?.visit?.id || SAMPLE_VISITS[0].id);
  const selectedVisit = visitOptions.find((visit) => visit.id === selectedVisitId) || visitOptions[0];
  const [charges, setCharges] = useState(() => (
    Array.isArray(posPrefill?.charges) && posPrefill.charges.length > 0
      ? posPrefill.charges.map(createPrefillCharge)
      : createInitialCharges(flattenCatalog(buildCatalog(INITIAL_INVENTORY)), SAMPLE_VISITS[0])
  ));
  const [activeTab, setActiveTab] = useState('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptPaperWidth, setReceiptPaperWidth] = useState('58mm');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-0530-001');
  const [notification, setNotification] = useState(() => (
    posPrefill ? 'Boarding payment summary loaded. Review the invoice before posting payment.' : ''
  ));
  const [selectedChargeId, setSelectedChargeId] = useState(charges[0]?.lineId || '');
  const [extraMaterialId, setExtraMaterialId] = useState('');
  const [extraMaterialQty, setExtraMaterialQty] = useState('1');
  const [customClassificationId, setCustomClassificationId] = useState('services');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customMaterialId, setCustomMaterialId] = useState('');
  const [customMaterialQty, setCustomMaterialQty] = useState('1');

  useEffect(() => {
    if (!posPrefill) {
      return;
    }

    localStorage.removeItem('ipawcus-pos-prefill');
  }, [posPrefill]);

  const invoiceTotal = getInvoiceTotal(charges);
  const stockProblems = getStockProblems(charges, inventoryById);
  const inventoryImpact = getInventoryImpact(charges, inventoryById);
  const selectedCharge = charges.find((charge) => charge.lineId === selectedChargeId);
  const materialOptions = inventory.filter((item) => item.category !== 'RETAIL');
  const visibleCatalog = catalog[activeTab].filter((item) => {
    const query = normalizeText(searchQuery);
    return !query ||
      normalizeText(item.name).includes(query) ||
      normalizeText(item.group).includes(query) ||
      normalizeText(item.description).includes(query);
  });

  const handleVisitChange = (visitId) => {
    const nextVisit = visitOptions.find((visit) => visit.id === visitId) || visitOptions[0];
    const isPrefillVisit = posPrefill?.visit && visitId === createPrefillVisit(posPrefill).id;
    const nextCharges = isPrefillVisit && Array.isArray(posPrefill?.charges)
      ? posPrefill.charges.map(createPrefillCharge)
      : createInitialCharges(catalogMap, nextVisit);
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

  const addCustomCharge = () => {
    const price = Number(customPrice);
    const materialQuantity = Number(customMaterialQty);
    const classification = CLASSIFICATION_BY_ID[customClassificationId];

    if (!customName.trim() || !Number.isFinite(price) || price < 0) {
      setNotification('Enter a custom item name and valid price.');
      return;
    }

    const customCharge = {
      lineId: nextLineId('custom'),
      catalogId: null,
      classificationId: customClassificationId,
      receiptType: classification.receiptType,
      name: customName.trim(),
      group: 'Custom',
      quantity: 1,
      price,
      inventoryId: null,
      includedMaterials: [],
      extraMaterials: customMaterialId && materialQuantity > 0
        ? [{ inventoryId: customMaterialId, quantity: materialQuantity, note: 'Custom material' }]
        : [],
    };

    const nextCharges = [...charges, customCharge];
    const problems = getStockProblems(nextCharges, inventoryById);
    if (problems.length > 0) {
      setNotification(problems[0]);
      return;
    }

    setCharges(nextCharges);
    setSelectedChargeId(customCharge.lineId);
    setCustomName('');
    setCustomPrice('');
    setCustomMaterialId('');
    setCustomMaterialQty('1');
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

    setInvoiceOpen(true);
  };

  const postPayment = () => {
    const problems = getStockProblems(charges, inventoryById);
    if (problems.length > 0) {
      setNotification(problems[0]);
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
              size: ${receiptPaperWidth} 200mm;
              margin: 0;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }

            body * {
              visibility: hidden !important;
            }

            .thermal-print-root,
            .thermal-print-root * {
              visibility: visible !important;
            }

            .thermal-print-root {
              position: absolute !important;
              inset: 0 auto auto 0 !important;
              width: ${receiptPaperWidth} !important;
              max-width: ${receiptPaperWidth} !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
            }

            .thermal-print-root img {
              filter: grayscale(1) contrast(1.15);
            }

            .thermal-print-hidden {
              display: none !important;
            }
          }
        `}
      </style>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-['Montserrat:Bold',sans-serif] text-[30px] font-bold text-[#101828]">
            Veterinary POS
          </h1>
          <p className="font-['Arimo:Regular',sans-serif] text-[15px] text-[#4a5565]">
            Patient visit billing with service packages, prescriptions, retail sales, and internal stock deduction.
          </p>
        </div>
        <Badge className="w-fit border-0 bg-blue-50 px-3 py-1.5 text-blue-700">
          <Receipt className="mr-1.5 size-4" />
          Visit to Invoice
        </Badge>
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[310px_minmax(0,1fr)_390px]">
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
                    {visit.id} - {visit.petName}
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

              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">Complaint</p>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  {selectedVisit.complaint}
                </p>
              </div>
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
              <p className="text-xs font-semibold text-slate-500">
                Added materials deduct inventory but stay hidden from the customer receipt.
              </p>
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#101828]">Treatment Record Charges</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Billable lines are separated from package materials and stock consumption.
                </p>
              </div>
              <div className="relative w-full lg:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search item"
                  className="h-10 pl-9"
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 gap-1 lg:grid-cols-4">
                {CLASSIFICATIONS.map((classification) => {
                  const Icon = classification.icon;
                  return (
                    <TabsTrigger key={classification.id} value={classification.id} className="gap-2">
                      <Icon className="size-4" />
                      {classification.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {CLASSIFICATIONS.map((classification) => (
                <TabsContent key={classification.id} value={classification.id} className="mt-4">
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${getAccentClasses(classification.accent)}`}>
                        <classification.icon className="size-4" />
                      </span>
                      <div>
                        <p className="font-black text-slate-900">{classification.label}</p>
                        <p className="text-sm font-semibold text-slate-500">{classification.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 2xl:grid-cols-2">
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
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#101828]">Custom Charge</h2>
                <p className="text-sm font-semibold text-slate-500">Attach optional internal material when a package does not cover it.</p>
              </div>
              <Badge className="border-0 bg-slate-100 text-slate-700">Manual</Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)_140px]">
              <Select value={customClassificationId} onValueChange={setCustomClassificationId}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATIONS.map((classification) => (
                    <SelectItem key={classification.id} value={classification.id}>
                      {classification.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Item name"
                className="h-10"
              />
              <Input
                type="number"
                min="0"
                value={customPrice}
                onChange={(event) => setCustomPrice(event.target.value)}
                placeholder="Price"
                className="h-10"
              />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_auto]">
              <Select value={customMaterialId} onValueChange={setCustomMaterialId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Optional internal material" />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.stock} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                value={customMaterialQty}
                onChange={(event) => setCustomMaterialQty(event.target.value)}
                className="h-10"
              />
              <Button type="button" onClick={addCustomCharge} className="h-10 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                <Plus className="mr-2 size-4" />
                Add Custom
              </Button>
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="sticky top-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#155dfc] p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Receipt className="size-5" />
                  Draft Invoice
                </h2>
                <Badge className="border border-white/20 bg-white/15 text-white">{charges.length} lines</Badge>
              </div>
              <p className="mt-1 text-sm font-semibold text-blue-100">{selectedVisit.id}</p>
            </div>

            <div className="max-h-[410px] overflow-y-auto">
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
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-500">
                <span>Payment Method</span>
                <span className="flex items-center gap-1.5">
                  <PaymentIcon method={paymentMethod} />
                  {paymentMethod.toUpperCase()}
                </span>
              </div>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="online">Online Payment</SelectItem>
                </SelectContent>
              </Select>

              <div className="my-4 flex items-center justify-between">
                <span className="text-base font-black text-slate-900">Total</span>
                <span className="text-2xl font-black text-[#155dfc]">{formatPhpCurrency(invoiceTotal)}</span>
              </div>

              <Button
                type="button"
                onClick={openInvoice}
                disabled={charges.length === 0 || stockProblems.length > 0}
                className="h-11 w-full bg-[#0c6a3c] text-white hover:bg-[#09522f] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FileText className="mr-2 size-5" />
                Create Invoice Receipt
              </Button>
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
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
                    <span>Payment</span>
                    <span className="capitalize">{paymentMethod}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
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
                paymentMethod={paymentMethod}
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
            <Button type="button" onClick={postPayment} className="bg-[#0c6a3c] text-white hover:bg-[#09522f]">
              <CheckCircle2 className="mr-2 size-4" />
              Post Payment
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
          <p className="mt-1 text-sm font-semibold text-slate-500">{item.description}</p>
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

function ThermalReceipt({ paperWidth, logo, invoiceNumber, invoiceDate, visit, charges, paymentMethod, total }) {
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
        <div className="flex items-center justify-between">
          <span>PAYMENT</span>
          <span>{paymentMethod.toUpperCase()}</span>
        </div>
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
