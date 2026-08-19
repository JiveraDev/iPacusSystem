const STORE_NAMES = {
    D1: 'User, Profile, Role and Branch Access Data',
    D2: 'Pet and Ownership Data',
    D3: 'Booking, Consent and Schedule Data',
    D4: 'Queue, Visit and Clinical Record Data',
    D5: 'Boarding Data',
    D6: 'Branch, Service, Room and Inventory Data',
    D7: 'Charge, Payment and Refund Data',
    D8: 'Notification, Preference and Task Data',
};

const ROLE_LABELS = {
    owner: 'PET OWNER',
    admin: 'ADMIN',
    vet: 'VETERINARIAN',
    super: 'SUPER ADMIN',
};

const FLOW_LABEL_ALIASES = new Map([
    ['Authentication and account status', 'Authentication result'],
    ['Personnel and role updates', 'Personnel and role details'],
    ['Personnel and role status', 'Personnel and role status'],
    ['Branch assignment updates', 'Branch assignment details'],
    ['Access and branch permissions', 'Access permissions'],
    ['Access and branch assignment', 'Branch access'],
    ['Profile and notification preferences', 'Profile preferences'],
    ['Profile and preference status', 'Profile status'],
    ['Account, profile, role and branch-access data', 'Account and access data'],
    ['Account, profile, role and branch-access updates', 'Account and access updates'],
    ['Pet registration and ownership data', 'Pet registration details'],
    ['Pet and ownership status', 'Pet record status'],
    ['Pet and ownership updates', 'Pet record updates'],
    ['Pet and ownership directory', 'Pet directory'],
    ['Booking and payment submissions', 'Booking review details'],
    ['Availability and schedule updates', 'Availability details'],
    ['Booking and consent request', 'Booking request and consent'],
    ['Schedule and booking confirmation', 'Booking confirmation'],
    ['Authorized user and branch data', 'User access data'],
    ['Availability, booking and consent data', 'Booking and schedule data'],
    ['Booking, consent and schedule updates', 'Booking and schedule updates'],
    ['Available appointment slots', 'Available slots'],
    ['Booking and consent submission', 'Booking submission'],
    ['Approved schedule reservation', 'Approved schedule'],
    ['Queue and veterinarian assignment', 'Queue assignment'],
    ['Queue, visit and request data', 'Queue and visit status'],
    ['Medical-record request decisions', 'Record request decision'],
    ['Case assignment actions', 'Case assignment'],
    ['Assigned queue and case data', 'Assigned cases'],
    ['Diagnosis and treatment data', 'Clinical findings'],
    ['Pet clinical history', 'Clinical history'],
    ['Prescription and record updates', 'Prescription details'],
    ['Consultation and request data', 'Prescription and record status'],
    ['Medical-record and update request', 'Record update request'],
    ['Approved medical-record correction', 'Approved record correction'],
    ['Diagnosis, prescription and medical record', 'Medical record'],
    ['Queue, visit and clinical record data', 'Queue and clinical data'],
    ['Queue, visit and clinical record updates', 'Queue and clinical updates'],
    ['Assigned visit and consultation data', 'Assigned visit details'],
    ['Diagnosis and treatment summary', 'Clinical summary'],
    ['Service and inventory transactions', 'Inventory updates'],
    ['Room, service and stock status', 'Resource and stock status'],
    ['Service, room and inventory data', 'Resource and inventory data'],
    ['Service, room and inventory updates', 'Resource and inventory updates'],
    ['Active boarding assignment', 'Boarding assignment'],
    ['Completed stay and recorded material usage', 'Stay and usage summary'],
    ['Validated catalog and stock transaction', 'Validated inventory update'],
    ['Updated availability and stock balances', 'Updated stock levels'],
    ['Charge, payment and refund data', 'Billing details'],
    ['Billing, payment and refund status', 'Billing status'],
    ['Validated refund request and payment data', 'Validated refund details'],
    ['Payment proof and refund request', 'Payment proof and refund request'],
    ['Monitoring and recovery requests', 'Monitoring request'],
    ['Audit and recovery results', 'Audit results'],
    ['Recipient and notification-preference data', 'Recipient preference data'],
    ['Notification delivery and task data', 'Notification and task data'],
    ['Notification, preference and task updates', 'Notification and task updates'],
    ['Recipient rules and active tasks', 'Recipient and task rules'],
    ['Validated notification events', 'Notification events'],
    ['Validated monitoring and recovery findings', 'Monitoring findings'],
]);

const conciseFlowLabel = (label) => FLOW_LABEL_ALIASES.get(label) || label;

const F = (id, source, target, label, options = {}) => ({
    id,
    source,
    target,
    label: conciseFlowLabel(label),
    ...options,
});

const roleId = (processId, role) => `${processId}-${role}`;
const storeId = (processId, code) => `${processId}-${code.toLowerCase()}`;

function splitBidirectionalReferences(nodes, edges) {
    const replacements = [];
    for (const item of [...nodes]) {
        if (item.type !== 'entity' && item.type !== 'store') continue;
        const incoming = edges.filter((edge) => edge.source === item.id);
        const outgoing = edges.filter((edge) => edge.target === item.id);
        if (incoming.length === 0 || outgoing.length === 0) {
            item.flowDirection = incoming.length > 0 ? 'input' : 'output';
            continue;
        }

        const inputReference = {
            ...item,
            id: `${item.id}-input`,
            flowDirection: 'input',
            duplicateReference: true,
        };
        const outputReference = {
            ...item,
            id: `${item.id}-output`,
            flowDirection: 'output',
            duplicateReference: true,
        };
        for (const edge of incoming) edge.source = inputReference.id;
        for (const edge of outgoing) edge.target = outputReference.id;
        replacements.push({ original: item, references: [inputReference, outputReference] });
    }

    for (const replacement of replacements) {
        const index = nodes.indexOf(replacement.original);
        nodes.splice(index, 1, ...replacement.references);
    }
}

function replaceInternalFlowsWithHorizontalReferences(nodes, edges) {
    const nodesById = new Map(nodes.map((item) => [item.id, item]));
    for (const edge of edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (source?.type !== 'process' || target?.type !== 'process') continue;
        const reference = {
            ...target,
            id: `${edge.id}-target-reference`,
            type: 'process-ref',
            logicalProcess: String(target.label).split('\n')[0],
            bandIndex: source.bandIndex,
            flowDirection: 'output',
            duplicateReference: true,
            fixedSize: true,
            width: 520,
            height: 110,
        };
        nodes.push(reference);
        nodesById.set(reference.id, reference);
        edge.target = reference.id;
    }
}

function layoutSide(nodes, edges, bandTop, centerX, side) {
    const laneSpacing = 76;
    const nodeGap = 70;
    const directionGap = 110;
    const startOffset = 106;
    const relevantNodes = nodes
        .filter((item) => (
            side === 'left'
                ? item.type === 'store'
                : item.type === 'entity' || item.type === 'process-ref'
        ))
        .sort((left, right) => {
            const directionOrder = (left.flowDirection === 'input' ? 0 : 1)
                - (right.flowDirection === 'input' ? 0 : 1);
            if (directionOrder !== 0) return directionOrder;
            return (left.orderIndex || 0) - (right.orderIndex || 0);
        });
    let cursor = startOffset;
    let previousDirection = null;

    for (const item of relevantNodes) {
        if (previousDirection !== null && previousDirection !== item.flowDirection) {
            cursor += directionGap;
        }
        const incident = edges
            .filter((edge) => edge.source === item.id || edge.target === item.id)
            .sort((left, right) => left.orderIndex - right.orderIndex);
        const firstLane = cursor;
        for (const edge of incident) {
            edge.laneY = bandTop + cursor;
            edge.flowDirection = item.flowDirection;
            edge.corridor = side;
            cursor += laneSpacing;
        }
        const lastLane = cursor - laneSpacing;
        item.width = item.type === 'store' ? 580 : item.type === 'process-ref' ? 520 : 260;
        item.height = Math.max(90, lastLane - firstLane + 76);
        item.minWidth = item.width;
        item.minHeight = item.height;
        item.fixedSize = true;
        item.x = centerX - item.width / 2;
        item.y = bandTop + firstLane - 38;
        cursor += nodeGap;
        previousDirection = item.flowDirection;
    }
    return Math.max(240, cursor + 24);
}

function buildBandedPage(meta, bandDefinitions, flowDefinitions) {
    const width = meta.width || 4300;
    const leftCenter = meta.leftCenter || 470;
    const processCenter = meta.processCenter || Math.round(width / 2);
    const rightCenter = meta.rightCenter || width - 470;
    const nodes = [];
    const bands = [];

    for (let bandIndex = 0; bandIndex < bandDefinitions.length; bandIndex += 1) {
        const definition = bandDefinitions[bandIndex];
        const process = {
            id: definition.id,
            label: `${definition.number}\n${definition.name}`,
            type: 'process',
            x: 0,
            y: 0,
            width: definition.width || 500,
            height: 110,
            minHeight: definition.minHeight || 0,
            bandIndex,
            orderIndex: bandIndex,
            fixedSize: true,
        };
        const stores = (definition.stores || []).map((entry, entryIndex) => {
            const [id, code] = Array.isArray(entry) ? entry : [entry.id, entry.code];
            return {
                id,
                label: `${code}\n${STORE_NAMES[code]}`,
                logicalStore: code,
                type: 'store',
                x: 0,
                y: 0,
                width: 580,
                height: 90,
                bandIndex,
                orderIndex: nodes.length + entryIndex,
                fixedSize: true,
            };
        });
        const entities = (definition.entities || []).map((entry, entryIndex) => {
            const [id, role] = Array.isArray(entry) ? entry : [entry.id, entry.role];
            return {
                id,
                label: ROLE_LABELS[role] || role,
                logicalRole: role,
                type: 'entity',
                x: 0,
                y: 0,
                width: 260,
                height: 90,
                bandIndex,
                orderIndex: nodes.length + stores.length + entryIndex,
                fixedSize: true,
            };
        });
        nodes.push(process, ...stores, ...entities);
        bands.push({ definition, process, stores, entities });
    }

    const originalNodesById = new Map(nodes.map((item) => [item.id, item]));
    const edges = flowDefinitions.map((definition, orderIndex) => {
        if (!originalNodesById.has(definition.source) || !originalNodesById.has(definition.target)) {
            throw new Error(`Unknown endpoint in ${meta.name}: ${definition.source} -> ${definition.target}`);
        }
        return { ...definition, orderIndex };
    });
    replaceInternalFlowsWithHorizontalReferences(nodes, edges);
    splitBidirectionalReferences(nodes, edges);

    const nodesById = new Map(nodes.map((item) => [item.id, item]));
    for (const edge of edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const process = source.type === 'process' ? source : target.type === 'process' ? target : null;
        const counterpart = process === source ? target : source;
        if (!process || !counterpart || process.bandIndex !== counterpart.bandIndex) {
            throw new Error(`Horizontal flow has invalid endpoints in ${meta.name}: ${edge.id}`);
        }
        if (counterpart.type === 'store') {
            edge.sourceSide = source === process ? 'left' : 'right';
            edge.targetSide = target === process ? 'left' : 'right';
        } else {
            edge.sourceSide = source === process ? 'right' : 'left';
            edge.targetSide = target === process ? 'right' : 'left';
        }
    }

    let cursorY = 150;
    for (let bandIndex = 0; bandIndex < bands.length; bandIndex += 1) {
        const band = bands[bandIndex];
        const bandNodes = nodes.filter((item) => item.bandIndex === bandIndex);
        const bandEdges = edges.filter((edge) => {
            const source = nodesById.get(edge.source);
            const target = nodesById.get(edge.target);
            return source.bandIndex === bandIndex && target.bandIndex === bandIndex;
        });
        band.top = cursorY;
        const leftHeight = layoutSide(bandNodes, bandEdges, cursorY, leftCenter, 'left');
        const rightHeight = layoutSide(bandNodes, bandEdges, cursorY, rightCenter, 'right');
        const contentHeight = Math.max(
            band.definition.bandHeight || 0,
            leftHeight,
            rightHeight,
            band.process.minHeight || 0,
            300,
        );
        const bandHeight = contentHeight + 70;
        band.height = bandHeight;
        band.process.width = band.definition.width || 540;
        band.process.height = contentHeight;
        band.process.minWidth = band.process.width;
        band.process.minHeight = band.process.height;
        band.process.x = processCenter - band.process.width / 2;
        band.process.y = cursorY + 28;
        cursorY += bandHeight + 80;
    }

    return {
        id: meta.id,
        name: meta.name,
        title: meta.title,
        subtitle: meta.subtitle,
        directionNote: meta.directionNote || 'INPUTS GROUPED ABOVE OUTPUTS - EVERY LABEL SITS DIRECTLY ABOVE ITS ARROW',
        legend: meta.legend || 'Repeated role, store and process symbols are visual references. Each flow uses its own horizontal landing lane.',
        kind: meta.kind,
        parentProcess: meta.parentProcess,
        routeStyle: 'horizontal',
        width,
        height: Math.ceil(cursorY + 40),
        zones: [
            { id: `${meta.id}-stores-zone`, label: 'LOGICAL DATA STORES', x: 40, y: 112, width: 860, height: 34 },
            { id: `${meta.id}-process-zone`, label: meta.kind === 'level2' ? 'DECOMPOSED SUBPROCESSES' : 'SYSTEM PROCESSES', x: processCenter - 500, y: 112, width: 1000, height: 34 },
            { id: `${meta.id}-roles-zone`, label: 'EXTERNAL ROLES', x: width - 900, y: 112, width: 860, height: 34 },
        ],
        nodes,
        edges,
    };
}

function buildFourColumnPage(meta, bandDefinitions, flowDefinitions) {
    const width = meta.width || (meta.kind === 'level1' ? 3800 : 3600);
    const leftEntityX = 80;
    const processX = meta.kind === 'level1' ? 720 : 680;
    const storeX = meta.kind === 'level1' ? 2150 : 1980;
    const rightEntityX = width - 330;
    const processWidth = meta.kind === 'level1' ? 560 : 540;
    const storeWidth = meta.kind === 'level1' ? 620 : 600;
    const entityWidth = 260;
    const top = 180;
    const bottomPadding = 110;
    const processGap = meta.processGap || 220;
    const columnGap = meta.columnGap || 96;
    const repeatEntities = meta.repeatEntities === true;
    const nodes = [];
    const aliases = new Map();
    const processes = [];
    const storesByCode = new Map();
    const entitiesByRole = new Map();

    for (let bandIndex = 0; bandIndex < bandDefinitions.length; bandIndex += 1) {
        const definition = bandDefinitions[bandIndex];
        const process = {
            id: definition.id,
            label: `${definition.number}\n${definition.name}`,
            type: 'process',
            logicalProcess: definition.number,
            bandIndex,
            orderIndex: bandIndex,
            x: processX,
            y: 0,
            width: definition.width || processWidth,
            height: definition.minHeight || 112,
            minHeight: definition.minHeight || 0,
            fixedSize: true,
            column: 'process',
        };
        nodes.push(process);
        processes.push(process);
        aliases.set(process.id, process.id);

        for (const entry of definition.stores || []) {
            const [rawId, code] = Array.isArray(entry) ? entry : [entry.id, entry.code];
            let store = storesByCode.get(code);
            if (!store) {
                store = {
                    id: `${meta.id}-store-${code.toLowerCase()}`,
                    label: `${code}\n${STORE_NAMES[code]}`,
                    logicalStore: code,
                    type: 'store',
                    x: storeX,
                    y: 0,
                    width: storeWidth,
                    height: 70,
                    fixedSize: true,
                    column: 'store',
                };
                storesByCode.set(code, store);
                nodes.push(store);
            }
            aliases.set(rawId, store.id);
        }

        for (const entry of definition.entities || []) {
            const [rawId, role] = Array.isArray(entry) ? entry : [entry.id, entry.role];
            const entityKey = repeatEntities ? `${definition.id}:${role}` : role;
            let entity = entitiesByRole.get(entityKey);
            if (!entity) {
                const column = role === 'owner' ? 'left-entity' : 'right-entity';
                entity = {
                    id: repeatEntities ? rawId : `${meta.id}-role-${role}`,
                    label: ROLE_LABELS[role] || role,
                    logicalRole: role,
                    type: 'entity',
                    x: column === 'left-entity' ? leftEntityX : rightEntityX,
                    y: 0,
                    width: entityWidth,
                    height: 80,
                    fixedSize: true,
                    column,
                };
                entitiesByRole.set(entityKey, entity);
                nodes.push(entity);
            }
            aliases.set(rawId, entity.id);
        }
    }

    const nodeIds = new Set(nodes.map((item) => item.id));
    const edges = flowDefinitions.map((definition, orderIndex) => {
        const source = aliases.get(definition.source) || definition.source;
        const target = aliases.get(definition.target) || definition.target;
        if (!nodeIds.has(source) || !nodeIds.has(target)) {
            throw new Error(`Unknown endpoint in ${meta.name}: ${definition.source} -> ${definition.target}`);
        }
        return {
            ...definition,
            source,
            target,
            orderIndex,
        };
    });

    if (repeatEntities) {
        for (const entity of [...entitiesByRole.values()]) {
            const inputEdges = edges.filter((edge) => edge.source === entity.id);
            const outputEdges = edges.filter((edge) => edge.target === entity.id);
            if (inputEdges.length > 0 && outputEdges.length > 0) {
                const inputReference = {
                    ...entity,
                    id: `${entity.id}-input`,
                    x: leftEntityX,
                    column: 'left-entity',
                    duplicateReference: true,
                };
                const outputReference = {
                    ...entity,
                    id: `${entity.id}-output`,
                    x: rightEntityX,
                    column: 'right-entity',
                    duplicateReference: true,
                };
                for (const edge of inputEdges) edge.source = inputReference.id;
                for (const edge of outputEdges) edge.target = outputReference.id;
                const index = nodes.indexOf(entity);
                nodes.splice(index, 1, inputReference, outputReference);
            } else if (inputEdges.length > 0) {
                entity.x = leftEntityX;
                entity.column = 'left-entity';
            } else {
                entity.x = rightEntityX;
                entity.column = 'right-entity';
            }
        }
    }

    const degree = new Map();
    for (const edge of edges) {
        degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
        degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    }

    for (const item of nodes) {
        const connectionCount = degree.get(item.id) || 0;
        if (item.type === 'process') {
            item.headerHeight = 42;
            const portSpacing = meta.compactProcesses ? 12 : 16;
            item.height = Math.max(item.minHeight || 0, 112, 62 + connectionCount * portSpacing);
        } else if (item.type === 'store') {
            item.height = Math.max(66, 34 + connectionCount * 15);
        } else {
            item.height = Math.max(78, 40 + connectionCount * (repeatEntities ? 14 : 17));
        }
        item.height = Math.ceil(item.height / 10) * 10;
    }

    let processCursor = top;
    for (const process of processes) {
        process.y = processCursor;
        processCursor += process.height + processGap;
    }
    const processBottom = processCursor - processGap;

    const entityNodes = nodes.filter((item) => item.type === 'entity');
    const leftEntities = entityNodes
        .filter((item) => item.column === 'left-entity');
    const rightEntities = entityNodes
        .filter((item) => item.column === 'right-entity');
    const stores = [...storesByCode.values()];
    const requiredHeight = (items) => items.reduce((sum, item) => sum + item.height, 0)
        + Math.max(0, items.length - 1) * columnGap;
    const contentHeight = Math.max(
        processBottom - top,
        requiredHeight(leftEntities),
        requiredHeight(rightEntities),
        requiredHeight(stores),
    );
    const height = Math.ceil((top + contentHeight + bottomPadding) / 10) * 10;
    const usableBottom = height - bottomPadding;

    if (processBottom < usableBottom) {
        const offset = Math.round((usableBottom - processBottom) / 2 / 10) * 10;
        for (const process of processes) process.y += offset;
    }

    const nodesById = new Map(nodes.map((item) => [item.id, item]));
    const desiredCenter = (item) => {
        const centers = [];
        for (const edge of edges) {
            if (edge.source !== item.id && edge.target !== item.id) continue;
            const other = nodesById.get(edge.source === item.id ? edge.target : edge.source);
            if (other?.type === 'process') centers.push(other.y + other.height / 2);
        }
        return centers.length > 0
            ? centers.reduce((sum, value) => sum + value, 0) / centers.length
            : (top + usableBottom) / 2;
    };

    const packColumn = (items, x) => {
        if (items.length === 0) return;
        const ordered = [...items].sort((left, right) => desiredCenter(left) - desiredCenter(right));
        for (const item of ordered) {
            item.x = x;
            item.y = Math.max(top, Math.min(
                usableBottom - item.height,
                desiredCenter(item) - item.height / 2,
            ));
        }
        let cursor = top;
        for (const item of ordered) {
            item.y = Math.max(item.y, cursor);
            cursor = item.y + item.height + columnGap;
        }
        cursor = usableBottom;
        for (let index = ordered.length - 1; index >= 0; index -= 1) {
            const item = ordered[index];
            item.y = Math.min(item.y, cursor - item.height);
            cursor = item.y - columnGap;
        }
        if (ordered[0].y < top) {
            const offset = top - ordered[0].y;
            for (const item of ordered) item.y += offset;
        }
        for (const item of ordered) item.y = Math.round(item.y / 10) * 10;
    };

    packColumn(leftEntities, leftEntityX);
    packColumn(stores, storeX);
    packColumn(rightEntities, rightEntityX);

    const columnOrder = {
        'left-entity': 0,
        process: 1,
        store: 2,
        'right-entity': 3,
    };
    for (const edge of edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (source.type === 'process' && target.type === 'process') {
            edge.sourceSide = source.y <= target.y ? 'bottom' : 'top';
            edge.targetSide = source.y <= target.y ? 'top' : 'bottom';
            edge.internalFlow = true;
            continue;
        }
        if (columnOrder[source.column] < columnOrder[target.column]) {
            edge.sourceSide = 'right';
            edge.targetSide = 'left';
        } else {
            edge.sourceSide = 'left';
            edge.targetSide = 'right';
        }
    }

    return {
        id: meta.id,
        name: meta.name,
        title: meta.title,
        subtitle: meta.subtitle,
        directionNote: meta.directionNote
            || 'EXTERNAL ENTITY  |  PROCESS  |  DATA STORE  |  EXTERNAL ENTITY',
        legend: meta.legend
            || 'Each arrow is one data flow. Shared stores appear once; vertical labels remain attached to their connector.',
        kind: meta.kind,
        parentProcess: meta.parentProcess,
        routeStyle: 'orthogonal',
        width,
        height,
        zones: [
            { id: `${meta.id}-left-role-zone`, label: 'EXTERNAL ENTITY', x: 40, y: 112, width: 320, height: 34 },
            { id: `${meta.id}-process-zone`, label: meta.kind === 'level2' ? 'SUBPROCESSES' : 'SYSTEM PROCESSES', x: processX - 70, y: 112, width: processWidth + 140, height: 34 },
            { id: `${meta.id}-stores-zone`, label: 'LOGICAL DATA STORES', x: storeX - 70, y: 112, width: storeWidth + 140, height: 34 },
            { id: `${meta.id}-right-role-zone`, label: 'EXTERNAL ENTITIES', x: rightEntityX - 30, y: 112, width: entityWidth + 60, height: 34 },
        ],
        nodes,
        edges,
    };
}

function buildLevelOnePage(pageBuilder = buildFourColumnPage, pageMeta = {}) {
    const bands = [
        {
            id: 'l1-p1',
            number: '1.0',
            name: 'MANAGE ACCOUNTS AND ACCESS',
            stores: [[storeId('l1-p1', 'D1'), 'D1']],
            entities: [
                [roleId('l1-p1', 'super'), 'super'],
                [roleId('l1-p1', 'admin'), 'admin'],
                [roleId('l1-p1', 'vet'), 'vet'],
                [roleId('l1-p1', 'owner'), 'owner'],
            ],
            minHeight: 230,
        },
        {
            id: 'l1-p2',
            number: '2.0',
            name: 'MANAGE PETS AND OWNERSHIP',
            stores: [[storeId('l1-p2', 'D2'), 'D2']],
            entities: [
                [roleId('l1-p2', 'admin'), 'admin'],
                [roleId('l1-p2', 'owner'), 'owner'],
            ],
        },
        {
            id: 'l1-p3',
            number: '3.0',
            name: 'MANAGE BOOKINGS AND SCHEDULING',
            stores: [
                [storeId('l1-p3', 'D1'), 'D1'],
                [storeId('l1-p3', 'D2'), 'D2'],
                [storeId('l1-p3', 'D3'), 'D3'],
            ],
            entities: [
                [roleId('l1-p3', 'admin'), 'admin'],
                [roleId('l1-p3', 'vet'), 'vet'],
                [roleId('l1-p3', 'owner'), 'owner'],
            ],
        },
        {
            id: 'l1-p4',
            number: '4.0',
            name: 'MANAGE QUEUE AND CLINICAL CARE',
            stores: [
                [storeId('l1-p4', 'D2'), 'D2'],
                [storeId('l1-p4', 'D3'), 'D3'],
                [storeId('l1-p4', 'D4'), 'D4'],
            ],
            entities: [
                [roleId('l1-p4', 'admin'), 'admin'],
                [roleId('l1-p4', 'vet'), 'vet'],
                [roleId('l1-p4', 'owner'), 'owner'],
            ],
            minHeight: 240,
        },
        {
            id: 'l1-p5',
            number: '5.0',
            name: 'MANAGE BOARDING',
            stores: [
                [storeId('l1-p5', 'D2'), 'D2'],
                [storeId('l1-p5', 'D3'), 'D3'],
                [storeId('l1-p5', 'D5'), 'D5'],
                [storeId('l1-p5', 'D6'), 'D6'],
                [storeId('l1-p5', 'D7'), 'D7'],
            ],
            entities: [[roleId('l1-p5', 'admin'), 'admin']],
        },
        {
            id: 'l1-p6',
            number: '6.0',
            name: 'MANAGE INVENTORY AND SERVICES',
            stores: [
                [storeId('l1-p6', 'D5'), 'D5'],
                [storeId('l1-p6', 'D6'), 'D6'],
            ],
            entities: [[roleId('l1-p6', 'admin'), 'admin']],
        },
        {
            id: 'l1-p7',
            number: '7.0',
            name: 'MANAGE BILLING, PAYMENTS AND REFUNDS',
            stores: [
                [storeId('l1-p7', 'D3'), 'D3'],
                [storeId('l1-p7', 'D4'), 'D4'],
                [storeId('l1-p7', 'D5'), 'D5'],
                [storeId('l1-p7', 'D6'), 'D6'],
                [storeId('l1-p7', 'D7'), 'D7'],
            ],
            entities: [
                [roleId('l1-p7', 'super'), 'super'],
                [roleId('l1-p7', 'admin'), 'admin'],
                [roleId('l1-p7', 'owner'), 'owner'],
            ],
        },
        {
            id: 'l1-p8',
            number: '8.0',
            name: 'MANAGE NOTIFICATIONS AND TASKS',
            stores: [
                [storeId('l1-p8', 'D1'), 'D1'],
                [storeId('l1-p8', 'D3'), 'D3'],
                [storeId('l1-p8', 'D4'), 'D4'],
                [storeId('l1-p8', 'D5'), 'D5'],
                [storeId('l1-p8', 'D6'), 'D6'],
                [storeId('l1-p8', 'D7'), 'D7'],
                [storeId('l1-p8', 'D8'), 'D8'],
            ],
            entities: [
                [roleId('l1-p8', 'admin'), 'admin'],
                [roleId('l1-p8', 'vet'), 'vet'],
                [roleId('l1-p8', 'owner'), 'owner'],
            ],
        },
        {
            id: 'l1-p9',
            number: '9.0',
            name: 'GENERATE REPORTS AND MONITOR SYSTEM',
            stores: Object.keys(STORE_NAMES).map((code) => [storeId('l1-p9', code), code]),
            entities: [[roleId('l1-p9', 'super'), 'super']],
            minHeight: 170,
        },
    ];

    const flows = [
        F('l1-p1-s01', roleId('l1-p1', 'super'), 'l1-p1', 'Login credentials'),
        F('l1-p1-s02', 'l1-p1', roleId('l1-p1', 'super'), 'Authentication and account status'),
        F('l1-p1-s03', roleId('l1-p1', 'super'), 'l1-p1', 'Personnel and role updates'),
        F('l1-p1-s04', 'l1-p1', roleId('l1-p1', 'super'), 'Personnel and role status'),
        F('l1-p1-s05', roleId('l1-p1', 'super'), 'l1-p1', 'Branch assignment updates'),
        F('l1-p1-s06', 'l1-p1', roleId('l1-p1', 'super'), 'Branch assignment status'),
        F('l1-p1-a01', roleId('l1-p1', 'admin'), 'l1-p1', 'Login credentials'),
        F('l1-p1-a02', 'l1-p1', roleId('l1-p1', 'admin'), 'Access and branch permissions'),
        F('l1-p1-v01', roleId('l1-p1', 'vet'), 'l1-p1', 'Login credentials'),
        F('l1-p1-v02', 'l1-p1', roleId('l1-p1', 'vet'), 'Access and branch assignment'),
        F('l1-p1-o01', roleId('l1-p1', 'owner'), 'l1-p1', 'Login credentials'),
        F('l1-p1-o02', 'l1-p1', roleId('l1-p1', 'owner'), 'Authentication and account status'),
        F('l1-p1-o03', roleId('l1-p1', 'owner'), 'l1-p1', 'Profile and notification preferences'),
        F('l1-p1-o04', 'l1-p1', roleId('l1-p1', 'owner'), 'Profile and preference status'),
        F('l1-p1-d01', storeId('l1-p1', 'D1'), 'l1-p1', 'Account, profile, role and branch-access data'),
        F('l1-p1-d02', 'l1-p1', storeId('l1-p1', 'D1'), 'Account, profile, role and branch-access updates'),

        F('l1-p2-a01', roleId('l1-p2', 'admin'), 'l1-p2', 'Pet and ownership updates'),
        F('l1-p2-a02', 'l1-p2', roleId('l1-p2', 'admin'), 'Pet and ownership directory'),
        F('l1-p2-o01', roleId('l1-p2', 'owner'), 'l1-p2', 'Pet registration and ownership data'),
        F('l1-p2-o02', 'l1-p2', roleId('l1-p2', 'owner'), 'Pet and ownership status'),
        F('l1-p2-d01', storeId('l1-p2', 'D2'), 'l1-p2', 'Pet and ownership data'),
        F('l1-p2-d02', 'l1-p2', storeId('l1-p2', 'D2'), 'Pet and ownership updates'),

        F('l1-p3-a01', roleId('l1-p3', 'admin'), 'l1-p3', 'Booking decisions'),
        F('l1-p3-a02', 'l1-p3', roleId('l1-p3', 'admin'), 'Booking and payment submissions'),
        F('l1-p3-v01', roleId('l1-p3', 'vet'), 'l1-p3', 'Availability and schedule updates'),
        F('l1-p3-v02', 'l1-p3', roleId('l1-p3', 'vet'), 'Veterinarian schedule'),
        F('l1-p3-o01', roleId('l1-p3', 'owner'), 'l1-p3', 'Booking and consent request'),
        F('l1-p3-o02', 'l1-p3', roleId('l1-p3', 'owner'), 'Schedule and booking confirmation'),
        F('l1-p3-d01', storeId('l1-p3', 'D1'), 'l1-p3', 'Authorized user and branch data'),
        F('l1-p3-d02', storeId('l1-p3', 'D2'), 'l1-p3', 'Pet and ownership data'),
        F('l1-p3-d03', storeId('l1-p3', 'D3'), 'l1-p3', 'Availability, booking and consent data'),
        F('l1-p3-d04', 'l1-p3', storeId('l1-p3', 'D3'), 'Booking, consent and schedule updates'),

        F('l1-p4-a01', roleId('l1-p4', 'admin'), 'l1-p4', 'Queue and veterinarian assignment'),
        F('l1-p4-a02', 'l1-p4', roleId('l1-p4', 'admin'), 'Queue, visit and request data'),
        F('l1-p4-a03', roleId('l1-p4', 'admin'), 'l1-p4', 'Medical-record request decisions'),
        F('l1-p4-v01', roleId('l1-p4', 'vet'), 'l1-p4', 'Case assignment actions'),
        F('l1-p4-v02', 'l1-p4', roleId('l1-p4', 'vet'), 'Assigned queue and case data'),
        F('l1-p4-v03', roleId('l1-p4', 'vet'), 'l1-p4', 'Diagnosis and treatment data'),
        F('l1-p4-v04', 'l1-p4', roleId('l1-p4', 'vet'), 'Pet clinical history'),
        F('l1-p4-v05', roleId('l1-p4', 'vet'), 'l1-p4', 'Prescription and record updates'),
        F('l1-p4-v06', 'l1-p4', roleId('l1-p4', 'vet'), 'Consultation and request data'),
        F('l1-p4-o01', roleId('l1-p4', 'owner'), 'l1-p4', 'Queue and consultation request'),
        F('l1-p4-o02', 'l1-p4', roleId('l1-p4', 'owner'), 'Queue and consultation status'),
        F('l1-p4-o03', roleId('l1-p4', 'owner'), 'l1-p4', 'Medical-record and update request'),
        F('l1-p4-o04', 'l1-p4', roleId('l1-p4', 'owner'), 'Diagnosis, prescription and medical record'),
        F('l1-p4-d01', storeId('l1-p4', 'D2'), 'l1-p4', 'Pet and ownership data'),
        F('l1-p4-d02', storeId('l1-p4', 'D3'), 'l1-p4', 'Confirmed booking and schedule data'),
        F('l1-p4-d03', storeId('l1-p4', 'D4'), 'l1-p4', 'Queue, visit and clinical record data'),
        F('l1-p4-d04', 'l1-p4', storeId('l1-p4', 'D4'), 'Queue, visit and clinical record updates'),

        F('l1-p5-a01', roleId('l1-p5', 'admin'), 'l1-p5', 'Boarding transactions'),
        F('l1-p5-a02', 'l1-p5', roleId('l1-p5', 'admin'), 'Boarding status'),
        F('l1-p5-d01', storeId('l1-p5', 'D2'), 'l1-p5', 'Pet and ownership data'),
        F('l1-p5-d02', storeId('l1-p5', 'D3'), 'l1-p5', 'Confirmed boarding booking data'),
        F('l1-p5-d03', storeId('l1-p5', 'D5'), 'l1-p5', 'Boarding assignment, task and observation data'),
        F('l1-p5-d04', storeId('l1-p5', 'D6'), 'l1-p5', 'Room and inventory availability data'),
        F('l1-p5-d05', 'l1-p5', storeId('l1-p5', 'D5'), 'Boarding stay and care updates'),
        F('l1-p5-d06', 'l1-p5', storeId('l1-p5', 'D6'), 'Boarding material usage'),
        F('l1-p5-d07', 'l1-p5', storeId('l1-p5', 'D7'), 'Boarding charge data'),

        F('l1-p6-a01', roleId('l1-p6', 'admin'), 'l1-p6', 'Service and inventory transactions'),
        F('l1-p6-a02', 'l1-p6', roleId('l1-p6', 'admin'), 'Room, service and stock status'),
        F('l1-p6-d01', storeId('l1-p6', 'D5'), 'l1-p6', 'Boarding material usage'),
        F('l1-p6-d02', storeId('l1-p6', 'D6'), 'l1-p6', 'Service, room and inventory data'),
        F('l1-p6-d03', 'l1-p6', storeId('l1-p6', 'D6'), 'Service, room and inventory updates'),

        F('l1-p7-s01', roleId('l1-p7', 'super'), 'l1-p7', 'Payment-method settings'),
        F('l1-p7-s02', 'l1-p7', roleId('l1-p7', 'super'), 'Payment configuration status'),
        F('l1-p7-a01', roleId('l1-p7', 'admin'), 'l1-p7', 'Charge, payment and refund data'),
        F('l1-p7-a02', 'l1-p7', roleId('l1-p7', 'admin'), 'Billing, payment and refund status'),
        F('l1-p7-o01', roleId('l1-p7', 'owner'), 'l1-p7', 'Payment proof and refund request'),
        F('l1-p7-o02', 'l1-p7', roleId('l1-p7', 'owner'), 'Payment and refund status'),
        F('l1-p7-d01', storeId('l1-p7', 'D3'), 'l1-p7', 'Booking and payment-submission data'),
        F('l1-p7-d02', storeId('l1-p7', 'D4'), 'l1-p7', 'Visit charge and treatment-usage data'),
        F('l1-p7-d03', storeId('l1-p7', 'D5'), 'l1-p7', 'Boarding stay and charge data'),
        F('l1-p7-d04', storeId('l1-p7', 'D6'), 'l1-p7', 'Service prices and inventory usage'),
        F('l1-p7-d05', storeId('l1-p7', 'D7'), 'l1-p7', 'Charge, payment and refund data'),
        F('l1-p7-d06', 'l1-p7', storeId('l1-p7', 'D7'), 'Charge, payment and refund updates'),

        F('l1-p8-a01', 'l1-p8', roleId('l1-p8', 'admin'), 'Operational alerts'),
        F('l1-p8-v01', roleId('l1-p8', 'vet'), 'l1-p8', 'Task and preference updates'),
        F('l1-p8-v02', 'l1-p8', roleId('l1-p8', 'vet'), 'Case, schedule and task reminders'),
        F('l1-p8-o01', 'l1-p8', roleId('l1-p8', 'owner'), 'Notifications and reminders'),
        F('l1-p8-d01', storeId('l1-p8', 'D1'), 'l1-p8', 'Recipient and notification-preference data'),
        F('l1-p8-d02', storeId('l1-p8', 'D3'), 'l1-p8', 'Booking and schedule events'),
        F('l1-p8-d03', storeId('l1-p8', 'D4'), 'l1-p8', 'Queue and clinical events'),
        F('l1-p8-d04', storeId('l1-p8', 'D5'), 'l1-p8', 'Boarding events'),
        F('l1-p8-d05', storeId('l1-p8', 'D6'), 'l1-p8', 'Stock and service events'),
        F('l1-p8-d06', storeId('l1-p8', 'D7'), 'l1-p8', 'Billing and payment events'),
        F('l1-p8-d07', storeId('l1-p8', 'D8'), 'l1-p8', 'Notification delivery and task data'),
        F('l1-p8-d08', 'l1-p8', storeId('l1-p8', 'D8'), 'Notification, preference and task updates'),

        F('l1-p9-s01', roleId('l1-p9', 'super'), 'l1-p9', 'Report filters'),
        F('l1-p9-s02', 'l1-p9', roleId('l1-p9', 'super'), 'Dashboards and reports'),
        F('l1-p9-s03', roleId('l1-p9', 'super'), 'l1-p9', 'Monitoring and recovery requests'),
        F('l1-p9-s04', 'l1-p9', roleId('l1-p9', 'super'), 'Audit and recovery results'),
        F('l1-p9-d01', storeId('l1-p9', 'D1'), 'l1-p9', 'Account and access statistics'),
        F('l1-p9-d02', storeId('l1-p9', 'D2'), 'l1-p9', 'Pet and ownership statistics'),
        F('l1-p9-d03', storeId('l1-p9', 'D3'), 'l1-p9', 'Booking and schedule statistics'),
        F('l1-p9-d04', storeId('l1-p9', 'D4'), 'l1-p9', 'Queue and clinical statistics'),
        F('l1-p9-d05', storeId('l1-p9', 'D5'), 'l1-p9', 'Boarding statistics'),
        F('l1-p9-d06', storeId('l1-p9', 'D6'), 'l1-p9', 'Service and inventory statistics'),
        F('l1-p9-d07', storeId('l1-p9', 'D7'), 'l1-p9', 'Billing and payment statistics'),
        F('l1-p9-d08', storeId('l1-p9', 'D8'), 'l1-p9', 'Notification and task statistics'),
    ];

    return pageBuilder(
        {
            id: 'ipawcus-level-1-corrected',
            name: '02 - Level 1 DFD',
            title: 'IPAWCUS Level 1 Data Flow Diagram',
            subtitle: 'Nine system processes with shared logical stores and individually labeled external data flows',
            kind: 'level1',
            ...pageMeta,
        },
        bands,
        flows,
    );
}

function buildHorizontalContextPage(sourcePage) {
    const page = buildBandedPage(
        {
            id: 'ipawcus-context',
            name: '01 - Context Diagram',
            title: 'IPAWCUS Context Diagram',
            subtitle: 'Process 0 with individual external inputs grouped above individual outputs',
            directionNote: 'INPUTS GROUPED ABOVE OUTPUTS - EVERY LABEL SITS DIRECTLY ABOVE ITS ARROW',
            legend: 'Repeated role boxes are visual references. Every external data flow has its own horizontal landing lane.',
            kind: 'context',
            width: 4300,
            leftCenter: 470,
            processCenter: 2150,
            rightCenter: 3830,
        },
        [
            {
                id: 'ctx-system',
                number: '0',
                name: 'IPAWCUS\nINTEGRATED PET CARE AND CLINIC MANAGEMENT SYSTEM',
                width: 700,
                stores: [],
                entities: [
                    ['ctx-super', 'super'],
                    ['ctx-admin', 'admin'],
                    ['ctx-vet', 'vet'],
                    ['ctx-owner', 'owner'],
                ],
            },
        ],
        sourcePage.edges.map((edge) => F(
            edge.id,
            edge.source,
            edge.target,
            edge.label,
            { balanceKey: edge.balanceKey },
        )),
    );
    const system = page.nodes.find((item) => item.id === 'ctx-system');
    system.type = 'context-process';
    page.zones = page.zones.filter((zone) => !zone.id.endsWith('-stores-zone'));
    return page;
}

function detailPage(number, name, bands, flows, pageBuilder = buildFourColumnPage, pageMeta = {}) {
    return pageBuilder(
        {
            id: `ipawcus-level-2-${number.replace('.', '-')}`,
            name: `${String(Number(number)).padStart(2, '0')} - Level 2 (${number})`,
            title: `IPAWCUS Level 2 DFD - Process ${number}`,
            subtitle: `${name}: decomposition of Level-1 Process ${number}`,
            directionNote: `PROCESS ${number} BOUNDARY  ->  DECOMPOSED DATA FLOWS`,
            kind: 'level2',
            parentProcess: number,
            width: 3900,
            leftCenter: 460,
            processCenter: 1950,
            rightCenter: 3440,
            ...pageMeta,
        },
        bands,
        flows,
    );
}

function buildLevelTwoPages(pageBuilder = buildFourColumnPage, pageMeta = {}) {
    const pages = [];
    const createDetailPage = (number, name, bands, flows) => detailPage(
        number,
        name,
        bands,
        flows,
        pageBuilder,
        pageMeta,
    );

    pages.push(createDetailPage('1.0', 'Manage Accounts and Access', [
        {
            id: 'l2-1-p11', number: '1.1', name: 'AUTHENTICATE USER',
            stores: [['l2-1-p11-d1', 'D1']],
            entities: [
                ['l2-1-p11-super', 'super'], ['l2-1-p11-admin', 'admin'],
                ['l2-1-p11-vet', 'vet'], ['l2-1-p11-owner', 'owner'],
            ],
            minHeight: 180,
        },
        {
            id: 'l2-1-p12', number: '1.2', name: 'MANAGE PROFILE AND PREFERENCES',
            stores: [['l2-1-p12-d1', 'D1']], entities: [['l2-1-p12-owner', 'owner']],
        },
        {
            id: 'l2-1-p13', number: '1.3', name: 'MANAGE PERSONNEL, ROLES AND BRANCH ACCESS',
            stores: [['l2-1-p13-d1', 'D1']], entities: [['l2-1-p13-super', 'super']],
        },
    ], [
        F('l2-1-e01', 'l2-1-p11-super', 'l2-1-p11', 'Login credentials'),
        F('l2-1-e02', 'l2-1-p11', 'l2-1-p11-super', 'Authentication and account status'),
        F('l2-1-e03', 'l2-1-p11-admin', 'l2-1-p11', 'Login credentials'),
        F('l2-1-e04', 'l2-1-p11', 'l2-1-p11-admin', 'Access and branch permissions'),
        F('l2-1-e05', 'l2-1-p11-vet', 'l2-1-p11', 'Login credentials'),
        F('l2-1-e06', 'l2-1-p11', 'l2-1-p11-vet', 'Access and branch assignment'),
        F('l2-1-e07', 'l2-1-p11-owner', 'l2-1-p11', 'Login credentials'),
        F('l2-1-e08', 'l2-1-p11', 'l2-1-p11-owner', 'Authentication and account status'),
        F('l2-1-e09', 'l2-1-p11-d1', 'l2-1-p11', 'Account, profile, role and branch-access data'),
        F('l2-1-e10', 'l2-1-p11', 'l2-1-p11-d1', 'Authentication and session updates'),
        F('l2-1-e11', 'l2-1-p12-owner', 'l2-1-p12', 'Profile and notification preferences'),
        F('l2-1-e12', 'l2-1-p12', 'l2-1-p12-owner', 'Profile and preference status'),
        F('l2-1-e13', 'l2-1-p12-d1', 'l2-1-p12', 'Current profile and preference data'),
        F('l2-1-e14', 'l2-1-p12', 'l2-1-p12-d1', 'Profile and preference updates'),
        F('l2-1-e15', 'l2-1-p13-super', 'l2-1-p13', 'Personnel and role updates'),
        F('l2-1-e16', 'l2-1-p13', 'l2-1-p13-super', 'Personnel and role status'),
        F('l2-1-e17', 'l2-1-p13-super', 'l2-1-p13', 'Branch assignment updates'),
        F('l2-1-e18', 'l2-1-p13', 'l2-1-p13-super', 'Branch assignment status'),
        F('l2-1-e19', 'l2-1-p13-d1', 'l2-1-p13', 'Personnel, role and branch assignment data'),
        F('l2-1-e20', 'l2-1-p13', 'l2-1-p13-d1', 'Account, profile, role and branch-access updates'),
    ]));

    pages.push(createDetailPage('2.0', 'Manage Pets and Ownership', [
        { id: 'l2-2-p21', number: '2.1', name: 'REGISTER AND MAINTAIN PET', stores: [['l2-2-p21-d2', 'D2']], entities: [['l2-2-p21-owner', 'owner']] },
        { id: 'l2-2-p22', number: '2.2', name: 'MANAGE OWNERSHIP LINKS', stores: [['l2-2-p22-d2', 'D2']], entities: [['l2-2-p22-admin', 'admin']] },
        { id: 'l2-2-p23', number: '2.3', name: 'PROVIDE PET AND OWNERSHIP DIRECTORY', stores: [['l2-2-p23-d2', 'D2']], entities: [['l2-2-p23-admin', 'admin']] },
    ], [
        F('l2-2-e01', 'l2-2-p21-owner', 'l2-2-p21', 'Pet registration and ownership data'),
        F('l2-2-e02', 'l2-2-p21', 'l2-2-p21-owner', 'Pet and ownership status'),
        F('l2-2-e03', 'l2-2-p21-d2', 'l2-2-p21', 'Pet and ownership data'),
        F('l2-2-e04', 'l2-2-p21', 'l2-2-p21-d2', 'Pet registration updates'),
        F('l2-2-e05', 'l2-2-p22-admin', 'l2-2-p22', 'Pet and ownership updates'),
        F('l2-2-e06', 'l2-2-p22-d2', 'l2-2-p22', 'Current ownership links'),
        F('l2-2-e07', 'l2-2-p22', 'l2-2-p22-d2', 'Pet and ownership updates'),
        F('l2-2-e08', 'l2-2-p23-d2', 'l2-2-p23', 'Pet directory records'),
        F('l2-2-e09', 'l2-2-p23', 'l2-2-p23-admin', 'Pet and ownership directory'),
    ]));

    pages.push(createDetailPage('3.0', 'Manage Bookings and Scheduling', [
        { id: 'l2-3-p31', number: '3.1', name: 'CHECK AVAILABILITY', stores: [['l2-3-p31-d1', 'D1'], ['l2-3-p31-d3', 'D3']], entities: [] },
        { id: 'l2-3-p32', number: '3.2', name: 'SUBMIT BOOKING AND CONSENT', stores: [['l2-3-p32-d2', 'D2'], ['l2-3-p32-d3', 'D3']], entities: [['l2-3-p32-owner', 'owner']] },
        { id: 'l2-3-p33', number: '3.3', name: 'REVIEW AND DECIDE BOOKING', stores: [['l2-3-p33-d3', 'D3']], entities: [['l2-3-p33-admin', 'admin'], ['l2-3-p33-owner', 'owner']] },
        { id: 'l2-3-p34', number: '3.4', name: 'MAINTAIN VETERINARIAN SCHEDULE', stores: [['l2-3-p34-d3', 'D3']], entities: [['l2-3-p34-vet', 'vet']] },
    ], [
        F('l2-3-e01', 'l2-3-p31-d1', 'l2-3-p31', 'Authorized user and branch data'),
        F('l2-3-e02', 'l2-3-p31-d3', 'l2-3-p31', 'Availability, booking and consent data'),
        F('l2-3-e03', 'l2-3-p31', 'l2-3-p32', 'Available appointment slots'),
        F('l2-3-e04', 'l2-3-p32-owner', 'l2-3-p32', 'Booking and consent request'),
        F('l2-3-e05', 'l2-3-p32-d2', 'l2-3-p32', 'Pet and ownership data'),
        F('l2-3-e06', 'l2-3-p32', 'l2-3-p32-d3', 'Booking and consent submission'),
        F('l2-3-e07', 'l2-3-p32', 'l2-3-p33', 'Booking and consent submission'),
        F('l2-3-e08', 'l2-3-p33-admin', 'l2-3-p33', 'Booking decisions'),
        F('l2-3-e09', 'l2-3-p33', 'l2-3-p33-admin', 'Booking and payment submissions'),
        F('l2-3-e10', 'l2-3-p33', 'l2-3-p33-owner', 'Schedule and booking confirmation'),
        F('l2-3-e11', 'l2-3-p33-d3', 'l2-3-p33', 'Submitted booking and consent data'),
        F('l2-3-e12', 'l2-3-p33', 'l2-3-p33-d3', 'Booking decision and schedule update'),
        F('l2-3-e13', 'l2-3-p33', 'l2-3-p34', 'Approved schedule reservation'),
        F('l2-3-e14', 'l2-3-p34-vet', 'l2-3-p34', 'Availability and schedule updates'),
        F('l2-3-e15', 'l2-3-p34', 'l2-3-p34-vet', 'Veterinarian schedule'),
        F('l2-3-e16', 'l2-3-p34-d3', 'l2-3-p34', 'Current veterinarian schedule'),
        F('l2-3-e17', 'l2-3-p34', 'l2-3-p34-d3', 'Booking, consent and schedule updates'),
    ]));

    pages.push(createDetailPage('4.0', 'Manage Queue and Clinical Care', [
        { id: 'l2-4-p41', number: '4.1', name: 'MANAGE QUEUE AND VETERINARIAN ASSIGNMENT', stores: [['l2-4-p41-d3', 'D3'], ['l2-4-p41-d4', 'D4']], entities: [['l2-4-p41-admin', 'admin'], ['l2-4-p41-vet', 'vet'], ['l2-4-p41-owner', 'owner']], minHeight: 170 },
        { id: 'l2-4-p42', number: '4.2', name: 'CONDUCT CONSULTATION AND RECORD DIAGNOSIS', stores: [['l2-4-p42-d2', 'D2'], ['l2-4-p42-d4', 'D4']], entities: [['l2-4-p42-vet', 'vet']] },
        { id: 'l2-4-p43', number: '4.3', name: 'MANAGE PRESCRIPTIONS AND MEDICAL RECORDS', stores: [['l2-4-p43-d4', 'D4']], entities: [['l2-4-p43-vet', 'vet'], ['l2-4-p43-owner', 'owner']] },
        { id: 'l2-4-p44', number: '4.4', name: 'REVIEW MEDICAL-RECORD UPDATE REQUESTS', stores: [['l2-4-p44-d4', 'D4']], entities: [['l2-4-p44-admin', 'admin'], ['l2-4-p44-owner', 'owner']] },
    ], [
        F('l2-4-e01', 'l2-4-p41-admin', 'l2-4-p41', 'Queue and veterinarian assignment'),
        F('l2-4-e02', 'l2-4-p41', 'l2-4-p41-admin', 'Queue, visit and request data'),
        F('l2-4-e03', 'l2-4-p41-vet', 'l2-4-p41', 'Case assignment actions'),
        F('l2-4-e04', 'l2-4-p41', 'l2-4-p41-vet', 'Assigned queue and case data'),
        F('l2-4-e05', 'l2-4-p41-owner', 'l2-4-p41', 'Queue and consultation request'),
        F('l2-4-e06', 'l2-4-p41', 'l2-4-p41-owner', 'Queue and consultation status'),
        F('l2-4-e07', 'l2-4-p41-d3', 'l2-4-p41', 'Confirmed booking and schedule data'),
        F('l2-4-e08', 'l2-4-p41-d4', 'l2-4-p41', 'Queue, visit and clinical record data'),
        F('l2-4-e09', 'l2-4-p41', 'l2-4-p41-d4', 'Queue and visit updates'),
        F('l2-4-e10', 'l2-4-p41', 'l2-4-p42', 'Assigned visit and consultation data'),
        F('l2-4-e11', 'l2-4-p42-vet', 'l2-4-p42', 'Diagnosis and treatment data'),
        F('l2-4-e12', 'l2-4-p42', 'l2-4-p42-vet', 'Pet clinical history'),
        F('l2-4-e13', 'l2-4-p42-d2', 'l2-4-p42', 'Pet and ownership data'),
        F('l2-4-e14', 'l2-4-p42-d4', 'l2-4-p42', 'Existing clinical record'),
        F('l2-4-e15', 'l2-4-p42', 'l2-4-p42-d4', 'Diagnosis and treatment updates'),
        F('l2-4-e16', 'l2-4-p42', 'l2-4-p43', 'Diagnosis and treatment summary'),
        F('l2-4-e17', 'l2-4-p43-vet', 'l2-4-p43', 'Prescription and record updates'),
        F('l2-4-e18', 'l2-4-p43', 'l2-4-p43-vet', 'Consultation and request data'),
        F('l2-4-e19', 'l2-4-p43', 'l2-4-p43-owner', 'Diagnosis, prescription and medical record'),
        F('l2-4-e20', 'l2-4-p43-d4', 'l2-4-p43', 'Consultation and request records'),
        F('l2-4-e21', 'l2-4-p43', 'l2-4-p43-d4', 'Queue, visit and clinical record updates'),
        F('l2-4-e22', 'l2-4-p44-owner', 'l2-4-p44', 'Medical-record and update request'),
        F('l2-4-e23', 'l2-4-p44-admin', 'l2-4-p44', 'Medical-record request decisions'),
        F('l2-4-e24', 'l2-4-p44-d4', 'l2-4-p44', 'Pending medical-record requests'),
        F('l2-4-e25', 'l2-4-p44', 'l2-4-p44-d4', 'Approved request and record correction'),
        F('l2-4-e26', 'l2-4-p44', 'l2-4-p43', 'Approved medical-record correction'),
    ]));

    pages.push(createDetailPage('5.0', 'Manage Boarding', [
        { id: 'l2-5-p51', number: '5.1', name: 'CREATE BOARDING ASSIGNMENT', stores: [['l2-5-p51-d2', 'D2'], ['l2-5-p51-d3', 'D3'], ['l2-5-p51-d5', 'D5'], ['l2-5-p51-d6', 'D6']], entities: [['l2-5-p51-admin', 'admin']] },
        { id: 'l2-5-p52', number: '5.2', name: 'MANAGE STAY, TASKS AND OBSERVATIONS', stores: [['l2-5-p52-d5', 'D5']], entities: [] },
        { id: 'l2-5-p53', number: '5.3', name: 'COMPLETE CHECKOUT AND MATERIAL USAGE', stores: [['l2-5-p53-d5', 'D5'], ['l2-5-p53-d6', 'D6'], ['l2-5-p53-d7', 'D7']], entities: [] },
    ], [
        F('l2-5-e01', 'l2-5-p51-admin', 'l2-5-p51', 'Boarding transactions'),
        F('l2-5-e02', 'l2-5-p51-d2', 'l2-5-p51', 'Pet and ownership data'),
        F('l2-5-e03', 'l2-5-p51-d3', 'l2-5-p51', 'Confirmed boarding booking data'),
        F('l2-5-e04', 'l2-5-p51-d6', 'l2-5-p51', 'Room and inventory availability data'),
        F('l2-5-e05', 'l2-5-p51', 'l2-5-p51-d5', 'Boarding assignment and check-in data'),
        F('l2-5-e06', 'l2-5-p51', 'l2-5-p52', 'Active boarding assignment'),
        F('l2-5-e07', 'l2-5-p52-d5', 'l2-5-p52', 'Boarding assignment, task and observation data'),
        F('l2-5-e08', 'l2-5-p52', 'l2-5-p52-d5', 'Boarding stay and care updates'),
        F('l2-5-e09', 'l2-5-p52', 'l2-5-p53', 'Completed stay and recorded material usage'),
        F('l2-5-e10', 'l2-5-p53-d5', 'l2-5-p53', 'Stay, task and observation summary'),
        F('l2-5-e11', 'l2-5-p53', 'l2-5-p53-d5', 'Checkout and completed-stay update'),
        F('l2-5-e12', 'l2-5-p53', 'l2-5-p53-d6', 'Boarding material usage'),
        F('l2-5-e13', 'l2-5-p53', 'l2-5-p53-d7', 'Boarding charge data'),
        F('l2-5-e14', 'l2-5-p53', 'l2-5-p51-admin', 'Boarding status'),
    ]));

    pages.push(createDetailPage('6.0', 'Manage Inventory and Services', [
        { id: 'l2-6-p61', number: '6.1', name: 'PROCESS SERVICE AND INVENTORY TRANSACTIONS', stores: [['l2-6-p61-d5', 'D5'], ['l2-6-p61-d6', 'D6']], entities: [['l2-6-p61-admin', 'admin']] },
        { id: 'l2-6-p62', number: '6.2', name: 'MAINTAIN SERVICE, ROOM AND STOCK RECORDS', stores: [['l2-6-p62-d6', 'D6']], entities: [] },
        { id: 'l2-6-p63', number: '6.3', name: 'MONITOR AVAILABILITY AND STOCK LEVELS', stores: [['l2-6-p63-d6', 'D6']], entities: [['l2-6-p63-admin', 'admin']] },
    ], [
        F('l2-6-e01', 'l2-6-p61-admin', 'l2-6-p61', 'Service and inventory transactions'),
        F('l2-6-e02', 'l2-6-p61-d5', 'l2-6-p61', 'Boarding material usage'),
        F('l2-6-e03', 'l2-6-p61-d6', 'l2-6-p61', 'Service, room and inventory data'),
        F('l2-6-e04', 'l2-6-p61', 'l2-6-p62', 'Validated catalog and stock transaction'),
        F('l2-6-e05', 'l2-6-p62-d6', 'l2-6-p62', 'Current service, room and stock records'),
        F('l2-6-e06', 'l2-6-p62', 'l2-6-p62-d6', 'Service, room and inventory updates'),
        F('l2-6-e07', 'l2-6-p62', 'l2-6-p63', 'Updated availability and stock balances'),
        F('l2-6-e08', 'l2-6-p63-d6', 'l2-6-p63', 'Availability and stock levels'),
        F('l2-6-e09', 'l2-6-p63', 'l2-6-p63-admin', 'Room, service and stock status'),
    ]));

    pages.push(createDetailPage('7.0', 'Manage Billing, Payments and Refunds', [
        { id: 'l2-7-p71', number: '7.1', name: 'GENERATE CHARGES AND BILL', stores: [['l2-7-p71-d3', 'D3'], ['l2-7-p71-d4', 'D4'], ['l2-7-p71-d5', 'D5'], ['l2-7-p71-d6', 'D6'], ['l2-7-p71-d7', 'D7']], entities: [['l2-7-p71-admin', 'admin']] },
        { id: 'l2-7-p72', number: '7.2', name: 'VERIFY AND RECORD PAYMENT', stores: [['l2-7-p72-d7', 'D7']], entities: [['l2-7-p72-admin', 'admin'], ['l2-7-p72-owner', 'owner']] },
        { id: 'l2-7-p73', number: '7.3', name: 'PROCESS REFUND', stores: [['l2-7-p73-d7', 'D7']], entities: [['l2-7-p73-admin', 'admin'], ['l2-7-p73-owner', 'owner']] },
        { id: 'l2-7-p74', number: '7.4', name: 'MANAGE PAYMENT METHODS', stores: [['l2-7-p74-d7', 'D7']], entities: [['l2-7-p74-super', 'super']] },
    ], [
        F('l2-7-e01', 'l2-7-p71-admin', 'l2-7-p71', 'Charge, payment and refund data'),
        F('l2-7-e02', 'l2-7-p71-d3', 'l2-7-p71', 'Booking and payment-submission data'),
        F('l2-7-e03', 'l2-7-p71-d4', 'l2-7-p71', 'Visit charge and treatment-usage data'),
        F('l2-7-e04', 'l2-7-p71-d5', 'l2-7-p71', 'Boarding stay and charge data'),
        F('l2-7-e05', 'l2-7-p71-d6', 'l2-7-p71', 'Service prices and inventory usage'),
        F('l2-7-e06', 'l2-7-p71-d7', 'l2-7-p71', 'Charge, payment and refund data'),
        F('l2-7-e07', 'l2-7-p71', 'l2-7-p71-d7', 'Generated charge and billing update'),
        F('l2-7-e08', 'l2-7-p71', 'l2-7-p72', 'Invoice and outstanding balance'),
        F('l2-7-e09', 'l2-7-p72-owner', 'l2-7-p72', 'Payment proof and refund request'),
        F('l2-7-e10', 'l2-7-p72-admin', 'l2-7-p72', 'Payment verification data'),
        F('l2-7-e11', 'l2-7-p72-d7', 'l2-7-p72', 'Pending payment record'),
        F('l2-7-e12', 'l2-7-p72', 'l2-7-p72-d7', 'Verified payment update'),
        F('l2-7-e13', 'l2-7-p72', 'l2-7-p72-owner', 'Payment and refund status'),
        F('l2-7-e14', 'l2-7-p72', 'l2-7-p72-admin', 'Billing, payment and refund status'),
        F('l2-7-e15', 'l2-7-p72', 'l2-7-p73', 'Validated refund request and payment data'),
        F('l2-7-e16', 'l2-7-p73-admin', 'l2-7-p73', 'Refund decision data'),
        F('l2-7-e17', 'l2-7-p73-owner', 'l2-7-p73', 'Refund supporting data'),
        F('l2-7-e18', 'l2-7-p73-d7', 'l2-7-p73', 'Payment and refund eligibility data'),
        F('l2-7-e19', 'l2-7-p73', 'l2-7-p73-d7', 'Charge, payment and refund updates'),
        F('l2-7-e20', 'l2-7-p74-super', 'l2-7-p74', 'Payment-method settings'),
        F('l2-7-e21', 'l2-7-p74', 'l2-7-p74-super', 'Payment configuration status'),
        F('l2-7-e22', 'l2-7-p74-d7', 'l2-7-p74', 'Current payment-method configuration'),
        F('l2-7-e23', 'l2-7-p74', 'l2-7-p74-d7', 'Payment-method configuration update'),
    ]));

    pages.push(createDetailPage('8.0', 'Manage Notifications and Tasks', [
        { id: 'l2-8-p81', number: '8.1', name: 'MANAGE RECIPIENT PREFERENCES AND TASKS', stores: [['l2-8-p81-d1', 'D1'], ['l2-8-p81-d8', 'D8']], entities: [['l2-8-p81-vet', 'vet']] },
        { id: 'l2-8-p82', number: '8.2', name: 'COLLECT OPERATIONAL EVENTS', stores: [['l2-8-p82-d3', 'D3'], ['l2-8-p82-d4', 'D4'], ['l2-8-p82-d5', 'D5'], ['l2-8-p82-d6', 'D6'], ['l2-8-p82-d7', 'D7'], ['l2-8-p82-d8', 'D8']], entities: [] },
        { id: 'l2-8-p83', number: '8.3', name: 'GENERATE AND DELIVER NOTIFICATIONS', stores: [['l2-8-p83-d8', 'D8']], entities: [['l2-8-p83-admin', 'admin'], ['l2-8-p83-vet', 'vet'], ['l2-8-p83-owner', 'owner']] },
    ], [
        F('l2-8-e01', 'l2-8-p81-vet', 'l2-8-p81', 'Task and preference updates'),
        F('l2-8-e02', 'l2-8-p81-d1', 'l2-8-p81', 'Recipient and notification-preference data'),
        F('l2-8-e03', 'l2-8-p81-d8', 'l2-8-p81', 'Current preference and task data'),
        F('l2-8-e04', 'l2-8-p81', 'l2-8-p81-d8', 'Notification, preference and task updates'),
        F('l2-8-e05', 'l2-8-p81', 'l2-8-p83', 'Recipient rules and active tasks'),
        F('l2-8-e06', 'l2-8-p82-d3', 'l2-8-p82', 'Booking and schedule events'),
        F('l2-8-e07', 'l2-8-p82-d4', 'l2-8-p82', 'Queue and clinical events'),
        F('l2-8-e08', 'l2-8-p82-d5', 'l2-8-p82', 'Boarding events'),
        F('l2-8-e09', 'l2-8-p82-d6', 'l2-8-p82', 'Stock and service events'),
        F('l2-8-e10', 'l2-8-p82-d7', 'l2-8-p82', 'Billing and payment events'),
        F('l2-8-e11', 'l2-8-p82-d8', 'l2-8-p82', 'Notification delivery and task data'),
        F('l2-8-e12', 'l2-8-p82', 'l2-8-p82-d8', 'Queued notification events'),
        F('l2-8-e13', 'l2-8-p82', 'l2-8-p83', 'Validated notification events'),
        F('l2-8-e14', 'l2-8-p83-d8', 'l2-8-p83', 'Queued notifications and delivery state'),
        F('l2-8-e15', 'l2-8-p83', 'l2-8-p83-d8', 'Notification delivery updates'),
        F('l2-8-e16', 'l2-8-p83', 'l2-8-p83-admin', 'Operational alerts'),
        F('l2-8-e17', 'l2-8-p83', 'l2-8-p83-vet', 'Case, schedule and task reminders'),
        F('l2-8-e18', 'l2-8-p83', 'l2-8-p83-owner', 'Notifications and reminders'),
    ]));

    pages.push(createDetailPage('9.0', 'Generate Reports and Monitor System', [
        { id: 'l2-9-p91', number: '9.1', name: 'COMPILE DASHBOARDS AND REPORTS', stores: [['l2-9-p91-d1', 'D1'], ['l2-9-p91-d2', 'D2'], ['l2-9-p91-d3', 'D3'], ['l2-9-p91-d4', 'D4'], ['l2-9-p91-d5', 'D5'], ['l2-9-p91-d6', 'D6'], ['l2-9-p91-d7', 'D7'], ['l2-9-p91-d8', 'D8']], entities: [['l2-9-p91-super', 'super']], minHeight: 150 },
        { id: 'l2-9-p92', number: '9.2', name: 'MONITOR OPERATIONS AND EXCEPTIONS', stores: [['l2-9-p92-d1', 'D1'], ['l2-9-p92-d3', 'D3'], ['l2-9-p92-d4', 'D4'], ['l2-9-p92-d6', 'D6'], ['l2-9-p92-d7', 'D7']], entities: [['l2-9-p92-super', 'super']] },
        { id: 'l2-9-p93', number: '9.3', name: 'GENERATE AUDIT AND RECOVERY RESULTS', stores: [['l2-9-p93-d1', 'D1'], ['l2-9-p93-d2', 'D2'], ['l2-9-p93-d3', 'D3'], ['l2-9-p93-d4', 'D4']], entities: [['l2-9-p93-super', 'super']] },
    ], [
        F('l2-9-e01', 'l2-9-p91-super', 'l2-9-p91', 'Report filters'),
        F('l2-9-e02', 'l2-9-p91', 'l2-9-p91-super', 'Dashboards and reports'),
        F('l2-9-e03', 'l2-9-p91-d1', 'l2-9-p91', 'Account and access statistics'),
        F('l2-9-e04', 'l2-9-p91-d2', 'l2-9-p91', 'Pet and ownership statistics'),
        F('l2-9-e05', 'l2-9-p91-d3', 'l2-9-p91', 'Booking and schedule statistics'),
        F('l2-9-e06', 'l2-9-p91-d4', 'l2-9-p91', 'Queue and clinical statistics'),
        F('l2-9-e07', 'l2-9-p91-d5', 'l2-9-p91', 'Boarding statistics'),
        F('l2-9-e08', 'l2-9-p91-d6', 'l2-9-p91', 'Service and inventory statistics'),
        F('l2-9-e09', 'l2-9-p91-d7', 'l2-9-p91', 'Billing and payment statistics'),
        F('l2-9-e10', 'l2-9-p91-d8', 'l2-9-p91', 'Notification and task statistics'),
        F('l2-9-e11', 'l2-9-p92-super', 'l2-9-p92', 'Monitoring and recovery requests'),
        F('l2-9-e12', 'l2-9-p92-d1', 'l2-9-p92', 'Account and access exceptions'),
        F('l2-9-e13', 'l2-9-p92-d3', 'l2-9-p92', 'Booking and schedule exceptions'),
        F('l2-9-e14', 'l2-9-p92-d4', 'l2-9-p92', 'Queue and clinical exceptions'),
        F('l2-9-e15', 'l2-9-p92-d6', 'l2-9-p92', 'Service and inventory exceptions'),
        F('l2-9-e16', 'l2-9-p92-d7', 'l2-9-p92', 'Billing and payment exceptions'),
        F('l2-9-e17', 'l2-9-p92', 'l2-9-p93', 'Validated monitoring and recovery findings'),
        F('l2-9-e18', 'l2-9-p93-d1', 'l2-9-p93', 'Account lifecycle data'),
        F('l2-9-e19', 'l2-9-p93-d2', 'l2-9-p93', 'Pet lifecycle data'),
        F('l2-9-e20', 'l2-9-p93-d3', 'l2-9-p93', 'Booking lifecycle data'),
        F('l2-9-e21', 'l2-9-p93-d4', 'l2-9-p93', 'Visit and clinical lifecycle data'),
        F('l2-9-e22', 'l2-9-p93', 'l2-9-p93-super', 'Audit and recovery results'),
    ]));

    return pages;
}

export function buildCorrectedDfdPages(contextSourcePage) {
    return {
        contextPage: buildHorizontalContextPage(contextSourcePage),
        levelOnePage: buildLevelOnePage(),
        levelTwoPages: buildLevelTwoPages(),
        storeNames: STORE_NAMES,
        roleLabels: ROLE_LABELS,
    };
}

function buildProfessionalContextPage(sourcePage) {
    return {
        ...sourcePage,
        name: '01 - Context Diagram (Professional)',
        title: 'IPAWCUS Context Diagram',
        subtitle: 'Balanced system boundary with individual role inputs and outputs',
        directionNote: 'EXTERNAL INPUTS  →  PROCESS 0  →  EXTERNAL OUTPUTS',
        legend: 'Each connector carries data, not control sequence. Labels remain attached to their arrows.',
        kind: 'context',
        nodes: sourcePage.nodes.map((item) => ({ ...item })),
        edges: sourcePage.edges.map((edge) => ({
            ...edge,
            label: conciseFlowLabel(edge.label),
        })),
    };
}

function buildProfessionalOverviewPage() {
    const reportingLabels = {
        D1: 'Account and access reporting data',
        D2: 'Pet and ownership reporting data',
        D3: 'Booking and schedule reporting data',
        D4: 'Queue and clinical reporting data',
        D5: 'Boarding reporting data',
        D6: 'Resource and inventory reporting data',
        D7: 'Billing and payment reporting data',
        D8: 'Notification and task reporting data',
    };
    const bands = [
        { id: 'po-p1', number: '1.0', name: 'MANAGE ACCOUNTS AND ACCESS', stores: [['po-p1-d1', 'D1']], entities: [] },
        { id: 'po-p2', number: '2.0', name: 'MANAGE PETS AND OWNERSHIP', stores: [['po-p2-d2', 'D2']], entities: [] },
        {
            id: 'po-p3', number: '3.0', name: 'MANAGE BOOKINGS AND SCHEDULING',
            stores: [['po-p3-d3', 'D3']], entities: [['po-p3-owner', 'owner']],
        },
        {
            id: 'po-p4', number: '4.0', name: 'MANAGE QUEUE AND CLINICAL CARE',
            stores: [['po-p4-d4', 'D4']],
            entities: [['po-p4-admin', 'admin'], ['po-p4-vet', 'vet']],
        },
        { id: 'po-p5', number: '5.0', name: 'MANAGE BOARDING', stores: [['po-p5-d5', 'D5']], entities: [] },
        { id: 'po-p6', number: '6.0', name: 'MANAGE INVENTORY AND SERVICES', stores: [['po-p6-d6', 'D6']], entities: [] },
        { id: 'po-p7', number: '7.0', name: 'MANAGE BILLING, PAYMENTS AND REFUNDS', stores: [['po-p7-d7', 'D7']], entities: [] },
        { id: 'po-p8', number: '8.0', name: 'MANAGE NOTIFICATIONS AND TASKS', stores: [['po-p8-d8', 'D8']], entities: [] },
        {
            id: 'po-p9', number: '9.0', name: 'GENERATE REPORTS AND MONITOR SYSTEM',
            stores: Object.keys(STORE_NAMES).map((code) => [`po-p9-${code.toLowerCase()}`, code]),
            entities: [['po-p9-super', 'super']],
        },
    ];
    const flows = [
        F('po-e01', 'po-p1-d1', 'po-p1', 'Account and access data'),
        F('po-e02', 'po-p1', 'po-p1-d1', 'Account and access changes'),
        F('po-e03', 'po-p2-d2', 'po-p2', 'Pet and ownership data'),
        F('po-e04', 'po-p2', 'po-p2-d2', 'Pet and ownership changes'),
        F('po-e05', 'po-p3-d3', 'po-p3', 'Booking and schedule data'),
        F('po-e06', 'po-p3', 'po-p3-d3', 'Booking and schedule changes'),
        F('po-e07', 'po-p4-d4', 'po-p4', 'Clinical record'),
        F('po-e08', 'po-p4', 'po-p4-d4', 'Clinical record changes'),
        F('po-e09', 'po-p5-d5', 'po-p5', 'Boarding data'),
        F('po-e10', 'po-p5', 'po-p5-d5', 'Boarding changes'),
        F('po-e11', 'po-p6-d6', 'po-p6', 'Resource and inventory data'),
        F('po-e12', 'po-p6', 'po-p6-d6', 'Resource and inventory changes'),
        F('po-e13', 'po-p7-d7', 'po-p7', 'Billing and payment data'),
        F('po-e14', 'po-p7', 'po-p7-d7', 'Billing and payment changes'),
        F('po-e15', 'po-p8-d8', 'po-p8', 'Notification and task data'),
        F('po-e16', 'po-p8', 'po-p8-d8', 'Notification and task changes'),

        F('po-e17', 'po-p1', 'po-p2', 'Authorized user context'),
        F('po-e18', 'po-p2', 'po-p3', 'Pet and owner details'),
        F('po-e19', 'po-p3', 'po-p4', 'Confirmed consultation'),
        F('po-e20', 'po-p3', 'po-p5', 'Boarding reservation'),
        F('po-e21', 'po-p3', 'po-p7', 'Booking charge details'),
        F('po-e22', 'po-p4', 'po-p7', 'Treatment charge details'),
        F('po-e23', 'po-p5', 'po-p6', 'Material usage'),
        F('po-e24', 'po-p6', 'po-p5', 'Resource availability'),
        F('po-e25', 'po-p5', 'po-p7', 'Boarding charge details'),
        F('po-e26', 'po-p6', 'po-p7', 'Service and item charges'),
        F('po-e27', 'po-p3', 'po-p8', 'Booking notification event'),
        F('po-e28', 'po-p4', 'po-p8', 'Clinical notification event'),
        F('po-e29', 'po-p5', 'po-p8', 'Boarding notification event'),
        F('po-e30', 'po-p6', 'po-p8', 'Stock notification event'),
        F('po-e31', 'po-p7', 'po-p8', 'Billing notification event'),

        F('po-e32', 'po-p3-owner', 'po-p3', 'Service request'),
        F('po-e33', 'po-p3', 'po-p3-owner', 'Service status'),
        F('po-e34', 'po-p4-admin', 'po-p4', 'Operational instruction'),
        F('po-e35', 'po-p4', 'po-p4-admin', 'Operational status'),
        F('po-e36', 'po-p4-vet', 'po-p4', 'Clinical update'),
        F('po-e37', 'po-p4', 'po-p4-vet', 'Case information'),
        F('po-e38', 'po-p9-super', 'po-p9', 'Report criteria'),
        F('po-e39', 'po-p9', 'po-p9-super', 'Reports and audit results'),

        ...Object.keys(STORE_NAMES).map((code, index) => F(
            `po-r${String(index + 1).padStart(2, '0')}`,
            `po-p9-${code.toLowerCase()}`,
            'po-p9',
            reportingLabels[code],
        )),
    ];
    return buildFourColumnPage(
        {
            id: 'ipawcus-level-1-core-overview',
            name: '02 - Level 1 Core Data Flow Overview',
            title: 'IPAWCUS Level 1 - Core Data Flow Overview',
            subtitle: 'Authoritative store ownership and cross-domain business handoffs; complete boundary detail follows on the next page',
            directionNote: 'CORE REQUESTS  |  DOMAIN PROCESSES  |  AUTHORITATIVE STORES  |  CORE RESULTS',
            legend: 'This explanatory view shows core handoffs. The next Level-1 page contains the complete balanced boundary inventory.',
            kind: 'level1',
            repeatEntities: true,
            compactProcesses: true,
            processGap: 240,
            columnGap: 76,
        },
        bands,
        flows,
    );
}

export function buildProfessionalDfdPages(contextSourcePage) {
    const levelOnePage = buildLevelOnePage(buildFourColumnPage, {
        id: 'ipawcus-level-1-professional',
        name: '03 - Level 1 Boundary Traceability',
        title: 'IPAWCUS Level 1 - Boundary and Store Traceability',
        subtitle: 'Repeated boundary references shorten routes; shared logical stores remain single sources of truth',
        directionNote: 'INPUT ENTITIES  |  SYSTEM PROCESSES  |  SHARED DATA STORES  |  OUTPUT ENTITIES',
        legend: 'Repeated entity boxes represent the same role and are duplicated only to prevent line congestion.',
        repeatEntities: true,
        compactProcesses: true,
        processGap: 220,
        columnGap: 64,
    });
    const levelTwoPages = buildLevelTwoPages(buildFourColumnPage, {
        repeatEntities: true,
        compactProcesses: true,
        processGap: 220,
        columnGap: 64,
        legend: 'Repeated boundary boxes are references to the same role. Shared stores appear once per page.',
    });
    for (let index = 0; index < levelTwoPages.length; index += 1) {
        const page = levelTwoPages[index];
        page.name = `${String(index + 4).padStart(2, '0')} - Level 2 (${page.parentProcess})`;
        page.title = `${page.title} - Professional Layout`;
        page.directionNote = 'BOUNDARY INPUTS  |  SUBPROCESSES  |  SHARED DATA STORES  |  BOUNDARY OUTPUTS';
    }
    return {
        contextPage: buildProfessionalContextPage(contextSourcePage),
        supplementalPages: [buildProfessionalOverviewPage()],
        levelOnePage,
        levelTwoPages,
        storeNames: STORE_NAMES,
        roleLabels: ROLE_LABELS,
    };
}
