export const BOOKING_PRICE_PROJECTION_STORAGE_KEY = 'ipawcus-booking-price-projections';
export const BOOKING_PRICE_PROJECTION_UPDATED_EVENT = 'ipawcus-booking-price-projections-updated';

export const SERVICE_PRICE_PROJECTIONS = Object.freeze({
    onlineConsultation: '\u20b1500 per session',
    generalConsultation: '\u20b1400',
    laboratoryTesting: 'Price confirmed after review',
    parasiteControl: 'Starts at \u20b1200',
    vaccination: '\u20b1300\u2013\u20b11,200 per vaccine',
    grooming: '\u20b1500\u2013\u20b11,200, depending on size',
    dentalAssessment: '\u20b1400',
    dentalCleaning: 'Starts at \u20b13,000',
    surgery: 'Price after veterinary assessment',
    kapon: 'Starts at \u20b11,500',
    specialSurgery: '\u20b15,000\u2013\u20b120,000+, depending on procedure'
});

export const GROOMING_PRICE_MATRIX = Object.freeze([
    { service: 'Bath and Blow-dry', small: '\u20b1300', medium: '\u20b1400', large: '\u20b1550', xl: '\u20b1700' },
    { service: 'Full Grooming', small: '\u20b1500', medium: '\u20b1650', large: '\u20b1850', xl: '\u20b11,100' },
    { service: 'Nail Trimming', small: '\u20b1150', medium: '\u20b1150', large: '\u20b1200', xl: '\u20b1250' },
    { service: 'Ear Cleaning', small: '\u20b1150', medium: '\u20b1150', large: '\u20b1200', xl: '\u20b1250' },
    { service: 'Dematting Add-on', small: '\u20b1200', medium: '\u20b1300', large: '\u20b1400', xl: '\u20b1500' }
]);

export const KAPON_PRICE_MATRIX = Object.freeze([
    { procedure: 'Male Cat Neuter', price: '\u20b11,500' },
    { procedure: 'Female Cat Spay', price: '\u20b12,500' },
    { procedure: 'Male Dog Neuter, up to 10 kg', price: '\u20b12,500' },
    { procedure: 'Female Dog Spay, up to 10 kg', price: '\u20b14,000' },
    { procedure: 'Additional weight charge', price: '\u20b1500 per additional 5 kg' },
    { procedure: 'Pre-operative Screening', price: '\u20b11,000' }
]);

export const HOME_SERVICE_PRICE_PROJECTIONS = Object.freeze([
    { id: 'home-visit-consultation', name: 'Home Visit + Consultation within Lucena', description: 'Complete physical examination', price: 'Starts at \u20b11,400' },
    { id: 'outside-lucena', name: 'Outside Lucena', description: '', price: 'Quoted by location' },
    { id: 'vaccines', name: 'Vaccines', description: 'Core vaccines, rabies, and boosters', price: 'Add regular vaccine price' },
    { id: 'deworming', name: 'Deworming', description: 'Parasite control by pet weight', price: 'Add weight-based price' },
    { id: 'medication-administration', name: 'Medication Administration', description: 'Medication delivery', price: '\u20b1250 professional fee + medicine' },
    { id: 'wound-care', name: 'Wound Care', description: 'Cleaning and dressing of minor wounds', price: '\u20b1400\u2013\u20b11,000 + materials' },
    { id: 'home-grooming', name: 'Home Grooming', description: 'Bath, haircut, nail trim, ear cleaning', price: '\u20b1700\u2013\u20b11,300 + applicable travel charge' },
    { id: 'bath-blow-dry', name: 'Bath and Blow-dry', description: 'Bath with quality products', price: '\u20b1400\u2013\u20b1800' },
    { id: 'nail-trimming', name: 'Nail Trimming Add-on', description: 'Nail care and filing', price: '\u20b1150\u2013\u20b1250' },
    { id: 'ear-cleaning', name: 'Ear Cleaning Add-on', description: 'Ear hygiene service', price: '\u20b1150\u2013\u20b1250' }
]);

export const BOARDING_ROOM_PROJECTIONS = Object.freeze({
    hotel: [
        { id: 'small', name: 'Small Room', capacity: '1 pet', pricePerDay: 600, features: ['Climate controlled', 'Comfortable bedding', '2 meals/day', 'Daily cleaning'] },
        { id: 'medium', name: 'Medium Room', capacity: '1-2 pets', pricePerDay: 1200, features: ['Spacious area', 'Comfortable bedding', '3 meals/day', 'Play area access'] },
        { id: 'large', name: 'Large Room', capacity: '2-3 pets', pricePerDay: 2000, features: ['Extra large space', 'Deluxe meals', 'Private play area', 'Daily grooming'] }
    ],
    boarding: [
        { id: 'small', name: 'Small Kennel', capacity: '1 pet', pricePerDay: 400, features: ['Secure kennel', 'Basic bedding', '2 meals/day', 'Outdoor time'] },
        { id: 'medium', name: 'Medium Kennel', capacity: '1-2 pets', pricePerDay: 800, features: ['Spacious kennel', 'Comfortable bedding', '3 meals/day', 'Extended outdoor time'] },
        { id: 'large', name: 'Large Kennel', capacity: '2-3 pets', pricePerDay: 1400, features: ['Extra large kennel', 'Premium meals', 'Extended play sessions', 'Training activities'] }
    ]
});

export const BOARDING_ADD_ON_PROJECTIONS = Object.freeze([
    { id: 'behavior', name: 'Behavior Observation', price: 300, billing: 'day' },
    { id: 'playtime', name: 'Extra Playtime (1hr)', price: 200, billing: 'day' },
    { id: 'training', name: 'Basic Training Session', price: 500, billing: 'stay' },
    { id: 'photos', name: 'Daily Photo Updates', price: 150, billing: 'day' },
    { id: 'medication', name: 'Medication Administration', price: 200, billing: 'day' },
    { id: 'special-diet', name: 'Special Diet Meals', price: 250, billing: 'day' }
]);

export const SERVICE_DETAIL_PROJECTIONS = Object.freeze({
    generalConsultation: {
        title: 'General Check-up',
        includedTitle: "What's Included:",
        includedItems: [
            'Physical examination',
            'Weight and temperature check',
            'Heart and lung assessment',
            'Dental evaluation',
            'Health consultation'
        ],
        duration: '30-45 minutes',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    parasiteControl: {
        title: 'Parasite Control',
        includedTitle: "What's Included:",
        includedItems: [
            'Flea and tick treatment',
            'Deworming medication',
            'Parasite screening',
            'Prevention plan',
            'Follow-up care guidance'
        ],
        duration: '20-30 minutes',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    laboratoryTesting: {
        title: 'Laboratory Testing',
        includedTitle: "What's Included:",
        includedItems: [
            'Veterinarian review of the requested test',
            'Sample and preparation guidance',
            'Laboratory processing',
            'Results release and interpretation guidance'
        ],
        duration: 'Varies by requested test',
        reviewNote: 'The clinic will confirm the appropriate test, sample requirements, preparation, and final laboratory fee after review.'
    },
    vaccination: {
        title: 'Vaccination',
        includedTitle: 'Common Vaccines:',
        includedItems: [
            'Rabies vaccine',
            '5-in-1 vaccine',
            'Booster shots',
            'Vaccination certificate',
            'Next due-date guidance'
        ],
        duration: '15-20 minutes',
        reviewNote: "Please bring your pet's vaccination record if available."
    },
    grooming: {
        title: 'Grooming',
        includedTitle: 'Services Include:',
        includedItems: [
            'Bath and blow dry',
            'Hair cut and styling',
            'Nail trimming',
            'Ear cleaning',
            'Teeth brushing'
        ],
        duration: '1-3 hours (varies by size)',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    dental: {
        title: 'Dental Check-up',
        includedTitle: "What's Included:",
        includedItems: [
            'Oral examination',
            'Teeth and gum assessment',
            'Dental cleaning',
            'Tartar removal',
            'Oral health recommendations'
        ],
        duration: '45-90 minutes',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    surgery: {
        title: 'Surgery',
        includedTitle: 'Services Include:',
        includedItems: [
            'Pre-surgical consultation',
            'Surgical procedures',
            'Anesthesia monitoring',
            'Post-operative care',
            'Follow-up appointments'
        ],
        duration: 'Varies by procedure',
        reviewNote: 'All surgical procedures require a pre-operative consultation and examination.'
    }
});

export const DEFAULT_BOOKING_PRICE_PROJECTION_CONFIG = Object.freeze({
    servicePrices: SERVICE_PRICE_PROJECTIONS,
    groomingMatrix: GROOMING_PRICE_MATRIX,
    kaponMatrix: KAPON_PRICE_MATRIX,
    homeServices: HOME_SERVICE_PRICE_PROJECTIONS,
    boardingRooms: BOARDING_ROOM_PROJECTIONS,
    boardingAddOns: BOARDING_ADD_ON_PROJECTIONS,
    serviceDetails: SERVICE_DETAIL_PROJECTIONS,
    instructions: Object.freeze({
        onlineConsultation: '',
        generalConsultation: '',
        laboratoryTesting: '',
        parasiteControl: '',
        vaccination: '',
        grooming: '',
        dental: '',
        surgery: '',
        homeService: '',
        kapon: 'Final kapon pricing may change after sex, weight, anesthesia, testing, and medication assessment.',
        specialSurgery: 'Final surgery pricing is confirmed after veterinary assessment.'
    })
});

function text(value, fallback = '') {
    const next = value === null || value === undefined ? '' : String(value);
    return next.trim() === '' ? fallback : next;
}

function cloneRows(rows) {
    return rows.map((row) => ({ ...row }));
}

function defaultConfigClone() {
    return {
        servicePrices: { ...SERVICE_PRICE_PROJECTIONS },
        groomingMatrix: cloneRows(GROOMING_PRICE_MATRIX),
        kaponMatrix: cloneRows(KAPON_PRICE_MATRIX),
        homeServices: cloneRows(HOME_SERVICE_PRICE_PROJECTIONS),
        boardingRooms: {
            hotel: BOARDING_ROOM_PROJECTIONS.hotel.map((room) => ({ ...room, features: [...room.features] })),
            boarding: BOARDING_ROOM_PROJECTIONS.boarding.map((room) => ({ ...room, features: [...room.features] }))
        },
        boardingAddOns: cloneRows(BOARDING_ADD_ON_PROJECTIONS),
        serviceDetails: Object.fromEntries(
            Object.entries(SERVICE_DETAIL_PROJECTIONS).map(([key, value]) => [
                key,
                {
                    title: value.title,
                    includedTitle: value.includedTitle,
                    includedItems: [...value.includedItems],
                    duration: value.duration,
                    reviewNote: value.reviewNote
                }
            ])
        ),
        instructions: { ...DEFAULT_BOOKING_PRICE_PROJECTION_CONFIG.instructions }
    };
}

function mergeServicePrices(overrides) {
    const defaults = SERVICE_PRICE_PROJECTIONS;
    const source = overrides && typeof overrides === 'object' ? overrides : {};

    return Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [
            key,
            key === 'onlineConsultation' ? value : text(source[key], value)
        ])
    );
}

function mergeRows(defaultRows, rows, fields, identityField) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const sourceByIdentity = new Map(
        sourceRows
            .filter((row) => row && typeof row === 'object')
            .map((row) => [String(row[identityField] || '').toLowerCase(), row])
    );

    return defaultRows.map((defaultRow, index) => {
        const source = sourceByIdentity.get(String(defaultRow[identityField] || '').toLowerCase()) || sourceRows[index] || {};
        return Object.fromEntries(
            fields.map((field) => [field, text(source[field], defaultRow[field])])
        );
    });
}

function mergeHomeServiceRows(rows) {
    const sourceRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
    const mergedDefaults = mergeRows(
        HOME_SERVICE_PRICE_PROJECTIONS,
        sourceRows,
        ['id', 'name', 'description', 'price'],
        'id'
    );
    const defaultIds = new Set(HOME_SERVICE_PRICE_PROJECTIONS.map((row) => row.id));
    const additionalRows = sourceRows
        .filter((row) => row.id && !defaultIds.has(String(row.id)))
        .map((row) => ({
            id: text(row.id),
            name: text(row.name, 'Custom Home Service'),
            description: text(row.description),
            price: text(row.price, 'Price confirmed after review')
        }));

    return [...mergedDefaults, ...additionalRows];
}

function finiteNumber(value, fallback) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function mergeBoardingRooms(rooms) {
    const source = rooms && typeof rooms === 'object' ? rooms : {};

    return Object.fromEntries(Object.entries(BOARDING_ROOM_PROJECTIONS).map(([type, defaultRooms]) => {
        const sourceRooms = Array.isArray(source[type]) ? source[type] : [];
        return [type, defaultRooms.map((defaultRoom, index) => {
            const sourceRoom = sourceRooms.find((room) => String(room?.id) === defaultRoom.id) || sourceRooms[index] || {};
            const features = Array.isArray(sourceRoom.features)
                ? sourceRoom.features.map((feature) => text(feature)).filter(Boolean)
                : [];
            return {
                id: defaultRoom.id,
                name: text(sourceRoom.name, defaultRoom.name),
                capacity: text(sourceRoom.capacity, defaultRoom.capacity),
                pricePerDay: finiteNumber(sourceRoom.pricePerDay, defaultRoom.pricePerDay),
                features: features.length > 0 ? features : [...defaultRoom.features]
            };
        })];
    }));
}

function mergeBoardingAddOns(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    return BOARDING_ADD_ON_PROJECTIONS.map((defaultRow, index) => {
        const sourceRow = sourceRows.find((row) => String(row?.id) === defaultRow.id) || sourceRows[index] || {};
        return {
            id: defaultRow.id,
            name: text(sourceRow.name, defaultRow.name),
            price: finiteNumber(sourceRow.price, defaultRow.price),
            billing: ['day', 'stay'].includes(sourceRow.billing) ? sourceRow.billing : defaultRow.billing
        };
    });
}

function mergeInstructions(instructions) {
    const defaults = DEFAULT_BOOKING_PRICE_PROJECTION_CONFIG.instructions;
    const source = instructions && typeof instructions === 'object' ? instructions : {};

    return Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, text(source[key], value)])
    );
}

function mergeServiceDetails(details) {
    const source = details && typeof details === 'object' ? details : {};

    return Object.fromEntries(
        Object.entries(SERVICE_DETAIL_PROJECTIONS).map(([key, value]) => {
            const sourceDetail = source[key] && typeof source[key] === 'object' ? source[key] : {};
            const sourceItems = Array.isArray(sourceDetail.includedItems)
                ? sourceDetail.includedItems.map((item) => text(item)).filter(Boolean)
                : [];

            return [
                key,
                {
                    title: text(sourceDetail.title, value.title),
                    includedTitle: text(sourceDetail.includedTitle, value.includedTitle),
                    includedItems: sourceItems.length > 0 ? sourceItems : [...value.includedItems],
                    duration: text(sourceDetail.duration, value.duration),
                    reviewNote: text(sourceDetail.reviewNote, value.reviewNote)
                }
            ];
        })
    );
}

export function mergeBookingPriceProjectionConfig(overrides = {}) {
    if (!overrides || typeof overrides !== 'object') {
        return defaultConfigClone();
    }

    return {
        servicePrices: mergeServicePrices(overrides.servicePrices),
        groomingMatrix: mergeRows(
            GROOMING_PRICE_MATRIX,
            overrides.groomingMatrix,
            ['service', 'small', 'medium', 'large', 'xl'],
            'service'
        ),
        kaponMatrix: mergeRows(
            KAPON_PRICE_MATRIX,
            overrides.kaponMatrix,
            ['procedure', 'price'],
            'procedure'
        ),
        homeServices: mergeHomeServiceRows(overrides.homeServices),
        boardingRooms: mergeBoardingRooms(overrides.boardingRooms),
        boardingAddOns: mergeBoardingAddOns(overrides.boardingAddOns),
        serviceDetails: mergeServiceDetails(overrides.serviceDetails),
        instructions: mergeInstructions(overrides.instructions)
    };
}

export function includedItemsText(items) {
    return Array.isArray(items) ? items.join('\n') : '';
}

export function parseIncludedItems(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function readBookingPriceProjectionConfig() {
    if (typeof window === 'undefined') {
        return defaultConfigClone();
    }

    try {
        const raw = window.localStorage.getItem(BOOKING_PRICE_PROJECTION_STORAGE_KEY);
        return mergeBookingPriceProjectionConfig(raw ? JSON.parse(raw) : {});
    } catch {
        return defaultConfigClone();
    }
}

export function saveBookingPriceProjectionConfig(config, { persist = true } = {}) {
    const normalized = mergeBookingPriceProjectionConfig(config);

    if (persist && typeof window !== 'undefined') {
        window.localStorage.setItem(BOOKING_PRICE_PROJECTION_STORAGE_KEY, JSON.stringify(normalized));
        window.dispatchEvent(new CustomEvent(BOOKING_PRICE_PROJECTION_UPDATED_EVENT, { detail: normalized }));
    }

    return normalized;
}

export function resetBookingPriceProjectionConfig({ persist = true } = {}) {
    const normalized = defaultConfigClone();

    if (persist && typeof window !== 'undefined') {
        window.localStorage.removeItem(BOOKING_PRICE_PROJECTION_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent(BOOKING_PRICE_PROJECTION_UPDATED_EVENT, { detail: normalized }));
    }

    return normalized;
}

export function homeServicePriceById(config, id) {
    const source = config?.homeServices || HOME_SERVICE_PRICE_PROJECTIONS;
    return source.find((item) => item.id === id)?.price || '';
}

function specialServiceKey(service) {
    return [
        service?.serviceCode,
        service?.service_code,
        service?.serviceTitle,
        service?.service_title,
        service?.serviceName,
        service?.service_name
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function isKaponProjectionService(service) {
    const key = specialServiceKey(service);
    return key.includes('kapon') || key.includes('spay') || key.includes('neuter');
}

export function isSpecialSurgeryProjectionService(service) {
    const key = specialServiceKey(service);
    return key.includes('special-surgery') || key.includes('special surgery');
}

export function getSpecialServiceProjectionLabel(service, fallback = 'To be announced', config = null) {
    const servicePrices = config?.servicePrices || SERVICE_PRICE_PROJECTIONS;

    if (isKaponProjectionService(service)) {
        return servicePrices.kapon;
    }

    if (isSpecialSurgeryProjectionService(service)) {
        return servicePrices.specialSurgery;
    }

    return fallback;
}
