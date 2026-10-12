// Generates plain, sample-style DFD documentation. Does not change app/DB code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overview, details, roles, stores, sources, primaryProcesses, contextFlows } from './simple-data-flow-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'outputs', 'ipawcus-context-2026-10-08-short-labels');
const projectTitle = 'iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic';
fs.mkdirSync(OUT, { recursive: true });
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('\n', '&#xa;');
const typography = { title: 24, note: 14, node: 16, flow: 14, increasePx: 2 };
// Unkerned Arial advances at 14 px, measured using the same Windows font as
// the preview renderer. Reserve true glyph widths, not character-count guesses.
const arial14 = [4,4,5,8,8,12.5,9.5,2.5,4.5,4.5,5.5,8,4,4.5,4,4,8,8,8,8,8,8,8,8,8,8,4,4,8,8,8,8,14,9.5,9.5,10,10,9.5,8.5,11,10,4,7,9.5,8,11.5,10,11,9.5,11,10,9.5,8.5,10,9.5,13,9.5,9.5,8.5,4,4,4,6.5,8,4.5,8,8,7,8,8,4,8,8,3,3,7,3,11.5,8,8,8,8,4.5,7,4,8,7,10,7,7,7,4.5,3.5,4.5,8];
const arial16 = [4.5,4.5,5.5,9,9,14,10.5,3,5.5,5.5,6,9.5,4.5,5.5,4.5,4.5,9,9,9,9,9,9,9,9,9,9,4.5,4.5,9.5,9.5,9.5,9,16,10.5,10.5,11.5,11.5,10.5,10,12.5,11.5,4.5,8,10.5,9,13.5,11.5,12.5,10.5,12.5,11.5,10.5,10,11.5,10.5,15,10.5,10.5,10,4.5,4.5,4.5,7.5,9,5.5,9,9,8,9,9,4.5,9,9,3.5,3.5,8,3.5,13.5,9,9,9,9,5.5,8,4.5,9,8,11.5,8,8,8,5.5,4,5.5,9.5];
const labelInfo = (label, size = typography.flow) => ({ text: label, fontSize: size,
    w: Math.ceil([...label].reduce((width, letter) => width + ((size === 16 ? arial16 : arial14)[letter.charCodeAt(0) - 32] ?? size), 0) + 4), h: size + 3 });

function layout(definition) {
    const page = { ...definition, nodes: [], edges: [] };
    const handoffs = [], connections = [], references = new Map();
    let top = 112;
    for (const block of definition.blocks) {
        const processId = definition.id + '-p-' + block.number;
        const sides = { left: [], right: [] };
        block.items.forEach((item, order) => {
            if (definition.level === 'overview' && item.ref.startsWith('process:')) {
                handoffs.push({ block, item, order });
                return;
            }
            const side = stores[item.ref] || item.ref.startsWith('process:') ? 'right' : 'left';
            sides[side].push({ ...item, order, side, block, processId });
        });
        const count = Math.max(sides.left.length, sides.right.length);
        const processNode = { id: processId, logicalId: block.number, type: 'process', name: block.name,
            number: block.number, feature: block.feature, x: 715, y: top, w: 245,
            h: Math.max(112, 28 + count * 28), header: 26 };
        page.nodes.push(processNode);
        for (const [side, items] of Object.entries(sides)) {
            for (const [port, item] of items.entries()) {
                const body = processNode.h - processNode.header;
                item.processY = top + processNode.header + (body - (items.length - 1) * 28) / 2 + port * 28;
                connections.push(item);
                if (!references.has(item.ref)) references.set(item.ref, { side, items: [] });
                references.get(item.ref).items.push(item);
            }
        }
        top += processNode.h + (definition.level === 'overview' && block.number === '2.0' ? 72 : 56);
    }
    const rightCount = connections.filter(item => item.side === 'right').length;
    const rightX = 1360 + Math.max(0, rightCount - 1) * 7 + 38;
    for (const side of ['left', 'right']) {
        let cursor = 112;
        const sidebar = [...references.entries()].filter(([, reference]) => reference.side === side);
        // Order by first use, and expose unique ports on a single shared figure.
        sidebar.sort((a, b) => a[1].items[0].processY - b[1].items[0].processY);
        for (const [ref, reference] of sidebar) {
            const isStore = !!stores[ref], isProcess = ref.startsWith('process:');
            const number = isProcess ? ref.slice(8) : undefined;
            const name = isStore ? stores[ref] : isProcess ? primaryProcesses[number] : roles[ref];
            if (!name) throw new Error('Unknown DFD reference: ' + ref);
            const firstItems = reference.items.filter(item => item.processId === reference.items[0].processId);
            const preferred = firstItems.reduce((sum, item) => sum + item.processY, 0) / firstItems.length;
            const header = isProcess ? 24 : 0;
            const h = Math.max(isProcess ? 96 : 68, header + 32 + (reference.items.length - 1) * 18);
            const node = { id: definition.id + '-ref-' + ref.replaceAll(':', '-'), logicalId: ref,
                type: isStore ? 'store' : isProcess ? 'process-reference' : 'entity',
                name, number, code: isStore ? ref : undefined, x: side === 'left' ? 60 : rightX,
                y: Math.max(cursor, preferred - h / 2), w: side === 'left' ? 170 : 230, h, header };
            page.nodes.push(node);
            cursor = node.y + h + 20;
            reference.items.forEach((item, port) => {
                item.reference = node;
                item.referenceY = node.y + header + (h - header - (reference.items.length - 1) * 18) / 2 + port * 18;
            });
        }
    }
    const laneCounters = { left: 0, right: 0 };
    for (const item of connections) {
        const { ref, side, block, processId, reference, processY, referenceY } = item;
        const inward = item.direction === 'in';
        const lane = (side === 'left' ? 248 : 1360) + laneCounters[side]++ * 7;
        const inner = { x: side === 'left' ? 715 : 960, y: processY };
        const outer = { x: side === 'left' ? reference.x + reference.w : reference.x, y: referenceY };
        const route = [outer, { x: lane, y: referenceY }, { x: lane, y: processY }, inner];
        const points = inward ? route : route.toReversed();
        const caption = labelInfo(item.label);
        Object.assign(caption, { x: side === 'left' ? inner.x - caption.w - 20 : inner.x + 65,
            y: processY - 22, lineY: processY, baseline: 14, segment: inward ? 2 : 0 });
        if (side === 'left' && caption.x < 248 + (connections.filter(entry => entry.side === 'left').length - 1) * 7 + 10)
            throw new Error('Flow label exceeds the reserved text corridor: ' + item.label);
        if (side === 'right' && caption.x + caption.w > 1350)
            throw new Error('Flow label exceeds the reserved text corridor: ' + item.label);
        page.edges.push({ id: processId + '-flow-' + item.order,
            source: inward ? reference.id : processId, target: inward ? processId : reference.id,
            logicalSource: inward ? ref : block.number, logicalTarget: inward ? block.number : ref,
            data: item.label, direction: item.direction, feature: block.feature, points, label: caption });
    }
    for (const { block, item, order } of handoffs) {
        const referenced = item.ref.slice(8);
        const sourceNumber = item.direction === 'in' ? referenced : block.number;
        const targetNumber = item.direction === 'in' ? block.number : referenced;
        const sourceNode = page.nodes.find(node => node.type === 'process' && node.number === sourceNumber);
        const targetNode = page.nodes.find(node => node.type === 'process' && node.number === targetNumber);
        const first = { x: sourceNode.x + sourceNode.w / 2, y: sourceNode.y + sourceNode.h };
        const laneX = targetNode.x + targetNode.w + 30;
        const points = [first, { x: first.x, y: first.y + 25 }, { x: laneX, y: first.y + 25 },
            { x: laneX, y: targetNode.y + targetNode.h - 12 }, { x: targetNode.x + targetNode.w, y: targetNode.y + targetNode.h - 12 }];
        const caption = labelInfo(item.label);
        if (caption.w > laneX - first.x - 8) throw new Error('Handoff caption does not fit.');
        Object.assign(caption, { x: first.x + 5, y: first.y + 3, lineY: first.y + 25, baseline: 14, segment: 1 });
        page.edges.push({ id: targetNode.id + '-flow-' + order, source: sourceNode.id, target: targetNode.id,
            logicalSource: sourceNumber, logicalTarget: targetNumber, data: item.label, feature: block.feature,
            direction: item.direction, points, label: caption });
    }
    page.width = rightCount ? rightX + 274 : 1070;
    page.height = Math.ceil(Math.max(top - 56, ...page.nodes.map(node => node.y + node.h)) + 56);
    return page;
}

// The overview is arranged by relationships rather than mandatory columns.
// The larger process expansions retain shared sidebars for dense data flows.
function flexibleOverview() {
    const page = { ...overview, nodes: [], edges: [], width: 2000, height: 1200,
        note: 'Each user role and data store appears once. Items are placed around their related processes.' };
    const processPositions = {
        '1.0': [590, 112, 160], '2.0': [590, 410, 215], '3.0': [590, 760, 128],
        '4.0': [1130, 940, 128], '5.0': [1130, 350, 160],
    };
    for (const block of overview.blocks) {
        const [x, y, h] = processPositions[block.number];
        page.nodes.push({ id: page.id + '-p-' + block.number, logicalId: block.number,
            type: 'process', number: block.number, name: block.name, feature: block.feature,
            x, y, w: 245, h, header: 26 });
    }
    const referencePositions = {
        owner: [60, 160, 170, 168], vet: [60, 480, 170, 68],
        admin: [60, 770, 170, 96], super: [1130, 88, 190, 100],
        D1: [1440, 206, 230, 68], D2: [1500, 550, 230, 100],
        D3: [650, 1080, 230, 68], D4: [1710, 930, 230, 96],
    };
    for (const [ref, position] of Object.entries(referencePositions)) {
        const [x, y, w, h] = position;
        page.nodes.push({ id: page.id + '-ref-' + ref, logicalId: ref,
            type: stores[ref] ? 'store' : 'entity', code: stores[ref] ? ref : undefined,
            name: stores[ref] || roles[ref], x, y, w, h, header: 0 });
    }
    // Coordinates run from source to recipient. Labels belong to the specified
    // horizontal segment, with dedicated clear space next to the process.
    const routes = {
        '1.0:0': [[[230, 182], [246, 182], [246, 166], [590, 166]], 2, 'left'],
        '1.0:1': [[[590, 194], [254, 194], [254, 206], [230, 206]], 0, 'left'],
        '1.0:2': [[[1130, 108], [1104, 108], [1104, 166], [835, 166]], 2, 'right'],
        '1.0:3': [[[835, 194], [1112, 194], [1112, 132], [1130, 132]], 0, 'right'],
        '1.0:4': [[[835, 238], [1440, 238]], 0, 'right'],
        '2.0:0': [[[230, 230], [262, 230], [262, 454], [590, 454]], 2, 'left'],
        '2.0:1': [[[590, 482], [270, 482], [270, 254], [230, 254]], 0, 'left'],
        '2.0:2': [[[230, 790], [286, 790], [286, 510], [590, 510]], 2, 'left'],
        '2.0:3': [[[590, 538], [294, 538], [294, 814], [230, 814]], 0, 'left'],
        '2.0:4': [[[230, 500], [302, 500], [302, 566], [590, 566]], 2, 'left'],
        '2.0:5': [[[590, 594], [310, 594], [310, 522], [230, 522]], 0, 'left'],
        '2.0:6': [[[835, 524], [1460, 524], [1460, 572], [1500, 572]], 0, 'right'],
        '3.0:0': [[[712.5, 625], [712.5, 666], [875, 666], [875, 740], [843, 740], [843, 866], [835, 866]], 1, 'handoff'],
        '3.0:1': [[[230, 278], [318, 278], [318, 802], [590, 802]], 2, 'left'],
        '3.0:2': [[[590, 830], [326, 830], [326, 302], [230, 302]], 0, 'left'],
        '3.0:3': [[[700, 1080], [700, 1030], [845, 1030], [845, 960], [645, 960], [645, 888]], 3, 'below'],
        '3.0:4': [[[620, 888], [620, 1000], [835, 1000], [835, 1050], [728, 1050], [728, 1080]], 1, 'below'],
        '4.0:0': [[[230, 838], [334, 838], [334, 922], [870, 922], [870, 982], [1130, 982]], 4, 'left'],
        '4.0:1': [[[1130, 1010], [878, 1010], [878, 914], [342, 914], [342, 862], [230, 862]], 0, 'left'],
        '4.0:2': [[[1375, 1000], [1680, 1000], [1680, 978], [1710, 978]], 0, 'right'],
        '5.0:0': [[[1200, 188], [1200, 292], [843, 292], [843, 386], [1130, 386]], 3, 'left'],
        '5.0:1': [[[1130, 414], [849, 414], [849, 300], [1226, 300], [1226, 188]], 0, 'left'],
        '5.0:2': [[[1500, 598], [1450, 598], [1450, 314], [870, 314], [870, 442], [1130, 442]], 4, 'left'],
        '5.0:3': [[[1710, 954], [1464, 954], [1464, 332], [862, 332], [862, 470], [1130, 470]], 4, 'left'],
    };
    for (const block of overview.blocks) {
        for (const [order, item] of block.items.entries()) {
            const [coordinates, segment, side] = routes[block.number + ':' + order];
            const points = coordinates.map(([x, y]) => ({ x, y }));
            const process = page.nodes.find(node => node.type === 'process' && node.number === block.number);
            const reference = page.nodes.find(node => node.logicalId === (item.ref.startsWith('process:') ? item.ref.slice(8) : item.ref));
            const inward = item.direction === 'in';
            const caption = labelInfo(item.label);
            const segmentStart = points[segment];
            Object.assign(caption, { x: side === 'left' ? process.x - caption.w - 20
                : side === 'right' ? process.x + process.w + 20 : Math.min(segmentStart.x, points[segment + 1].x) + 5,
                y: segmentStart.y - 22, lineY: segmentStart.y, baseline: 14, segment });
            page.edges.push({ id: process.id + '-flow-' + order,
                source: inward ? reference.id : process.id, target: inward ? process.id : reference.id,
                logicalSource: inward ? reference.logicalId : block.number,
                logicalTarget: inward ? block.number : reference.logicalId,
                data: item.label, direction: item.direction, feature: block.feature, points, label: caption });
        }
    }
    return page;
}

function revisedContext() {
    const page = { id: '00-context', title: 'iPawcus — Context Diagram', level: 'context',
        note: 'IN: User → System. OUT: System → User. Each role appears once; internal data stores are not shown.',
        contextTypography: { role: 19.5, flow: 16, roleIncreasePx: 3.5, flowIncreasePx: 2 },
        width: 1500, height: 750, nodes: [], edges: [], blocks: [{ number: '0',
            name: 'iPawcus: A Web-Based\nVeterinary Management\nSystem with Online Booking\nand Pet Record Management\nfor Vetfocus Care\nAnimal Clinic',
            feature: 'accounts', items: contextFlows.map(item => ({ ref: item.actor, label: item.shortLabel, direction: item.direction })) }] };
    if (page.blocks[0].name.replaceAll('\n', ' ') !== projectTitle)
        throw new Error('The context title must preserve the exact full project title.');
    const system = { id: page.id + '-p-0', logicalId: '0', type: 'process', number: '0',
        name: page.blocks[0].name, feature: 'accounts', x: 595, y: 280, w: 310, h: 260, header: 28,
        boldPrefix: 'iPawcus', numberBold: false, lineHeight: 17 };
    page.nodes.push(system);
    const positions = {
        super: [60, 130], admin: [60, 560], vet: [1210, 130], owner: [1210, 560],
    };
    for (const [actor, position] of Object.entries(positions)) {
        const [x, y] = position;
        const role = { id: page.id + '-ref-' + actor, logicalId: actor, type: 'entity',
            name: actor === 'super' ? 'Super Admin\n(Clinic Owner)' : actor === 'admin' ? 'Admin\n(Nurse / Staff)' : roles[actor],
            x, y, w: 230, h: 130, header: 0, fontSize: 19.5, lineHeight: 24, baselineOffset: 7 };
        page.nodes.push(role);
        const counters = { in: 0, out: 0 };
        contextFlows.filter(item => item.actor === actor).forEach((item, index) => {
            const inward = item.direction === 'in';
            const port = counters[item.direction]++;
            let coordinates, segment, labelX;
            const caption = labelInfo(item.shortLabel, page.contextTypography.flow);
            // Keep all four roles close to process 0. Coordinates are relative
            // to their figures; the 20 px vertical gaps match the supplied sample.
            if (actor === 'super' && inward) {
                const row = role.y + 36 + port * 38, column = system.x + 130 - port * 50;
                coordinates = [[role.x + role.w, row], [column, row], [column, system.y]];
                segment = 0; labelX = role.x + role.w + 12;
            } else if (actor === 'super') {
                const row = system.y + 44 + port * 28, column = role.x + 151 - port * 36;
                coordinates = [[system.x, row], [column, row], [column, role.y + role.h]];
                segment = 0; labelX = system.x - 20 - caption.w;
            } else if (actor === 'vet' && inward) {
                const row = system.y + 44 + port * 28, column = role.x + 52 + port * 42;
                coordinates = [[column, role.y + role.h], [column, row], [system.x + system.w, row]];
                segment = 1; labelX = system.x + system.w + 20;
            } else if (actor === 'vet') {
                const row = role.y + 36 + port * 38, column = system.x + 180 + port * 50;
                coordinates = [[column, system.y], [column, row], [role.x, row]];
                segment = 1; labelX = role.x - 20 - caption.w;
            } else if (actor === 'admin' && inward) {
                const row = system.y + 128 + port * 28, column = role.x + 52 + port * 42;
                coordinates = [[column, role.y], [column, row], [system.x, row]];
                segment = 1; labelX = system.x - 20 - caption.w;
            } else if (actor === 'admin') {
                const row = role.y + 36 + port * 38, column = system.x + 35 + port * 40;
                coordinates = [[column, system.y + system.h], [column, row], [role.x + role.w, row]];
                segment = 1; labelX = role.x + role.w + 12;
            } else if (inward) {
                const row = role.y + 17 + port * 32, column = system.x + 275 - port * 40;
                coordinates = [[role.x, row], [column, row], [column, system.y + system.h]];
                segment = 0; labelX = role.x - 20 - caption.w;
            } else {
                const row = system.y + 156 + port * 28, column = role.x + 178 - port * 42;
                coordinates = [[system.x + system.w, row], [column, row], [column, role.y]];
                segment = 0; labelX = system.x + system.w + 20;
            }
            const points = coordinates.map(([pointX, pointY]) => ({ x: pointX, y: pointY }));
            const lineY = points[segment].y;
            Object.assign(caption, { x: labelX, y: lineY - 24, lineY, baseline: 16, segment });
            page.edges.push({ id: page.id + '-flow-' + actor + '-' + index,
                source: inward ? role.id : system.id, target: inward ? system.id : role.id,
                logicalSource: inward ? actor : '0', logicalTarget: inward ? '0' : actor,
                data: item.shortLabel, fullData: item.data, direction: item.direction, feature: item.feature, covers: item.covers,
                points, label: caption });
        });
    }
    return page;
}
const context = revisedContext();
// Main diagram first; context and expansions are available without cluttering it.
const pages = [flexibleOverview(), context, ...details.map(layout)];

function svg(page) {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="title desc">`,
        `<title id="title">${esc(page.title)}</title><desc id="desc">Plain black-and-white logical data-flow diagram with roles, numbered processes, open-ended data stores and labeled data arrows.</desc>`,
        '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 4 L0 8 Z" fill="#000000"/></marker></defs>',
        '<rect width="100%" height="100%" fill="#ffffff"/>'];
    const text = (x, y, value, size = 15, center = false, bold = false, boldPrefix = '') => {
        const content = boldPrefix && value.startsWith(boldPrefix)
            ? `<tspan font-weight="700">${esc(boldPrefix)}</tspan>${esc(value.slice(boldPrefix.length))}` : esc(value);
        parts.push(`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#000000"${center ? ' text-anchor="middle"' : ''}${bold ? ' font-weight="700"' : ''}>${content}</text>`);
    };
    text(60, 34, page.title, typography.title);
    text(60, 64, page.note || 'Expansion of process ' + page.parent + '. Each user role and each data store appears once.', typography.note);
    for (const edge of page.edges) {
        parts.push(`<path d="${edge.points.map((point, index) => (index ? 'L' : 'M') + point.x + ' ' + point.y).join(' ')}" fill="none" stroke="#000000" stroke-width="1.2" marker-end="url(#arrow)"><title>${esc(edge.fullData || edge.data)}</title></path>`);
        text(edge.label.x, edge.label.y + edge.label.baseline, edge.data, edge.label.fontSize ?? typography.flow);
    }
    for (const node of page.nodes) {
        parts.push(`<g data-node="${esc(node.id)}"><title>${esc(node.logicalId)}</title>`);
        if (node.type === 'store') {
            parts.push(`<path d="M${node.x + node.w} ${node.y} H${node.x} V${node.y + node.h} H${node.x + node.w} M${node.x + 40} ${node.y} V${node.y + node.h}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            text(node.x + 20, node.y + node.h / 2 + 6, node.code, typography.node, true);
        } else {
            parts.push(`<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.type.startsWith('process') ? 11 : 0}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
        }
        if (node.type.startsWith('process')) {
            parts.push(`<line x1="${node.x}" y1="${node.y + node.header}" x2="${node.x + node.w}" y2="${node.y + node.header}" stroke="#000000" stroke-width="1.2"/>`);
            text(node.x + node.w / 2, node.y + 20, node.number, typography.node, true, node.numberBold !== false);
        }
        const rows = node.name.split('\n');
        const header = node.type.startsWith('process') ? node.header : 0;
        const centerX = node.x + (node.type === 'store' ? 40 + (node.w - 40) / 2 : node.w / 2);
        const centerY = node.y + header + (node.h - header) / 2;
        rows.forEach((row, index) => text(centerX, centerY + (node.baselineOffset ?? 6) + (index - (rows.length - 1) / 2) * (node.lineHeight ?? 19), row, node.fontSize ?? typography.node, true, node.type === 'entity', index === 0 ? node.boldPrefix : ''));
        parts.push('</g>');
    }
    parts.push('</svg>'); return parts.join('\n') + '\n';
}

function drawio(page) {
    const cells = [`<diagram id="${page.id}" name="${esc(page.title.replace('iPawcus — ', ''))}"><mxGraphModel grid="1" gridSize="10" page="1" pageWidth="${page.width}" pageHeight="${page.height}" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`];
    const textStyle = 'text;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;fillColor=none;strokeColor=none;fontFamily=Arial;fontSize=16;fontColor=#000000;';
    cells.push(`<mxCell id="title" value="${esc(page.title)}" style="${textStyle}align=left;fontSize=24;" vertex="1" parent="1"><mxGeometry x="60" y="12" width="${page.width - 120}" height="34" as="geometry"/></mxCell>`);
    cells.push(`<mxCell id="note" value="${esc(page.note || 'Expansion of process ' + page.parent + '. Each user role and each data store appears once.')}" style="${textStyle}align=left;fontSize=14;" vertex="1" parent="1"><mxGeometry x="60" y="47" width="${page.width - 120}" height="28" as="geometry"/></mxCell>`);
    for (const node of page.nodes) {
        const process = node.type.startsWith('process');
        const shape = process ? 'rounded=1;arcSize=10;absoluteArcSize=1;' : 'rounded=0;';
        const label = process ? '' : node.type === 'entity' ? node.name : '';
        const evidence = sources[page.blocks.find(block => block.number === node.number)?.feature] || [];
        const style = shape + `html=0;whiteSpace=wrap;align=center;verticalAlign=middle;fontSize=${node.fontSize ?? typography.node};fontFamily=Arial;fontColor=#000000;`
            + (node.type === 'store' ? 'fillColor=none;strokeColor=none;' : 'fillColor=#ffffff;strokeColor=#000000;')
            + 'strokeWidth=1.2;shadow=0;' + (node.type === 'entity' ? 'fontStyle=1;' : '');
        cells.push(`<object id="${esc(node.id)}" label="${esc(label)}" tooltip="${esc(node.logicalId + (evidence.length ? '\n' + evidence.join('\n') : ''))}"><mxCell style="${style}" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" as="geometry"/></mxCell></object>`);
        if (process) {
            const nameValue = node.boldPrefix
                ? '<b>' + esc(node.boldPrefix) + '</b>' + esc(node.name.slice(node.boldPrefix.length)).replaceAll('&#xa;', '<br>') : node.name;
            const nameStyle = node.boldPrefix ? textStyle.replace('html=0;', 'html=1;') : textStyle;
            cells.push(`<mxCell id="${esc(node.id)}-number" value="${esc(node.number)}" style="${textStyle}fontStyle=${node.numberBold === false ? 0 : 1};" vertex="1" parent="${esc(node.id)}"><mxGeometry width="${node.w}" height="${node.header}" as="geometry"/></mxCell>`);
            cells.push(`<mxCell id="${esc(node.id)}-divider" style="line;strokeColor=#000000;strokeWidth=1.2;" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.header}" width="${node.w}" height="0" as="geometry"/></mxCell>`);
            cells.push(`<mxCell id="${esc(node.id)}-name" value="${esc(nameValue)}" style="${nameStyle}" vertex="1" parent="${esc(node.id)}"><mxGeometry y="${node.header}" width="${node.w}" height="${node.h - node.header}" as="geometry"/></mxCell>`);
        } else if (node.type === 'store') {
            // Ordinary rectangular line primitives make the open right side
            // portable without relying on optional diagrams.net shape libraries.
            for (const [part, x, y, width, height] of [
                ['top-border', 0, 0, node.w, 1.2], ['bottom-border', 0, node.h - 1.2, node.w, 1.2],
                ['left-border', 0, 0, 1.2, node.h], ['divider', 40, 0, 1.2, node.h],
            ]) cells.push(`<mxCell id="${esc(node.id)}-${part}" style="rounded=0;fillColor=#000000;strokeColor=none;" vertex="1" parent="${esc(node.id)}"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`);
            cells.push(`<mxCell id="${esc(node.id)}-code" value="${node.code}" style="${textStyle}" vertex="1" parent="${esc(node.id)}"><mxGeometry width="40" height="${node.h}" as="geometry"/></mxCell>`);
            cells.push(`<mxCell id="${esc(node.id)}-name" value="${esc(node.name)}" style="${textStyle}" vertex="1" parent="${esc(node.id)}"><mxGeometry x="40" width="${node.w - 40}" height="${node.h}" as="geometry"/></mxCell>`);
        }
    }
    const byId = new Map(page.nodes.map(node => [node.id, node]));
    for (const edge of page.edges) {
        const source = byId.get(edge.source), target = byId.get(edge.target), first = edge.points[0], last = edge.points.at(-1);
        const description = edge.logicalSource + ' → ' + edge.logicalTarget + ': ' + edge.data
            + (edge.fullData ? '\n' + edge.fullData + '\n' + edge.covers.join('\n') : '');
        cells.push(`<object id="${edge.id}" label="" tooltip="${esc(description)}"><mxCell style="edgeStyle=none;html=0;rounded=0;endArrow=classic;endFill=1;endSize=7;strokeColor=#000000;strokeWidth=1.2;exitX=${(first.x - source.x) / source.w};exitY=${(first.y - source.y) / source.h};exitPerimeter=0;entryX=${(last.x - target.x) / target.w};entryY=${(last.y - target.y) / target.h};entryPerimeter=0;" edge="1" parent="1" source="${esc(edge.source)}" target="${esc(edge.target)}"><mxGeometry relative="1" as="geometry"><Array as="points">${edge.points.slice(1, -1).map(point => `<mxPoint x="${point.x}" y="${point.y}"/>`).join('')}</Array></mxGeometry></mxCell></object>`);
        cells.push(`<mxCell id="${edge.id}-label" value="${esc(edge.data)}" style="edgeLabel;html=0;align=left;verticalAlign=middle;spacing=0;fontFamily=Arial;fontSize=${edge.label.fontSize ?? typography.flow};fontColor=#000000;fillColor=none;strokeColor=none;resizable=0;" vertex="1" connectable="0" parent="${edge.id}"><mxGeometry x="-1" y="0" width="${edge.label.w}" height="${edge.label.h}" relative="1" as="geometry"><mxPoint x="${edge.label.x - first.x}" y="${edge.label.y - first.y}" as="offset"/></mxGeometry></mxCell>`);
    }
    cells.push('</root></mxGraphModel></diagram>'); return cells.join('\n');
}

const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/ipawcus-class-diagram-2026-10-06/system-source-model.json'), 'utf8'));
const databaseGroups = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/ipawcus-class-diagram-2026-10-06/schema-model.json'), 'utf8')).modules;
const ids = group => databaseGroups.find(item => item.id === group).names;
const medical = ids('pets').filter(name => /medical|vaccination|allerg|history|record_update/.test(name));
const storeTables = {
    D1: [...ids('identity'), ...ids('pets').filter(name => !medical.includes(name)), 'user_branch_assignments'],
    D2: [...ids('clinics').filter(name => name !== 'user_branch_assignments'), ...ids('bookings'), ...medical, 'clinical_intakes', 'online_consultations', 'online_consultation_diagnoses', 'online_consultation_reschedules', 'visits'],
    D3: [...ids('prescriptions').filter(name => !name.startsWith('online_')), ...ids('operations').filter(name => !name.startsWith('system_backup'))],
    D4: [...ids('care'), ...ids('inventory'), ...ids('billing').filter(name => name !== 'visits'), ...ids('operations').filter(name => name.startsWith('system_backup'))],
};
const derivation = ['# How the simple iPawcus data-flow diagram was derived', '',
    'This follows the supplied sample: plain rectangles for people, rounded numbered process boxes, open-ended data stores, and black labeled arrows. There are no colors, UML classes, database relationship lines, decisions, or decorative panels.', '',
    '## How to imitate this method', '',
    '1. Identify who sends or receives information: Pet Owner, Admin, Veterinarian, and Super Admin. Draw each role once per sheet as a rectangle, with all its flows connected to that same figure.',
    '2. Group related user actions into a few major functions. Give each function a verb-based name and number. The numbers identify functions, not execution order.',
    '3. Identify the information that must be saved. Group related records into logical data stores rather than drawing every SQL table. Draw each store once per sheet and connect all relevant processes to it.',
    '4. For each major function, ask: who provides the data, what data comes in, where is it saved/read, and who receives the result? Draw only these main arrows.',
    '5. Label arrows with the data being passed, such as "Booking details" or "Prescription details". Do not label them with commands like "Click", "Next", "Approve?", or "Yes/No".',
    '6. Keep extra queries, form fields, and detailed steps on separate process-expansion sheets. Give every arrow its own label, above its horizontal segment near the process. Reserve separate routing corridors so lines do not cross figures or any label.', '',
    'The main sheet does not require rigid columns. The super admin is next to account/report functions, the reports and operations processes sit to the right of clinical work, and the prescription store is below its process. Each role and each store remains a single shared figure. The detailed sheets use shared sidebars where the additional flows need more structure.', '',
    '## Applying that method to this project', '', '| User actions | Derived process | Main saved records |', '| --- | --- | --- |',
    '| Register/update accounts and pets; assign personnel to clinics | 1.0 Manage Accounts and Pets | D1 Account and Pet Records |',
    '| Set clinic acceptance/online availability; book; examine; capture consent; diagnose | 2.0 Manage Bookings and Clinical Care | D2 Booking and Clinical Records |',
    '| Issue/amend a pet prescription; start each item; generate dates; tick completed doses | 3.0 Manage Prescriptions and Schedules | D3 Prescription and Task Records |',
    '| Perform grooming/boarding, manage stock/services, verify payments and refund | 4.0 Manage Clinic Operations | D4 Clinic Operations and Billing Records |',
    '| Filter dashboards/reports, inspect activity, obtain backups | 5.0 Generate Reports and Monitor System | Reads existing records; no invented reports table |', '',
    '## One worked example', '',
    'The admin supplies examination findings, images, owner consent, and the assigned veterinarian. These are input data, so the admin is an external entity and the information labels an arrow. The system processes that input in 2.3 Conduct Physical Examination. It saves the exam and recording staff in D2, then returns examination/reassignment status and assigned-patient status. This is a data transformation, not a flowchart of button clicks.', '',
    'For prescriptions, 2.0 supplies medication details to 3.0. The owner supplies selected items, individual start dates, and completion updates. The system generates each item\'s dated occurrences, stores them in D3, and returns schedules, checklist state, and reminders. A clinic or online diagnosis can supply the prescription.', '',
    '## Scope and simplification', '',
    '- The first sheet is a concise overview of the main data transformations, not an exhaustive inventory of all HTTP requests, SQL reads, status updates, or notification deliveries. Detailed sheets add those important inputs/outputs without placing them all on the main page.',
    '- The context sheet shows the system as process 0 with the four roles. The five main processes are broad functional groups; detail numbers such as 2.3 expand their parent.',
    '- Data stores are logical groups, not physical tables or UML classes. Their exact table mapping is included below and in the JSON model.',
    '- A line shows data movement, not a foreign key, association multiplicity, or chronological sequence. Do not imitate accidental database-to-user or user-to-store shortcuts: all flows pass through a process.',
    '- Reports read existing clinical and operational data. There is no fictitious reports database. The main sheet shows the major report sources; the report detail sheet also shows account/pet sources. The backup process separately reads all four store groups.', '',
    '## Current changes represented', '',
    '- The admin performs the physical examination, captures consent, records examination provenance, and may reassign the veterinarian. The vet can still capture additional consent during diagnosis.',
    '- Onsite availability uses assigned/accepting vets and clinic hours, with one concurrent medical booking per vet. Online availability remains separate. Grooming and boarding keep their independent capacity rules.',
    '- The vet receives assigned case status during examination. Current-day My List and future booking/todo views are display projections of these booking/clinical/task records, not separate data stores.',
    '- Prescriptions are pet-specific, amendable/replacement-aware, and scheduled per item with individual start dates, frequency, duration and completion state. Clinic and online diagnosis both supply prescriptions.',
    '- Prescription notifications link owners to the relevant tasks. Prescription printing is an output of diagnosis when medication content exists; it is not a mandatory process for an empty prescription.',
    '- Grooming, boarding, stock, service catalogues, billing, refunds, notifications, reporting, activity and backups remain in scope.',
    '- The source migration defines clinical_intakes although the supplied SQL export omits it. The diagram describes that current examination workflow; no SQL or DB change was made.', '',
    '## Source evidence', ''];
for (const [feature, files] of Object.entries(sources)) {
    derivation.push('### ' + feature, '', ...files.map(file => `- [${file}](${ROOT.replaceAll('\\', '/')}/${file})`), '');
}
derivation.push('## Revised context: input and output directions', '',
    'The central process uses the exact project title, with line breaks for readability only: ' + projectTitle + '.', '',
    'The placement follows the original four-corner reference: Super Admin upper-left, Veterinarian upper-right, Admin lower-left, and Pet Owner lower-right. All four roles sit close to process 0, with only 20 px vertical clearance above and below the system. The canvas is 1500 by 750 px, reduced from 1880 by 1200 without shrinking the figures or text. Connections use its top, sides and bottom, with each caption above its own line. Context role labels are 19.5 px (+3.5 px) and flow labels are 16 px (+2 px); the other DFD sheets retain 16 px node labels and 14 px flows. Only iPawcus in the central title and the four role labels are bold; all other context text is regular.', '',
    'The cleanup centers process 0 between the role columns, with equal 305 px side gaps. System-side arrows use a consistent 28 px rhythm; top ports are evenly spaced by 50 px and bottom ports by 40 px. Role boxes share the same upper/lower alignment and size. No flow or role was removed.', '',
    'Context arrows now use short data-category labels of two to four words, matching the supplied sample. The original complete descriptions and grouped information are retained in each editable connector tooltip, this table, and the JSON model. This changes presentation, not the system boundary or arrow direction.', '',
    'The system is one process numbered 0. IN is always role to system; OUT is always system to role. Placement does not change that meaning. Each role appears once, and no internal data store is shown on the context sheet.', '',
    'Consent signatures originate with the owner. Admin records the initial signed consent during physical examination, and the vet may record additional owner consent. These are complementary inputs, not a claim that staff sign as the owner.', '',
    'The vet sends clinic booking acceptance and independent online availability. The system returns assigned bookings, examination status, and calendar data. The old Branch Visit Schedule label is replaced. Task Calendar is an output, while task details/completion are inputs.', '',
    'The current activity log covers clinic staff, so the output is named staff history rather than implying pet-owner activity is logged. Lab findings can be entered and retrieved as clinical data; this is not an external laboratory integration.', '',
    '| Role | Direction | Short label | Full description | Information grouped under this label |',
    '| --- | --- | --- | --- | --- |');
for (const item of contextFlows) derivation.push(`| ${roles[item.actor]} | ${item.direction === 'in' ? 'Role → System' : 'System → Role'} | ${item.shortLabel} | ${item.data} | ${item.covers.join('; ')} |`);
derivation.push('', 'The context and detailed sheets document source-supported scope. The compact main sheet remains a representative overview, not an exhaustive formal boundary inventory. This revision does not certify the deployed server or database.', '');

derivation.push('## Logical data store mapping', '');
for (const [code, tables] of Object.entries(storeTables)) derivation.push('### ' + code + ' — ' + stores[code].replaceAll('\n', ' '), '', tables.map(table => '`' + table + '`').join(', '), '');

for (const page of pages) fs.writeFileSync(path.join(OUT, page.id + '.svg'), svg(page));
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" type="device" compressed="false" modified="' + new Date().toISOString() + '">\n' + pages.map(drawio).join('\n') + '\n</mxfile>\n';
const canonical = path.join(ROOT, 'ipawcus-data-flow-diagram.drawio');
const backup = path.join(OUT, 'previous-ipawcus-data-flow-diagram.drawio');
if (fs.existsSync(canonical) && !fs.existsSync(backup)) fs.copyFileSync(canonical, backup);
fs.writeFileSync(canonical, xml);
fs.writeFileSync(path.join(OUT, 'ipawcus-data-flow-simple.drawio'), xml);
const contextXml = '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" type="device" compressed="false">\n' + drawio(context) + '\n</mxfile>\n';
const contextCanonical = path.join(ROOT, 'ipawcus-context-diagram-revised.drawio');
const contextBackup = path.join(OUT, 'previous-ipawcus-context-diagram-revised.drawio');
if (fs.existsSync(contextCanonical) && !fs.existsSync(contextBackup)) fs.copyFileSync(contextCanonical, contextBackup);
fs.writeFileSync(contextCanonical, contextXml);
fs.writeFileSync(path.join(OUT, 'ipawcus-context-diagram-revised.drawio'), contextXml);
fs.writeFileSync(path.join(OUT, 'HOW-IT-WAS-DERIVED.md'), derivation.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'dfd-model.json'), JSON.stringify({ sourceRoot: ROOT.replaceAll('\\', '/'), projectTitle, pages, roles, stores, storeTables, sources,
    typography, contextFlows, schemaTables: metadata.tables.map(table => table.name), scope: 'Concise overview plus context and detailed expansions; not an ERD or exhaustive boundary inventory.' }, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'REVISION-NOTES.md'), [
    '# iPawcus diagram revision — October 8, 2026', '',
    '- Increased the base DFD typography by 2 px: flow labels and notes 12 → 14 px; role/process/store labels and numbers 14 → 16 px; titles 22 → 24 px.',
    '- Applied the additional context-only increases: role labels 16 → 19.5 px (+3.5 px), and flow labels 14 → 16 px (+2 px).',
    '- Moved all four roles closer to process 0: 20 px above/below the system, with reduced horizontal routing corridors and a 1500 by 750 px canvas. Figures and font sizes are unchanged.',
    '- Cleaned the alignment: equal 305 px side gaps, consistent 28 px side-arrow spacing, evenly distributed top/bottom ports, and symmetric role connection points.',
    '- Tightened the central process title line spacing to 17 px without changing its font size or the column gaps.',
    '- Shortened all 28 context arrow labels to two-to-four-word data categories. Full meanings remain in editable connector tooltips and the derivation/model; directions, scope, fonts and geometry are unchanged.',
    '- Bolded only iPawcus in the central title and the four role labels. The rest of the context text, including process 0, remains regular.',
    '- Preserved the exact full project title in process 0: ' + projectTitle + '.',
    '- Revised the context diagram against the current source, with four roles shown once and one process 0. Input arrows end at the system; output arrows end at the role.',
    '- Added physical examination findings/photos, initial consent and vet reassignment; retained additional consent during veterinarian diagnosis.',
    '- Replaced obsolete branch-visit scheduling with per-clinic booking acceptance and independent online availability. The vet calendar is a system output, not a submitted calendar.',
    '- Added pet-specific prescription updates, per-item start dates/completion inputs, and dated checklist/reminder outputs for clinic and online prescriptions.',
    '- Included grooming/boarding, service/inventory, billing/refunds, staff history, media monitoring and backup requests/results as concise data groups.',
    '- Kept flexible main-sheet placement, monochrome figures, one role/store per sheet, individual labels above their owning arrow, and clear routing corridors.',
    '- Kept the previous editable DFD and context backups in this folder and left all earlier preview folders, including the larger four-corner arrangement, intact. No application, database, or dashboard debug-bypass change.', '',
    'For derivation, grouping details, and source references, see HOW-IT-WAS-DERIVED.md. Validation and previews are generated by scripts/validate-render-simple-dfd.py.', '',
].join('\n'));
console.log('Updated ' + canonical);
console.log('Preserved previous diagram in ' + backup);
console.log(pages.map(page => page.id + ': ' + page.blocks.length + ' processes / ' + page.edges.length + ' flows').join('\n'));
