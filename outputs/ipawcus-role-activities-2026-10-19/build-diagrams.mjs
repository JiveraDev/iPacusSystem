import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { workflows } from './workflows.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const measure = new jsPDF({ unit: 'pt' });
const ink = '#171717';
const quiet = '#555555';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const xmlText = value => escape(value).replaceAll('\n', '&#xa;');
const center = n => [n.x + n.w / 2, n.y + n.h / 2];
const port = (n, side) => {
    const [x, y] = center(n);
    return side === 'top' ? [x, n.y] : side === 'bottom' ? [x, n.y + n.h]
        : side === 'left' ? [n.x, y] : [n.x + n.w, y];
};
const wrap = (value, width, size, bold = false) => {
    measure.setFont('helvetica', bold ? 'bold' : 'normal');
    measure.setFontSize(size);
    return value.split('\n').flatMap(line => measure.splitTextToSize(line, width));
};

function build(workflow) {
    const width = workflow.areas.length * 360 + 180;
    const mid = width / 2;
    const model = { ...workflow, width, nodes: [], edges: [], texts: [] };
    const nodes = new Map();
    const add = (id, text, actor, x, y, w = 272, kind = 'action') => {
        const size = kind === 'decision' ? 15 : 16;
        const rows = wrap(text, kind === 'decision' ? w * 0.6 : w - 24, size);
        const h = kind === 'start' || kind === 'end' ? 22 : kind === 'merge' ? 32
            : kind === 'decision' ? Math.max(104, rows.length * 21 + 44)
                : Math.max(80, rows.length * 21 + (actor ? 31 : 20));
        const node = { id, text, actor: actor || '', x: x - w / 2, y, w, h, kind, rows, size };
        model.nodes.push(node);
        nodes.set(id, node);
        return node;
    };
    const text = (value, x, y, w, h, size = 16, bold = false, align = 'center', color = ink, background = false) => {
        model.texts.push({ value, rows: wrap(value, w - 8, size, bold), x, y, w, h, size, bold, align, color, background });
    };
    const edge = (from, to, fromSide = 'bottom', toSide = 'top', via = [], label = '', labelBox) => {
        const a = nodes.get(from), b = nodes.get(to);
        const points = [port(a, fromSide), ...via, port(b, toSide)]
            .filter((point, index, all) => index === 0 || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1]);
        model.edges.push({ id: `e${model.edges.length + 1}`, from, to, fromSide, toSide, points, label, labelBox });
    };
    const straight = (a, b, label = '') => {
        const source = nodes.get(a);
        edge(a, b, 'bottom', 'top', [], label, label ? {
            x: source.x + source.w / 2 + 10, y: source.y + source.h + 7, w: 42, h: 22,
        } : undefined);
    };

    text(`iPawcus  |  ${workflow.role} Activity Diagram`, 60, 25, width - 120, 45, 30, true, 'left');
    text(workflow.subtitle, 60, 78, width - 120, 28, 16, false, 'left', quiet);
    text('Current local implementation reviewed: 19 October 2026  |  Rounded box: activity  |  Diamond: decision / merge  |  Small label: responsible actor',
        60, 116, width - 120, 28, 13, false, 'left', quiet);
    add('start', '', '', mid, 165, 22, 'start');
    add('login', workflow.login, workflow.role, mid, 215, 440);
    add('auth', 'Validate credentials / Google identity,\nemail verification, token, and role access', 'System', mid, 340, 440);
    add('authorized', 'Access\nauthorized?', '', mid, 463, 260, 'decision');
    add('authError', 'Show access error; correct account /\nverification details and retry sign-in', workflow.role, mid - 490, 475, 330);
    add('dashboard', workflow.dashboard, 'System', mid, 612, 440);
    add('choose', 'Choose one\nactivity', '', mid, 735, 320, 'decision');
    straight('start', 'login');
    straight('login', 'auth');
    straight('auth', 'authorized');
    edge('authorized', 'authError', 'left', 'right', [], 'No', { x: mid - 245, y: 490, w: 42, h: 22 });
    const errorLeft = port(nodes.get('authError'), 'left');
    const loginLeft = port(nodes.get('login'), 'left');
    edge('authError', 'login', 'left', 'left', [[errorLeft[0] - 35, errorLeft[1]], [errorLeft[0] - 35, loginLeft[1]]]);
    straight('authorized', 'dashboard', 'Yes');
    straight('dashboard', 'choose');

    const firstY = 960;
    const endings = [];
    const exitRecoveries = [];
    let maxBottom = firstY;
    for (const [index, area] of workflow.areas.entries()) {
        const cx = 270 + index * 360;
        const prefix = `c${index + 1}-`;
        let y = firstY;
        let previous;
        let first;
        let pendingGate;
        for (const step of area.steps) {
            const id = prefix + step.id;
            const node = add(id, step.text, step.kind === 'gate' ? '' : step.actor, cx, y, 272,
                step.kind === 'gate' ? 'decision' : 'action');
            first ||= node;
            if (pendingGate) {
                const source = pendingGate.decision;
                const from = port(source, 'right'), to = port(node, 'right');
                const rail = cx + 159;
                edge(source.id, node.id, 'right', 'right', [[rail, from[1]], [rail, to[1]]], 'Yes', {
                    x: rail - 10, y: from[1] + 10, w: 38, h: 22,
                });
                pendingGate = null;
            } else if (previous) straight(previous.id, node.id);
            y += node.h + 42;
            if (step.kind === 'gate') {
                const recovery = add(id + '-recovery', step.recovery, step.actor, cx, y);
                straight(id, recovery.id, 'No');
                if (step.retry === 'exit') {
                    exitRecoveries.push({ recovery, cx, prefix });
                } else {
                    const target = nodes.get(prefix + step.retry);
                    if (!target) throw new Error(`Unknown retry target: ${prefix + step.retry}`);
                    const from = port(recovery, 'left'), to = port(target, 'left');
                    const rail = cx - 159;
                    edge(recovery.id, target.id, 'left', 'left', [[rail, from[1]], [rail, to[1]]]);
                }
                y += recovery.h + 42;
                pendingGate = { decision: node, recovery };
                previous = null;
            } else previous = node;
        }
        if (pendingGate) throw new Error(`Last step cannot be a gate: ${area.title}`);
        endings.push({ last: previous, cx, prefix });
        maxBottom = Math.max(maxBottom, y);
        const from = port(nodes.get('choose'), 'bottom');
        edge('choose', first.id, 'bottom', 'top', [[from[0], 895], [cx, 895]], `[${area.title}]`, {
            x: cx - 154, y: 910, w: 308, h: 36,
        });
    }

    const localMergeY = maxBottom + 30;
    for (const { last, cx, prefix } of endings) {
        const node = add(prefix + 'merge', '', '', cx, localMergeY, 32, 'merge');
        straight(last.id, node.id);
    }
    for (const { recovery, cx, prefix } of exitRecoveries) {
        const from = port(recovery, 'left');
        const merge = nodes.get(prefix + 'merge');
        const target = port(merge, 'left');
        edge(recovery.id, merge.id, 'left', 'left', [[cx - 159, from[1]], [cx - 159, target[1]]]);
    }
    const globalMerge = add('merge', '', '', mid, localMergeY + 130, 36, 'merge');
    for (const { cx, prefix } of endings) {
        edge(prefix + 'merge', 'merge', 'bottom', 'top', [[cx, localMergeY + 93], [mid, localMergeY + 93]]);
    }
    add('again', 'Perform another\nactivity?', '', mid, globalMerge.y + 88, 280, 'decision');
    straight('merge', 'again');
    const again = nodes.get('again');
    const from = port(again, 'right'), choose = port(nodes.get('choose'), 'right');
    edge('again', 'choose', 'right', 'right', [[width - 35, from[1]], [width - 35, choose[1]]], 'Yes', {
        x: width - 92, y: from[1] - 30, w: 44, h: 22,
    });
    add('logout', 'Log out; clear local session', workflow.role, mid, again.y + again.h + 48, 360);
    straight('again', 'logout', 'No');
    const logout = nodes.get('logout');
    add('end', '', '', mid, logout.y + logout.h + 42, 22, 'end');
    straight('logout', 'end');

    let noteY = nodes.get('end').y + 65;
    text('Reading the revised diagram', 60, noteY, width - 120, 30, 17, true, 'left');
    noteY += 39;
    const baseNotes = [
        'Columns are alternative work areas. Merge diamonds combine alternatives; they do not wait for every activity to finish. Pending reviews may be revisited later.',
        'Use the selected action\'s validation rules. For a timeout or uncertain write result, refresh the record before resubmitting. Leaving an activity returns to the menu.',
        ...workflow.notes,
    ];
    for (const note of baseNotes) {
        const h = wrap(note, width - 132, 14).length * 20 + 10;
        text(note, 60, noteY, width - 120, h, 14, false, 'left', quiet);
        noteY += h;
    }
    model.height = noteY + 35;
    return model;
}

function validate(model) {
    const byId = new Map(model.nodes.map(n => [n.id, n]));
    if (byId.size !== model.nodes.length) throw new Error('Duplicate node ID');
    const reach = (initial, reverse) => {
        const seen = new Set([initial]), stack = [initial];
        while (stack.length) {
            const current = stack.pop();
            for (const e of model.edges) {
                const next = reverse ? (e.to === current ? e.from : null) : (e.from === current ? e.to : null);
                if (next && !seen.has(next)) { seen.add(next); stack.push(next); }
            }
        }
        return seen;
    };
    const fromStart = reach('start', false), toEnd = reach('end', true);
    for (const n of model.nodes) {
        if (!fromStart.has(n.id) || !toEnd.has(n.id)) throw new Error(`Unreachable / stranded node: ${n.id}`);
        if (n.kind === 'decision' && model.edges.filter(e => e.from === n.id).length < 2) throw new Error(`Missing decision branch: ${n.id}`);
        if (n.x < 0 || n.y < 0 || n.x + n.w > model.width || n.y + n.h > model.height) throw new Error(`Node outside page: ${n.id}`);
    }
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = 0; i < model.nodes.length; i++) for (let j = i + 1; j < model.nodes.length; j++) {
        if (overlaps(model.nodes[i], model.nodes[j])) throw new Error(`Overlapping nodes: ${model.nodes[i].id} / ${model.nodes[j].id}`);
    }
    let segments = 0;
    for (const e of model.edges) for (let i = 1; i < e.points.length; i++) {
        const [a, b] = [e.points[i - 1], e.points[i]];
        if (a[0] !== b[0] && a[1] !== b[1]) throw new Error(`Diagonal edge: ${e.id}`);
        segments++;
        for (const n of model.nodes) {
            if (n.id === e.from || n.id === e.to) continue;
            const hits = a[0] === b[0]
                ? a[0] > n.x + 0.1 && a[0] < n.x + n.w - 0.1 && Math.max(a[1], b[1]) > n.y + 0.1 && Math.min(a[1], b[1]) < n.y + n.h - 0.1
                : a[1] > n.y + 0.1 && a[1] < n.y + n.h - 0.1 && Math.max(a[0], b[0]) > n.x + 0.1 && Math.min(a[0], b[0]) < n.x + n.w - 0.1;
            if (hits) throw new Error(`Edge ${e.id} crosses node ${n.id}`);
        }
    }
    return { role: model.role, nodes: model.nodes.length, edges: model.edges.length, segments, allReachable: true, allCanExit: true, nodeOverlaps: 0, edgeNodeCrossings: 0 };
}

function textRows(node, yOverride) {
    const leading = node.size * 1.31;
    const height = node.rows.length * leading;
    const total = height + (node.actor ? 20 : 0);
    const y = yOverride ?? node.y + (node.h - total) / 2 + node.size;
    const cx = node.x + node.w / 2;
    const result = node.rows.map((row, i) => ({ text: row, x: cx, y: y + i * leading, size: node.size, align: 'center', color: ink }));
    if (node.actor) result.push({ text: node.actor, x: cx, y: y + height + 5, size: 11, align: 'center', color: quiet });
    return result;
}

function svg(model) {
    const result = [`<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-labelledby="title description">`,
        `<title id="title">${escape(model.role)} revised activity diagram</title>`,
        '<desc id="description">Current iPawcus workflow, reviewed 19 October 2026. Alternative activity branches use decisions and merges; actor labels identify responsibility.</desc>',
        '<defs><marker id="arrow" markerWidth="8" markerHeight="7" refX="8" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 3.5 L0 7 Z" fill="#171717"/></marker></defs>',
        '<rect width="100%" height="100%" fill="white"/>'];
    for (const e of model.edges) result.push(`<polyline points="${e.points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round" marker-end="url(#arrow)"/>`);
    const drawText = item => `<text x="${item.x}" y="${item.y}" font-family="Arial,Helvetica,sans-serif" font-size="${item.size}" font-weight="${item.bold ? 700 : 400}" text-anchor="${item.align === 'left' ? 'start' : 'middle'}" fill="${item.color || ink}">${escape(item.text)}</text>`;
    for (const n of model.nodes) {
        const [cx, cy] = center(n);
        if (n.kind === 'start' || n.kind === 'end') {
            result.push(`<circle cx="${cx}" cy="${cy}" r="${n.w / 2}" stroke="${ink}" fill="${n.kind === 'start' ? ink : 'white'}" stroke-width="1.6"/>`);
            if (n.kind === 'end') result.push(`<circle cx="${cx}" cy="${cy}" r="${n.w / 2 - 4}" fill="${ink}"/>`);
        } else if (n.kind === 'decision' || n.kind === 'merge') {
            result.push(`<polygon points="${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}" fill="white" stroke="${ink}" stroke-width="1.6"/>`);
        } else result.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="white" stroke="${ink}" stroke-width="1.6"/>`);
        result.push(...textRows(n).map(drawText));
    }
    for (const e of model.edges) if (e.label) {
        const b = e.labelBox;
        const rows = wrap(e.label, b.w - 4, e.from === 'choose' ? 17 : 13, true);
        result.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="white"/>`);
        rows.forEach((text, i) => result.push(drawText({ text, x: b.x + b.w / 2, y: b.y + 16 + i * 20, size: e.from === 'choose' ? 17 : 13, bold: true })));
    }
    for (const t of model.texts) t.rows.forEach((row, i) => result.push(drawText({ ...t, text: row,
        x: t.align === 'left' ? t.x + 4 : t.x + t.w / 2, y: t.y + t.size + i * (t.size * 1.4) })));
    result.push('</svg>');
    return result.join('\n') + '\n';
}

function drawio(model) {
    const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
    const common = 'html=0;whiteSpace=wrap;fontFamily=Arial;fontSize=16;fontColor=#171717;strokeColor=#171717;strokeWidth=1.6;fillColor=#ffffff;';
    for (const n of model.nodes) {
        const shape = n.kind === 'start' ? 'ellipse;fillColor=#171717;aspect=fixed;' : n.kind === 'end' ? 'shape=endState;aspect=fixed;'
            : ['decision', 'merge'].includes(n.kind) ? 'rhombus;' : 'rounded=1;arcSize=10;';
        const noText = n.actor ? '' : xmlText(n.text);
        cells.push(`<mxCell id="${n.id}" value="${noText}" style="${common}${shape}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`);
        if (n.actor) for (const [i, row] of textRows(n).entries()) {
            cells.push(`<mxCell id="${n.id}-text-${i}" value="${xmlText(row.text)}" style="text;html=0;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=${row.size};fontColor=${row.color};strokeColor=none;fillColor=none;" vertex="1" connectable="0" parent="${n.id}"><mxGeometry x="4" y="${row.y - n.y - row.size}" width="${n.w - 8}" height="${row.size + 5}" as="geometry"/></mxCell>`);
        }
    }
    const anchors = { top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5] };
    for (const e of model.edges) {
        const [sx, sy] = anchors[e.fromSide], [tx, ty] = anchors[e.toSide];
        const points = e.points.slice(1, -1).map(p => `<mxPoint x="${p[0]}" y="${p[1]}"/>`).join('');
        cells.push(`<mxCell id="${e.id}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;strokeColor=#171717;strokeWidth=1.6;endArrow=block;endFill=1;endSize=8;exitX=${sx};exitY=${sy};entryX=${tx};entryY=${ty};exitPerimeter=0;entryPerimeter=0;" edge="1" parent="1" source="${e.from}" target="${e.to}"><mxGeometry relative="1" as="geometry"><Array as="points">${points}</Array></mxGeometry></mxCell>`);
        if (e.label) {
            const b = e.labelBox;
            cells.push(`<mxCell id="${e.id}-label" value="${xmlText(e.label)}" style="text;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;fontFamily=Arial;fontSize=${e.from === 'choose' ? 17 : 13};fontStyle=1;fillColor=#ffffff;strokeColor=none;" vertex="1" connectable="0" parent="1"><mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/></mxCell>`);
        }
    }
    for (const [i, t] of model.texts.entries()) cells.push(`<mxCell id="text-${i}" value="${xmlText(t.value)}" style="text;html=0;whiteSpace=wrap;align=${t.align};verticalAlign=top;fontFamily=Arial;fontSize=${t.size};fontStyle=${t.bold ? 1 : 0};fontColor=${t.color};strokeColor=none;fillColor=none;" vertex="1" connectable="0" parent="1"><mxGeometry x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" as="geometry"/></mxCell>`);
    return `<diagram id="${model.id}" name="${model.role}"><mxGraphModel page="1" pageScale="1" pageWidth="${model.width}" pageHeight="${model.height}" grid="1" gridSize="10" background="#ffffff"><root>${cells.join('\n')}</root></mxGraphModel></diagram>`;
}

function mermaid(model) {
    const result = ['flowchart TB'];
    // Prefix every identifier, including the otherwise reserved lowercase end.
    const mermaidId = id => 'n_' + id.replaceAll('-', '_');
    for (const n of model.nodes) {
        const label = (n.text + (n.actor ? `\n(${n.actor})` : '')).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('\n', '<br/>');
        result.push(`    ${mermaidId(n.id)}${n.kind === 'start' ? '(("Start"))' : n.kind === 'end' ? '(("End"))'
            : ['decision', 'merge'].includes(n.kind) ? `{"${label || ' '}"}` : `("${label}")`}`);
    }
    for (const e of model.edges) result.push(`    ${mermaidId(e.from)} -->${e.label ? `|"${e.label}"|` : ''} ${mermaidId(e.to)}`);
    return result.join('\n') + '\n';
}

function pdfPage(pdf, model) {
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const scale = Math.min((pageW - 48) / model.width, (pageH - 48) / model.height);
    const ox = (pageW - model.width * scale) / 2, oy = 24;
    const X = x => ox + x * scale, Y = y => oy + y * scale;
    const line = (points, arrow = false) => {
        pdf.setDrawColor(ink); pdf.setLineWidth(1.6 * scale);
        for (let i = 1; i < points.length; i++) pdf.line(X(points[i - 1][0]), Y(points[i - 1][1]), X(points[i][0]), Y(points[i][1]));
        if (arrow) {
            const [a, b] = points.slice(-2), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const dx = (b[0] - a[0]) / length, dy = (b[1] - a[1]) / length;
            pdf.setFillColor(ink);
            pdf.triangle(X(b[0]), Y(b[1]), X(b[0] - dx * 8 + dy * 3.5), Y(b[1] - dy * 8 - dx * 3.5), X(b[0] - dx * 8 - dy * 3.5), Y(b[1] - dy * 8 + dx * 3.5), 'F');
        }
    };
    const text = item => {
        pdf.setFont('helvetica', item.bold ? 'bold' : 'normal'); pdf.setFontSize(item.size * scale);
        pdf.setTextColor(item.color || ink); pdf.text(item.text, X(item.x), Y(item.y), { align: item.align === 'left' ? 'left' : 'center' });
    };
    for (const e of model.edges) line(e.points, true);
    for (const n of model.nodes) {
        const [cx, cy] = center(n);
        pdf.setDrawColor(ink); pdf.setFillColor('#ffffff'); pdf.setLineWidth(1.6 * scale);
        if (n.kind === 'start' || n.kind === 'end') {
            if (n.kind === 'start') pdf.setFillColor(ink);
            pdf.circle(X(cx), Y(cy), n.w / 2 * scale, 'FD');
            if (n.kind === 'end') { pdf.setFillColor(ink); pdf.circle(X(cx), Y(cy), (n.w / 2 - 4) * scale, 'F'); }
        } else if (['decision', 'merge'].includes(n.kind)) {
            pdf.lines([[n.w / 2 * scale, n.h / 2 * scale], [-n.w / 2 * scale, n.h / 2 * scale], [-n.w / 2 * scale, -n.h / 2 * scale], [n.w / 2 * scale, -n.h / 2 * scale]], X(cx), Y(n.y), [1, 1], 'FD', true);
        } else pdf.roundedRect(X(n.x), Y(n.y), n.w * scale, n.h * scale, 8 * scale, 8 * scale, 'FD');
        textRows(n).forEach(text);
    }
    for (const e of model.edges) if (e.label) {
        const b = e.labelBox, size = e.from === 'choose' ? 17 : 13;
        pdf.setFillColor('#ffffff'); pdf.rect(X(b.x), Y(b.y), b.w * scale, b.h * scale, 'F');
        wrap(e.label, b.w - 4, size, true).forEach((row, i) => text({ text: row, x: b.x + b.w / 2, y: b.y + 16 + i * 20, size, bold: true }));
    }
    for (const t of model.texts) t.rows.forEach((row, i) => text({ ...t, text: row,
        x: t.align === 'left' ? t.x + 4 : t.x + t.w / 2, y: t.y + t.size + i * (t.size * 1.4) }));
}

const models = workflows.map(build);
const validation = models.map(validate);
fs.writeFileSync(path.join(out, 'diagram-models.json'), JSON.stringify(models, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify({ reviewed: '2026-10-19', source: 'local working tree, including existing uncommitted changes', checks: validation }, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'iPawcus-Updated-Role-Activity-Diagrams.drawio'), `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="2026-10-19T00:00:00.000Z" agent="Codex" type="device" compressed="false">\n${models.map(drawio).join('\n')}\n</mxfile>\n`);
const combined = new jsPDF({ unit: 'pt', format: 'a2', orientation: 'portrait', compress: true });
combined.setProperties({ title: 'iPawcus - Updated Activity Diagrams for All User Roles', subject: 'Current implementation, reviewed 19 October 2026', author: 'iPawcus project' });
for (const [index, model] of models.entries()) {
    fs.writeFileSync(path.join(out, model.id + '.svg'), svg(model));
    fs.writeFileSync(path.join(out, model.id + '.mmd'), mermaid(model));
    const individual = new jsPDF({ unit: 'pt', format: 'a2', orientation: 'portrait', compress: true });
    individual.setProperties({ title: `iPawcus - ${model.role} Activity Diagram` });
    pdfPage(individual, model); individual.save(path.join(out, model.id + '.pdf'));
    if (index) combined.addPage('a2', 'portrait');
    pdfPage(combined, model);
}
combined.save(path.join(out, 'iPawcus-Updated-Role-Activity-Diagrams.pdf'));
console.log(JSON.stringify(validation, null, 2));
