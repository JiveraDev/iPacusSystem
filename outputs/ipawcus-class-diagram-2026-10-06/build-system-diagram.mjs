// Generated documentation: no application code, SQL export, or DB is changed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSystemModel } from './extract-system-model.mjs';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const model = extractSystemModel();
const moduleMap = new Map(model.modules.map(module => [module.id, module]));
const tableMap = new Map(model.tables.map(table => [table.name, table]));
const oldLayout = JSON.parse(fs.readFileSync(path.join(OUT, 'layout.json'), 'utf8'));
const dbPage = new Map(oldLayout.pages.slice(1).flatMap((page, index) => page.names.map(name => [name, index + 1])));
const dbClass = new Map(oldLayout.pages.flatMap(page => page.nodes.map(node => [node.id, node.className])));
dbClass.set('clinical_intakes', 'ClinicalIntake');
const reachable = new Set();
function visit(id) {
    if (reachable.has(id) || !moduleMap.has(id)) return;
    reachable.add(id);
    moduleMap.get(id).imports.forEach(dependency => visit(dependency.source));
}
visit('src/App.jsx');
model.modules.forEach(module => module.navigationReachable = reachable.has(module.id));
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const pascal = value => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('');

const rules = [
    [/auth|login|register|registration|password|emailverification|forgotpassword|google/i, 'authentication'],
    [/prescription/i, 'prescriptions'],
    [/consent|signature/i, 'consent'],
    [/groom/i, 'grooming'],
    [/boarding|room|pethotel/i, 'boarding'],
    [/inventory|stock|allitems|newitem|expiry|disposal/i, 'inventory'],
    [/paymentmethod|posmanagement|visit_billing|invoice|currency/i, 'billing'],
    [/reports|reportcenter|reporttable|reportpreview|reportkpi|reportdate|reportchart|activity/i, 'reports'],
    [/backup/i, 'backups'],
    [/notification|todo|mail_|veterinarian_booking_todo/i, 'notifications'],
    [/online|video|jaas/i, 'online'],
    [/recordupdate|record_update|certificate|medical_record_item/i, 'records'],
    [/diagnos|clinical_record|clinical_confinement|medicalrecord|vetpets|clinicalrecord/i, 'diagnosis'],
    [/queue|clinical_intake|patientintake|self.service/i, 'examination'],
    [/booking|consultbooking|consultpayment|consultconfirmation|home_service_confirmation/i, 'booking'],
    [/branch|vetpresence|vet_presence|vetschedule|vet_schedule|vetonlineavailability|veterinarian.*schedule|clinicavailability|vetbooking/i, 'clinics'],
    [/media|upload|protectedimage|fileupload|imagepreview/i, 'media'],
    [/servicecatalog|service_catalog|specialservice|special_service|servicecontent|serviceprojection|servicepage/i, 'catalog'],
    [/petowneraccounts|pet_owner_accounts|account|profile|admin_feature/i, 'accounts'],
    [/pet|ownership|coparent/i, 'pets'],
];

function inferFeature(module) {
    if (module.feature) return module.feature;
    const explicit = rules.find(([expression]) => expression.test(module.name));
    if (explicit) return explicit[1];
    const counts = new Map();
    for (const dependency of module.imports || []) {
        const target = moduleMap.get(dependency.source);
        if (target?.kind === 'service' && target.feature !== 'foundation') counts.set(target.feature, (counts.get(target.feature) || 0) + 1);
    }
    return [...counts.entries()].sort((first, last) => last[1] - first[1])[0]?.[0] || 'foundation';
}
for (const module of model.modules) module.feature = inferFeature(module);
// A service's dispatcher evidence takes priority over a filename heuristic.
for (const backend of model.modules.filter(module => module.kind === 'backend')) {
    if (backend.name === 'index' || backend.name === 'db' || backend.name === 'role_access' || backend.name === 'workflow_guard_helpers') { backend.feature = 'foundation'; continue; }
    const callers = model.modules.filter(module => module.kind === 'service' && module.http.some(call => call.handlers.includes(backend.id)));
    if (callers.length) backend.feature = callers.find(module => module.name !== 'apiClient' && module.name !== 'uploadService')?.feature || callers[0].feature;
}

function rowsFor(module) {
    const rows = (module.properties || []).filter(property => property.type === 'state').slice(0, 3).map(property => '- ' + property.name + ': state');
    const operations = [...module.operations];
    if (module.kind === 'boundary') for (const operation of module.localFunctions || []) if (/^(handle|save|load|start|submit|print|receive|fetch)/i.test(operation.name) && !operations.some(item => item.name === operation.name)) operations.push(operation);
    rows.push(...operations.slice(0, 8).map(operation => '+ ' + operation.name + '()'));
    if (operations.length > 8) rows.push('+ ' + (operations.length - 8) + ' more operations [source index]');
    if (!rows.length) rows.push('HTTP script / module exports' + (module.properties?.length ? ': ' + module.properties.map(item => item.name).join(', ') : ''));
    return rows;
}

function moduleNode(module, reference = false) {
    const fullPage = module.diagramPage === undefined ? '' : ' / page ' + String(module.diagramPage).padStart(2, '0');
    return { id: module.id, name: module.kind === 'backend' ? pascal(module.name) : module.name,
        source: module.source, kind: module.kind, reference, layer: module.kind === 'boundary' ? 0 : module.kind === 'service' ? 1 : 2,
        subtitle: '«' + (module.kind === 'boundary' ? module.source.endsWith('.jsx') ? 'React component' : 'UI support module' : module.kind === 'service' ? 'JS service module' : 'PHP module') + '»' + (reference ? fullPage : '') + (module.kind === 'boundary' && !module.navigationReachable ? ' / source-only' : ''),
        rows: reference ? ['Definition' + fullPage] : rowsFor(module), operations: module.operations,
        sourceLine: module.operations[0]?.line || 1 };
}

function entityNode(table, full = false) {
    const page = dbPage.get(table.name);
    const keys = table.columns.filter(column => table.pk.includes(column.name)).map(column => '+ ' + column.name + ': ' + column.type + ' [PK]');
    const rows = full ? table.columns.map(column => {
        const type = column.type === 'longtext' && /json_valid/.test(column.definition) ? 'json' : column.type + (column.size && column.type !== 'enum' ? '(' + column.size + ')' : '');
        const marks = [table.pk.includes(column.name) ? 'PK' : '', table.fks.some(key => key.columns.includes(column.name)) ? 'FK' : '', table.unique.some(key => key.length === 1 && key[0] === column.name) ? 'UK' : ''].filter(Boolean);
        return '+ ' + column.name + ': ' + type + (column.nullable ? ' ?' : '') + (marks.length ? ' [' + marks.join(',') + ']' : '');
    }) : keys;
    rows.push(table.provenance === 'migration-only' ? 'Migration only; absent from SQL export' : 'Full SQL attributes / DB page ' + String(page).padStart(2, '0'));
    return { id: 'db:' + table.name, name: dbClass.get(table.name) || pascal(table.name), subtitle: '«entity» ' + table.name,
        source: table.provenance === 'migration-only' ? table.source : 'iPawcus_ERD_Schema.sql', sourceLine: table.line,
        kind: 'entity', layer: 3, reference: !full, rows, table: table.name, provenance: table.provenance };
}

const chunks = (values, size) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
const pages = [];
// Plan home pages first, so every dependency reference has a stable destination.
for (const feature of model.features) {
    const owned = model.modules.filter(module => module.feature === feature.id);
    const groups = [chunks(owned.filter(module => module.kind === 'boundary'), 7), chunks(owned.filter(module => module.kind === 'service'), 4), chunks(owned.filter(module => module.kind === 'backend'), 7)];
    const count = Math.max(1, ...groups.map(group => group.length));
    for (let index = 0; index < count; index++) {
        const selected = groups.flatMap(group => group[index] || []);
        const number = 11 + pages.length;
        selected.forEach(module => module.diagramPage = number);
        pages.push({ id: feature.id + (count > 1 ? '-' + (index + 1) : ''), feature: feature.id, title: feature.title + (count > 1 ? ' / ' + (index + 1) + ' of ' + count : ''), number, selected });
    }
}

const omittedInfra = new Set(['php/db.php', 'php/role_access.php', 'php/workflow_guard_helpers.php', 'php/staff_activity_helpers.php']);
const diagramDependencies = [];
for (const page of pages) {
    const nodes = new Map(page.selected.map(module => [module.id, moduleNode(module)]));
    const edges = new Map();
    const addModule = id => { if (!nodes.has(id) && moduleMap.has(id)) nodes.set(id, moduleNode(moduleMap.get(id), true)); };
    const edge = (source, target, text, evidence, kind = 'dependency') => {
        if (source === target || !nodes.has(source) || !nodes.has(target)) return;
        const key = source + ' -> ' + target + ' / ' + text;
        if (!edges.has(key)) edges.set(key, { source, target, text, evidence: [], kind });
        edges.get(key).evidence.push(evidence);
    };
    for (const module of page.selected) {
        for (const declaration of module.classes || []) {
            const id = module.id + '#' + declaration.name;
            const parentNode = nodes.get(module.id);
            nodes.set(id, { id, name: declaration.name, source: module.source, sourceLine: declaration.line, kind: 'class', subtitle: '«actual JavaScript class»', layer: parentNode.layer, rows: [...declaration.properties.map(property => '- ' + property.name), ...declaration.operations.map(operation => '+ ' + operation.name + '()')], reference: false, declaration });
            edge(module.id, id, 'declares', { file: module.source, line: declaration.line });
            if (declaration.extends) {
                const base = 'external:' + declaration.extends;
                if (!nodes.has(base)) nodes.set(base, { id: base, name: declaration.extends, source: 'External language / framework class', kind: 'external', subtitle: '«external class»', layer: parentNode.layer, rows: ['Base class referenced by source'], reference: true });
                edge(id, base, 'extends', { file: module.source, line: declaration.line }, 'inheritance');
            }
        }
        if (module.kind === 'boundary') for (const dependency of module.imports) {
            const target = moduleMap.get(dependency.source);
            if (target?.kind !== 'service') continue;
            addModule(target.id);
            edge(module.id, target.id, 'uses', { file: module.source, line: dependency.line, symbols: dependency.names });
        }
        if (module.kind === 'service') {
            for (const call of module.http) for (const handler of call.handlers) {
                if (!moduleMap.has(handler)) continue;
                addModule(handler);
                edge(module.id, handler, 'HTTP', { file: module.source, line: call.line, route: call.route, dispatcher: 'php/index.php', dispatcherLine: call.dispatcherLine });
            }
            for (const dependency of module.imports) {
                if (dependency.source === 'src/services/apiClient.js' && page.feature !== 'foundation') continue;
                if (moduleMap.get(dependency.source)?.kind !== 'service') continue;
                addModule(dependency.source);
                edge(module.id, dependency.source, 'uses', { file: module.source, line: dependency.line, symbols: dependency.names });
            }
        }
        if (module.kind === 'backend') {
            for (const dependency of module.imports) {
                // Dispatcher route targets are already documented by each
                // service's HTTP dependency and the complete route index.
                if (module.id === 'php/index.php' && model.routes.some(route => route.handlers.includes(dependency.source))) continue;
                if (omittedInfra.has(dependency.source) && page.feature !== 'foundation') continue;
                if (!moduleMap.has(dependency.source)) continue;
                addModule(dependency.source);
                edge(module.id, dependency.source, 'includes', { file: module.source, line: dependency.line });
            }
            for (const query of module.queries) {
                const table = tableMap.get(query.table);
                nodes.set('db:' + table.name, entityNode(table));
                edge(module.id, 'db:' + table.name, 'SQL', { file: module.source, line: query.line, clause: query.clause, table: query.table });
            }
        }
    }
    page.nodes = [...nodes.values()];
    page.edges = [...edges.values()].map((relation, index) => ({ ...relation, id: page.id + '-edge-' + index }));
    diagramDependencies.push(...page.edges.map(relation => ({ ...relation, page: page.number })));
    delete page.selected;
}

const families = [
    ['Identity', ['authentication', 'accounts'], ['identity']],
    ['Pets and ownership', ['pets'], ['pets']],
    ['Clinic booking', ['clinics', 'booking'], ['clinics', 'bookings']],
    ['Examination and diagnosis', ['examination', 'diagnosis', 'records', 'consent'], ['bookings', 'care']],
    ['Online consultation', ['online'], ['bookings', 'care']],
    ['Prescription and reminders', ['prescriptions', 'notifications'], ['prescriptions', 'operations']],
    ['Grooming and boarding', ['grooming', 'boarding'], ['care']],
    ['Clinic business', ['inventory', 'billing', 'catalog'], ['inventory', 'billing', 'clinics']],
    ['Oversight and media', ['reports', 'media', 'backups'], ['operations', 'billing']],
    ['Infrastructure', ['foundation'], ['identity', 'operations']],
];
const overview = { id: 'system-overview', title: 'System + database reference overview', number: 10, nodes: [], edges: [] };
const roleViews = [
    ['PetOwnerWorkspace', 'pet_owner', ['MyPets', 'ConsultBooking', 'MedicalRecords', 'Todos', 'PetOwnerProfile']],
    ['AdminWorkspace', 'admin', ['BookingManagement', 'PatientIntake', 'QueueManagement', 'POSmanagement', 'GroomingManagement']],
    ['VeterinarianWorkspace', 'veterinarian', ['VetMylistinService', 'VetDiagnosis', 'VetOnlineConsultDiagnosis', 'VetProfile']],
    ['SuperAdminWorkspace', 'super_admin', ['AccountManagement', 'SuperAdminReportsDashboard', 'SuperAdminReportCenter', 'PaymentMethodsManagement']],
];
for (const [name, role, screens] of roleViews) overview.nodes.push({ id: name, name, layer: 0, kind: 'role', subtitle: '«role view» ' + role, source: 'src/components/Dashboard.jsx', rows: screens, reference: false });
families.forEach(([name, featureIds, dbIds], index) => {
    const serviceFiles = model.modules.filter(module => module.kind === 'service' && featureIds.includes(module.feature));
    const backendFiles = model.modules.filter(module => module.kind === 'backend' && featureIds.includes(module.feature));
    const tables = [...new Set(oldLayout.pages.filter(page => dbIds.includes(page.id)).flatMap(page => page.names))];
    if (featureIds.includes('examination')) tables.push('clinical_intakes');
    for (const [layer, suffix, kind, members] of [[1, 'services', 'package', serviceFiles.map(module => module.name)], [2, 'backend', 'package', backendFiles.slice(0, 8).map(module => module.name)], [3, 'database', 'entity-package', tables.slice(0, 9)]]) {
        const rows = [...members];
        if (layer === 2 && backendFiles.length > 8) rows.push('+ ' + (backendFiles.length - 8) + ' modules on detail pages');
        if (layer === 3 && tables.length > 9) rows.push('+ ' + (tables.length - 9) + ' entities on DB pages');
        const detailPages = pages.filter(page => featureIds.includes(page.feature)).map(page => page.number);
        overview.nodes.push({ id: 'family-' + index + '-' + suffix, name, layer, kind, subtitle: layer === 1 ? '«service package»' : layer === 2 ? '«PHP package»' : '«database references»', source: layer === 3 ? 'SQL export / DB pages 01–09' : 'System pages ' + detailPages[0] + '–' + detailPages.at(-1), rows, reference: false, family: index });
    }
    overview.edges.push({ id: 'overview-http-' + index, source: 'family-' + index + '-services', target: 'family-' + index + '-backend', text: 'HTTP', kind: 'summary', evidence: [] });
    overview.edges.push({ id: 'overview-sql-' + index, source: 'family-' + index + '-backend', target: 'family-' + index + '-database', text: 'SQL', kind: 'summary', evidence: [] });
});
const roleFamilies = [[0, 1, 2, 4, 5, 6], [1, 2, 3, 6, 7], [2, 3, 4, 5], [0, 2, 7, 8]];
roleFamilies.forEach((items, role) => items.forEach(index => overview.edges.push({ id: 'role-' + role + '-' + index, source: roleViews[role][0], target: 'family-' + index + '-services', text: 'uses', kind: 'summary', evidence: [] })));

const additions = { id: 'schema-additions', title: 'Migration entity + application-only association', number: 11 + pages.length, nodes: [], edges: [] };
const intake = tableMap.get('clinical_intakes');
const intakeNode = entityNode(intake, true); intakeNode.layer = 0; additions.nodes.push(intakeNode);
for (const target of ['queues', 'bookings', 'pets_information', 'users']) { const node = entityNode(tableMap.get(target)); node.layer = 2; additions.nodes.push(node); }
intake.fks.forEach((fk, index) => additions.edges.push({ id: 'migration-fk-' + index, source: 'db:clinical_intakes', target: 'db:' + fk.table, text: [intake.pk, ...intake.unique].some(key => key.length && key.every(column => fk.columns.includes(column))) ? '0..1' : '0..*', endText: fk.columns.some(name => intake.columns.find(column => column.name === name).nullable) ? '0..1' : '1', kind: 'migration-fk', evidence: [{ file: intake.source, line: intake.line, constraint: fk.constraint, columns: fk.columns, references: fk.references }] }));
additions.edges.push({ id: 'application-vet-reference', source: 'db:bookings', target: 'db:users', text: 'vet ref', kind: 'application-association', evidence: [{ file: 'php/get_bookings.php', line: 146, field: 'bookings.veterinarian_id', targetField: 'users.user_id', note: 'Application JOIN, not a foreign key in the SQL export.' }] });
pages.unshift(overview);
pages.push(additions);

function wrap(text, limit = 56) {
    if (text.length <= limit) return [text];
    const rows = [];
    let rest = text;
    while (rest.length > limit) {
        let at = Math.max(rest.lastIndexOf(' ', limit), rest.lastIndexOf('_', limit));
        if (at < limit / 2) at = limit;
        else at += 1;
        rows.push(rest.slice(0, at));
        rest = '  ' + rest.slice(at).trimStart();
    }
    if (rest.trim()) rows.push(rest);
    return rows;
}

class Heap {
    constructor() { this.values = []; }
    push(value) {
        let at = this.values.length;
        this.values.push(value);
        while (at) { const parent = (at - 1) >> 1; if (this.values[parent][0] <= value[0]) break; this.values[at] = this.values[parent]; at = parent; }
        this.values[at] = value;
    }
    pop() {
        const result = this.values[0], last = this.values.pop();
        if (this.values.length) {
            let at = 0;
            while (at * 2 + 1 < this.values.length) {
                let child = at * 2 + 1;
                if (child + 1 < this.values.length && this.values[child + 1][0] < this.values[child][0]) child++;
                if (this.values[child][0] >= last[0]) break;
                this.values[at] = this.values[child]; at = child;
            }
            this.values[at] = last;
        }
        return result;
    }
    get length() { return this.values.length; }
}

const overlaps = (first, last) => first.x < last.x + last.w && first.x + first.w > last.x && first.y < last.y + last.h && first.y + first.h > last.y;
function hit(first, last, box, margin = 0) {
    const left = box.x - margin, right = box.x + box.w + margin, top = box.y - margin, bottom = box.y + box.h + margin;
    if (first.y === last.y) return first.y > top + 0.001 && first.y < bottom - 0.001 && Math.max(first.x, last.x) > left + 0.001 && Math.min(first.x, last.x) < right - 0.001;
    if (first.x === last.x) return first.x > left + 0.001 && first.x < right - 0.001 && Math.max(first.y, last.y) > top + 0.001 && Math.min(first.y, last.y) < bottom - 0.001;
    throw new Error('Non-orthogonal segment');
}
const simplify = points => points.filter((point, index) => {
    if (!index || index === points.length - 1) return true;
    const before = points[index - 1], after = points[index + 1];
    return !((before.x === point.x && point.x === after.x && (point.y - before.y) * (after.y - point.y) >= 0) || (before.y === point.y && point.y === after.y && (point.x - before.x) * (after.x - point.x) >= 0));
});

function layoutPage(page) {
    const byId = new Map(page.nodes.map(node => [node.id, node]));
    const widths = [420, 420, 440, 440];
    const xs = page.id === 'schema-additions' ? [80, 550, 860, 1560] : [80, 740, 1400, 2080];
    page.nodes.forEach(node => {
        node.rows = node.rows.flatMap(row => wrap(row, Math.floor((widths[node.layer] - 32) / 7)));
        node.nameRows = wrap(node.name, Math.floor((widths[node.layer] - 28) / 8.6));
        node.subtitleRows = wrap(node.subtitle, Math.floor((widths[node.layer] - 28) / 6));
        node.sourceRows = wrap(node.source + (node.sourceLine ? ':' + node.sourceLine : ''), Math.floor((widths[node.layer] - 28) / 7.5));
        node.header = 20 + node.nameRows.length * 19 + node.subtitleRows.length * 16;
        node.w = widths[node.layer];
        const ports = page.edges.filter(edge => edge.source === node.id || edge.target === node.id).length;
        node.h = Math.max(node.header + 14 + node.rows.length * 18 + node.sourceRows.length * 16 + 14, 48 + ports * 22);
    });
    for (let layer = 0; layer < 4; layer++) {
        let y = 170;
        page.nodes.filter(node => node.layer === layer).sort((first, last) => Number(first.reference) - Number(last.reference)).forEach(node => { node.x = xs[layer]; node.y = y; y += node.h + 58; });
    }
    if (page.id === 'system-overview') {
        let y = 170;
        for (let family = 0; family < families.length; family++) {
            const row = page.nodes.filter(node => node.family === family);
            row.forEach(node => node.y = y);
            y += Math.max(...row.map(node => node.h)) + 58;
        }
    }
    page.width = Math.max(...page.nodes.map(node => node.x + node.w)) + 80;
    page.height = Math.max(...page.nodes.map(node => node.y + node.h)) + 70;
    const dockGroups = new Map();
    for (const edge of page.edges) {
        const source = byId.get(edge.source), target = byId.get(edge.target);
        const right = source.x <= target.x;
        edge.sourceSide = right ? 'R' : 'L';
        edge.targetSide = source.x === target.x ? 'R' : right ? 'L' : 'R';
        for (const kind of ['start', 'end']) {
            const owner = kind === 'start' ? source : target;
            const side = kind === 'start' ? edge.sourceSide : edge.targetSide;
            const key = owner.id + ':' + side;
            if (!dockGroups.has(key)) dockGroups.set(key, []);
            dockGroups.get(key).push({ edge, kind, owner, side });
        }
    }
    for (const group of dockGroups.values()) group.forEach((dock, index) => {
        const endpoint = { x: dock.side === 'R' ? dock.owner.x + dock.owner.w : dock.owner.x, y: dock.owner.y + 40 + index * 22 };
        dock.edge[dock.kind] = endpoint;
        dock.edge[dock.kind + 'Anchor'] = { x: endpoint.x + (dock.side === 'R' ? 110 : -110), y: endpoint.y };
    });
    for (const edge of page.edges) {
        edge.labels = [['start', edge.text], ['end', edge.endText]].filter(([, text]) => text).map(([kind, text]) => {
            const endpoint = edge[kind], side = kind === 'start' ? edge.sourceSide : edge.targetSide, w = text.length * 7 + 2;
            return { text, endpoint: kind, owner: kind === 'start' ? edge.source : edge.target, x: side === 'R' ? endpoint.x + 12 : endpoint.x - 12 - w, y: endpoint.y - 16, w, h: 12, baselineOffset: 10, lineY: endpoint.y };
        });
    }
    // Right-side loops and endpoint anchors must also fit inside the canvas,
    // not only the class rectangles. This prevents clipped relationships.
    page.width = Math.max(page.width, ...page.edges.flatMap(edge => [edge.startAnchor.x + 30, edge.endAnchor.x + 30]));
    const captions = page.edges.flatMap(edge => edge.labels);
    const obstacles = [...page.nodes.map(node => ({ x: node.x - 22, y: node.y - 22, w: node.w + 44, h: node.h + 44 })), ...captions.map(label => ({ x: label.x - 3, y: label.y - 3, w: label.w + 6, h: label.h + 6 }))];
    const xGrid = [...new Set([30, page.width - 30, ...obstacles.flatMap(box => [box.x, box.x + box.w]), ...page.edges.flatMap(edge => [edge.startAnchor.x, edge.endAnchor.x])])].sort((a, b) => a - b);
    const yGrid = [...new Set([140, page.height - 30, ...obstacles.flatMap(box => [box.y, box.y + box.h]), ...page.edges.flatMap(edge => [edge.startAnchor.y, edge.endAnchor.y])])].sort((a, b) => a - b);
    const width = xGrid.length, height = yGrid.length;
    const xIndex = new Map(xGrid.map((value, index) => [value, index])), yIndex = new Map(yGrid.map((value, index) => [value, index]));
    const blocked = new Uint8Array(width * height);
    const neighbours = Array.from({ length: width * height }, () => []);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (obstacles.some(box => xGrid[x] > box.x + 0.001 && xGrid[x] < box.x + box.w - 0.001 && yGrid[y] > box.y + 0.001 && yGrid[y] < box.y + box.h - 0.001)) blocked[y * width + x] = 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (blocked[index]) continue;
        for (const [dx, dy, direction] of [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (blocked[next]) continue;
            const first = { x: xGrid[x], y: yGrid[y] }, last = { x: xGrid[nx], y: yGrid[ny] };
            if (obstacles.some(box => hit(first, last, box))) continue;
            neighbours[index].push({ next, direction, length: Math.abs(first.x - last.x) + Math.abs(first.y - last.y) });
        }
    }
    const used = new Map();
    for (const edge of page.edges) {
        const start = yIndex.get(edge.startAnchor.y) * width + xIndex.get(edge.startAnchor.x), goal = yIndex.get(edge.endAnchor.y) * width + xIndex.get(edge.endAnchor.x);
        const costs = new Float64Array(width * height * 4); costs.fill(Infinity);
        const previous = new Int32Array(width * height * 4); previous.fill(-1);
        const heap = new Heap();
        const heuristic = index => Math.abs(xGrid[index % width] - edge.endAnchor.x) + Math.abs(yGrid[Math.floor(index / width)] - edge.endAnchor.y);
        for (let direction = 0; direction < 4; direction++) { costs[start * 4 + direction] = 0; heap.push([heuristic(start), start * 4 + direction, 0]); }
        let found = -1;
        while (heap.length) {
            const [, state, cost] = heap.pop();
            if (costs[state] !== cost) continue;
            const index = Math.floor(state / 4), direction = state % 4;
            if (index === goal) { found = state; break; }
            for (const next of neighbours[index]) {
                if (index === start && next.direction === (edge.sourceSide === 'R' ? 1 : 0)) continue;
                if (next.next === goal && next.direction === (edge.targetSide === 'R' ? 0 : 1)) continue;
                const key = index < next.next ? index + ':' + next.next : next.next + ':' + index;
                const candidate = cost + next.length + (next.direction === direction ? 0 : 42) + (used.get(key) || 0) * 24;
                const nextState = next.next * 4 + next.direction;
                if (candidate < costs[nextState]) { costs[nextState] = candidate; previous[nextState] = state; heap.push([candidate + heuristic(next.next), nextState, candidate]); }
            }
        }
        if (found < 0) throw new Error('Cannot route ' + edge.id + ' / ' + page.title);
        const route = [];
        for (let state = found; state >= 0; state = previous[state]) route.push(Math.floor(state / 4));
        route.reverse();
        route.slice(1).forEach((index, offset) => { const before = route[offset], key = index < before ? index + ':' + before : before + ':' + index; used.set(key, (used.get(key) || 0) + 1); });
        edge.points = simplify([edge.start, ...route.map(index => ({ x: xGrid[index % width], y: yGrid[Math.floor(index / width)] })), edge.end]);
    }
    for (const [index, node] of page.nodes.entries()) if (page.nodes.slice(index + 1).some(other => overlaps(node, other))) throw new Error('Class overlap on ' + page.id);
    for (const [index, label] of captions.entries()) {
        if (label.y + label.h > label.lineY - 4) throw new Error('Caption is not above its line.');
        if (captions.slice(index + 1).some(other => overlaps(label, other))) throw new Error('Caption overlap on ' + page.id);
        if (page.nodes.some(node => overlaps(label, node))) throw new Error('Caption crosses a class.');
    }
    for (const edge of page.edges) {
        for (const label of edge.labels) {
            const index = label.endpoint === 'start' ? 0 : edge.points.length - 2;
            const first = edge.points[index], last = edge.points[index + 1];
            if (first.y !== last.y || first.y !== label.lineY || Math.min(first.x, last.x) > label.x || Math.max(first.x, last.x) < label.x + label.w) throw new Error('Caption is not over its own segment.');
        }
        for (let index = 1; index < edge.points.length; index++) {
            const first = edge.points[index - 1], last = edge.points[index];
            if (page.nodes.some(node => hit(first, last, node))) throw new Error('Relationship enters class on ' + page.id);
            if (captions.some(label => hit(first, last, label, 3))) throw new Error('Relationship touches text on ' + page.id);
        }
    }
    return page;
}

const palette = { ink: '#2d3748', muted: '#596579', line: '#8793a3', border: '#c4cbd4' };
function svg(page) {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="title desc">`, `<title id="title">iPawcus / ${esc(page.title)}</title>`, '<desc id="desc">Application modules and verified database references. Original SQL entity definitions are on pages 01 to 09. Dashed dependencies are not foreign keys.</desc>', `<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 4.5 L0 9" fill="none" stroke="${palette.line}" stroke-width="1.2"/></marker><marker id="inheritance" markerWidth="11" markerHeight="11" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="#ffffff" stroke="${palette.line}" stroke-width="1.2"/></marker></defs>`, '<rect width="100%" height="100%" fill="#ffffff"/>'];
    const text = (x, y, value, size = 12, mono = false, muted = false) => parts.push(`<text x="${x}" y="${y}" font-family="${mono ? 'Consolas,monospace' : 'Arial,sans-serif'}" font-size="${size}" fill="${muted ? palette.muted : palette.ink}">${esc(value)}</text>`);
    text(80, 44, 'iPawcus / ' + page.title, 25);
    text(80, 73, 'React / service / PHP / entity reference · arrows show source-code dependencies; no invented OO inheritance.', 14, false, true);
    text(80, 100, 'Dashed: dependency. Solid: migration FK or real class inheritance. Full source evidence accompanies detailed links.', 13, false, true);
    const headers = page.id === 'schema-additions' ? ['Migration-defined entity', '', 'Related SQL-export entities', ''] : ['UI and system views', 'JavaScript services', 'PHP backend modules', 'Database references'];
    headers.forEach((value, index) => { if (page.nodes.some(node => node.layer === index)) text(page.nodes.find(node => node.layer === index).x, 143, value, 14, false, true); });
    for (const edge of page.edges) parts.push(`<path d="${edge.points.map((point, index) => (index ? 'L' : 'M') + point.x + ' ' + point.y).join(' ')}" fill="none" stroke="${palette.line}" stroke-width="1.2"${['migration-fk', 'inheritance'].includes(edge.kind) ? '' : ' stroke-dasharray="5 4"'} marker-end="url(#${edge.kind === 'inheritance' ? 'inheritance' : 'arrow'})"><title>${esc(edge.source + ' → ' + edge.target + ' / ' + edge.text)}</title></path>`);
    for (const node of page.nodes) {
        parts.push(`<g data-node="${esc(node.id)}"><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" fill="${node.reference ? '#f8fafc' : '#ffffff'}" stroke="${palette.border}" stroke-width="1.2"${node.reference ? ' stroke-dasharray="5 4"' : ''}/><line x1="${node.x}" y1="${node.y + node.header}" x2="${node.x + node.w}" y2="${node.y + node.header}" stroke="${palette.border}"/>`);
        node.nameRows.forEach((value, index) => text(node.x + 14, node.y + 23 + index * 19, value, 16));
        node.subtitleRows.forEach((value, index) => text(node.x + 14, node.y + 23 + node.nameRows.length * 19 + index * 16, value, 11.5, false, true));
        node.rows.forEach((value, index) => text(node.x + 14, node.y + node.header + 23 + index * 18, value, 12, true));
        node.sourceRows.forEach((value, index) => text(node.x + 14, node.y + node.h - 12 - (node.sourceRows.length - 1 - index) * 16, value, 11.5, false, true));
        parts.push('</g>');
    }
    for (const edge of page.edges) for (const label of edge.labels) text(label.x, label.y + label.baselineOffset, label.text, 11.5, true, true);
    parts.push('</svg>'); return parts.join('\n');
}

function drawio(page) {
    const cells = [`<diagram id="system-${page.id}" name="${page.number} - ${esc(page.title)}"><mxGraphModel grid="1" gridSize="10" page="1" pageWidth="${page.width}" pageHeight="${page.height}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`, `<mxCell id="page-title" value="iPawcus / ${esc(page.title)}" style="text;html=0;align=left;fontSize=25;fontColor=${palette.ink};fillColor=none;strokeColor=none;" vertex="1" parent="1"><mxGeometry x="80" y="16" width="${page.width - 160}" height="40" as="geometry"/></mxCell>`, `<mxCell id="legend" value="React / services / PHP / DB references. Dashed links: source dependencies, NOT foreign keys. Solid: migration FK. Source locations and full method index accompany the diagram." style="text;html=0;align=left;fontSize=13;fontColor=${palette.muted};fillColor=none;strokeColor=none;" vertex="1" parent="1"><mxGeometry x="80" y="65" width="${page.width - 160}" height="50" as="geometry"/></mxCell>`];
    for (const node of page.nodes) {
        cells.push(`<object id="${esc(node.id)}" label="${esc([...node.nameRows, ...node.subtitleRows].join('\n'))}" tooltip="${esc(node.source + ':' + (node.sourceLine || 1))}"><mxCell style="swimlane;html=0;startSize=${node.header};align=left;spacingLeft=14;fontSize=15;fontColor=${palette.ink};fillColor=${node.reference ? '#f8fafc' : '#ffffff'};swimlaneFillColor=${node.reference ? '#f8fafc' : '#ffffff'};strokeColor=${palette.border};rounded=0;collapsible=0;${node.reference ? 'dashed=1;' : ''}" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" as="geometry"/></mxCell></object>`);
        node.rows.forEach((row, index) => cells.push(`<mxCell id="${esc(node.id)}-row-${index}" value="${esc(row)}" style="text;html=0;align=left;verticalAlign=middle;spacingLeft=14;fontFamily=Consolas;fontSize=12;fontColor=${palette.ink};fillColor=none;strokeColor=none;" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.header + 6 + index * 18}" width="${node.w}" height="18" as="geometry"/></mxCell>`));
        node.sourceRows.forEach((row, index) => cells.push(`<mxCell id="${esc(node.id)}-source-${index}" value="${esc(row)}" style="text;html=0;align=left;spacingLeft=14;fontSize=11.5;fontColor=${palette.muted};fillColor=none;strokeColor=none;" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.h - 27 - (node.sourceRows.length - 1 - index) * 16}" width="${node.w}" height="18" as="geometry"/></mxCell>`));
    }
    for (const edge of page.edges) {
        const source = page.nodes.find(node => node.id === edge.source), target = page.nodes.find(node => node.id === edge.target);
        const tooltip = edge.evidence.map(value => value.file + ':' + value.line + (value.route ? ' / ' + value.route : '')).join('\n') || 'Summary view; detailed dependencies are on the system module pages.';
        cells.push(`<object id="${edge.id}" label="" tooltip="${esc(tooltip)}"><mxCell style="edgeStyle=none;html=0;orthogonal=1;endArrow=${edge.kind === 'inheritance' ? 'block' : 'open'};endFill=0;endSize=8;strokeColor=${palette.line};strokeWidth=1.2;${['migration-fk', 'inheritance'].includes(edge.kind) ? '' : 'dashed=1;'}jumpStyle=arc;jumpSize=5;exitX=${edge.sourceSide === 'R' ? 1 : 0};exitY=${(edge.start.y - source.y) / source.h};exitPerimeter=0;entryX=${edge.targetSide === 'R' ? 1 : 0};entryY=${(edge.end.y - target.y) / target.h};entryPerimeter=0;" edge="1" parent="1" source="${esc(edge.source)}" target="${esc(edge.target)}"><mxGeometry relative="1" as="geometry"><Array as="points">${edge.points.slice(1, -1).map(point => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')}</Array></mxGeometry></mxCell></object>`);
        edge.labels.forEach((label, index) => { const endpoint = edge[label.endpoint]; cells.push(`<mxCell id="${edge.id}-label-${index}" value="${esc(label.text)}" style="edgeLabel;html=0;align=left;verticalAlign=middle;spacing=0;fontFamily=Consolas;fontSize=11.5;fontColor=${palette.muted};fillColor=none;strokeColor=none;resizable=0;" vertex="1" connectable="0" parent="${edge.id}"><mxGeometry x="${label.endpoint === 'start' ? -1 : 1}" y="0" width="${label.w}" height="${label.h}" relative="1" as="geometry"><mxPoint x="${label.x - endpoint.x}" y="${label.y - endpoint.y}" as="offset"/></mxGeometry></mxCell>`); });
    }
    cells.push('</root></mxGraphModel></diagram>'); return cells.join('\n');
}

export function buildSystemDiagrams() {
    for (const page of pages) { layoutPage(page); console.log('Routed ' + page.number + ' / ' + page.id + ': ' + page.nodes.length + ' boxes, ' + page.edges.length + ' links'); }
    const oldDrawio = fs.readFileSync(path.join(OUT, 'ipawcus-class-diagram.drawio'), 'utf8');
    // Open the new system overview first, while preserving the ten original
    // DB diagrams byte-for-byte inside the combined document.
    const combined = oldDrawio.replace(/(<mxfile[^>]*>)/, '$1\n' + drawio(pages[0])).replace(/\s*<\/mxfile>\s*$/, '\n' + pages.slice(1).map(drawio).join('\n') + '\n</mxfile>\n');
    fs.writeFileSync(path.join(OUT, 'ipawcus-system-and-database.drawio'), combined);
    for (const page of pages) fs.writeFileSync(path.join(OUT, page.number + '-' + page.id + '.svg'), svg(page) + '\n');
    const systemLayout = { title: 'iPawcus system and DB references', originalDbPages: 10, pages, statistics: { ...model.statistics, systemPages: pages.length, combinedPages: pages.length + 10, diagramModules: model.modules.length, systemDependencyLinks: pages.reduce((count, page) => count + page.edges.length, 0), boxIntersections: 0, labelLineIntersections: 0, labelLabelIntersections: 0 } };
    fs.writeFileSync(path.join(OUT, 'system-layout.json'), JSON.stringify(systemLayout, null, 2) + '\n');
    fs.writeFileSync(path.join(OUT, 'system-source-model.json'), JSON.stringify({ ...model, diagramDependencies }, null, 2) + '\n');
    writeSourceIndex(systemLayout);
    return systemLayout;
}

function writeSourceIndex(layout) {
    const sourceLink = (source, line = 1) => `[${source}:${line}](${model.sourceRoot}/${source}:${line})`;
    const md = ['# iPawcus system + database class reference', '', 'Open `ipawcus-system-and-database.drawio`. The first tab is the new system overview; the original ten database pages are retained unchanged.', '', '## Scope and meaning', '', `Static source coverage: ${model.statistics.boundaries} React/component modules, ${model.statistics.services} JavaScript service modules, ${model.statistics.backendModules} PHP modules, all ${model.statistics.schemaTables} SQL-export tables, and the migration-defined ClinicalIntake entity. There are ${layout.statistics.combinedPages} editable pages.`, '', '- This is a hybrid implementation class/module model. React function components, JavaScript modules, and procedural PHP handlers are marked by stereotypes; they are not falsely claimed to be object-oriented classes.', '- Literal JavaScript classes are shown separately, with only their real declared inheritance.', '- Original SQL entity pages contain every exported table and column. System pages use entity references to those definitions.', '- System dependency arrows mean `uses`, `HTTP`, `includes`, or `SQL`. They do not imply database foreign keys or UML multiplicities.', '- Each detailed relationship includes source-file and line evidence in its editable tooltip and in `system-source-model.json`.', '- The overview packages and role views summarize the implementation; their detailed modules are shown on the following system pages. Role views are not a replacement for backend authorization rules.', '- Component state names and operations come from source. Dense boxes show selected operations; the complete exported/PHP operation list is below, and React internal functions are retained in the JSON source index.', '- Components not reachable through imports from `src/App.jsx` are marked `source-only`. Their presence is not a claim of active navigation or a deployed working feature.', '- Database connection/configuration values, secrets, UI primitives, static assets, third-party libraries, and pure formatting utilities are not modeled as business classes.', '- Direct source imports and SQL literals are statically inspected. Dynamic SQL/table selection and runtime behavior still require application/runtime verification.', '- Shared `apiClient`, PDO/database access, role guards, workflow guards, and staff-activity includes are expanded on infrastructure pages and omitted from repeated feature-page connectors. The full import list is preserved in JSON.', '', '## Schema difference and application-only association', '', '- `clinical_intakes` is defined by `DDL/20261004_01_clinical_intakes.sql`, but is absent from the supplied SQL export. Its full fields and five migration foreign keys are on the final additions page. It is explicitly migration-only; no live DB change was made.', '- `bookings.veterinarian_id` is joined to `users.user_id` by `php/get_bookings.php:146`, despite having no FK in the exported schema. The additions page shows that relationship as a dashed application reference, not a made-up FK.', '- The supplied export remains the authority for the original 88 entity definitions. Existing-table column changes from other migrations are not silently merged into the exported entities.', '', '## Page index', '', '| Tab prefix | Content |', '| --- | --- |', ...oldLayout.pages.map((page, index) => `| ${String(index).padStart(2, '0')} | ${page.title} — original DB model |`), ...pages.map(page => `| ${page.number} | ${page.title} |`), '', '## Complete module and public-operation index', ''];
    for (const module of model.modules) {
        md.push(`### ${module.name} — ${module.kind}`, '', `Definition: ${sourceLink(module.source)} · diagram tab ${module.diagramPage}.`, '');
        for (const property of (module.properties || []).filter(property => property.type === 'state')) md.push(`- State: \`${property.name}\` — ${sourceLink(module.source, property.line)}`);
        for (const operation of module.operations) md.push(`- \`${operation.name}(${operation.parameters.join(', ')})\` — ${sourceLink(module.source, operation.line)}`);
        for (const declaration of module.classes || []) {
            md.push(`- Actual class: \`${declaration.name}\`${declaration.extends ? ' extends `' + declaration.extends + '`' : ''} — ${sourceLink(module.source, declaration.line)}`);
            for (const operation of declaration.operations) md.push(`  - \`${operation.name}(${operation.parameters.join(', ')})\` — ${sourceLink(module.source, operation.line)}`);
        }
        md.push('');
    }
    md.push('## HTTP dispatcher index', '', '| Route / pattern | PHP handler(s) | Dispatcher evidence |', '| --- | --- | --- |');
    for (const route of model.routes) md.push(`| \`${route.path.replaceAll('|', '\\|')}\` | ${route.handlers.map(handler => sourceLink(handler)).join(', ')} | ${sourceLink('php/index.php', route.line)} |`);
    fs.writeFileSync(path.join(OUT, 'SYSTEM-REFERENCE.md'), md.join('\n') + '\n');

    const alias = value => 'C_' + value.replace(/[^a-zA-Z0-9_]/g, '_');
    const mermaid = ['classDiagram', 'direction LR', '%% Complete source module operations; native draw.io pages provide collision-checked layout.'];
    for (const module of model.modules) {
        mermaid.push(`class ${alias(module.id)}["${module.name}"] {`, `    <<${module.kind}>>`);
        for (const property of (module.properties || []).filter(property => property.type === 'state')) mermaid.push(`    -state ${property.name}`);
        for (const operation of module.operations) mermaid.push(`    +${operation.name.replaceAll('.', '_')}()`);
        mermaid.push('}');
        for (const declaration of module.classes || []) {
            const id = alias(module.id + '#' + declaration.name);
            mermaid.push(`class ${id}["${declaration.name}"] {`, ...declaration.operations.map(operation => '    +' + operation.name + '()'), '}');
            if (declaration.extends) { const base = alias('external:' + declaration.extends); mermaid.push(`class ${base}["${declaration.extends}"]`, `${id} --|> ${base}`); }
        }
    }
    for (const table of model.tables) {
        mermaid.push(`class ${alias('db:' + table.name)}["${dbClass.get(table.name) || pascal(table.name)}"] {`, '    <<entity>>', ...table.columns.map(column => '    +' + column.type + ' ' + column.name), '}');
        for (const fk of table.fks) { const child = [table.pk, ...table.unique].some(key => key.length && key.every(column => fk.columns.includes(column))) ? '0..1' : '0..*'; const parent = fk.columns.some(name => table.columns.find(column => column.name === name)?.nullable) ? '0..1' : '1'; mermaid.push(`${alias('db:' + table.name)} "${child}" --> "${parent}" ${alias('db:' + fk.table)} : ${fk.columns.join('_and_')}`); }
    }
    const seen = new Set();
    for (const edge of diagramDependencies) {
        const key = edge.source + '|' + edge.target + '|' + edge.text;
        if (seen.has(key)) continue; seen.add(key);
        if (edge.kind === 'inheritance') continue;
        mermaid.push(`${alias(edge.source)} ..> ${alias(edge.target)} : ${edge.text}`);
    }
    mermaid.push(`${alias('db:bookings')} ..> ${alias('db:users')} : veterinarian_id_application_JOIN`);
    fs.writeFileSync(path.join(OUT, 'system-and-database-full.mmd'), mermaid.join('\n') + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildSystemDiagrams();
