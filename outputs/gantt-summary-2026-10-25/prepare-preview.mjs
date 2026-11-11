import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const book = new ExcelJS.Workbook();
await book.xlsx.readFile(path.join(out, 'iPawcus_Gantt_Auto_Color_2026.xlsx'));
const color = (c, fallback = 'FFFFFF') => (c?.argb ?? fallback).slice(-6);
function coord(address) {
    const [, letters, r] = address.match(/^([A-Z]+)([0-9]+)$/);
    let c = 0;
    for (const ch of letters) c = c * 26 + ch.charCodeAt(0) - 64;
    return { r: Number(r), c };
}
const images = [];
const targets = [['Summary Gantt', 'summary-preview.png'], ['Increment Gantt', 'increment-preview.png']];
if (book.getWorksheet('Broad Increment Plan')) targets.push(['Broad Increment Plan', 'broad-plan-preview.png', 32]);
for (const [name, file, limit] of targets) {
    const s = book.getWorksheet(name);
    const rowLimit = limit ?? s.rowCount;
    const xp = [0], yp = [0];
    const widths = {}, heights = {};
    for (let c = 1; c <= s.columnCount; c++) {
        const col = s.getColumn(c);
        const width = col.width ?? 8.43;
        widths[c] = col.hidden ? 0 : Math.floor(width < 1 ? width * 12 + 0.5 : width * 7 + 5);
        xp[c] = xp[c - 1] + widths[c];
    }
    for (let r = 1; r <= rowLimit; r++) {
        heights[r] = s.getRow(r).hidden ? 0 : Math.round((s.getRow(r).height ?? 19) * 96 / 72);
        yp[r] = yp[r - 1] + heights[r];
    }
    const merges = {};
    for (const m of s.model.merges) {
        const [a, b] = m.split(':').map(coord);
        merges[`${a.r},${a.c}`] = { a, b };
    }
    const cells = [];
    for (let r = 1; r <= rowLimit; r++) {
        if (!heights[r]) continue;
        for (let c = 2; c <= s.columnCount; c++) {
            if (!widths[c]) continue;
            const cell = s.getCell(r, c);
            if (cell.isMerged && cell.master.address !== cell.address) continue;
            const m = merges[`${r},${c}`];
            const lastR = m?.b.r ?? r, lastC = m?.b.c ?? c;
            const value = cell.value;
            const hiddenNumeric = cell.numFmt === ';;;';
            const displayDate = d => `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
            const actual = value && typeof value === 'object' && 'formula' in value ? value.result : value;
            const isDate = cell.numFmt === 'd mmm' && (actual instanceof Date || typeof actual === 'number');
            const text = hiddenNumeric ? '' : isDate ? displayDate(actual instanceof Date ? actual : new Date((actual - 25569) * 86400000))
                : value === null ? '' : typeof value === 'object' ? String(value.result ?? value.text ?? '') : String(value);
            const bg = color(cell.fill?.fgColor);
            const borders = {};
            for (const side of ['top', 'bottom', 'left', 'right']) if (cell.border?.[side]?.style) borders[side] = color(cell.border[side].color, 'D7DCDE');
            cells.push({ x: xp[c - 1], y: yp[r - 1], w: xp[lastC] - xp[c - 1], h: yp[lastR] - yp[r - 1],
                fill: bg, text, font: cell.font?.name ?? 'Calibri', size: cell.font?.size ?? 10,
                bold: cell.font?.bold ?? false, color: color(cell.font?.color, '22272B'),
                align: cell.alignment?.horizontal ?? 'left', borders });
        }
    }
    images.push({ name, file, width: xp[s.columnCount], height: yp[rowLimit], cells });
}
await fs.writeFile(path.join(out, 'preview-layout.json'), JSON.stringify(images));
console.log(images.map(i => `${i.name}: ${i.width}x${i.height}, ${i.cells.length} cells`).join('\n'));
