// Create diagram artifacts without changing application, database, or earlier diagrams.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutPage } from './route-classes.mjs';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const PREVIOUS = path.join(OUT, '../ipawcus-class-diagram-2026-10-06');
const model = JSON.parse(fs.readFileSync(path.join(PREVIOUS, 'domain-model.json'), 'utf8'));
const previous = JSON.parse(fs.readFileSync(path.join(PREVIOUS, 'domain-layout.json'), 'utf8'));
const definitions = new Map(model.classes.map(item => [item.id, item]));
const metrics = JSON.parse(fs.readFileSync(path.join(OUT, 'text-metrics.json'), 'utf8'));
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const theme = { ink: '#222222', border: '#858585', line: '#777777', font: 'Arial',
    title: 19, className: 11, body: 10, row: 13, label: 9, borderWidth: .8, lineWidth: .75 };

// Group related classes into columns. No positions or entities are copied from the ERD.
const coreColumns = [
    ['branches', 'branch_operating_hours', 'veterinarian_booking_clinics',
        'user_branch_assignments', 'vet_schedules', 'domain:booking_scheduler'],
    ['users', 'veterinarian_profiles', 'pet_ownership', 'pets_information',
        'pet_vaccinations', 'pet_medical_record_groups', 'pet_medical_record_group_items'],
    ['bookings', 'booking_pets', 'queues', 'vet_queue_assignments', 'clinical_intakes',
        'vet_diagnoses', 'consent_files', 'consent_form_records'],
    ['online_consultations', 'online_consultation_diagnoses', 'prescription_plans',
        'prescription_items', 'prescription_occurrences', 'pet_owner_todos', 'user_notifications'],
    ['visits', 'visit_charges', 'visit_payments', 'visit_payment_refunds', 'service_catalog',
        'inventory_items', 'domain:report_generator'],
];
const corePositions = new Map(coreColumns.flatMap((column, index) =>
    column.map((id, order) => [id, { column: index, order }])));

const pages = previous.pages.map(original => {
    const page = structuredClone(original);
    for (const node of page.nodes) {
        for (const key of ['x', 'y', 'w', 'h', 'column', 'header', 'attributeHeight', 'methodY', 'methodHeight']) delete node[key];
        if (node.reference && node.id === 'users') {
            // Include the actual role attribute as meaningful identity information.
            const role = previous.pages[0].nodes.find(item => item.id === 'users').attrs.find(row => row.startsWith('+ role:'));
            if (!node.attrs.includes(role)) node.attrs.push(role);
        }
        node.measuredTextWidth = Math.max(metrics.names[node.name],
            ...[...node.attrs, ...node.methods].map(row => metrics.rows[row]));
    }
    for (const edge of page.edges) {
        for (const key of ['points', 'labels', 'start', 'end', 'startAnchor', 'endAnchor', 'sourceSide', 'targetSide']) delete edge[key];
    }
    if (page.number === 0) {
        page.nodes.sort((a, b) => corePositions.get(a.id).column - corePositions.get(b.id).column
            || corePositions.get(a.id).order - corePositions.get(b.id).order);
        for (const node of page.nodes) node.column = corePositions.get(node.id).column;
    }
    layoutPage(page);
    console.log(`Laid out ${String(page.number).padStart(2, '0')}: ${page.nodes.length} boxes / ${page.edges.length} relationships`);
    return page;
});

function svg(page) {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="title description">`,
        `<title id="title">iPawcus - ${esc(page.title)}</title>`,
        '<desc id="description">Conceptual UML class diagram. White three-compartment class boxes with thin gray borders and orthogonal relationships. Attributes and operations describe the existing system, not literal PHP class declarations.</desc>',
        `<defs><marker id="dependency" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 4 L0 8" fill="none" stroke="${theme.line}" stroke-width="${theme.lineWidth}"/></marker></defs>`,
        '<rect width="100%" height="100%" fill="#ffffff"/>'];
    const text = (x, y, value, size = theme.body, extra = '') => parts.push(
        `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${theme.ink}" ${extra}>${esc(value)}</text>`);
    text(72, 35, 'iPawcus - ' + page.title, theme.title);
    text(72, 56, 'Conceptual UML model | class name, attributes, operations | + public | ? nullable', 10);
    text(72, 73, 'Solid: association | dashed: application association | dashed arrow: uses | 1 / 0..1 / 0..* multiplicities', 9.5);
    for (const edge of page.edges) {
        const dash = edge.kind === 'association' ? '' : edge.kind === 'dependency'
            ? ' stroke-dasharray="4 3" marker-end="url(#dependency)"' : ' stroke-dasharray="7 3"';
        parts.push(`<path d="${edge.points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ')}" fill="none" stroke="${theme.line}" stroke-width="${theme.lineWidth}"${dash}><title>${esc(edge.source + '.' + edge.columns.join(', ') + ' -> ' + edge.target + '.' + edge.references.join(', '))}</title></path>`);
    }
    for (const node of page.nodes) {
        parts.push(`<g data-class="${esc(node.id)}"><title>${esc(node.name + (node.reference ? ' (reference to the same class on its detail sheet)' : ''))}</title>`,
            `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" fill="#ffffff" stroke="${theme.border}" stroke-width="${theme.borderWidth}"/>`);
        for (const offset of [node.header, node.methodY]) parts.push(
            `<line x1="${node.x}" y1="${node.y + offset}" x2="${node.x + node.w}" y2="${node.y + offset}" stroke="${theme.border}" stroke-width="${theme.borderWidth}"/>`);
        text(node.x + node.w / 2, node.y + 16, node.name, theme.className, 'font-weight="700" text-anchor="middle"');
        node.attrs.forEach((row, index) => text(node.x + 10, node.y + node.header + 14 + index * theme.row, row));
        node.methods.forEach((row, index) => text(node.x + 10, node.y + node.methodY + 14 + index * theme.row, row));
        parts.push('</g>');
    }
    for (const edge of page.edges) for (const label of edge.labels) text(label.x, label.y + label.baselineOffset,
        label.text, page.labelFont, 'style="font-family:Consolas,monospace"');
    text(72, page.height - 22, page.number === 0
        ? 'Core classes and selected attributes. Full class definitions and relationships are on the complete and detail sheets.'
        : page.number === 1 ? 'Complete conceptual model, including legacy records. Operations map to existing functions and API workflows.'
            : 'Reference boxes repeat an existing class. Empty operation compartments indicate supporting state.', 9);
    parts.push('</svg>');
    return parts.join('\n') + '\n';
}

function drawio(page) {
    const cells = [`<diagram id="${esc(page.id)}" name="${String(page.number).padStart(2, '0')} - ${esc(page.title)}"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" page="1" pageWidth="${page.width}" pageHeight="${page.height}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`];
    const caption = (id, x, y, w, h, value, size) => cells.push(`<mxCell id="${id}" value="${esc(value)}" style="text;html=0;align=left;spacing=0;fontFamily=Arial;fontSize=${size};fontColor=${theme.ink};strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    caption('title', 72, 14, page.width - 144, 25, 'iPawcus - ' + page.title, theme.title);
    caption('scope', 72, 44, page.width - 144, 14, 'Conceptual UML model | class name, attributes, operations | + public | ? nullable', 10);
    caption('legend', 72, 62, page.width - 144, 14, 'Solid: association | dashed: application association | dashed arrow: uses | 1 / 0..1 / 0..* multiplicities', 9.5);
    for (const node of page.nodes) {
        const definition = definitions.get(node.id);
        const tooltip = [node.name, 'Conceptual class; operations are implemented by functions or API workflows.',
            definition.table ? 'Persistent mapping: ' + node.id : 'Stateless domain responsibility.',
            node.reference ? 'Reference to the same class on sheet ' + node.homePage : '',
            definition.migrationOnly ? 'Migration-defined: DDL/20261004_01_clinical_intakes.sql.' : '',
            definition.legacy ? 'Legacy scheduling data.' : '',
            ...definition.operations.map(op => op.signature + ' -> ' + op.evidence.file + ':' + op.evidence.line)].filter(Boolean).join('\n');
        cells.push(`<object id="${esc(node.id)}" label="${esc(node.name)}" tooltip="${esc(tooltip)}"><mxCell style="swimlane;html=0;startSize=${node.header};horizontal=1;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=${theme.className};fontStyle=1;fontColor=${theme.ink};fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=${theme.border};strokeWidth=${theme.borderWidth};rounded=0;collapsible=0;" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" as="geometry"/></mxCell></object>`);
        const body = `text;html=0;whiteSpace=nowrap;align=left;verticalAlign=middle;spacingLeft=10;fontFamily=Arial;fontSize=${theme.body};fontColor=${theme.ink};strokeColor=none;fillColor=none;`;
        for (const [index, row] of node.attrs.entries()) cells.push(`<mxCell id="${esc(node.id)}-attribute-${index}" value="${esc(row)}" style="${body}" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.header + 3 + index * theme.row}" width="${node.w}" height="${theme.row}" as="geometry"/></mxCell>`);
        cells.push(`<mxCell id="${esc(node.id)}-divider" style="line;strokeColor=${theme.border};strokeWidth=${theme.borderWidth};" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.methodY}" width="${node.w}" height="0" as="geometry"/></mxCell>`);
        for (const [index, row] of node.methods.entries()) cells.push(`<mxCell id="${esc(node.id)}-method-${index}" value="${esc(row)}" style="${body}" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.methodY + 3 + index * theme.row}" width="${node.w}" height="${theme.row}" as="geometry"/></mxCell>`);
    }
    for (const edge of page.edges) {
        const start = page.nodes.find(node => node.id === edge.source), end = page.nodes.find(node => node.id === edge.target);
        const tooltip = `${edge.source}.${edge.columns.join(', ')} -> ${edge.target}.${edge.references.join(', ')}\n${edge.evidence.file}:${edge.evidence.line}\n${edge.evidence.constraint || edge.evidence.note || 'Domain dependency'}`;
        const sourceX = (edge.start.x - start.x) / start.w, sourceY = (edge.start.y - start.y) / start.h;
        const targetX = (edge.end.x - end.x) / end.w, targetY = (edge.end.y - end.y) / end.h;
        cells.push(`<object id="${esc(edge.id)}" label="" tooltip="${esc(tooltip)}"><mxCell style="edgeStyle=none;html=0;orthogonal=1;endArrow=${edge.kind === 'dependency' ? 'open' : 'none'};endFill=0;endSize=7;strokeColor=${theme.line};strokeWidth=${theme.lineWidth};${edge.kind === 'association' ? '' : 'dashed=1;dashPattern=' + (edge.kind === 'dependency' ? '4 3;' : '7 3;')}jumpStyle=arc;jumpSize=4;exitX=${sourceX};exitY=${sourceY};exitPerimeter=0;entryX=${targetX};entryY=${targetY};entryPerimeter=0;" edge="1" parent="1" source="${esc(edge.source)}" target="${esc(edge.target)}"><mxGeometry relative="1" as="geometry"><Array as="points">${edge.points.slice(1, -1).map(point => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')}</Array></mxGeometry></mxCell></object>`);
        for (const [index, label] of edge.labels.entries()) {
            const endpoint = edge[label.endpoint];
            cells.push(`<mxCell id="${esc(edge.id)}-label-${index}" value="${esc(label.text)}" style="edgeLabel;html=0;align=left;spacing=0;fontFamily=Consolas;fontSize=${page.labelFont};fontColor=${theme.ink};strokeColor=none;fillColor=none;resizable=0;" vertex="1" connectable="0" parent="${esc(edge.id)}"><mxGeometry x="${label.endpoint === 'start' ? -1 : 1}" y="0" width="${label.w}" height="${label.h}" relative="1" as="geometry"><mxPoint x="${label.x - endpoint.x}" y="${label.y - endpoint.y}" as="offset"/></mxGeometry></mxCell>`);
        }
    }
    cells.push('</root></mxGraphModel></diagram>');
    return cells.join('\n');
}

for (const page of pages) fs.writeFileSync(path.join(OUT, `${String(page.number).padStart(2, '0')}-${page.id}.svg`), svg(page));
const wrap = selected => '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="2026-10-08T00:00:00.000Z" agent="Codex" type="device" compressed="false">\n'
    + selected.map(drawio).join('\n') + '\n</mxfile>\n';
fs.writeFileSync(path.join(OUT, 'ipawcus-class-diagram.drawio'), wrap(pages));
fs.writeFileSync(path.join(OUT, 'ipawcus-core-class-diagram.drawio'), wrap([pages[0]]));
fs.writeFileSync(path.join(OUT, 'diagram-layout.json'), JSON.stringify({ theme, pages }, null, 2) + '\n');
fs.copyFileSync(path.join(PREVIOUS, 'domain-model.json'), path.join(OUT, 'domain-model.json'));
fs.copyFileSync(path.join(PREVIOUS, 'DOMAIN-REFERENCE.md'), path.join(OUT, 'SOURCE-REFERENCE.md'));
console.log(JSON.stringify({ pages: pages.length, coreClasses: pages[0].nodes.length,
    completeClasses: pages[1].nodes.length, coreRelationships: pages[0].edges.length,
    completeRelationships: pages[1].edges.length }));
