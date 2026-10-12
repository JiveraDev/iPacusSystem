// Produces documentation artifacts only. No app code or database changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classes, relations, core, coreFields, groups, source } from './domain-model.mjs';
import { layoutPage } from './domain-layout.mjs';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const classMap = new Map(classes.map(item => [item.id, item]));
const homePage = new Map(groups.flatMap((group, index) => group.names.map(name => [name, index + 2])));
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const ink = '#202020', stroke = '#767676', line = '#858585';
function node(id, overview = false, reference = false) {
    const definition = classMap.get(id);
    const attributes = reference ? definition.attributes.filter(attribute => definition.table?.pk.includes(attribute.sqlName))
        : overview && coreFields[id] ? definition.attributes.filter(attribute => coreFields[id].includes(attribute.sqlName)) : definition.attributes;
    return { id, name: definition.name, attrs: attributes.map(attribute => '+ ' + attribute.name + ': ' + attribute.type + (attribute.nullable ? '?' : '')),
        methods: reference ? [] : definition.operations.map(operation => operation.signature),
        columns: attributes.map(attribute => attribute.sqlName), reference, homePage: homePage.get(id),
        migrationOnly: definition.migrationOnly, legacy: definition.legacy, stateless: !!definition.stateless };
}
function page(id, title, names, overview = false, columns = 3, number = 0) {
    const selected = new Set(names);
    const edges = relations.filter(edge => selected.has(edge.source) && (!overview || selected.has(edge.target)));
    const referenced = [...new Set(edges.map(edge => edge.target).filter(target => !selected.has(target)))].sort();
    return { id, title, names, overview, columns, number,
        nodes: [...names.map(name => node(name, overview)), ...referenced.map(name => node(name, false, true))],
        edges: edges.map((edge, index) => ({ ...edge, modelId: edge.id, id: id + '-edge-' + index })) };
}
const pages = [page('system-class-diagram', 'System Class Diagram', core, true, 5),
    page('complete-domain-model', 'Complete Domain Model', classes.map(item => item.id), false, 7, 1),
    ...groups.map((group, index) => page('domain-' + group.id, group.title.replace(/entities|schema/gi, 'classes'), group.names, false, 3, index + 2)),
];

function svg(page) {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="title desc">`,
        `<title id="title">iPawcus — ${esc(page.title)}</title>`,
        '<desc id="desc">Domain UML class diagram: names, typed attributes, operations, and relationships. Every label is above its own relationship line near the class. Lines avoid all class boxes. Supporting pages include the complete domain model.</desc>',
        `<defs><marker id="dependency" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 4.5 L0 9" fill="none" stroke="${line}" stroke-width="1.1"/></marker></defs>`, '<rect width="100%" height="100%" fill="#ffffff"/>'];
    const text = (x, y, value, size = 12, options = '') => parts.push(`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${ink}" ${options}>${esc(value)}</text>`);
    text(90, 40, 'iPawcus — ' + page.title, 25);
    text(90, 68, 'Classes show attributes and operations. Solid: association · dashed: logical association · dashed arrow: dependency.', 13);
    text(90, 91, page.overview ? 'Core system objects; all classes and attributes are included on the complete-model and detail sheets.' : '1 required · 0..1 optional · 0..* zero-to-many · ? nullable · source and operation mappings in DOMAIN-REFERENCE.md.', 12);
    for (const edge of page.edges) {
        const dashed = edge.kind === 'application-association' ? ' stroke-dasharray="8 4"' : edge.kind === 'dependency' ? ' stroke-dasharray="4 4" marker-end="url(#dependency)"' : '';
        parts.push(`<path d="${edge.points.map((point, index) => (index ? 'L' : 'M') + point.x + ' ' + point.y).join(' ')}" fill="none" stroke="${line}" stroke-width="1.1"${dashed}><title>${esc(edge.source + '.' + edge.columns.join(',') + ' → ' + edge.target + '.' + edge.references.join(',') + ' / ' + (edge.evidence.constraint || edge.evidence.note || edge.kind))}</title></path>`);
    }
    for (const item of page.nodes) {
        parts.push(`<g data-class="${esc(item.id)}"><title>${esc(item.name + (item.reference ? ' / full definition on sheet ' + item.homePage : '') + (item.migrationOnly ? ' / migration-defined; absent from supplied SQL export' : '') + (item.legacy ? ' / legacy data; not used for current onsite scheduling' : ''))}</title>`);
        parts.push(`<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="#ffffff" stroke="${stroke}" stroke-width="1.2"/>`);
        for (const offset of [item.header, item.methodY]) parts.push(`<line x1="${item.x}" y1="${item.y + offset}" x2="${item.x + item.w}" y2="${item.y + offset}" stroke="${stroke}" stroke-width="1"/>`);
        text(item.x + item.w / 2, item.y + 20, item.name, 14, 'text-anchor="middle" font-weight="600"');
        item.attrs.forEach((row, index) => text(item.x + 12, item.y + item.header + 17 + index * 16, row));
        item.methods.forEach((row, index) => text(item.x + 12, item.y + item.methodY + 17 + index * 16, row));
        parts.push('</g>');
    }
    for (const edge of page.edges) for (const label of edge.labels) parts.push(`<text x="${label.x}" y="${label.y + label.baselineOffset}" font-family="Consolas,monospace" font-size="11.5" fill="${ink}" data-relationship="${edge.id}" data-endpoint="${label.endpoint}">${esc(label.text)}</text>`);
    parts.push('</svg>'); return parts.join('\n') + '\n';
}
function drawio(page) {
    const elements = [`<diagram id="${page.id}" name="${String(page.number).padStart(2, '0')} - ${esc(page.title)}"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" page="1" pageWidth="${page.width}" pageHeight="${page.height}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`];
    elements.push(`<mxCell id="page-title" value="iPawcus — ${esc(page.title)}" style="text;html=0;align=left;fontSize=25;strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="90" y="16" width="${page.width - 180}" height="35" as="geometry"/></mxCell>`);
    elements.push(`<mxCell id="page-legend" value="Names · attributes · operations. Solid: association; dashed: logical association; dashed arrow: dependency. 1 required; 0..1 optional; 0..* zero-to-many; ? nullable. ${page.overview ? 'Core view; see complete-model and detail sheets.' : 'Source and behavior mappings: DOMAIN-REFERENCE.md.'}" style="text;html=0;align=left;fontSize=12;strokeColor=none;fillColor=none;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="90" y="55" width="${page.width - 180}" height="45" as="geometry"/></mxCell>`);
    for (const item of page.nodes) {
        const definition = classMap.get(item.id);
        const tooltip = [item.name, definition.table ? 'SQL mapping: ' + item.id : 'Stateless domain responsibility; no DB table.',
            item.reference ? 'Reference: full definition on sheet ' + item.homePage : '',
            item.migrationOnly ? 'Defined by DDL/20261004_01_clinical_intakes.sql; absent from supplied export.' : '',
            item.legacy ? 'Legacy data class, not used for current onsite booking scheduling.' : '',
            ...definition.operations.map(operation => operation.signature + ' → ' + operation.evidence.file + ':' + operation.evidence.line + (operation.note ? ' / ' + operation.note : ''))].filter(Boolean).join('\n');
        elements.push(`<object id="${esc(item.id)}" label="${esc(item.name)}" tooltip="${esc(tooltip)}"><mxCell style="swimlane;html=0;startSize=${item.header};horizontal=1;align=center;verticalAlign=middle;fontSize=14;fontStyle=1;fontColor=${ink};fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=${stroke};strokeWidth=1.2;rounded=0;collapsible=0;" vertex="1" parent="1"><mxGeometry x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" as="geometry"/></mxCell></object>`);
        const bodyStyle = `text;html=0;whiteSpace=nowrap;align=left;verticalAlign=middle;spacingLeft=12;fontFamily=Arial;fontSize=12;fontColor=${ink};strokeColor=none;fillColor=none;`;
        item.attrs.forEach((row, index) => elements.push(`<mxCell id="${esc(item.id)}-attribute-${index}" value="${esc(row)}" style="${bodyStyle}" vertex="1" parent="${esc(item.id)}"><mxGeometry y="${item.header + 3 + index * 16}" width="${item.w}" height="16" as="geometry"/></mxCell>`));
        elements.push(`<mxCell id="${esc(item.id)}-method-divider" style="line;strokeColor=${stroke};strokeWidth=1;" vertex="1" parent="${esc(item.id)}"><mxGeometry y="${item.methodY}" width="${item.w}" height="0" as="geometry"/></mxCell>`);
        item.methods.forEach((row, index) => elements.push(`<mxCell id="${esc(item.id)}-operation-${index}" value="${esc(row)}" style="${bodyStyle}" vertex="1" parent="${esc(item.id)}"><mxGeometry y="${item.methodY + 3 + index * 16}" width="${item.w}" height="16" as="geometry"/></mxCell>`));
    }
    for (const edge of page.edges) {
        const start = page.nodes.find(item => item.id === edge.source), end = page.nodes.find(item => item.id === edge.target);
        const tooltip = edge.source + '.' + edge.columns.join(',') + ' → ' + edge.target + '.' + edge.references.join(',') + '\n' + edge.evidence.file + ':' + edge.evidence.line + '\n' + (edge.evidence.constraint || edge.evidence.note || 'Domain dependency');
        elements.push(`<object id="${edge.id}" label="" tooltip="${esc(tooltip)}"><mxCell style="edgeStyle=none;html=0;orthogonal=1;endArrow=${edge.kind === 'dependency' ? 'open' : 'none'};endFill=0;endSize=8;strokeColor=${line};strokeWidth=1.1;${edge.kind === 'association' ? '' : 'dashed=1;dashPattern=' + (edge.kind === 'dependency' ? '4 4;' : '8 4;')}jumpStyle=arc;jumpSize=5;exitX=${edge.sourceSide === 'R' ? 1 : 0};exitY=${(edge.start.y - start.y) / start.h};exitPerimeter=0;entryX=${edge.targetSide === 'R' ? 1 : 0};entryY=${(edge.end.y - end.y) / end.h};entryPerimeter=0;" edge="1" parent="1" source="${esc(edge.source)}" target="${esc(edge.target)}"><mxGeometry relative="1" as="geometry"><Array as="points">${edge.points.slice(1, -1).map(point => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')}</Array></mxGeometry></mxCell></object>`);
        edge.labels.forEach((label, index) => { const endpoint = edge[label.endpoint]; elements.push(`<mxCell id="${edge.id}-label-${index}" value="${esc(label.text)}" style="edgeLabel;html=0;align=left;verticalAlign=middle;spacing=0;fontFamily=Consolas;fontSize=11.5;fontColor=${ink};strokeColor=none;fillColor=none;resizable=0;" vertex="1" connectable="0" parent="${edge.id}"><mxGeometry x="${label.endpoint === 'start' ? -1 : 1}" y="0" width="${label.w}" height="${label.h}" relative="1" as="geometry"><mxPoint x="${label.x - endpoint.x}" y="${label.y - endpoint.y}" as="offset"/></mxGeometry></mxCell>`); });
    }
    elements.push('</root></mxGraphModel></diagram>'); return elements.join('\n');
}

function reference(layout) {
    const link = evidence => `[${evidence.file}:${evidence.line}](${/^[A-Z]:\//i.test(evidence.file) ? evidence.file : source.sourceRoot + '/' + evidence.file}:${evidence.line})`;
    const md = ['# iPawcus domain UML class diagram', '',
        'Open `ipawcus-system-class-diagram.drawio`. The first sheet follows the supplied reference: three-part class boxes with typed attributes, domain operations, and relationships.', '',
        'This replaces the architecture-style interpretation with a conceptual software class model. It is not a table-only ERD, screen diagram, or claim that every class is literally declared in the procedural PHP/functional React implementation.', '',
        `Coverage: ${classes.length} domain classes — all ${source.tables.length} persistent classes (${source.tables.filter(table => !table.provenance || table.provenance === 'sql-export').length} from the export plus PhysicalExamination from the current migration), and 2 stateless domain responsibilities. ${source.tables.reduce((sum, table) => sum + table.columns.length, 0)} persistent attributes; ${classes.reduce((sum, item) => sum + item.operations.length, 0)} source-backed operations.`, '',
        '## What the model means', '',
        '- Every object has a name, attributes compartment, and operations compartment. Empty compartments are intentional where there is no state or verified operation.',
        '- Attributes are readable camelCase aliases of the supplied SQL fields. Complete exact mappings, original types, nullable flags, enums, and keys are retained in `domain-model.json`.',
        '- Operation names describe domain responsibilities. Source references below identify their actual functions or observed queries; conceptual names do not assert literal object methods.',
        '- Solid lines are associations backed by declared foreign keys. Multiplicities follow nullability and uniqueness; a parent is not required by SQL to have any children.',
        '- Dashed lines without arrows are verified logical references absent from the export\'s FK definitions (assigned booking vet, consent context, and prescription source). They are not asserted database constraints. Prescription source links are conditional: `source_type` selects either clinic diagnosis or online diagnosis, so each alternative has `0..1` at its source-record end.',
        '- Dashed arrows mean domain service dependencies, labeled separately with `uses`, not multiplicities.',
        '- The main sheet shows core objects with selected attributes. The complete-model sheet contains every class and persistent attribute. Nine domain detail sheets repeat full owned classes and short references.',
        '- Reference boxes are the same class, not additional objects. Editable tooltips identify their full definition sheet.',
        '- `PhysicalExamination` maps to `clinical_intakes`, which is missing from the supplied SQL export but defined by the current migration. No database or supplied SQL change was made.',
        '- Legacy veterinarian working-hours, time-off, and clinic-visit records are retained for schema completeness, not represented as the current onsite scheduling policy.', '',
        '## Current workflows represented', '',
        '- Administration: starts a physical examination for booking/queue patients, saves signs and vital findings, uploads evidence, captures consent, and can reassign the veterinarian. Recorded-by and assigned-vet associations remain distinct.',
        '- Veterinarian: records/finalizes diagnosis, adds additional consent, and prints a prescription when it has content. Physical examination provenance is linked through the shared queue.',
        '- Onsite booking: clinic assignments, per-clinic acceptance, branch hours, existing reservations, and veterinarian capacity are represented by BookingScheduler and associated objects. OnlineVetSchedule remains separate.',
        '- Prescriptions: each pet has versioned plans, individually startable/updatable medicine items, and dated occurrences with completion state. OnlineDiagnosis also issues a prescription plan.',
        '- ConsentRecord keeps owner, patient, queue/booking/visit context, template, signature document, and processing staff.',
        '- ReportGenerator represents dashboard/report behavior without inventing a database table. Grooming, boarding, inventory, billing, ownership, authentication, and notifications are included on the complete/detail sheets.', '',
        '## Sheets', '', '| Sheet | Content |', '| --- | --- |', ...pages.map(page => `| ${String(page.number).padStart(2, '0')} | ${page.title} — ${page.names.length} classes${page.overview ? ', selected attributes' : ''} |`), '',
        '## Object responsibilities and implementation evidence', ''];
    for (const item of classes) {
        md.push('### ' + item.name, '', item.table ? `Persistent mapping: \`${item.id}\`. Definition sheet ${homePage.get(item.id)}. ${item.migrationOnly ? 'Migration only; absent from supplied export.' : ''} ${item.legacy ? 'Legacy scheduling data only.' : ''}` : 'Stateless domain service; no persistent table or invented fields.', '');
        for (const operation of item.operations) md.push(`- \`${operation.name}()\` — ${link(operation.evidence)}${operation.evidence.operation ? ' (`' + operation.evidence.operation + '`)' : ''}${operation.note ? ': ' + operation.note : ''}`);
        if (!item.operations.length) md.push('No distinct operation is asserted; this object is supporting persistent state.');
        md.push('');
    }
    md.push('## Associations and dependencies', '', '| Object / fields | Related object / fields | End multiplicities | Evidence |', '| --- | --- | --- | --- |');
    for (const edge of relations) md.push(`| ${classMap.get(edge.source).name}.${edge.columns.join(',')} | ${classMap.get(edge.target).name}.${edge.references.join(',')} | ${edge.kind === 'dependency' ? 'uses' : edge.sourceText + ' / ' + edge.targetText} | ${edge.evidence.constraint || edge.evidence.note || 'Domain dependency'}; ${link(edge.evidence)} |`);
    fs.writeFileSync(path.join(OUT, 'DOMAIN-REFERENCE.md'), md.join('\n') + '\n');
    const mermaid = ['classDiagram', 'direction LR', '%% Conceptual domain classes; generated from verified SQL and system responsibilities.'];
    for (const item of classes) {
        mermaid.push('class ' + item.name + ' {');
        for (const attribute of item.attributes) mermaid.push('    +' + attribute.type + ' ' + attribute.name);
        for (const operation of item.operations) mermaid.push('    +' + operation.name + '()');
        mermaid.push('}');
    }
    for (const edge of relations) mermaid.push(edge.kind === 'dependency'
        ? classMap.get(edge.source).name + ' ..> ' + classMap.get(edge.target).name + ' : uses'
        : classMap.get(edge.source).name + ' "' + edge.sourceText + '" ' + (edge.kind === 'application-association' ? '..' : '--') + ' "' + edge.targetText + '" ' + classMap.get(edge.target).name + ' : ' + edge.columns.join('_and_'));
    fs.writeFileSync(path.join(OUT, 'system-domain-classes.mmd'), mermaid.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'domain-model.json'), JSON.stringify({ basis: { sql: 'C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql', sourceRoot: source.sourceRoot, date: source.date, semantics: 'Conceptual UML domain model, not literal implementation classes.' }, classes, relations, statistics: layout.statistics }, null, 2) + '\n');
}

for (const page of pages) {
    layoutPage(page);
    console.log('Routed ' + page.id + ': ' + page.nodes.length + ' classes, ' + page.edges.length + ' relations / ' + page.width + ' × ' + page.height);
    fs.writeFileSync(path.join(OUT, String(page.number).padStart(2, '0') + '-' + page.id + '.svg'), svg(page));
}
const layout = { title: 'iPawcus System Class Diagram', pages, statistics: {
    domainClasses: classes.length, persistentClasses: source.tables.length, statelessDomainServices: 2,
    attributes: classes.reduce((sum, item) => sum + item.attributes.length, 0), operations: classes.reduce((sum, item) => sum + item.operations.length, 0),
    declaredAssociations: relations.filter(edge => edge.kind === 'association').length,
    logicalAssociations: relations.filter(edge => edge.kind === 'application-association').length,
    dependencies: relations.filter(edge => edge.kind === 'dependency').length, pages: pages.length,
} };
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="2026-10-06T00:00:00.000Z" agent="Codex" type="device" compressed="false">\n' + pages.map(drawio).join('\n') + '\n</mxfile>\n';
fs.writeFileSync(path.join(OUT, 'ipawcus-system-class-diagram.drawio'), xml);
fs.writeFileSync(path.join(OUT, 'domain-layout.json'), JSON.stringify(layout, null, 2) + '\n');
reference(layout);
console.log(JSON.stringify(layout.statistics));
