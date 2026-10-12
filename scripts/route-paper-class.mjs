// Keep the established box/label placement, but discourage crossing wires.
import { hit } from '../outputs/ipawcus-class-diagram-2026-10-06/domain-layout.mjs';

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

function interaction(a, b, c, d) {
    const horizontal = a.y === b.y, otherHorizontal = c.y === d.y;
    if (horizontal === otherHorizontal) {
        if ((horizontal ? a.y !== c.y : a.x !== c.x)) return 0;
        const key = horizontal ? 'x' : 'y';
        return Math.min(Math.max(a[key], b[key]), Math.max(c[key], d[key]))
            - Math.max(Math.min(a[key], b[key]), Math.min(c[key], d[key])) > .001 ? Infinity : 0;
    }
    const h = horizontal ? [a, b] : [c, d], v = horizontal ? [c, d] : [a, b];
    return v[0].x >= Math.min(h[0].x, h[1].x) && v[0].x <= Math.max(h[0].x, h[1].x)
        && h[0].y >= Math.min(v[0].y, v[1].y) && h[0].y <= Math.max(v[0].y, v[1].y) ? 600 : 0;
}

export function reroute(page) {
    const obstacles = [
        ...page.nodes.map(box => ({ x: box.x - 22, y: box.y - 22, w: box.w + 44, h: box.h + 44 })),
        ...page.edges.flatMap(edge => edge.labels).map(box => ({ x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 })),
    ];
    const distinct = values => [...new Set(values)].sort((a, b) => a - b);
    const xs = distinct([30, 42, 54, page.width - 54, page.width - 42, page.width - 30,
        ...obstacles.flatMap(box => [box.x - 6, box.x, box.x + box.w, box.x + box.w + 6]),
        ...page.edges.flatMap(edge => [edge.startAnchor.x, edge.endAnchor.x])]);
    const ys = distinct([108, 114, 120, page.height - 54, page.height - 42, page.height - 30,
        ...obstacles.flatMap(box => [box.y - 6, box.y, box.y + box.h, box.y + box.h + 6]),
        ...page.edges.flatMap(edge => [edge.startAnchor.y, edge.endAnchor.y])]);
    const width = xs.length, height = ys.length;
    const xIndex = new Map(xs.map((value, i) => [value, i])), yIndex = new Map(ys.map((value, i) => [value, i]));
    const blocked = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        blocked[y * width + x] = obstacles.some(box => xs[x] > box.x + .001 && xs[x] < box.x + box.w - .001
            && ys[y] > box.y + .001 && ys[y] < box.y + box.h - .001);
    }
    const neighbours = Array.from({ length: width * height }, () => []);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const at = y * width + x;
        if (blocked[at]) continue;
        for (const [dx, dy, direction] of [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || blocked[ny * width + nx]) continue;
            const a = { x: xs[x], y: ys[y] }, b = { x: xs[nx], y: ys[ny] };
            if (!obstacles.some(box => hit(a, b, box))) neighbours[at].push({ next: ny * width + nx, a, b, direction, length: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) });
        }
    }
    const routed = [];
    const order = [...page.edges].sort((a, b) => {
        const distance = edge => Math.abs(edge.start.x - edge.end.x) + Math.abs(edge.start.y - edge.end.y);
        return distance(a) - distance(b);
    });
    for (const edge of order) {
        const stubs = page.edges.filter(other => other !== edge).flatMap(other => [[other.start, other.startAnchor], [other.endAnchor, other.end]]);
        const used = [...routed, ...stubs];
        const penalties = neighbours.map(group => group.map(next => used.reduce((sum, [a, b]) => sum + interaction(next.a, next.b, a, b), 0)));
        const start = yIndex.get(edge.startAnchor.y) * width + xIndex.get(edge.startAnchor.x);
        const goal = yIndex.get(edge.endAnchor.y) * width + xIndex.get(edge.endAnchor.x);
        const costs = new Float64Array(width * height * 4); costs.fill(Infinity);
        const previous = new Int32Array(width * height * 4); previous.fill(-1);
        const heuristic = at => Math.abs(xs[at % width] - xs[goal % width]) + Math.abs(ys[Math.floor(at / width)] - ys[Math.floor(goal / width)]);
        const heap = new Heap();
        for (let direction = 0; direction < 4; direction++) { costs[start * 4 + direction] = 0; heap.push([heuristic(start), start * 4 + direction, 0]); }
        let found = -1;
        while (heap.length) {
            const [, state, cost] = heap.pop();
            if (costs[state] !== cost) continue;
            const at = Math.floor(state / 4), direction = state % 4;
            if (at === goal) { found = state; break; }
            neighbours[at].forEach((next, index) => {
                if (at === start && next.direction === (edge.sourceSide === 'R' ? 1 : 0)) return;
                if (next.next === goal && next.direction === (edge.targetSide === 'R' ? 0 : 1)) return;
                const candidate = cost + next.length + (direction === next.direction ? 0 : 42) + penalties[at][index];
                const nextState = next.next * 4 + next.direction;
                if (candidate < costs[nextState]) { costs[nextState] = candidate; previous[nextState] = state; heap.push([candidate + heuristic(next.next), nextState, candidate]); }
            });
        }
        if (found < 0) throw new Error('No independent paper route: ' + edge.id);
        const route = [];
        for (let state = found; state >= 0; state = previous[state]) { const at = Math.floor(state / 4); route.push({ x: xs[at % width], y: ys[Math.floor(at / width)] }); }
        route.reverse();
        const points = [edge.start, ...route, edge.end];
        edge.points = points.filter((point, index) => {
            if (!index || index === points.length - 1) return true;
            const before = points[index - 1], after = points[index + 1];
            return !((before.x === point.x && point.x === after.x && (point.y - before.y) * (after.y - point.y) >= 0)
                || (before.y === point.y && point.y === after.y && (point.x - before.x) * (after.x - point.x) >= 0));
        });
        edge.points.slice(1).forEach((point, index) => routed.push([edge.points[index], point]));
    }
    const segments = page.edges.flatMap(edge => edge.points.slice(1).map((b, index) => ({ edge: edge.id, segment: index, a: edge.points[index], b })));
    page.bridges = [];
    for (const h of segments.filter(segment => segment.a.y === segment.b.y)) {
        for (const v of segments.filter(segment => segment.a.x === segment.b.x && segment.edge !== h.edge)) {
            if (v.a.x > Math.min(h.a.x, h.b.x) && v.a.x < Math.max(h.a.x, h.b.x)
                && h.a.y > Math.min(v.a.y, v.b.y) && h.a.y < Math.max(v.a.y, v.b.y)) {
                page.bridges.push({ edge: h.edge, segment: h.segment, x: v.a.x, y: h.a.y, radius: 4 });
            }
        }
    }
    for (const bridge of page.bridges) {
        const nearest = page.bridges.filter(other => other !== bridge && other.edge === bridge.edge && other.segment === bridge.segment)
            .map(other => Math.abs(other.x - bridge.x));
        bridge.radius = Math.min(4, ...nearest.map(distance => Math.max(2, distance / 2 - 1)));
    }
    return page;
}

export function wirePath(edge, bridges) {
    const parts = [`M${edge.points[0].x} ${edge.points[0].y}`];
    edge.points.slice(1).forEach((last, index) => {
        const first = edge.points[index];
        const direction = last.x >= first.x ? 1 : -1;
        const jumps = bridges.filter(bridge => bridge.edge === edge.id && bridge.segment === index).sort((a, b) => direction * (a.x - b.x));
        for (const jump of jumps) parts.push(`L${jump.x - direction * jump.radius} ${jump.y} A${jump.radius} ${jump.radius} 0 0 ${direction > 0 ? 1 : 0} ${jump.x + direction * jump.radius} ${jump.y}`);
        parts.push(`L${last.x} ${last.y}`);
    });
    return parts.join(' ');
}
