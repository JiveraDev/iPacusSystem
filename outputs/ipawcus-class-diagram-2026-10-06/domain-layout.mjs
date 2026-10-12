// Compact class-box layout. Associations route around boxes and label bounds.
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
    const count = page.columns || 3, gap = 140;
    const commonWidth = Math.max(330, ...nodes.map(node => Math.ceil((Math.max(node.name.length * 8, ...[...node.attrs, ...node.methods].map(row => row.length * 7.3)) + 28) / 10) * 10));
    nodes.forEach((node, index) => {
        node.column = node.column ?? (node.reference ? count : index % count);
        node.w = commonWidth; node.x = 90 + node.column * (commonWidth + gap);
        node.header = 30; node.attributeHeight = Math.max(24, node.attrs.length * 16 + 12);
        node.methodY = node.header + node.attributeHeight;
        node.methodHeight = Math.max(24, node.methods.length * 16 + 12);
        node.h = node.methodY + node.methodHeight;
    });
    const docks = new Map();
    for (const edge of page.edges) {
        const source = byId.get(edge.source), target = byId.get(edge.target);
        const right = source.x <= target.x;
        edge.sourceSide = right ? 'R' : 'L';
        edge.targetSide = source.x === target.x ? 'R' : right ? 'L' : 'R';
        for (const kind of ['start', 'end']) {
            const owner = kind === 'start' ? source : target;
            const side = kind === 'start' ? edge.sourceSide : edge.targetSide;
            const key = owner.id + ':' + side;
            if (!docks.has(key)) docks.set(key, []);
            docks.get(key).push({ edge, kind, owner, side });
        }
    }
    for (const group of docks.values()) {
        const owner = group[0].owner;
        owner.h = Math.max(owner.h, 50 + (group.length - 1) * 18);
    }
    const columnY = Array(count + 1).fill(135);
    for (const node of nodes) { node.y = columnY[node.column]; columnY[node.column] += node.h + 64; }
    page.width = Math.max(...nodes.map(node => node.x + node.w)) + 90;
    page.height = Math.max(...nodes.map(node => node.y + node.h)) + 80;
    for (const group of docks.values()) {
        group.sort((a, b) => {
            const aTarget = byId.get(a.kind === 'start' ? a.edge.target : a.edge.source);
            const bTarget = byId.get(b.kind === 'start' ? b.edge.target : b.edge.source);
            return aTarget.y - bTarget.y || a.edge.id.localeCompare(b.edge.id) || a.kind.localeCompare(b.kind);
        });
        group.forEach((dock, index) => {
            // Fixed, distinct endpoint rows keep each caption attached to its own line.
            const endpoint = { x: dock.side === 'R' ? dock.owner.x + dock.owner.w : dock.owner.x, y: dock.owner.y + 30 + index * 18 };
            dock.edge[dock.kind] = endpoint;
            dock.edge[dock.kind + 'Anchor'] = { x: endpoint.x + (dock.side === 'R' ? 56 : -56), y: endpoint.y };
        });
    }
    for (const edge of page.edges) {
        edge.labels = [['start', edge.sourceText], ['end', edge.targetText]].filter(([, text]) => text).map(([kind, text]) => {
            const endpoint = edge[kind], side = kind === 'start' ? edge.sourceSide : edge.targetSide, w = text.length * 7 + 2;
            return { text, endpoint: kind, owner: kind === 'start' ? edge.source : edge.target, lineY: endpoint.y,
                x: side === 'R' ? endpoint.x + 12 : endpoint.x - 12 - w, y: endpoint.y - 14, w, h: 10, baselineOffset: 9 };
        });
    }
    const captions = page.edges.flatMap(edge => edge.labels);
    const obstacles = [
        ...nodes.map(node => ({ x: node.x - 22, y: node.y - 22, w: node.w + 44, h: node.h + 44 })),
        ...captions.map(label => ({ x: label.x - 2, y: label.y - 2, w: label.w + 4, h: label.h + 4 })),
    ];
    const distinct = values => [...new Set(values)].sort((a, b) => a - b);
    const xs = distinct([30, page.width - 30, ...obstacles.flatMap(box => [box.x, box.x + box.w]), ...page.edges.flatMap(edge => [edge.startAnchor.x, edge.endAnchor.x])]);
    const ys = distinct([108, page.height - 30, ...obstacles.flatMap(box => [box.y, box.y + box.h]), ...page.edges.flatMap(edge => [edge.startAnchor.y, edge.endAnchor.y])]);
    const width = xs.length, height = ys.length;
    const blocked = new Uint8Array(width * height), xIndex = new Map(xs.map((x, index) => [x, index])), yIndex = new Map(ys.map((y, index) => [y, index]));
    for (const box of obstacles) {
        for (let y = 0; y < height; y++) {
            if (ys[y] <= box.y + .001 || ys[y] >= box.y + box.h - .001) continue;
            for (let x = 0; x < width; x++) if (xs[x] > box.x + .001 && xs[x] < box.x + box.w - .001) blocked[y * width + x] = 1;
        }
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
            if (obstacles.some(box => hit(first, last, box))) continue;
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
                if (at === start && next.direction === (edge.sourceSide === 'R' ? 1 : 0)) continue;
                if (next.next === goal && next.direction === (edge.targetSide === 'R' ? 0 : 1)) continue;
                const key = at < next.next ? at + ':' + next.next : next.next + ':' + at;
                const candidate = cost + next.length + (next.direction === direction ? 0 : 42) + (used.get(key) || 0) * 24;
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
        if (label.y + label.h > label.lineY - 4) throw new Error('Label is not above its line.');
        if (captions.slice(index + 1).some(other => overlaps(label, other))) throw new Error('Labels overlap: ' + page.id);
        if (nodes.some(node => overlaps(label, node))) throw new Error('Label enters a class.');
    }
    for (const edge of page.edges) {
        for (const label of edge.labels) {
            const at = label.endpoint === 'start' ? 0 : edge.points.length - 2;
            const first = edge.points[at], last = edge.points[at + 1];
            if (first.y !== last.y || first.y !== label.lineY || Math.min(first.x, last.x) > label.x || Math.max(first.x, last.x) < label.x + label.w) throw new Error('Label is not above its own endpoint.');
        }
        for (let index = 1; index < edge.points.length; index++) {
            const first = edge.points[index - 1], last = edge.points[index];
            if (nodes.some(node => hit(first, last, node))) throw new Error('Association enters a class: ' + edge.id);
            if (captions.some(label => hit(first, last, label, 2))) throw new Error('Association touches label: ' + edge.id);
        }
    }
    return page;
}
