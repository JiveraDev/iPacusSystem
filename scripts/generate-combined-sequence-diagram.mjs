import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as combinedModel from './combined-sequence-model.mjs';
import * as plainModel from './plain-sequence-model.mjs';
const PLAIN = process.argv.includes('--plain');
const { output, title, participants, events, references, modelingNotes } = PLAIN ? plainModel : combinedModel;

// Native editable UML sequence geometry; no activity-diagram router is used.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, output);
fs.mkdirSync(OUT, { recursive: true });
const metrics = JSON.parse(fs.readFileSync(path.join(OUT, 'font-metrics.json'), 'utf8'));
const WIDTH = 1960;
const FONT = 18;
const LINE_HEIGHT = 22;
const ink = '#111111';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('\n', '&#xa;');
const upper = value => String(value).toUpperCase();
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const byId = new Map(participants.map(p => [p.id, p]));
const primitives = [];
const frames = [];
const messages = [];
const refs = [];
const activations = [];
const textItems = [];
const notes = [];
const onlineBoxes = [];
const logoAssets = [];
let primitiveId = 0;
const add = p => { p.id ||= `shape-${++primitiveId}`; primitives.push(p); return p; };
const rect = (id, x, y, w, h, fill = null, role = '') => add({ type: 'rect', id, x, y, w, h, fill, role });
const line = (id, x1, y1, x2, y2, dash = false, role = '') => add({ type: 'line', id, x1, y1, x2, y2, dash, role });
const polygon = (id, points, fill = null) => add({ type: 'polygon', id, points, fill });
if (PLAIN) {
    fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
    for (const asset of plainModel.imageAssets) {
        const originalFile = path.isAbsolute(asset.source) ? asset.source : path.join(ROOT, asset.source);
        const savedFile = path.join(OUT, 'assets', asset.filename);
        const sourceFile = fs.existsSync(originalFile) ? originalFile : savedFile;
        const bytes = fs.readFileSync(sourceFile);
        if (bytes.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error(`Expected PNG logo: ${asset.id}`);
        if (path.resolve(sourceFile) !== path.resolve(savedFile)) fs.copyFileSync(sourceFile, savedFile);
        logoAssets.push({ ...asset, originalFile, savedFile: `assets/${asset.filename}`, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20), originalPresent: fs.existsSync(originalFile) });
    }
}
function logo(id, x, y, w, h) {
    const asset = logoAssets.find(item => item.id === id);
    if (!asset) throw new Error(`Missing logo: ${id}`);
    const data64 = fs.readFileSync(path.join(OUT, asset.savedFile)).toString('base64');
    return add({ type: 'image', id, x, y, w, h, data64, file: asset.savedFile, assetSha256: asset.sha256, role: 'logo', participant: asset.participant, placement: asset.placement });
}
function fittedLogo(id, centerX, y, maxWidth, maxHeight) {
    const asset = logoAssets.find(item => item.id === id);
    if (!asset) throw new Error(`Missing logo: ${id}`);
    const scale = Math.min(maxWidth / asset.naturalWidth, maxHeight / asset.naturalHeight);
    const w = asset.naturalWidth * scale;
    const h = asset.naturalHeight * scale;
    return logo(id, centerX - w / 2, y + (maxHeight - h) / 2, w, h);
}

function measure(text, size = FONT) {
    const row = metrics[String(size)];
    if (!row) throw new Error(`Missing font metrics for ${size}`);
    return [...text].reduce((sum, char) => sum + (row[char] ?? row.M), 0) * 1.015;
}
function wrap(value, maxWidth, size = FONT) {
    const words = upper(value).split(/\s+/);
    const result = [];
    let row = '';
    for (const word of words) {
        const next = row ? `${row} ${word}` : word;
        if (row && measure(next, size) > maxWidth) { result.push(row); row = word; }
        else row = next;
        if (measure(word, size) > maxWidth) throw new Error(`Word cannot fit: ${word}`);
    }
    if (row) result.push(row);
    return result;
}
function text(id, x, y, w, lines, size = FONT, align = 'left', fill = null, role = '', parentMessage = null) {
    const rows = Array.isArray(lines) ? lines.map(upper) : [upper(lines)];
    const p = add({ type: 'text', id, x, y, w, h: rows.length * (size + 4), lines: rows, size, align, fill, role, parentMessage });
    textItems.push(p);
    return p;
}
function tab(id, x, y, operator) {
    polygon(`${id}-tab`, [[x, y], [x + 68, y], [x + 68, y + 18], [x + 58, y + 28], [x, y + 28]], '#ffffff');
    text(`${id}-operator`, x + 5, y + 2, 53, [operator], FONT, 'center', null, 'operator');
}
function collect(items) {
    const ids = new Set();
    for (const item of items) {
        if (item.type === 'message') { ids.add(item.from); ids.add(item.to); }
        if (item.branches) for (const b of item.branches) for (const id of collect(b.events)) ids.add(id);
    }
    return [...ids];
}
function evidenceEntries(items) {
    return items.flatMap(item => [...(item.evidence || []), ...(item.branches || []).flatMap(b => evidenceEntries(b.events))]);
}
const evidence = [...new Map([...evidenceEntries(events), ...Object.values(references).flatMap(r => r.evidence)].map(e => [JSON.stringify(e), e])).values()].map(e => {
    const file = path.join(ROOT, e.file);
    if (!fs.existsSync(file)) throw new Error(`Missing evidence file: ${e.file}`);
    const content = fs.readFileSync(file, 'utf8');
    const index = content.indexOf(e.needle);
    if (index < 0) throw new Error(`Missing evidence text: ${e.file}: ${e.needle}`);
    return { ...e, line: content.slice(0, index).split('\n').length, sha256: hash(e.file) };
});
const originals = ['docs/IPAWCUS-Role-Activity-Diagrams.drawio', 'ipawcus-data-flow-diagram.drawio', 'ipawcus-context-diagram-revised.drawio', ...(PLAIN ? ['outputs/ipawcus-sequence-diagram-2026-10-08-combined/ipawcus-combined-sequence.drawio'] : [])];
const originalHashes = Object.fromEntries(originals.filter(f => fs.existsSync(path.join(ROOT, f))).map(f => [f, hash(f)]));

text('heading', 30, 18, WIDTH - 60, ['iPawcus - Combined System Sequence Diagram'], 26, 'center');
const titleRows = wrap(title, WIDTH - 90, 20);
text('system-title', 45, 53, WIDTH - 90, titleRows, 20, 'center');
let headerTop = 53 + titleRows.length * 24 + 12;
if (!PLAIN) {
    text('scope', 30, headerTop, WIDTH - 60, ['FOUR INDEPENDENT ROLES; FOLLOW THE SELECTED SERVICE BRANCH, NOT EVERY OPTIONAL BLOCK.'], FONT, 'center');
    headerTop += 34;
}
for (const p of participants) {
    if (p.actor) {
        const actorTop = headerTop + (PLAIN ? 56 : 0);
        add({ type: 'circle', id: `actor-${p.id}-head`, x: p.x, y: actorTop + 9, r: 7, fill: '#ffffff', role: 'actor' });
        line(`actor-${p.id}-body`, p.x, actorTop + 16, p.x, actorTop + 37, false, 'actor');
        line(`actor-${p.id}-arms`, p.x - 17, actorTop + 25, p.x + 17, actorTop + 25, false, 'actor');
        line(`actor-${p.id}-leg-left`, p.x, actorTop + 37, p.x - 15, actorTop + 51, false, 'actor');
        line(`actor-${p.id}-leg-right`, p.x, actorTop + 37, p.x + 15, actorTop + 51, false, 'actor');
        text(`participant-${p.id}`, p.x - 125, actorTop + 61, 250, p.label, 22, 'center', '#ffffff', 'participant');
    } else if (PLAIN) {
        if (p.id === 'SYS') {
            fittedLogo('ipawcus-logo', p.x, headerTop + 10, 88, 88);
        } else {
            fittedLogo('mysql-logo', p.x, headerTop, 160, 108);
        }
        rect(`participant-box-${p.id}`, p.x - p.w / 2, headerTop + 112, p.w, 68, '#ffffff', 'participant-box');
        text(`participant-${p.id}`, p.x - p.w / 2 + 8, headerTop + 117, p.w - 16, [p.label[0]], 22, 'center', null, 'participant');
        text(`participant-detail-${p.id}`, p.x - p.w / 2 + 8, headerTop + 151, p.w - 16, [p.label[1]], FONT, 'center');
    } else {
        rect(`participant-box-${p.id}`, p.x - p.w / 2, headerTop + 22, p.w, 76, '#ffffff', 'participant-box');
        text(`participant-${p.id}`, p.x - p.w / 2 + 8, headerTop + 28, p.w - 16, [p.label[0]], 22, 'center', null, 'participant');
        text(`participant-detail-${p.id}`, p.x - p.w / 2 + 8, headerTop + 62, p.w - 16, [p.label[1]], FONT, 'center');
    }
}
const lifelineStart = headerTop + (PLAIN ? 204 : 121);
let y = lifelineStart + 10;

function drawEvents(items, scope = '') {
    for (const item of items) {
        if (item.type === 'message') {
            const from = byId.get(item.from);
            const to = byId.get(item.to);
            const direction = Math.sign(to.x - from.x);
            const x1 = from.x + (from.actor ? 0 : direction * 6);
            const x2 = to.x - (to.actor ? 0 : direction * 6);
            const maxWidth = Math.abs(x2 - x1) - 38;
            const rows = wrap(item.text, maxWidth);
            const w = Math.min(maxWidth, Math.ceil(Math.max(...rows.map(row => measure(row))) + 10));
            const h = rows.length * LINE_HEIGHT;
            const arrowY = y + h + (PLAIN ? 6 : 7);
            const label = { x: (x1 + x2 - w) / 2, y, w, h, rows };
            const message = { ...item, x1, x2, y: arrowY, label, scope, order: messages.length + 1 };
            messages.push(message);
            add({ type: 'message', ...message });
            text(`label-${item.id}`, label.x, label.y, label.w, rows, FONT, 'center', '#ffffff', 'message-label', item.id);
            y = arrowY + (PLAIN ? 12 : 14);
        } else if (item.type === 'note') {
            const rows = wrap(item.text, WIDTH - 130);
            const shape = text(`note-${item.id}`, 65, y + 4, WIDTH - 130, rows, FONT, 'center', '#ffffff', 'note');
            notes.push({ ...item, x: shape.x, y: shape.y, w: shape.w, h: shape.h, scope });
            y += shape.h + 14;
        } else if (item.type === 'ref') {
            const ids = item.id === 'R2-call' ? ['VT', 'PO', 'SYS'] : item.id === 'R5-care' ? ['AD', 'VT', 'PO', 'SYS', 'DB'] : participants.map(p => p.id);
            const xs = ids.map(id => byId.get(id).x);
            const x = Math.min(...xs) - 47;
            const w = Math.max(...xs) - x + 47;
            const prefix = item.text.startsWith(item.id.split('-')[0] + ':') ? '' : `${item.id.split('-')[0]}: `;
            const rows = wrap(prefix + item.text, w - 106);
            const h = Math.max(48, rows.length * LINE_HEIGHT + 18);
            rect(`ref-${item.id}`, x, y, w, h, '#ffffff', 'reference');
            tab(`ref-${item.id}`, x, y, 'ref');
            text(`ref-${item.id}-text`, x + 82, y + 8, w - 96, rows, FONT, 'center', null, 'reference-label');
            refs.push({ ...item, x, y, w, h, scope });
            y += h + 10;
        } else if (item.type === 'group') {
            const xs = collect(item.branches.flatMap(b => b.events)).map(id => byId.get(id).x);
            const x = Math.min(...xs) - 50;
            const w = Math.max(...xs) - x + 50;
            const frameY = y;
            // Frame inserted first; fill stays transparent so lifelines continue through it.
            const frame = PLAIN ? { h: 0 } : rect(`frame-${item.id}`, x, y, w, 0, null, 'fragment');
            if (!PLAIN) tab(`frame-${item.id}`, x, y, item.operator);
            const branches = [];
            for (let index = 0; index < item.branches.length; index++) {
                const branch = item.branches[index];
                if (index) {
                    y += 5;
                    if (!PLAIN) line(`frame-${item.id}-separator-${index}`, x, y, x + w, y, true, 'separator');
                    y += 6;
                }
                const branchTop = y;
                let onlineBox = null;
                if (PLAIN && item.id === 'care' && index === 1) {
                    const branchXs = collect(branch.events).map(id => byId.get(id).x);
                    const boxX = Math.min(...branchXs) - 42;
                    const boxW = Math.max(...branchXs) - boxX + 42;
                    onlineBox = rect('online-consultation-box', boxX, y, boxW, 0, null, 'online-box');
                    text('online-consultation-label', boxX + 14, y + 8, boxW - 28, ['Online consultation (for online bookings)'], 20, 'center', '#ffffff', 'online-heading');
                    y += 42;
                } else if (!PLAIN) {
                    const guardRows = wrap(`[${branch.guard}]`, w - 110);
                    text(`frame-${item.id}-guard-${index}`, x + 83, y + 3, w - 97, guardRows, FONT, 'left', '#ffffff', 'guard');
                    y += Math.max(34, guardRows.length * LINE_HEIGHT + 10);
                }
                drawEvents(branch.events, `${scope}/${item.id}:${index}`);
                if (onlineBox) {
                    onlineBox.h = y - branchTop + 7;
                    onlineBoxes.push({ x: onlineBox.x, y: onlineBox.y, w: onlineBox.w, h: onlineBox.h, messages: collect(branch.events), messageIds: branch.events.filter(event => event.type === 'message').map(event => event.id) });
                    y += 17;
                }
                branches.push({ guard: branch.guard, y: branchTop, end: y });
            }
            y += 2;
            frame.h = y - frameY;
            frames.push({ id: item.id, operator: item.operator, x, y: frameY, w, h: frame.h, branches, scope });
            y += PLAIN ? 8 : 10;
        }
    }
}
drawEvents(events);
const lifelineEnd = y + 8;
for (const p of participants) line(`lifeline-${p.id}`, p.x, lifelineStart, p.x, lifelineEnd, true, 'lifeline');

function activate(id, participantId, start, end) {
    const a = { id, participantId, x: byId.get(participantId).x - 6, y: start, w: 12, h: Math.max(13, end - start) };
    activations.push(a);
    rect(id, a.x, a.y, a.w, a.h, '#ffffff', 'activation');
}
for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.to === 'SYS' && m.kind === 'call') {
        let end = m.y + 13;
        for (let next = i + 1; next < messages.length; next++) {
            const following = messages[next];
            if (following.scope !== m.scope || (following.from !== 'SYS' && !(following.from === 'DB' && following.to === 'SYS' && following.kind === 'reply'))) break;
            end = following.y + 12;
        }
        activate(`activation-SYS-${m.id}`, 'SYS', m.y - 2, end);
    }
    if (m.to === 'DB' && m.kind === 'call') {
        const reply = messages[i + 1]?.from === 'DB' && messages[i + 1]?.kind === 'reply' ? messages[i + 1] : null;
        activate(`activation-DB-${m.id}`, 'DB', m.y - 2, reply ? reply.y + 10 : m.y + 14);
        if (!activations.some(a => a.participantId === 'SYS' && m.y >= a.y && m.y <= a.y + a.h)) {
            activate(`activation-SYS-${m.id}`, 'SYS', m.y - 3, m.y + 15);
        }
    }
}
const legendY = lifelineEnd + 17;
text('legend', 30, legendY, WIDTH - 60, wrap('SOLID FILLED ARROW: CALL   |   DASHED OPEN ARROW: REPLY   |   SOLID OPEN ARROW: UPDATE / HANDOFF', WIDTH - 60), FONT, 'center');
if (!PLAIN) text('legend-fragments', 30, legendY + 29, WIDTH - 60, wrap('OPT: OPTIONAL   |   ALT: SELECT ONE SERVICE   |   LOOP: REPEAT PER DUE ITEM   |   REF: EXPLAINED IN THE ACCOMPANYING NOTES', WIDTH - 60), FONT, 'center');
const HEIGHT = legendY + (PLAIN ? 0 : 29) + LINE_HEIGHT + 27;

// Explicit layer order is shared by SVG, editable XML and PNG.
const rank = p => p.role === 'lifeline' ? 0 : ['fragment', 'separator', 'online-box'].includes(p.role) ? 1 : p.role === 'activation' ? 2 : p.type === 'message' ? 3 : p.role === 'reference' ? 4 : 5;
primitives.sort((a, b) => rank(a) - rank(b));

function svg() {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title description">`,
        `<title id="title">${esc(title)} - Combined UML Sequence Diagram</title>`,
        `<desc id="description">Four role lifelines, iPawcus System and Database. ${PLAIN ? 'General sequence with login validation, persistence and return messages. No coded references or general grouping headings. Only online consultation for online bookings is boxed.' : 'Messages run top to bottom within guarded service alternatives.'} Large bold uppercase text; no activity-diagram symbols.</desc>`,
        `<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>`];
    for (const p of primitives) {
        const id = `id="${p.id}"`;
        if (p.type === 'rect') parts.push(`<rect ${id} x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill || 'none'}" stroke="${ink}" stroke-width="1.3"/>`);
        if (p.type === 'circle') parts.push(`<circle ${id} cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.fill || 'none'}" stroke="${ink}" stroke-width="1.5"/>`);
        if (p.type === 'polygon') parts.push(`<polygon ${id} points="${p.points.map(point => point.join(',')).join(' ')}" fill="${p.fill || 'none'}" stroke="${ink}" stroke-width="1.3"/>`);
        if (p.type === 'image') parts.push(`<image ${id} x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${p.data64}"/>`);
        if (p.type === 'line' || p.type === 'message') {
            const message = p.type === 'message';
            const x1 = p.x1, x2 = p.x2;
            const y1 = message ? p.y : p.y1, y2 = message ? p.y : p.y2;
            parts.push(`<line ${id} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${p.role === 'lifeline' ? 1 : 1.5}"${p.dash || p.kind === 'reply' ? ' stroke-dasharray="6 5"' : ''}/>`);
            if (message) {
                const dir = Math.sign(x2 - x1);
                const points = [[x2 - dir * 11, y2 - 5], [x2, y2], [x2 - dir * 11, y2 + 5]];
                parts.push(`<${p.kind === 'call' ? 'polygon' : 'polyline'} points="${points.map(pt => pt.join(',')).join(' ')}" fill="${p.kind === 'call' ? ink : 'none'}" stroke="${ink}" stroke-width="1.5"/>`);
            }
        }
        if (p.type === 'text') {
            if (p.fill) parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}"/>`);
            const x = p.align === 'center' ? p.x + p.w / 2 : p.x;
            p.lines.forEach((row, i) => parts.push(`<text ${i ? '' : id} x="${x}" y="${p.y + p.size + i * (p.size + 4)}" text-anchor="${p.align === 'center' ? 'middle' : 'start'}" font-family="Arial,sans-serif" font-size="${p.size}" font-weight="700" fill="${ink}">${esc(row)}</text>`));
        }
    }
    parts.push('</svg>');
    return parts.join('\n') + '\n';
}

function drawio() {
    const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<mxfile host="app.diagrams.net" type="device" compressed="false">',
        `<diagram id="combined-sequence" name="01 - Combined UML Sequence"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" page="1" pageWidth="${WIDTH}" pageHeight="${HEIGHT}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`];
    const vertex = (p, style, value = '', x = p.x, y = p.y, w = p.w, h = p.h) => parts.push(`<mxCell id="${p.id}" value="${esc(value)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    const edge = (p, x1, y1, x2, y2, end = 'none', filled = false, dash = false) => parts.push(`<mxCell id="${p.id}" style="edgeStyle=none;noEdgeStyle=1;rounded=0;html=0;strokeColor=${ink};strokeWidth=1.5;endArrow=${end};endFill=${filled ? 1 : 0};endSize=10;${dash ? 'dashed=1;dashPattern=6 5;' : ''}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry></mxCell>`);
    for (const p of primitives) {
        if (p.type === 'rect') vertex(p, `rounded=0;html=0;strokeColor=${ink};strokeWidth=1.3;fillColor=${p.fill || 'none'};`);
        if (p.type === 'circle') vertex(p, `ellipse;html=0;strokeColor=${ink};strokeWidth=1.5;fillColor=${p.fill || 'none'};`, '', p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        if (p.type === 'image') vertex(p, `shape=image;imageAspect=1;aspect=fixed;html=0;strokeColor=none;fillColor=none;image=data:image/png,${p.data64};`);
        if (p.type === 'polygon') {
            // Frame tab consists of editable lines and a white rectangular base.
            const x = Math.min(...p.points.map(pt => pt[0])), y = Math.min(...p.points.map(pt => pt[1]));
            const w = Math.max(...p.points.map(pt => pt[0])) - x, h = Math.max(...p.points.map(pt => pt[1])) - y;
            vertex({ ...p, id: `${p.id}-base` }, 'rounded=0;strokeColor=none;fillColor=#ffffff;', '', x, y, w, h);
            for (let i = 0; i < p.points.length; i++) {
                const a = p.points[i], b = p.points[(i + 1) % p.points.length];
                edge({ id: `${p.id}-${i}` }, a[0], a[1], b[0], b[1]);
            }
        }
        if (p.type === 'line') edge(p, p.x1, p.y1, p.x2, p.y2, 'none', false, p.dash);
        if (p.type === 'message') edge(p, p.x1, p.y, p.x2, p.y, p.kind === 'call' ? 'block' : 'open', p.kind === 'call', p.kind === 'reply');
        if (p.type === 'text') {
            const style = `text;html=0;whiteSpace=nowrap;align=${p.align};verticalAlign=top;spacing=0;fontFamily=Arial;fontSize=${p.size};fontStyle=1;fontColor=${ink};strokeColor=none;fillColor=${p.fill || 'none'};`;
            const value = p.lines.join('\n');
            if (p.parentMessage) {
                const message = messages.find(m => m.id === p.parentMessage);
                // A real edge-label child follows its message when the arrow is moved.
                parts.push(`<mxCell id="${p.id}" value="${esc(value)}" style="${style}" vertex="1" connectable="0" parent="${p.parentMessage}"><mxGeometry x="0" y="0" width="${p.w}" height="${p.h}" relative="1" as="geometry"><mxPoint x="${p.x - (message.x1 + message.x2) / 2}" y="${p.y - message.y}" as="offset"/></mxGeometry></mxCell>`);
            } else vertex(p, style, value);
        }
    }
    parts.push('</root></mxGraphModel></diagram></mxfile>');
    return parts.join('\n') + '\n';
}

function explanations() {
    if (PLAIN) return plainExplanations();
    const rows = ['# Combined system sequence diagram', '', title, '',
        'This figure is a conceptual UML sequence overview checked against the current React/PHP implementation on 8 October 2026. It is not an activity diagram, a physical deployment diagram or a live end-to-end test result.', '',
        '## How it was derived', '',
        '1. Identify the actors in the supplied sequence screenshots: Pet Owner, Admin and Super Admin. Two Pet Owner screenshots and two Super Admin screenshots are duplicates. The missing distinct Veterinarian sequence is derived from the current implementation, rather than inferred from a duplicate upload.',
        '2. Read the current booking, intake, consent, diagnosis, online consultation, prescription, billing, care and governance code. Check the revised workflows against their frontend service calls, backend persistence and notification helpers.',
        '3. Combine React and PHP into one conceptual iPawcus System participant. Keep Database distinct. This removes repeated UI-to-PHP forwarding without claiming that the real backend disappeared.',
        '4. Keep all four actors once. Retain the direction and ordering of meaningful requests, saved state and user results. Routine database acknowledgements and repeated authentication are summarized, not reversed.',
        '5. Separate service alternatives with ALT, conditional work with OPT, and dated medication completion with LOOP. Named REF interactions preserve supporting behavior without adding provider columns or repeating dozens of arrows.',
        '6. Increase all visible labels to at least 18 px, bold and uppercase. Role names are 22 px. Fit each message label above its own arrow and leave independent processing activation bars short.', '',
        '## Reading and scope', '', ...modelingNotes.map(n => `- ${n}`), '',
        'The top-to-bottom order is the order within the selected interaction, not a claim that four people share a session or that all optional blocks execute for every patient. Super Admin configuration/reporting and R3/R4 requests are independently invoked. A booked patient goes through Admin review; a walk-in skips booking. A standard medical visit selects the onsite branch, an online booking selects the call branch, and routine grooming/boarding selects its own care branch.', '',
        'A REF block names an interaction summarized here. It is not an activity step or a claim that unrelated external services are one server. This is an overview abstraction; expand the named interaction when implementation-level call-by-call detail is required.', '',
        '## What changed from the references', '',
        '- Separate PHP, location, meeting, notification and export columns are summarized at the system boundary or in R2; their identities are retained in the explanation.',
        '- Onsite availability follows clinic hours and accepting assigned veterinarians, with cross-clinic/online conflict protection. Grooming slots and boarding room capacity remain independent.',
        '- Admin owns physical examination, exam-time consent, images and veterinarian reassignment. Starting it appears on the assigned Vet\'s today-only My List. The Vet still handles clinical diagnosis and additional consent.',
        '- Online consultations retain their own availability, access checks, video call and diagnosis/prescription path; they do not require onsite physical intake.',
        '- Changed prescriptions remain synchronized with the pet, versioned and scheduled per medicine item. Owners start selected items or all items with dates, then track due occurrences. Onsite printing is guarded by printable medicine rows.',
        '- Record read/email access is not confused with a staff-reviewed, payment-checked correction request.',
        '- Report PDF/Excel export is represented as the current browser helper implementation, not as a fictional external generator. Meeting support is Jitsi/JaaS according to configuration, not unconditionally self-hosted.', '',
        '## Named reference interactions', ''];
    for (const [id, r] of Object.entries(references)) rows.push(`### ${id}: ${r.title}`, '', r.explanation, '', ...r.steps.map((step, i) => `${i + 1}. ${step}`), '');
    rows.push('## Message-by-message explanation', '', '| ID | Sender -> receiver | Message | Preserved meaning |', '| --- | --- | --- | --- |');
    for (const m of messages) rows.push(`| ${m.id} | ${m.from} -> ${m.to} | ${m.text} | ${m.explanation.replaceAll('|', '/')} |`);
    rows.push('', '## Source basis', '', 'Each evidence anchor was checked for file existence and matching text. Line numbers are snapshots and may move after subsequent edits. Evidence hashes are saved in sequence-layout.json; the renderer checks them again. This verifies traceability, not successful execution against a live database.', '', '| Source | Anchor |', '| --- | --- |');
    for (const e of evidence) rows.push(`| [${e.file}:${e.line}](../../${e.file}) | \`${e.needle.replaceAll('`', '')}\` |`);
    rows.push('', '## Reproduce', '', 'Run from the repository root:', '', '```powershell', 'python scripts/validate-render-combined-sequence.py --fonts', 'node scripts/generate-combined-sequence-diagram.mjs', 'python scripts/validate-render-combined-sequence.py', '```', '', 'Only documentation and generated diagram files are created. No app code, database schema, original uploaded image or pre-existing diagram is changed.', '');
    return rows.join('\n');
}

function plainExplanations() {
    const rows = ['# General system sequence diagram - plain presentation', '', title, '',
        'This revision follows the message-by-message style of the individual sequence examples, with four role lifelines in one figure. It removes coded references, control keywords and grouping headings. Only the online-consultation exchanges for online bookings retain a descriptive box. It is not an activity diagram or an instruction to create another figure.', '',
        '## How to read it', '', ...modelingNotes.map(note => `- ${note}`), '',
        '## Derivation and retained detail', '',
        'The examples supplied show Pet Owner, Admin and Super Admin; two owner and two Super Admin images are duplicates. Veterinarian actions are derived from the current implementation. Existing UI/service calls, PHP authorization/persistence and notification helpers were inspected to preserve actual directions and important state changes.', '',
        'The login exchange explicitly shows credential submission, account/role validation, returned account data and the session/dashboard result. It is drawn once rather than repeated four times; every role still signs in independently. Subsequent protected requests retain their own access checks.', '',
        'Booking separates available slots, initial pending confirmation and later Admin review. Onsite care retains Admin examination, owner signing, images, reassignment, My List progress and a veterinarian reading the patient/exam context before submitting diagnosis. Online access and diagnosis are shown as a different service, not a compulsory stage of an onsite visit.', '',
        'Medication plans retain item-level start dates and dated occurrences. New/changed plans notify the owner. Onsite printable medicines can trigger the print dialog even when their content is unchanged. No medicines means no automatic printing. Routine database replies are omitted where they add no new information; the visible user-facing returns are retained.', '',
        'This is a general overview of representative exchanges, not one literal execution that always includes all services, inventory, reports and backups. Conditions remain in the message labels; the online consultation is boxed separately. The login example applies independently to each role. Error/retry paths and all CRUD variants are not drawn.', '',
        '## Supporting behavior and integrity checks', ''];
    for (const r of Object.values(references)) rows.push(`### ${r.title}`, '', r.explanation.replace(/\s*\(R\d+\)/g, ''), '', ...r.steps.map((step, i) => `${i + 1}. ${step}`), '');
    rows.push('## Message-by-message basis', '', '| Sender -> receiver | Message | Preserved meaning |', '| --- | --- | --- |');
    for (const m of messages) rows.push(`| ${m.from} -> ${m.to} | ${m.text} | ${m.explanation.replaceAll('|', '/').replace(/\bR[1-5]\b/g, 'the supporting behavior notes')} |`);
    rows.push('', '## Source checks', '', 'Source paths and anchors were checked at generation and again before rendering. The saved SHA-256 snapshots establish which local implementation was used. This is a static documentation check, not a live database or end-to-end workflow test.', '', '| Source | Anchor |', '| --- | --- |');
    for (const item of evidence) rows.push(`| [${item.file}:${item.line}](../../${item.file}) | \`${item.needle.replaceAll('`', '')}\` |`);
    rows.push('', '## Reproduce', '', '```powershell', 'python scripts/validate-render-combined-sequence.py --plain --fonts', 'node scripts/generate-combined-sequence-diagram.mjs --plain', 'python scripts/validate-render-combined-sequence.py --plain', '```', '', 'The prior combined version and original activity/context/class diagrams are preserved. No app or database changes are made.', '');
    return rows.join('\n');
}

fs.writeFileSync(path.join(OUT, 'ipawcus-combined-sequence.drawio'), drawio());
fs.writeFileSync(path.join(OUT, 'ipawcus-combined-sequence.svg'), svg());
fs.writeFileSync(path.join(OUT, 'EXPLANATION-AND-SYSTEM-BASIS.md'), explanations());
fs.writeFileSync(path.join(OUT, 'sequence-layout.json'), JSON.stringify({ plain: PLAIN, title, width: WIDTH, height: HEIGHT, font: FONT, lineHeight: LINE_HEIGHT, participants, lifelineStart, lifelineEnd, events, frames, messages, refs, notes, onlineBoxes, logoAssets, activations, primitives, textItems, evidence, originalHashes }, null, 2));
console.log(JSON.stringify({ output, columns: participants.length, roles: participants.filter(p => p.actor).length, messages: messages.length, references: refs.length, boxesDrawn: PLAIN ? onlineBoxes.length : frames.length, logos: logoAssets.length, width: WIDTH, height: HEIGHT, minimumFont: FONT, uppercase: true, bold: true, evidenceChecks: evidence.length }, null, 2));
