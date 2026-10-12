// Reuses the established class-box router; writes documentation only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layoutPage } from '../outputs/ipawcus-class-diagram-2026-10-06/domain-layout.mjs';
import { reroute, wirePath } from './route-paper-class.mjs';
import { classes, relations, title, output, reference, constraints } from './paper-class-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, output);
const detailed = JSON.parse(fs.readFileSync(path.join(ROOT, reference), 'utf8'));
const originals = ['docs/IPAWCUS-Class-Diagram.drawio', 'outputs/ipawcus-class-diagram-2026-10-06/ipawcus-system-class-diagram.drawio'];
const hashes = Object.fromEntries(originals.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const detailedMap = new Map(detailed.classes.map(item => [item.id, item]));
const members = classes.flatMap(item => item.members);
if (members.length !== new Set(members).size || members.some(id => !detailedMap.has(id))
    || members.length !== detailed.classes.length) throw new Error('Supporting class coverage changed.');

const page = { id: 'paper-overview', title: 'Simplified System Class Diagram', columns: 4, number: 0,
    nodes: structuredClone(classes), edges: structuredClone(relations) };
layoutPage(page);
// Measure the actual render fonts: boxes fit their own content, not a common width.
const measurement = spawnSync('python', [path.join(ROOT, 'scripts/validate-render-paper-class.py'), '--measure'], {
    input: JSON.stringify(page.nodes), encoding: 'utf8', windowsHide: true,
});
if (measurement.status !== 0) throw new Error(measurement.stderr || 'Font measurement failed.');
const widths = JSON.parse(measurement.stdout);
for (const box of page.nodes) {
    box.originalBounds = { x: box.x, y: box.y, w: box.w, h: box.h };
    const center = box.x + box.w / 2;
    box.w = widths[box.id];
    box.x = center - box.w / 2;
    box.attributeHeight = box.attrs.length * 16 + 8;
    box.methodY = box.header + box.attributeHeight;
    box.methodHeight = box.methods.length * 16 + 8;
    box.h = box.methodY + box.methodHeight;
}
const byId = new Map(page.nodes.map(box => [box.id, box]));
for (const edge of page.edges) {
    for (const kind of ['start', 'end']) {
        const box = byId.get(kind === 'start' ? edge.source : edge.target);
        const side = kind === 'start' ? edge.sourceSide : edge.targetSide;
        const endpoint = edge[kind];
        endpoint.x = box.x + (side === 'R' ? box.w : 0);
        edge[kind + 'Anchor'] = { x: endpoint.x + (side === 'R' ? 56 : -56), y: endpoint.y };
        for (const label of edge.labels.filter(label => label.endpoint === kind)) {
            label.x = side === 'R' ? endpoint.x + 12 : endpoint.x - 12 - label.w;
        }
    }
}
reroute(page);
fs.mkdirSync(OUT, { recursive: true });
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const ink = '#111111';

function svg() {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="title desc">`,
        `<title id="title">${esc(title)} — Simplified System Class Diagram</title>`,
        '<desc id="desc">Sixteen conceptual classes with attributes, operations and selected UML associations. Supporting tables are grouped, not removed. Multiplicities sit above their own lines near class boxes. Full responsibilities and mappings accompany the diagram.</desc>',
        `<defs><marker id="dependency" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0 L8 4.5 L0 9" fill="none" stroke="${ink}" stroke-width="1.2"/></marker></defs>`,
        '<rect width="100%" height="100%" fill="#ffffff"/>'];
    const text = (x, y, value, size = 14, extra = '') => parts.push(`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${ink}" ${extra}>${esc(value)}</text>`);
    text(90, 39, 'iPawcus — Simplified System Class Diagram', 24, 'font-weight="700"');
    text(90, 67, title, 16);
    text(90, 94, '16 main classes · Attributes + operations · Solid: association · Dashed arrow: uses · 1: one · 0..1: optional · 0..*: many · ?: optional value', 14);
    for (const edge of page.edges) {
        parts.push(`<path data-relationship="${edge.id}" d="${wirePath(edge, page.bridges)}" fill="none" stroke="${ink}" stroke-width="1.2"${edge.kind === 'dependency' ? ' stroke-dasharray="5 4" marker-end="url(#dependency)"' : ''}><title>${esc(edge.meaning)}</title></path>`);
    }
    for (const jump of page.bridges) {
        const curve = `M${jump.x - jump.radius} ${jump.y} A${jump.radius} ${jump.radius} 0 0 1 ${jump.x + jump.radius} ${jump.y}`;
        parts.push(`<path d="${curve}" fill="none" stroke="#ffffff" stroke-width="4"/><path data-bridge="${jump.edge}" d="${curve}" fill="none" stroke="${ink}" stroke-width="1.2"/>`);
    }
    for (const box of page.nodes) {
        parts.push(`<g data-class="${box.id}"><title>${esc(box.explanation)}</title><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#ffffff" stroke="${ink}" stroke-width="1.2"/>`);
        for (const offset of [box.header, box.methodY]) parts.push(`<line x1="${box.x}" y1="${box.y + offset}" x2="${box.x + box.w}" y2="${box.y + offset}" stroke="${ink}"/>`);
        text(box.x + box.w / 2, box.y + 21, box.name, 17, 'text-anchor="middle" font-weight="700"');
        box.attrs.forEach((row, index) => text(box.x + 12, box.y + box.header + 17 + index * 16, row));
        box.methods.forEach((row, index) => text(box.x + 12, box.y + box.methodY + 17 + index * 16, row));
        parts.push('</g>');
    }
    for (const edge of page.edges) for (const label of edge.labels) text(label.x, label.y + label.baselineOffset, label.text, 12, `data-relationship="${edge.id}"`);
    parts.push('</svg>');
    return parts.join('\n') + '\n';
}

function drawio() {
    const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<mxfile host="app.diagrams.net" type="device" compressed="false">',
        `<diagram id="${page.id}" name="01 - Simplified System Classes"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" page="1" pageWidth="${page.width}" pageHeight="${page.height}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`];
    const heading = (id, value, y, size, bold = false) => parts.push(`<mxCell id="${id}" value="${esc(value)}" style="text;html=0;align=left;verticalAlign=middle;fontFamily=Arial;fontSize=${size};fontStyle=${bold ? 1 : 0};fontColor=${ink};strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="90" y="${y}" width="${page.width - 180}" height="28" as="geometry"/></mxCell>`);
    heading('heading', 'iPawcus — Simplified System Class Diagram', 16, 24, true);
    heading('system-title', title, 46, 16);
    heading('legend', '16 main classes · Attributes + operations · Solid: association · Dashed arrow: uses · 1: one · 0..1: optional · 0..*: many · ?: optional value', 72, 14);
    for (const box of page.nodes) {
        parts.push(`<object id="${box.id}" label="${box.name}" tooltip="${esc(box.explanation + '\nSupporting mappings: ' + box.members.join(', '))}"><mxCell style="swimlane;html=0;horizontal=1;startSize=${box.header};align=center;fontFamily=Arial;fontSize=17;fontStyle=1;fontColor=${ink};fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=${ink};strokeWidth=1.2;rounded=0;collapsible=0;" vertex="1" parent="1"><mxGeometry x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" as="geometry"/></mxCell></object>`);
        const bodyStyle = `text;html=0;whiteSpace=nowrap;align=left;verticalAlign=middle;spacingLeft=12;fontFamily=Arial;fontSize=14;fontColor=${ink};strokeColor=none;fillColor=none;`;
        box.attrs.forEach((row, index) => parts.push(`<mxCell id="${box.id}-attribute-${index}" value="${esc(row)}" style="${bodyStyle}" vertex="1" parent="${box.id}"><mxGeometry y="${box.header + 3 + index * 16}" width="${box.w}" height="16" as="geometry"/></mxCell>`));
        parts.push(`<mxCell id="${box.id}-divider" style="line;strokeColor=${ink};" vertex="1" parent="${box.id}"><mxGeometry y="${box.methodY}" width="${box.w}" height="0" as="geometry"/></mxCell>`);
        box.methods.forEach((row, index) => parts.push(`<mxCell id="${box.id}-operation-${index}" value="${esc(row)}" style="${bodyStyle}" vertex="1" parent="${box.id}"><mxGeometry y="${box.methodY + 3 + index * 16}" width="${box.w}" height="16" as="geometry"/></mxCell>`));
    }
    for (const edge of page.edges) {
        const start = page.nodes.find(box => box.id === edge.source), end = page.nodes.find(box => box.id === edge.target);
        parts.push(`<object id="${edge.id}" label="" tooltip="${esc(edge.meaning)}"><mxCell style="edgeStyle=none;html=0;orthogonal=1;endArrow=${edge.kind === 'dependency' ? 'open' : 'none'};endFill=0;endSize=8;strokeColor=${ink};strokeWidth=1.2;${edge.kind === 'dependency' ? 'dashed=1;dashPattern=5 4;' : ''}jumpStyle=arc;jumpSize=5;exitX=${edge.sourceSide === 'R' ? 1 : 0};exitY=${(edge.start.y - start.y) / start.h};exitPerimeter=0;entryX=${edge.targetSide === 'R' ? 1 : 0};entryY=${(edge.end.y - end.y) / end.h};entryPerimeter=0;" edge="1" parent="1" source="${edge.source}" target="${edge.target}"><mxGeometry relative="1" as="geometry"><Array as="points">${edge.points.slice(1, -1).map(point => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')}</Array></mxGeometry></mxCell></object>`);
        edge.labels.forEach((label, index) => {
            const endpoint = edge[label.endpoint];
            parts.push(`<mxCell id="${edge.id}-label-${index}" value="${esc(label.text)}" style="edgeLabel;html=0;align=left;verticalAlign=middle;spacing=0;fontFamily=Arial;fontSize=12;fontColor=${ink};strokeColor=none;fillColor=none;resizable=0;" vertex="1" connectable="0" parent="${edge.id}"><mxGeometry x="${label.endpoint === 'start' ? -1 : 1}" y="0" width="${label.w}" height="${label.h}" relative="1" as="geometry"><mxPoint x="${label.x - endpoint.x}" y="${label.y - endpoint.y}" as="offset"/></mxGeometry></mxCell>`);
        });
    }
    parts.push('</root></mxGraphModel></diagram></mxfile>');
    return parts.join('\n') + '\n';
}

const paper = ['# Simplified iPawcus system class diagram', '', title, '',
    '## Paper-ready explanation', '',
    'The class diagram presents the main objects and responsibilities of iPawcus using sixteen conceptual classes. Each class contains a name, selected typed attributes and public operations. Associations describe important connections between objects, while the dashed dependency arrow identifies role-authorized use of the cross-cutting system service. Small bridges at wire crossings mean the wires are not joined. This is a system-level UML model based on the database reference and application behavior, not an entity-relationship diagram containing every table and not a claim that the procedural PHP backend declares sixteen matching object-oriented classes.', '',
    'UserAccount represents the four user roles: Pet Owner, Admin, Veterinarian and Super Admin. Pet stores the patient identity, while MedicalRecord organizes the patient\'s health information. Clinic and Booking represent location-based service requests and calendar availability. Veterinarian clinic acceptance is separate from online-call availability, and overlapping appointments for the same veterinarian are prevented across both calendars.', '',
    'PatientExamination represents the admin-led assessment before onsite diagnosis. It retains clinical signs, urgent symptoms, vital signs, physical findings and image evidence, together with the identity of the examiner and the assigned veterinarian. ConsentRecord retains signed owner authorization. Diagnosis represents the veterinarian\'s clinical assessment, treatment and prescription decisions; additional consent remains available during diagnosis. OnlineConsultation represents the remote-call workflow and its own diagnostic record.', '',
    'PrescriptionPlan groups versioned prescriptions for a particular pet. PrescriptionItem is deliberately separate because every medicine has its own start date, frequency, duration and dated completion checklist. This preserves the essential per-item scheduling behavior without displaying a separate box for every occurrence or audit event. Online and onsite diagnoses both support prescriptions. A diagnosis with no prescription content does not trigger prescription printing or create an empty plan.', '',
    'CareSession summarizes grooming and boarding/confinement while retaining their different operational rules. InventoryItem represents products and supplies with auditable stock records. BillingRecord summarizes visit charges, payment proofs, invoices, payments and refunds. Notification delivers actionable updates to the appropriate user. SystemOperations represents authorized reporting, monitoring, media and backup functions. Supporting records remain implemented separately and are documented in the mapping appendix.', '',
    '## Main-class responsibilities', ''];
for (const item of classes) paper.push('### ' + item.name, '', item.explanation, '');
paper.push('## Relationship meanings and multiplicities', '',
    'Read a number at an endpoint as the number of instances of that endpoint class allowed for one instance at the other endpoint. For example, UserAccount `1` — Booking `0..*` means each booking has one requesting account, and that account may request many bookings. Counts in this overview describe the conceptual associations; they do not assert new SQL foreign-key constraints. Some counts are deliberately optional because the combined class includes multiple workflows or legacy records.', '',
    '| Relationship | Multiplicities at the named ends | Meaning |', '| --- | --- | --- |');
for (const edge of relations) paper.push(`| ${edge.source} — ${edge.target} | ${edge.kind === 'dependency' ? 'Dependency: uses' : `${edge.sourceText} / ${edge.targetText}`} | ${edge.meaning} |`);
paper.push('', '## Rules retained by the simplification', '', ...constraints.map(value => '- ' + value), '',
    '## What was simplified, not removed', '',
    'The previous main overview displayed 35 classes; this paper overview displays 16. The detailed reference still contains 91 modeled responsibilities (89 persistent objects and 2 stateless services). Every one is mapped exactly once in IMPLEMENTATION-MAPPING.md. Queue/assignment records are grouped with examination; onsite/online diagnostic records share a conceptual Diagnosis abstraction; prescription occurrences are grouped with their item; payment/charge/refund records are grouped with BillingRecord; grooming and boarding supporting records are grouped with CareSession.', '',
    'Not every foreign key, actor reference or reporting input is redrawn. For example, patient and veterinarian references also appear as typed attributes, and role authorization applies to operations throughout the system. This deliberate selection keeps the overview readable; it does not remove those relationships from the implementation. The original detailed class diagram remains available for database and implementation-level questions.', '',
    '## Modeling boundaries', '',
    '- Collections such as `charges`, `occurrences`, `findings` and `clinicAcceptance` are conceptual properties backed by several fields/tables, not newly added SQL columns.',
    '- Methods summarize existing application responsibilities. Some responsibilities are grouped into a conceptual operation rather than matching a function name verbatim.',
    '- `Diagnosis` and `CareSession` are overview abstractions; no inheritance hierarchy, merged storage table or new global ID namespace is claimed.',
    '- `SystemOperations` is a conceptual service facade. Report history/media/staff history can be implemented through files or services; no extra persistence table is invented.',
    '- The table coverage is based on the previously parsed supplied SQL reference plus the current clinical_intakes migration, not inspection of a live deployed database.',
    '- No app, database, debug bypass, original class diagram, context diagram or role-activity diagram was changed.', '',
    '## Using this figure in the paper', '',
    'Suggested caption: “Simplified system class diagram of iPawcus showing the principal domain objects, their attributes, operations and selected associations.” Use the SVG for sharp scaling and a landscape page if possible. Place the main-class responsibility explanation after the figure; keep IMPLEMENTATION-MAPPING.md as an appendix rather than crowding the diagram with every SQL table.', '');

const mapping = ['# Implementation mapping for the simplified class diagram', '',
    'This appendix preserves the supporting objects and source-backed responsibilities that were folded into the sixteen paper-level classes. It is not a proposed database redesign. Original detailed diagram: `../ipawcus-class-diagram-2026-10-06/ipawcus-system-class-diagram.drawio`.', '',
    'Reference schema: `C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql`, previously parsed in the detailed domain model. Additional current table: `DDL/20261004_01_clinical_intakes.sql`. Legacy scheduling objects are included in coverage but are not activated as current onsite booking requirements.', ''];
const fileLink = file => `[${file}](${path.join(ROOT, file).replaceAll('\\', '/')})`;
let operations = 0;
for (const item of classes) {
    mapping.push('## ' + item.name, '', item.explanation, '', '| Supporting object | Persistent mapping | Source-backed responsibilities |', '| --- | --- | --- |');
    for (const id of item.members) {
        const member = detailedMap.get(id);
        const behavior = member.operations.map(operation => {
            operations++;
            const evidence = operation.evidence;
            const prefix = operation.signature.replace(/^\+ /, '');
            return `\`${prefix}\` — ${fileLink(evidence.file)}${operation.note ? ' (' + operation.note + ')' : ''}`;
        }).join('<br>');
        mapping.push(`| ${member.name}${member.legacy ? ' (legacy)' : ''} | ${member.table ? '`' + id + '`' + (member.migrationOnly ? ' (current migration)' : '') : 'Stateless service; no table'} | ${behavior || 'Supporting state; no distinct operation asserted.'} |`);
    }
    mapping.push('');
}
mapping.push('## Additional current-source references', '',
    '- Clinic/calendar distinction and daily My List: ' + fileLink('docs/shared-veterinarian-booking.md'),
    '- Intake consent requirement and examination provenance: ' + fileLink('php/clinical_intakes.php'),
    '- Per-item recurrence generation, plan versioning and empty-plan guard: ' + fileLink('php/prescription_helpers.php'),
    '- Diagnosis prescription synchronization: ' + fileLink('php/vet_diagnoses.php'),
    '- Online diagnosis prescription synchronization: ' + fileLink('php/online_consultations.php'),
    '- Prescription start/checklist UI: ' + fileLink('src/components/shared/PrescriptionPlanPanel.jsx'),
    '- Conditional automatic printing and extra vet consent: ' + fileLink('src/components/VetrinarianComponents/VetDiagnosis.jsx'),
    '- Staff history: ' + fileLink('php/staff_activity_helpers.php'),
    '- Media operations: ' + fileLink('php/pet_media_monitoring.php'),
    '- Super Admin backup authorization: ' + fileLink('php/system_backups.php'), '',
    `Coverage: ${members.length} detailed responsibilities, ${detailed.classes.filter(item => item.table).length} persistent objects, ${operations} source-backed operations, each supporting object assigned to exactly one main class.`, '');

const mermaid = ['classDiagram', 'direction LR', '%% Conceptual paper overview; not a database migration.'];
for (const box of classes) mermaid.push(`class ${box.name} {`, ...box.attrs.map(value => '    ' + value), ...box.methods.map(value => '    ' + value), '}');
for (const edge of relations) mermaid.push(edge.kind === 'dependency' ? `${edge.source} ..> ${edge.target} : uses` : `${edge.source} "${edge.sourceText}" -- "${edge.targetText}" ${edge.target}`);
const xml = drawio();
fs.writeFileSync(path.join(OUT, 'ipawcus-class-diagram-simplified.drawio'), xml);
fs.writeFileSync(path.join(OUT, '00-simplified-system-class-diagram.svg'), svg());
fs.writeFileSync(path.join(OUT, 'paper-class-diagram.mmd'), mermaid.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'PAPER-EXPLANATION.md'), paper.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'IMPLEMENTATION-MAPPING.md'), mapping.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'paper-class-layout.json'), JSON.stringify({ title, page, originals: hashes,
    basis: reference, constraints, statistics: { mainClasses: classes.length, previousOverviewClasses: 35,
        selectedRelations: relations.length, mappedDetailedResponsibilities: members.length,
        persistentObjects: detailed.classes.filter(item => item.table).length, retainedSourceOperations: operations } }, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'README.md'), '# Simplified paper class diagram\n\n'
    + '16 main classes, compared with 35 in the previous overview. Supporting records are grouped, not deleted.\n\n'
    + '- Editable: `ipawcus-class-diagram-simplified.drawio` (one sheet).\n'
    + '- Figure: `00-simplified-system-class-diagram.png` / `.svg`.\n'
    + '- Paper explanation: `PAPER-EXPLANATION.md`.\n'
    + '- Full grouping and behavior appendix: `IMPLEMENTATION-MAPPING.md`.\n'
    + '- Each box fits its actual text; original column centers are retained to leave more room for connectors.\n'
    + '- Reproduce: `node scripts/generate-paper-class-diagram.mjs`, then `python scripts/validate-render-paper-class.py`.\n\n'
    + 'Original diagrams, app and database remain unchanged.\n');
console.log(JSON.stringify({ output, width: page.width, height: page.height, classes: classes.length, relations: relations.length, mappedResponsibilities: members.length, retainedOperations: operations }));
