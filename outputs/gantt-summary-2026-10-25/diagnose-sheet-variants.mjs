import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const bytes = await fs.readFile(path.join(dir, 'broad-plan-excel-test-copy.xlsx'));
const variants = [
    ['minimal', () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Test</t></is></c></row></sheetData></worksheet>'],
    ['no-notes', xml => xml.replace(/<legacyDrawing\b[^>]*\/>/g, '')],
    ['no-groups', xml => xml.replace(/ outlineLevel="[^"]*"/g, '').replace(/<outlinePr\b[^>]*\/>/g, '')],
    ['no-cf', xml => xml.replace(/<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/g, '')],
    ['no-formulas', xml => xml.replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, '')],
    ['fixed-outline', xml => xml.replace(/outlineLevelRow="0"/, 'outlineLevelRow="1"')],
    ['no-outline-pr', xml => xml.replace(/<outlinePr\b[^>]*\/>/g, '')],
];
for (const [name, transform] of variants) {
    const zip = await JSZip.loadAsync(bytes);
    const file = 'xl/worksheets/sheet6.xml';
    zip.file(file, transform(await zip.file(file).async('string')));
    if (name === 'minimal' || name === 'no-notes') zip.remove('xl/worksheets/_rels/sheet6.xml.rels');
    await fs.writeFile(path.join(dir, `diagnostic-${name}.xlsx`), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
console.log(`Prepared ${variants.length} isolated sheet diagnostics.`);
