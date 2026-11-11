import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { broadIncrements } from './broad-increment-tasks.mjs';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(OUT, 'iPawcus_Gantt_Auto_Color_2026.xlsx');
const STAGED = path.join(OUT, 'iPawcus_Gantt_Auto_Color_2026.broad-plan.pending.xlsx');
const NAME = 'Broad Increment Plan';
const DAY = 86400000;
const colors = { green: '70AD47', yellow: 'FFD966', white: 'FFFFFF', dark: '343A3D', ink: '22272B', muted: '66746C', grid: 'D7DCDE', pale: 'F2F4F3', phase: 'E7EDE8', blue: '1765A6', blueFill: 'F0F7FE' };
const isoDate = s => new Date(`${s}T00:00:00Z`);
const add = (d, n) => new Date(d.getTime() + n * DAY);
const serial = d => Math.round(d.getTime() / DAY) + 25569;
const short = d => `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
const iso = d => d.toISOString().slice(0, 10);
const rangeLabel = (a, b) => a && b ? `${short(a)} - ${short(b)}` : '';
const fill = (rgb, differential = false) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${rgb}` }, ...(differential ? { bgColor: { argb: `FF${rgb}` } } : {}) });
const font = (size = 10, bold = false, color = colors.ink) => ({ name: 'Calibri', size, bold, color: { argb: `FF${color}` } });
const border = { style: 'hair', color: { argb: `FF${colors.grid}` } };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function parseDate(s) {
    const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/);
    assert(m, `Cannot parse current workbook date: ${s}`);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.indexOf(m[2].slice(0, 3).toLowerCase());
    assert(month >= 0);
    return new Date(Date.UTC(Number(m[3] ?? 2026), month, Number(m[1])));
}
function parseRange(text) {
    if (!text) return { start: null, end: null };
    const a = text.replace(/[–—]/g, '-').split(/\s*-\s*/);
    const start = parseDate(a[0]), end = parseDate(a[1] ?? a[0]);
    assert(start <= end, `Invalid current parent range: ${text}`);
    return { start, end };
}
function stable(value) {
    if (value instanceof Date) return { date: value.toISOString() };
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, stable(value[k])]));
    return value;
}
function sheetSignature(s) {
    const cells = [];
    s.eachRow(r => r.eachCell(c => {
        if (c.isMerged && c.master.address !== c.address) return;
        cells.push([c.address, stable(c.value), stable(c.style)]);
    }));
    return hash(JSON.stringify(stable({
        name: s.name, cells,
        rows: s._rows.filter(Boolean).map(r => [r.number, r.height, r.hidden, r.outlineLevel]),
        columns: s.columns.map(c => [c.width, c.hidden, c.outlineLevel]),
        merges: [...s.model.merges].sort(), conditionalFormatting: s.conditionalFormattings,
    })));
}

const liveInput = await fs.readFile(FILE);
const liveInputHash = hash(liveInput);
let original = liveInput;
if (process.argv.includes('--refresh-generated')) {
    assert.equal(hash(await fs.readFile(STAGED)), liveInputHash, 'The workbook has changed since the last generation; preserve those new edits before refreshing.');
    const previous = JSON.parse(await fs.readFile(path.join(OUT, 'broad-plan-validation.json'), 'utf8'));
    original = await fs.readFile(previous.backup);
}
const sourceHash = hash(original);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(original);
assert(!wb.getWorksheet(NAME), `${NAME} already exists; review it before replacing any existing task edits.`);
const oldNames = wb.worksheets.map(s => s.name);
const signatures = Object.fromEntries(wb.worksheets.map(s => [s.name, sheetSignature(s)]));
const main = wb.getWorksheet('Summary Gantt');
assert(main, 'The existing summary must be retained.');
const parents = new Map();
main.eachRow(r => {
    const id = r.getCell(1).text;
    if (/^I[1-6]-[DCT]$/.test(id)) parents.set(id, { id, row: r.number, text: r.getCell(3).text, ...parseRange(r.getCell(3).text) });
});
assert.equal(parents.size, 18);

const s = wb.addWorksheet(NAME, { properties: { tabColor: { argb: `FF${colors.green}` } } });
s.properties.defaultRowHeight = 21;
s.properties.outlineLevelRow = 1;
s.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
s.views = [{ state: 'frozen', xSplit: 3, ySplit: 7, showGridLines: false, zoomScale: 85 }];
s.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: '1:7', margins: { left: .25, right: .25, top: .3, bottom: .3, header: .1, footer: .1 } };
s.headerFooter.oddFooter = '&LiPawcus | Suggested feature-task estimates&RP&P of &N';
const axis = Array.from({ length: 275 }, (_, i) => add(isoDate('2026-04-01'), i));
assert.equal(iso(axis.at(-1)), '2026-12-31');
const first = 4, last = first + axis.length - 1, delivery = last + 1, helperStart = delivery + 1, helperEnd = delivery + 2;
const startLetter = s.getColumn(helperStart).letter, endLetter = s.getColumn(helperEnd).letter;
s.getColumn(1).hidden = true;
s.getColumn(2).width = 57;
s.getColumn(3).width = 24;
s.getColumn(delivery).width = 77;
for (let c = first; c <= last; c++) s.getColumn(c).width = .30;
s.getColumn(helperStart).hidden = true;
s.getColumn(helperEnd).hidden = true;

function merged(row, left, right, text, { size = 10, bold = false, bg = colors.white, color = colors.ink, align = 'left', height = 24 } = {}) {
    s.mergeCells(row, left, row, right);
    const c = s.getCell(row, left);
    c.value = text; c.font = font(size, bold, color); c.fill = fill(bg);
    c.alignment = { horizontal: align, vertical: 'middle', wrapText: true, indent: align === 'left' ? 1 : 0 };
    s.getRow(row).height = height;
    return c;
}
merged(1, 2, delivery, 'iPawcus | Broad Increment Feature Plan', { size: 20, bold: true, bg: colors.dark, color: colors.white, height: 35 });
merged(2, 2, delivery, 'One detailed sheet supporting the existing summary | Design, Coding and Testing with editable task estimates', { size: 11, bg: colors.dark, color: colors.white, height: 25 });
merged(3, 2, delivery, 'Edit any blue Date range, e.g. 5 Oct - 21 Oct | Green: design/coding | Yellow: testing | Phase dates follow Summary Gantt; estimated child tasks follow their phase', { size: 10, height: 25 });
for (const [col, label] of [[2, 'Increment / phase / feature task'], [3, 'Date'], [delivery, 'PLANNED RESULT']]) {
    s.mergeCells(4, col, 6, col);
    const c = s.getCell(4, col);
    c.value = label; c.font = font(11, true); c.fill = fill(colors.phase);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: border, bottom: border, left: border, right: border };
}
merged(4, first, last, '2026', { size: 12, bold: true, align: 'center', bg: colors.phase, height: 21 });
let i = 0;
while (i < axis.length) {
    let j = i;
    while (j + 1 < axis.length && axis[j + 1].getUTCMonth() === axis[i].getUTCMonth()) j++;
    const m = merged(5, first + i, first + j, axis[i].toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }).toUpperCase(), { bold: true, align: 'center', bg: colors.phase, height: 22 });
    m.border = { left: border, right: border };
    let k = i;
    while (k <= j) {
        let l = k;
        const week = Math.min(3, Math.floor((axis[k].getUTCDate() - 1) / 7));
        while (l + 1 <= j && Math.min(3, Math.floor((axis[l + 1].getUTCDate() - 1) / 7)) === week) l++;
        const w = merged(6, first + k, first + l, `W${week + 1}`, { size: 9, align: 'center', bg: colors.pale, height: 20 });
        w.border = { left: border, right: border, bottom: border };
        k = l + 1;
    }
    i = j + 1;
}
s.getRow(7).hidden = true;
axis.forEach((d, n) => { s.getCell(7, first + n).value = d; s.getCell(7, first + n).numFmt = 'd mmm yyyy'; });

function parseFormula(row, finish) {
    const text = `TRIM(SUBSTITUTE(SUBSTITUTE($C${row},"–","-"),"—","-"))`;
    const split = finish ? `MID(${text},FIND("-",${text})+1,99)` : `LEFT(${text},FIND("-",${text})-1)`;
    const part = `TRIM(IFERROR(${split},${text}))`;
    return `IF($C${row}="","",IF(ISNUMBER($C${row}),INT($C${row}),IFERROR(DATEVALUE(${part}&" 2026"),IFERROR(DATEVALUE(${part}),""))))`;
}
function active(row, colLetter) {
    return `AND(ISNUMBER($${startLetter}${row}),ISNUMBER($${endLetter}${row}),${colLetter}$7>=$${startLetter}${row},${colLetter}$7<=$${endLetter}${row})`;
}
function childDateFormula(parentRow, begin, finish) {
    const a = `$${startLetter}$${parentRow}`, b = `$${endLetter}$${parentRow}`;
    const left = `${a}+ROUND((${b}-${a})*${begin},0)`;
    const right = `${a}+ROUND((${b}-${a})*${finish},0)`;
    return `IF(AND(ISNUMBER(${a}),ISNUMBER(${b}),${b}>=${a}),TEXT(${left},"d mmm")&" - "&TEXT(${right},"d mmm"),"")`;
}
const rows = [];
function addActivity(row, { id, label, stage, outcome, start, end, formula, parentRow = null, task = false }) {
    assert(!start || start <= end);
    const r = s.getRow(row);
    r.height = task ? 29 : 27;
    r.outlineLevel = task ? 1 : 0;
    r.getCell(1).value = id;
    const labelCell = r.getCell(2);
    labelCell.value = label; labelCell.font = font(task ? 10.5 : 11, !task);
    labelCell.fill = fill(task ? colors.white : colors.phase);
    labelCell.alignment = { vertical: 'middle', wrapText: true, indent: task ? 2 : 1 };
    const dc = r.getCell(3);
    dc.value = { formula, result: rangeLabel(start, end) };
    dc.numFmt = 'General'; dc.font = font(10.5, !task, colors.blue); dc.fill = fill(colors.blueFill);
    dc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    dc.note = task ? 'Suggested estimate within its phase. Edit this Date range directly to override it. Otherwise it follows changes to its phase range.'
        : 'Initially linked to the existing Summary Gantt phase. You can edit this Date range directly; estimated child tasks will follow this phase range.';
    const oc = r.getCell(delivery);
    oc.value = outcome; oc.font = font(10); oc.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    oc.fill = fill(task ? colors.white : colors.pale);
    for (const col of [2, 3, delivery]) r.getCell(col).border = { bottom: border, right: border };
    r.getCell(helperStart).value = { formula: parseFormula(row, false), result: start ? serial(start) : '' };
    r.getCell(helperEnd).value = { formula: parseFormula(row, true), result: end ? serial(end) : '' };
    const barColor = stage === 'Testing' ? colors.yellow : colors.green;
    for (let n = 0; n < axis.length; n++) {
        const c = r.getCell(first + n), inRange = start && axis[n] >= start && axis[n] <= end;
        c.value = { formula: `IF(${active(row, s.getColumn(first + n).letter)},${stage === 'Testing' ? 2 : 1},0)`, result: inRange ? stage === 'Testing' ? 2 : 1 : 0 };
        c.numFmt = ';;;'; c.fill = fill(inRange ? barColor : colors.white);
        c.border = { bottom: border, ...([1, 8, 15, 22].includes(axis[n].getUTCDate()) ? { left: border } : {}) };
    }
    const condition = active(row, s.getColumn(first).letter);
    s.addConditionalFormatting({ ref: `${s.getColumn(first).letter}${row}:${s.getColumn(last).letter}${row}`, rules: [
        { type: 'expression', formulae: [condition], style: { fill: fill(barColor, true) }, priority: row * 2, stopIfTrue: true },
        { type: 'expression', formulae: [`NOT(${condition})`], style: { fill: fill(colors.white, true) }, priority: row * 2 + 1, stopIfTrue: true },
    ] });
    rows.push({ id, row, stage, task, parentRow, label, date: rangeLabel(start, end), start: start ? iso(start) : null, end: end ? iso(end) : null });
}

let row = 8;
const totals = [];
for (const inc of broadIncrements) {
    const head = merged(row, 2, delivery, `INCREMENT ${inc.number} | ${inc.name.toUpperCase()}`, { bold: true, bg: colors.dark, color: colors.white, size: 11, height: 28 });
    head.border = { bottom: border };
    s.getCell(row, 1).value = `INC-${inc.number}`;
    row++;
    let count = 0;
    for (const [stage, suffix] of [['Design', 'D'], ['Coding', 'C'], ['Testing', 'T']]) {
        const id = `I${inc.number}-${suffix}`, parent = parents.get(id), phaseRow = row;
        addActivity(row++, { id, label: stage, stage, start: parent.start, end: parent.end,
            formula: `IF('Summary Gantt'!C${parent.row}="","",'Summary Gantt'!C${parent.row})`,
            outcome: `${stage} phase for Increment ${inc.number}; current dates follow the existing summary.` });
        for (const [index, task] of inc[stage].entries()) {
            assert(task.start >= 0 && task.start <= task.end && task.end <= 1);
            const span = parent.start ? Math.round((parent.end - parent.start) / DAY) : 0;
            const start = parent.start ? add(parent.start, Math.round(span * task.start)) : null;
            const end = parent.end ? add(parent.start, Math.round(span * task.end)) : null;
            if (start) assert(start >= parent.start && end <= parent.end);
            addActivity(row++, { id: `${id}-${String(index + 1).padStart(2, '0')}`, label: `${index + 1}. ${task.name}`, stage, task: true, parentRow: phaseRow,
                start, end, formula: childDateFormula(phaseRow, task.start, task.end), outcome: task.outcome });
            count++;
        }
    }
    totals.push({ increment: inc.number, design: inc.Design.length, coding: inc.Coding.length, testing: inc.Testing.length, tasks: count });
}
merged(row++, 2, delivery, 'Suggested feature-task estimates only. Related tasks can overlap within a phase. Dates count calendar time; the sheet is a project plan, not a record of measured working effort.', { size: 10, height: 25, color: colors.muted });
merged(row++, 2, delivery, 'Change a Summary Gantt phase to update its linked phase here. Change a phase Date here to re-range its estimated children. A typed child date becomes a manual override. Existing summary dates are preserved.', { size: 10, height: 27, color: colors.muted });
merged(row++, 2, delivery, 'Use the row-outline minus/plus controls to collapse or expand the task lists. W1: days 1-7; W2: 8-14; W3: 15-21; W4: 22 through month-end.', { size: 10, height: 23, color: colors.muted });
s.pageSetup.printArea = `B1:${s.getColumn(delivery).letter}${row - 1}`;
wb.views = wb.views.length ? wb.views.map((v, i) => i === 0 ? { ...v, activeTab: wb.worksheets.length - 1 } : v) : [{ activeTab: wb.worksheets.length - 1 }];
wb.calcProperties.fullCalcOnLoad = true;
await wb.xlsx.writeFile(STAGED);
const zipped = await JSZip.loadAsync(await fs.readFile(STAGED));
const xml = await zipped.file('xl/workbook.xml').async('string');
zipped.file('xl/workbook.xml', xml.replace(/<calcPr\b[^>]*\/>/, '<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'));
// Excel requires outlinePr before pageSetUpPr within sheetPr; ExcelJS emits the
// reverse order when both custom outlines and fit-to-page printing are enabled.
const addedPart = `xl/worksheets/sheet${wb.worksheets.length}.xml`;
const addedXml = await zipped.file(addedPart).async('string');
zipped.file(addedPart, addedXml.replace(/(<pageSetUpPr\b[^>]*\/>)(\s*)(<outlinePr\b[^>]*\/>)/, '$3$2$1'));
await fs.writeFile(STAGED, await zipped.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

const check = new ExcelJS.Workbook();
await check.xlsx.readFile(STAGED);
assert.deepEqual(check.worksheets.map(s => s.name), [...oldNames, NAME]);
for (const name of oldNames) assert.equal(sheetSignature(check.getWorksheet(name)), signatures[name], `Existing sheet changed: ${name}`);
const added = check.getWorksheet(NAME);
assert.equal(rows.filter(r => !r.task).length, 18);
assert.equal(added.conditionalFormattings.length, rows.length);
for (const item of rows) {
    assert.equal(added.getCell(item.row, 3).value.result ?? '', item.date);
    assert(added.getCell(item.row, 3).value.formula);
    assert(added.getCell(item.row, helperStart).value.formula.includes(`$C${item.row}`));
    for (let n = 0; n < axis.length; n++) {
        const cell = added.getCell(item.row, first + n);
        const expected = item.start && axis[n] >= isoDate(item.start) && axis[n] <= isoDate(item.end) ? item.stage === 'Testing' ? colors.yellow : colors.green : colors.white;
        assert.equal(cell.fill.fgColor.argb, `FF${expected}`);
    }
}
const allText = rows.map(r => r.label).join('\n');
for (const text of ['Ordered migrations', 'Production environment and release readiness', 'Cross-module, responsive and access regression']) assert(!allText.includes(text));
assert.equal(hash(await fs.readFile(FILE)), liveInputHash, 'The source workbook changed during preparation. Re-run against the latest saved edits.');
const backup = path.join(OUT, `iPawcus_Gantt_Auto_Color_2026_before_broad_${sourceHash.slice(0, 8)}.xlsx`);
await fs.writeFile(backup, original, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
let output = FILE;
try { await fs.copyFile(STAGED, FILE); }
catch (error) {
    if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    output = path.join(OUT, 'iPawcus_Gantt_Auto_Color_2026_Revised.xlsx');
    await fs.copyFile(STAGED, output);
}
const report = { passed: true, file: output, sheet: NAME, addedSheets: 1, existingSheetsPreserved: oldNames,
    sourceHash, backup, totalFeatureTasks: rows.filter(r => r.task).length, phaseRows: 18, totals,
    firstIncrementLastRow: rows.filter(r => r.id.startsWith('I1-')).at(-1).row,
    rowCount: row - 1, axisStart: iso(axis[0]), axisEnd: iso(axis.at(-1)), firstDayColumn: first,
    helperStartColumn: helperStart, helperEndColumn: helperEnd, rows };
await fs.writeFile(path.join(OUT, 'broad-plan-validation.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
