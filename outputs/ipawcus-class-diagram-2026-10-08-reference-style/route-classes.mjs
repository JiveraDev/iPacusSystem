// Documentation-only layout. Thin orthogonal associations avoid class boxes and labels.
// The router is adapted from the earlier model; the class arrangement is independent
// of the user's ERD reference and keeps the existing conceptual UML content.
class Heap {
    constructor() { this.items = []; }
    push(value) {
        let index = this.items.length;
        this.items.push(value);
        while (index) {
            const parent = (index - 1) >> 1;
            if (this.items[parent][0] <= value[0]) break;
            this.items[index] = this.items[parent]; index = parent;
        }
        this.items[index] = value;
    }
    pop() {
        const first = this.items[0], last = this.items.pop();
        if (this.items.length) {
            let index = 0;
            while (index * 2 + 1 < this.items.length) {
                let child = index * 2 + 1;
                if (child + 1 < this.items.length && this.items[child + 1][0] < this.items[child][0]) child++;
                if (this.items[child][0] >= last[0]) break;
                this.items[index] = this.items[child]; index = child;
            }
            this.items[index] = last;
        }
        return first;
    }
    get length() { return this.items.length; }
}
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function hit(a, b, rectangle, margin = 0) {
    const left = rectangle.x - margin, right = rectangle.x + rectangle.w + margin;
    const top = rectangle.y - margin, bottom = rectangle.y + rectangle.h + margin;
    if (a.y === b.y) return a.y > top + .001 && a.y < bottom - .001 && Math.max(a.x, b.x) > left + .001 && Math.min(a.x, b.x) < right - .001;
    if (a.x === b.x) return a.x > left + .001 && a.x < right - .001 && Math.max(a.y, b.y) > top + .001 && Math.min(a.y, b.y) < bottom - .001;
    throw new Error('Non-orthogonal association.');
}
function simplify(points) {
    return points.filter((point, index) => {
        if (!index || index === points.length - 1) return true;
        const before = points[index - 1], after = points[index + 1];
        return !((before.x === point.x && point.x === after.x && (point.y - before.y) * (after.y - point.y) >= 0)
            || (before.y === point.y && point.y === after.y && (point.x - before.x) * (after.x - point.x) >= 0));
    });
}

export function layoutPage(page) {
    const nodes = page.nodes, byId = new Map(nodes.map(node => [node.id, node]));
    const count = page.columns || 3, gap = 116;
    const sidePitch = page.number === 1 ? 10 : 14;
    page.labelFont = page.number === 1 ? 7 : 9;
    page.labelClearance = page.number === 1 ? 1 : 2;
    nodes.forEach((node, index) => {
        node.column = node.column ?? (node.reference ? count : index % count);
        // Measured font widths determine each box independently. No column minimum.
        node.w = Math.ceil(node.measuredTextWidth + 20);
        node.header = 24; node.attributeHeight = node.attrs.length * 13 + 10;
        node.methodY = node.header + node.attributeHeight;
        node.methodHeight = node.methods.length * 13 + 10;
        node.h = node.methodY + node.methodHeight;
    });
    const columnWidths = Array.from({ length: count + 1 }, (_, column) =>
        Math.max(0, ...nodes.filter(node => node.column === column).map(node => node.w)));
    const columnX = [72];
    for (let index = 1; index <= count; index++) columnX[index] = columnX[index - 1] + columnWidths[index - 1] + gap;
    for (const node of nodes) node.x = columnX[node.column] + Math.floor((columnWidths[node.column] - node.w) / 2);
    const columnY = Array(count + 1).fill(130);
    for (const node of nodes) { node.y = columnY[node.column]; columnY[node.column] += node.h + 90; }
    page.width = Math.max(...nodes.map(node => node.x + node.w)) + 72;
    page.height = Math.max(...nodes.map(node => node.y + node.h)) + 100;

    // Allocate endpoint ports on all four sides. Relationship count never changes
    // the content height, even for heavily connected User and Booking classes.
    const docks = new Map();
    const byOwner = new Map(nodes.map(node => [node.id, []]));
    for (const edge of page.edges) for (const kind of ['start', 'end']) {
        const owner = byId.get(kind === 'start' ? edge.source : edge.target);
        const other = byId.get(kind === 'start' ? edge.target : edge.source);
        byOwner.get(owner.id).push({ edge, kind, owner, other });
    }
    for (const [id, endpoints] of byOwner) {
        const owner = byId.get(id);
        const capacities = { L: Math.floor((owner.h - 24) / sidePitch) + 1,
            R: Math.floor((owner.h - 24) / sidePitch) + 1,
            T: Math.floor((owner.w - 20) / 40) + 1,
            B: Math.floor((owner.w - 20) / 40) + 1 };
        const used = { L: 0, R: 0, T: 0, B: 0 };
        if (Object.values(capacities).reduce((sum, value) => sum + value, 0) < endpoints.length)
            throw new Error('Insufficient border ports without stretching content: ' + page.id + ' / ' + id);
        endpoints.sort((a, b) => a.other.column - b.other.column || a.other.y - b.other.y || a.edge.id.localeCompare(b.edge.id));
        for (const dock of endpoints) {
            const dx = dock.other.x + dock.other.w / 2 - (owner.x + owner.w / 2);
            const dy = dock.other.y + dock.other.h / 2 - (owner.y + owner.h / 2);
            const preferred = dock.other.column === owner.column ? (dy >= 0 ? 'B' : 'T') : dx >= 0 ? 'R' : 'L';
            const sides = ['L', 'R', 'T', 'B'].filter(side => used[side] < capacities[side]);
            const score = side => (side === preferred ? 0 : side === 'L' || side === 'R' ? 110 : 160)
                + (side === 'L' && dx > 0 || side === 'R' && dx < 0 || side === 'T' && dy > 0 || side === 'B' && dy < 0 ? 90 : 0)
                + used[side] / capacities[side] * 160;
            sides.sort((a, b) => score(a) - score(b));
            dock.side = sides[0]; used[dock.side]++;
            dock.edge[dock.kind === 'start' ? 'sourceSide' : 'targetSide'] = dock.side;
            const key = owner.id + ':' + dock.side;
            if (!docks.has(key)) docks.set(key, []);
            docks.get(key).push(dock);
        }
    }
    for (const group of docks.values()) {
        group.sort((a, b) => {
            return (a.side === 'L' || a.side === 'R' ? a.other.y - b.other.y : a.other.x - b.other.x)
                || a.edge.id.localeCompare(b.edge.id) || a.kind.localeCompare(b.kind);
        });
        group.forEach((dock, index) => {
            const vertical = dock.side === 'T' || dock.side === 'B';
            const span = vertical ? dock.owner.w - 20 : dock.owner.h - 24;
            const step = vertical ? 40 : sidePitch;
            const offset = (span - (group.length - 1) * step) / 2;
            const endpoint = vertical
                ? { x: dock.owner.x + 10 + offset + index * step, y: dock.owner.y + (dock.side === 'B' ? dock.owner.h : 0) }
                : { x: dock.owner.x + (dock.side === 'R' ? dock.owner.w : 0), y: dock.owner.y + 18 + offset + index * step };
            dock.edge[dock.kind] = endpoint;
            dock.edge[dock.kind + 'Anchor'] = { x: endpoint.x + (vertical ? 0 : dock.side === 'R' ? 46 : -46),
                y: endpoint.y + (vertical ? dock.side === 'B' ? 46 : -46 : 0) };
        });
    }
    for (const edge of page.edges) {
        edge.labels = [['start', edge.sourceText], ['end', edge.targetText]].filter(([, text]) => text).map(([kind, text]) => {
            const endpoint = edge[kind], side = kind === 'start' ? edge.sourceSide : edge.targetSide, w = text.length * (page.labelFont * .62) + 2;
            const vertical = side === 'T' || side === 'B';
            return { text, endpoint: kind, owner: kind === 'start' ? edge.source : edge.target, lineY: endpoint.y,
                side, x: vertical ? endpoint.x + 6 : side === 'R' ? endpoint.x + 8 : endpoint.x - 8 - w,
                y: vertical ? endpoint.y + (side === 'T' ? -29 : 14) : endpoint.y - (page.number === 1 ? 9 : 12),
                w, h: page.number === 1 ? 6 : 8, baselineOffset: page.number === 1 ? 5 : 7 };
        });
    }
    const captions = page.edges.flatMap(edge => edge.labels);
    const obstacles = [
        ...nodes.map(node => ({ x: node.x - 18, y: node.y - 18, w: node.w + 36, h: node.h + 36 })),
        ...captions.map(label => ({ x: label.x - page.labelClearance, y: label.y - page.labelClearance,
            w: label.w + page.labelClearance * 2, h: label.h + page.labelClearance * 2 })),
    ];
    const distinct = values => [...new Set(values)].sort((a, b) => a - b);
    const xs = distinct([30, page.width - 30, ...obstacles.flatMap(box => [box.x, box.x + box.w]), ...page.edges.flatMap(edge => [edge.startAnchor.x, edge.endAnchor.x])]);
    const ys = distinct([84, page.height - 50, ...obstacles.flatMap(box => [box.y, box.y + box.h]), ...page.edges.flatMap(edge => [edge.startAnchor.y, edge.endAnchor.y])]);
    const width = xs.length, height = ys.length;
    const blocked = new Uint8Array(width * height), xIndex = new Map(xs.map((x, index) => [x, index])), yIndex = new Map(ys.map((y, index) => [y, index]));
    const horizontalBlocked = new Uint8Array((width - 1) * height);
    const verticalBlocked = new Uint8Array(width * (height - 1));
    for (const box of obstacles) {
        const left = xIndex.get(box.x), right = xIndex.get(box.x + box.w);
        const top = yIndex.get(box.y), bottom = yIndex.get(box.y + box.h);
        // Coordinate compression includes every obstacle boundary. Marking the
        // exact covered intervals avoids scanning every box for every grid edge.
        for (let y = top + 1; y < bottom; y++) {
            blocked.fill(1, y * width + left + 1, y * width + right);
            horizontalBlocked.fill(1, y * (width - 1) + left, y * (width - 1) + right);
        }
        for (let y = top; y < bottom; y++)
            verticalBlocked.fill(1, y * width + left + 1, y * width + right);
    }
    const neighbours = Array.from({ length: width * height }, () => []);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const at = y * width + x;
        if (blocked[at]) continue;
        for (const [dx, dy, direction] of [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const next = ny * width + nx;
            if (blocked[next]) continue;
            const first = { x: xs[x], y: ys[y] }, last = { x: xs[nx], y: ys[ny] };
            if (dx && horizontalBlocked[y * (width - 1) + Math.min(x, nx)]) continue;
            if (dy && verticalBlocked[Math.min(y, ny) * width + x]) continue;
            neighbours[at].push({ next, direction, length: Math.abs(first.x - last.x) + Math.abs(first.y - last.y) });
        }
    }
    const used = new Map();
    for (const edge of page.edges) {
        const start = yIndex.get(edge.startAnchor.y) * width + xIndex.get(edge.startAnchor.x);
        const goal = yIndex.get(edge.endAnchor.y) * width + xIndex.get(edge.endAnchor.x);
        const costs = new Float64Array(width * height * 4); costs.fill(Infinity);
        const previous = new Int32Array(width * height * 4); previous.fill(-1);
        const heap = new Heap();
        const heuristic = index => Math.abs(xs[index % width] - xs[goal % width]) + Math.abs(ys[Math.floor(index / width)] - ys[Math.floor(goal / width)]);
        for (let direction = 0; direction < 4; direction++) { costs[start * 4 + direction] = 0; heap.push([heuristic(start), start * 4 + direction, 0]); }
        let found = -1;
        while (heap.length) {
            const [, state, cost] = heap.pop();
            if (costs[state] !== cost) continue;
            const at = Math.floor(state / 4), direction = state % 4;
            if (at === goal) { found = state; break; }
            for (const next of neighbours[at]) {
                if (at === start && next.direction === ({ R: 1, L: 0, T: 2, B: 3 }[edge.sourceSide])) continue;
                if (next.next === goal && next.direction === ({ R: 0, L: 1, T: 3, B: 2 }[edge.targetSide])) continue;
                const key = at < next.next ? at + ':' + next.next : next.next + ':' + at;
                const candidate = cost + next.length + (next.direction === direction ? 0 : 38) + (used.get(key) || 0) * 70;
                const nextState = next.next * 4 + next.direction;
                if (candidate < costs[nextState]) { costs[nextState] = candidate; previous[nextState] = state; heap.push([candidate + heuristic(next.next), nextState, candidate]); }
            }
        }
        if (found < 0) throw new Error('No safe route: ' + page.id + ' / ' + edge.id);
        const route = [];
        for (let state = found; state >= 0; state = previous[state]) route.push(Math.floor(state / 4));
        route.reverse();
        route.slice(1).forEach((at, index) => { const before = route[index], key = at < before ? at + ':' + before : before + ':' + at; used.set(key, (used.get(key) || 0) + 1); });
        edge.points = simplify([edge.start, ...route.map(index => ({ x: xs[index % width], y: ys[Math.floor(index / width)] })), edge.end]);
    }
    for (const [index, node] of nodes.entries()) if (nodes.slice(index + 1).some(other => overlaps(node, other))) throw new Error('Boxes overlap: ' + page.id);
    for (const [index, label] of captions.entries()) {
        if ((label.side === 'L' || label.side === 'R') && label.y + label.h > label.lineY - (page.number === 1 ? 3 : 4))
            throw new Error('Label is not above its horizontal line.');
        if (captions.slice(index + 1).some(other => overlaps(label, other))) throw new Error('Labels overlap: ' + page.id);
        if (nodes.some(node => overlaps(label, node))) throw new Error('Label enters a class.');
    }
    for (const edge of page.edges) {
        for (const label of edge.labels) {
            const at = label.endpoint === 'start' ? 0 : edge.points.length - 2;
            const first = edge.points[at], last = edge.points[at + 1];
            if (label.side === 'T' || label.side === 'B') {
                if (first.x !== last.x || Math.min(first.y, last.y) > label.y || Math.max(first.y, last.y) < label.y + label.h)
                    throw new Error('Label is not beside its own endpoint.');
            } else if (first.y !== last.y || first.y !== label.lineY || Math.min(first.x, last.x) > label.x || Math.max(first.x, last.x) < label.x + label.w)
                throw new Error('Label is not above its own endpoint.');
        }
        for (let index = 1; index < edge.points.length; index++) {
            const first = edge.points[index - 1], last = edge.points[index];
            if (nodes.some(node => hit(first, last, node))) throw new Error('Association enters a class: ' + edge.id);
            if (captions.some(label => hit(first, last, label, page.labelClearance))) throw new Error('Association touches label: ' + edge.id);
        }
    }
    return page;
}
