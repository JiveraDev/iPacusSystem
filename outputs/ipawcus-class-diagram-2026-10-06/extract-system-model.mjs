// Static source evidence only: this does not call APIs or connect to MySQL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { spawnSync } from 'node:child_process';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(OUT, '../..');
const posix = value => value.replaceAll('\\', '/');
const relative = value => posix(path.relative(ROOT, value));
const read = value => fs.readFileSync(path.join(ROOT, value), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(OUT, 'schema-model.json'), 'utf8'));
const tableMap = new Map(schema.tables.map(table => [table.name, { ...table, provenance: 'sql-export' }]));

export const FEATURES = [
    ['foundation', 'System shell and API infrastructure', ['apiClient', 'addressAutocomplete', 'statusDisplayService', 'problemReportService']],
    ['authentication', 'Authentication and registration', ['userLogin', 'registerUser', 'authEmail', 'googleAuthService']],
    ['accounts', 'Accounts, profiles and access control', ['accountService', 'userService', 'profileService', 'adminFeatureAccessService']],
    ['clinics', 'Clinic assignments and vet availability', ['branchService', 'vetBookingScheduleService', 'vetScheduleService', 'vetPresenceService']],
    ['pets', 'Pets, ownership and catalog', ['petService', 'addPet', 'findPet', 'ConnectOwnership', 'petCatalogService']],
    ['booking', 'Bookings and shared clinic capacity', ['bookingService', 'bookingAvailabilityService']],
    ['examination', 'Queue, physical examination and handoff', ['queueService', 'selfServiceService', 'clinicalIntakeService']],
    ['diagnosis', 'Veterinarian diagnosis and medical records', ['vetDiagnosisService']],
    ['online', 'Online consultation and call diagnosis', ['onlineConsultationService']],
    ['prescriptions', 'Prescriptions, per-item schedules and printing', ['prescriptionService', 'prescriptionDocumentPdf']],
    ['records', 'Record requests and pet certificates', ['recordUpdateRequestService', 'petCertificateService']],
    ['consent', 'Consent templates, signatures and documents', ['consentFileService', 'consentRecordService', 'consentDocumentPdf']],
    ['grooming', 'Grooming operations', ['groomingService']],
    ['boarding', 'Boarding, rooms and monitoring', ['boardingService']],
    ['inventory', 'Inventory and stock movements', ['inventoryApi']],
    ['billing', 'Visits, POS and payment methods', ['visitBillingService', 'paymentMethodService']],
    ['catalog', 'Service catalog and special services', ['serviceCatalogService', 'specialServicesService']],
    ['notifications', 'Notifications, push, TODOs and reminders', ['notificationService', 'pushNotificationService', 'todoService']],
    ['reports', 'Reports, exports and activity history', ['reportService', 'staffActivityService']],
    ['media', 'Uploads and pet media monitoring', ['uploadService', 'petMediaMonitoringService']],
    ['backups', 'System backup management', ['systemBackupService']],
].map(([id, title, services]) => ({ id, title, services }));

function filesUnder(directory, extension) {
    return fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true }).flatMap(entry => {
        const name = posix(path.join(directory, entry.name));
        return entry.isDirectory() ? filesUnder(name, extension) : extension.test(name) ? [name] : [];
    }).sort();
}

// Supplemental entities are drawn from checked-in migrations, never inferred
// from column names. They are not claimed to exist in the deployed database.
for (const source of filesUnder('DDL', /\.sql$/)) {
    const code = read(source);
    const expression = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-z_][a-z0-9_]*)`?\s*\(([\s\S]*?)^\)\s*(?:ENGINE|;)/gim;
    for (const match of code.matchAll(expression)) {
        if (tableMap.has(match[1])) continue;
        const columns = [];
        const pk = [], unique = [];
        const fks = [];
        for (const raw of match[2].split('\n')) {
            const line = raw.trim().replace(/,$/, '');
            const column = line.match(/^`([^`]+)`\s+(\w+)(?:\(([^)]*)\))?/);
            if (column) columns.push({ name: column[1], type: column[2].toLowerCase(), size: column[3] || '', nullable: !/\bNOT NULL\b/i.test(line), definition: line });
            if (/^PRIMARY KEY/i.test(line)) pk.push(...[...line.matchAll(/`([^`]+)`/g)].map(value => value[1]));
            if (/^UNIQUE KEY/i.test(line)) unique.push([...line.match(/\(([^)]+)\)/)[1].matchAll(/`([^`]+)`/g)].map(value => value[1]));
            const fk = line.match(/^CONSTRAINT\s+`([^`]+)`\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+`([^`]+)`\s*\(([^)]+)\)/i);
            if (fk) fks.push({ constraint: fk[1], columns: [...fk[2].matchAll(/`([^`]+)`/g)].map(value => value[1]), table: fk[3], references: [...fk[4].matchAll(/`([^`]+)`/g)].map(value => value[1]) });
        }
        tableMap.set(match[1], { name: match[1], columns, pk, unique, fks, provenance: 'migration-only', source, line: code.slice(0, match.index).split('\n').length });
    }
}

function resolveImport(owner, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(ROOT, path.dirname(owner), specifier);
    const found = [base, base + '.js', base + '.jsx', path.join(base, 'index.js'), path.join(base, 'index.jsx')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    return found ? relative(found) : null;
}

function walk(node, visitor, parent = null) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(item => walk(item, visitor, parent)); return; }
    if (node.type) visitor(node, parent);
    for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end', 'comments', 'tokens', 'extra'].includes(key)) walk(value, visitor, node);
}

function jsModule(source) {
    const code = read(source);
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
    const imports = [], operations = [], localFunctions = [], literals = [], properties = [], classes = [];
    const bindings = new Map();
    const parameter = node => node?.type === 'Identifier' ? node.name : node?.type === 'AssignmentPattern' ? parameter(node.left) : node?.type === 'ObjectPattern' ? '{…}' : '…';
    const describe = (name, declaration) => ({ name, parameters: (declaration.params || []).map(parameter), line: declaration.loc.start.line });
    walk(ast, node => {
        if (node.type === 'ImportDeclaration') imports.push({ source: resolveImport(source, node.source.value), external: node.source.value, names: node.specifiers.map(item => item.imported?.name || item.local.name), line: node.loc.start.line });
        if ((node.type === 'CallExpression' && node.callee.type === 'Import') && node.arguments[0]?.type === 'StringLiteral') imports.push({ source: resolveImport(source, node.arguments[0].value), external: node.arguments[0].value, names: ['default'], line: node.loc.start.line, lazy: true });
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') bindings.set(node.id.name, node.init);
        if (node.type === 'VariableDeclarator' && node.id.type === 'ArrayPattern' && node.init?.type === 'CallExpression' && node.init.callee.name === 'useState') {
            const state = node.id.elements[0];
            if (state?.type === 'Identifier') properties.push({ name: state.name, type: 'state', line: node.loc.start.line });
        }
        if (node.type === 'FunctionDeclaration') localFunctions.push(describe(node.id?.name || 'default', node));
        if (node.type === 'ClassDeclaration') classes.push({ name: node.id.name, extends: node.superClass ? code.slice(node.superClass.start, node.superClass.end) : null, line: node.loc.start.line, operations: node.body.body.filter(member => member.type === 'ClassMethod').map(member => describe(member.key.name, member)), properties: node.body.body.filter(member => member.type === 'ClassProperty').map(member => ({ name: member.key.name, line: member.loc.start.line })) });
        if (node.type === 'VariableDeclarator' && ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init?.type)) localFunctions.push(describe(node.id.name, node.init));
        if (node.type === 'StringLiteral' && node.value.startsWith('/')) literals.push({ route: node.value.split('?')[0], line: node.loc.start.line, kind: 'route-literal' });
        if (node.type === 'TemplateLiteral' && node.quasis[0]?.value.cooked?.startsWith('/')) {
            let route = node.quasis.map((part, index) => part.value.cooked + (index < node.expressions.length ? `{${parameter(node.expressions[index])}}` : '')).join('');
            route = route.split('?')[0].replace(/\{[^}]+\}$/, value => route.includes('/' + value) ? value : '');
            literals.push({ route, line: node.loc.start.line, kind: 'route-template' });
        }
    });
    for (const statement of ast.program.body) {
        if (statement.type === 'ExportNamedDeclaration') {
            const declaration = statement.declaration;
            if (declaration?.type === 'FunctionDeclaration') operations.push(describe(declaration.id.name, declaration));
            if (declaration?.type === 'VariableDeclaration') for (const item of declaration.declarations) {
                if (['ArrowFunctionExpression', 'FunctionExpression'].includes(item.init?.type)) operations.push(describe(item.id.name, item.init));
                else if (item.init?.type === 'ObjectExpression') for (const property of item.init.properties) {
                    if (property.type === 'ObjectMethod') operations.push(describe(item.id.name + '.' + property.key.name, property));
                    else if (['ArrowFunctionExpression', 'FunctionExpression'].includes(property.value?.type)) operations.push(describe(item.id.name + '.' + property.key.name, property.value));
                }
                else properties.push({ name: item.id.name, line: item.loc.start.line });
            }
            for (const specifier of statement.specifiers || []) {
                const name = specifier.local.name;
                const operation = localFunctions.find(item => item.name === name);
                if (operation && !operations.some(item => item.name === name)) operations.push(operation);
            }
        }
        if (statement.type === 'ExportDefaultDeclaration') {
            const declaration = statement.declaration;
            const name = declaration.id?.name || (declaration.type === 'Identifier' ? declaration.name : path.basename(source, path.extname(source)));
            const operation = localFunctions.find(item => item.name === name);
            if (operation) operations.push(operation);
            else if (['FunctionDeclaration', 'ArrowFunctionExpression'].includes(declaration.type)) operations.push(describe(name, declaration));
        }
    }
    return { id: source, source, name: path.basename(source, path.extname(source)), kind: source.startsWith('src/services/') ? 'service' : 'boundary', imports, operations, localFunctions, properties, classes, routes: literals };
}

function phpModule(source) {
    const code = read(source);
    const functions = [...code.matchAll(/\bfunction\s+([a-z_][a-z0-9_]*)\s*\(/gi)].map(match => ({ name: match[1], parameters: [], line: code.slice(0, match.index).split('\n').length }));
    const imports = [...code.matchAll(/\b(?:require|include)(?:_once)?\s+__DIR__\s*\.\s*['"]\/([^'"]+\.php)['"]/g)].map(match => ({ source: 'php/' + match[1], line: code.slice(0, match.index).split('\n').length }));
    const queries = [...code.matchAll(/\b(FROM|JOIN|UPDATE|INTO|TABLE(?:\s+IF\s+(?:NOT\s+)?EXISTS)?)\s+`?([a-z_][a-z0-9_]*)`?/gi)].filter(match => tableMap.has(match[2])).map(match => ({ table: match[2], clause: match[1].toUpperCase(), line: code.slice(0, match.index).split('\n').length }));
    return { id: source, source, name: path.basename(source, '.php'), kind: 'backend', operations: functions, imports, queries };
}

function routesFromDispatcher() {
    const code = read('php/index.php');
    const routes = [];
    let pending = [], handlers = [];
    for (const [index, line] of code.split('\n').entries()) {
        const match = line.match(/case\s+'([^']+)'\s*:/);
        if (match) pending.push({ path: match[1], line: index + 1 });
        const handler = line.match(/require_once __DIR__\s*\.\s*'\/([^']+\.php)'/);
        if (handler && pending.length) handlers.push('php/' + handler[1]);
        if (/\bbreak;/.test(line)) { for (const route of pending) routes.push({ ...route, handlers: [...new Set(handlers)] }); pending = []; handlers = []; }
    }
    const dynamic = /(?:if|elseif)\s*\(preg_match\('([^']+)'\s*,\s*\$path[\s\S]*?(?=\}\s*elseif|\}\s*else\s*\{|$)/g;
    for (const match of code.matchAll(dynamic)) {
        const pattern = match[1];
        const targets = [...match[0].matchAll(/require_once __DIR__\s*\.\s*'\/([^']+\.php)'/g)].map(item => 'php/' + item[1]);
        const route = pattern.slice(1, -1).replace(/^\^|\$$/g, '').replaceAll('\\/', '/').replace(/\([^)]*\)/g, '{id}');
        routes.push({ path: route, regex: pattern.slice(1, -1), line: code.slice(0, match.index).split('\n').length, handlers: [...new Set(targets)] });
    }
    return routes;
}

export function extractSystemModel() {
    const services = filesUnder('src/services', /\.js$/).map(jsModule);
    const boundaries = [...filesUnder('src/components', /\.(?:jsx|js)$/), ...filesUnder('src/context', /\.jsx$/), 'src/App.jsx'].filter(source => !/\.test\.|\/figma\//.test(source)).map(jsModule);
    const backendFiles = filesUnder('php', /\.php$/).filter(source => !/\/(?:config|test[^/]*)\.php$/.test(source));
    const inspected = spawnSync('php', [path.join(OUT, 'extract-system-php.php')], { input: JSON.stringify({ root: ROOT, files: backendFiles, tables: [...tableMap.keys()] }), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (inspected.status !== 0) throw new Error('PHP static token inspection failed: ' + inspected.stderr);
    const symbols = JSON.parse(inspected.stdout);
    const backends = backendFiles.map(source => ({ ...phpModule(source), ...symbols[source] }));
    const routes = routesFromDispatcher();
    const unresolvedRoutes = [];
    for (const service of services) {
        service.feature = FEATURES.find(feature => feature.services.includes(service.name))?.id;
        if (!service.feature) throw new Error('Unassigned service ' + service.source);
        service.http = [];
        for (const literal of service.routes) {
            const sample = literal.route.replace(/\{[^}]+\}/g, '1');
            const matches = routes.filter(route => route.regex ? new RegExp(route.regex).test(sample) : route.path === sample);
            if (matches.length) for (const route of matches) service.http.push({ route: literal.route, handlers: route.handlers, line: literal.line, dispatcherLine: route.line });
            else if (!/^\/(?:dashboard|$)|^\/https?:/.test(literal.route)) unresolvedRoutes.push({ source: service.source, ...literal });
        }
    }
    const modules = [...boundaries, ...services, ...backends];
    return { sourceRoot: posix(ROOT), date: '2026-10-06', basis: 'Static React, JavaScript and PHP source plus supplied SQL export and supplemental DDL. Not a live database audit.', features: FEATURES, modules, routes, tables: [...tableMap.values()], unresolvedRoutes, statistics: { services: services.length, boundaries: boundaries.length, backendModules: backends.length, exportedServiceOperations: services.reduce((count, item) => count + item.operations.length, 0), schemaTables: schema.tables.length, supplementalTables: [...tableMap.values()].filter(table => table.provenance !== 'sql-export').length, dispatcherRoutes: routes.length } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const model = extractSystemModel();
    fs.writeFileSync(path.join(OUT, 'system-source-model.json'), JSON.stringify(model, null, 2) + '\n');
    console.log(JSON.stringify({ ...model.statistics, supplemental: model.tables.filter(table => table.provenance !== 'sql-export').map(table => table.name), unmatchedServiceRoutes: model.unresolvedRoutes }, null, 2));
}
