import { excelReportNumberFormat, excelReportValue, formatReportValue, getReportNarrative, getReportOrientation, getReportSections, humanizeReportLabel, reportCellText, reportColumnAlignment, reportColumnWidths, reportMetadata, reportRowDetails } from './reportPresentation';

function reportFileName(report, extension) {
    const title = String(report.title || 'Report').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Report';
    return `iPawcus_${title}_${report.date_range?.start_date || 'start'}_to_${report.date_range?.end_date || 'end'}.${extension}`;
}

function cleanPdfText(value) {
    return String(value ?? '')
        .replace(/\u20b1\s*/g, 'PHP ')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2022/g, '-');
}

function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReportPdf(report) {
    if (!report) return;
    const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const autoTable = autoTableModule.autoTable || autoTableModule.default?.autoTable || autoTableModule.default?.default || autoTableModule.default;
    const narrative = getReportNarrative(report);
    const metadata = reportMetadata(report);
    const doc = new jsPDF({ orientation: getReportOrientation(report), unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = 40;

    const ensureSpace = (height = 40) => {
        if (cursorY + height > pageHeight - 42) {
            doc.addPage();
            cursorY = 40;
        }
    };
    const addText = (paragraph, size = 9, bold = false) => {
        if (!paragraph) return;
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(bold ? 15 : 51, bold ? 23 : 65, bold ? 42 : 85);
        const lines = doc.splitTextToSize(cleanPdfText(paragraph), contentWidth);
        lines.forEach(line => {
            ensureSpace(size + 5);
            doc.text(line, margin, cursorY);
            cursorY += size + 4;
        });
        cursorY += 5;
    };
    const addSection = (heading, paragraphs) => {
        const entries = (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).filter(Boolean);
        if (!entries.length) return;
        ensureSpace(50);
        addText(heading, 11, true);
        entries.forEach(entry => addText(entry));
        cursorY += 7;
    };
    const addTable = (columns, body, footer) => {
        if (!columns.length) return;
        ensureSpace(60);
        const hasFooter = footer && typeof footer === 'object' && Object.keys(footer).length > 0;
        const widths = reportColumnWidths(columns);
        const columnStyles = Object.fromEntries(columns.map((column, index) => [index, {
            halign: reportColumnAlignment(column),
            cellWidth: widths[index] * contentWidth
        }]));
        autoTable(doc, {
            startY: cursorY,
            head: [columns.map(column => cleanPdfText(column.label))],
            body,
            foot: hasFooter ? [columns.map((column, index) => Object.hasOwn(footer, column.key)
                ? cleanPdfText(formatReportValue(footer[column.key], column))
                : index === 0 ? 'Total' : '')] : undefined,
            showFoot: 'lastPage',
            theme: 'plain',
            tableWidth: contentWidth,
            showHead: 'everyPage',
            rowPageBreak: 'avoid',
            margin: { top: 36, left: margin, right: margin, bottom: 38 },
            columnStyles,
            styles: { cellPadding: 5, font: 'helvetica', fontSize: 8, overflow: 'linebreak', textColor: [51, 65, 85], valign: 'top', lineWidth: { bottom: 0.4 }, lineColor: [226, 232, 240] },
            headStyles: { fillColor: [248, 250, 252], fontStyle: 'bold', textColor: [71, 85, 105], lineWidth: { bottom: 0.8 } },
            footStyles: { fillColor: [248, 250, 252], fontStyle: 'bold', textColor: [15, 23, 42], lineWidth: { top: 0.8 } },
            didParseCell: data => {
                if (data.section === 'body' && data.cell.colSpan === 1 && columns[data.column.index]?.primary) {
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        cursorY = (doc.lastAutoTable?.finalY || cursorY) + 20;
    };

    addText('iPawcus | Vetfocus Animal Care Clinic', 10, true);
    addText(report.title || 'Report', 18, true);
    addText(`Period: ${metadata.dateRange}`);
    addText(`Generated: ${metadata.generatedAt} | Prepared by: ${metadata.generatedBy}`);
    addText(`Included: ${report.summary?.record_count ?? report.rows?.length ?? 0} ${report.summary?.record_unit || 'records'}`);
    if (narrative.filters.length) addText(`Filters: ${narrative.filters.map(filter => `${filter.label}: ${filter.value}`).join('; ')}`);
    addText(narrative.scope);
    cursorY += 10;
    addSection('Executive Summary', narrative.executive);
    addSection('Discussion', narrative.discussion);
    if (narrative.breakdowns.length) {
        addSection('Selected Figures', narrative.breakdowns.map(item => `${item.label}: ${item.value}${item.detail ? ` - ${item.detail}` : ''}`));
    }
    const comparison = report.comparison || {};
    if (comparison.text || comparison.rows?.length) {
        addSection('Comparison with the Previous Period', comparison.text);
        if (comparison.rows?.length) {
            addTable([
                { key: 'label', label: 'Measure', width: 2, primary: true },
                { key: 'current', label: 'Current period', align: 'right' },
                { key: 'previous', label: 'Previous period', align: 'right' },
                { key: 'change', label: 'Change', align: 'right' },
                { key: 'change_percent', label: 'Relative change', align: 'right' }
            ], comparison.rows.map(row => [row.label, row.current, row.previous, row.change, row.change_percent || 'Not applicable'].map(cleanPdfText)));
        }
    }
    getReportSections(report).forEach(section => {
        ensureSpace(80);
        addText(section.title, 11, true);
        addText(section.description);
        if (!section.columns.length) {
            addText(section.empty_message);
            cursorY += 10;
            return;
        }
        const body = [];
        section.rows.forEach(row => {
            body.push(section.columns.map(column => cleanPdfText(reportCellText(row, column))));
            const details = reportRowDetails(section, row);
            if (details.length) body.push([{
                content: details.map(field => `${field.label}: ${cleanPdfText(field.value)}`).join('\n\n'),
                colSpan: section.columns.length,
                styles: { fontStyle: 'normal', cellPadding: { top: 2, right: 5, bottom: 9, left: 8 } }
            }]);
        });
        if (!body.length) body.push([{ content: cleanPdfText(section.empty_message), colSpan: section.columns.length }]);
        addTable(section.columns, body, section.footer);
    });
    addSection('Follow-Up Actions', narrative.actions.map((action, index) => `${index + 1}. ${action}`));
    addSection('Data Notes', narrative.missing);

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`iPawcus | Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 18, { align: 'center' });
    }
    doc.save(reportFileName(report, 'pdf'));
}

function worksheetName(title, usedNames) {
    const base = String(title || 'Records').replace(/[\\/*?:[\]]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Records';
    let name = base;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
        const ending = ` (${suffix++})`;
        name = `${base.slice(0, 31 - ending.length)}${ending}`;
    }
    usedNames.add(name.toLowerCase());
    return name;
}

function excelFields(section) {
    const fields = [];
    const seen = new Set();
    const append = field => {
        if (!field?.key || seen.has(field.key)) return;
        fields.push({ ...field, label: field.label || humanizeReportLabel(field.key) });
        seen.add(field.key);
    };
    section.columns.forEach(column => {
        append(column);
        (column.secondary_keys || []).forEach(field => append(typeof field === 'string' ? { key: field } : field));
    });
    (section.row_details || []).forEach(append);
    return fields;
}

export async function exportReportExcel(report) {
    if (!report) return;
    const excelModule = await import('exceljs');
    const Workbook = excelModule.Workbook || excelModule.default?.Workbook;
    if (!Workbook) throw new Error('The Excel export library could not be loaded.');
    const workbook = new Workbook();
    const metadata = reportMetadata(report);
    const narrative = getReportNarrative(report);
    const usedNames = new Set(['summary']);
    const orientation = getReportOrientation(report);
    workbook.creator = 'iPawcus';
    workbook.company = 'Vetfocus Animal Care Clinic';
    workbook.created = new Date();
    workbook.modified = new Date();
    const summarySheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    summarySheet.columns = [{ width: 26 }, { width: 34 }, { width: 48 }, { width: 24 }];

    const addSummaryText = (text, heading = false) => {
        const row = summarySheet.addRow([text]);
        summarySheet.mergeCells(row.number, 1, row.number, 4);
        row.getCell(1).font = { bold: heading, size: heading ? 12 : 10, color: { argb: 'FF0F172A' } };
        row.getCell(1).alignment = { vertical: 'top', wrapText: true };
        row.height = Math.max(24, Math.ceil(String(text).length / 120) * 16 + 8);
    };
    const addSummarySection = (heading, entries) => {
        const paragraphs = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
        if (!paragraphs.length) return;
        summarySheet.addRow([]);
        addSummaryText(heading, true);
        paragraphs.forEach(paragraph => addSummaryText(paragraph));
    };
    addSummaryText('iPawcus | Vetfocus Animal Care Clinic', true);
    addSummaryText(report.title || 'Report', true);
    addSummaryText(`Period: ${metadata.dateRange}`);
    addSummaryText(`Generated: ${metadata.generatedAt} | Prepared by: ${metadata.generatedBy}`);
    addSummaryText(`Included: ${report.summary?.record_count ?? report.rows?.length ?? 0} ${report.summary?.record_unit || 'records'}`);
    if (narrative.filters.length) addSummaryText(`Filters: ${narrative.filters.map(filter => `${filter.label}: ${filter.value}`).join('; ')}`);
    if (narrative.scope) addSummaryText(narrative.scope);
    addSummarySection('Executive Summary', narrative.executive);
    addSummarySection('Discussion', narrative.discussion);
    addSummarySection('Selected Figures', narrative.breakdowns.map(item => `${item.label}: ${item.value}${item.detail ? ` - ${item.detail}` : ''}`));
    const comparison = report.comparison || {};
    addSummarySection('Comparison with the Previous Period', [comparison.text, ...(comparison.rows || []).map(row => `${row.label}: current ${row.current}; previous ${row.previous}; change ${row.change}; relative change ${row.change_percent || 'not applicable'}.`)]);
    addSummarySection('Follow-Up Actions', narrative.actions.map((action, index) => `${index + 1}. ${action}`));
    addSummarySection('Data Notes', narrative.missing);

    getReportSections(report).forEach(section => {
        const fields = excelFields(section);
        const count = Math.max(fields.length, 1);
        const sheet = workbook.addWorksheet(worksheetName(section.title, usedNames), {
            views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
            pageSetup: { paperSize: 9, orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' }
        });
        sheet.columns = fields.length ? fields.map(field => ({ width: Math.min(48, Math.max(14, field.label.length + 3)) })) : [{ width: 60 }];
        const title = sheet.addRow([section.title]);
        sheet.mergeCells(title.number, 1, title.number, count);
        title.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
        title.height = 26;
        const period = sheet.addRow([metadata.dateRange]);
        sheet.mergeCells(period.number, 1, period.number, count);
        const description = sheet.addRow([section.description || narrative.scope || '']);
        sheet.mergeCells(description.number, 1, description.number, count);
        description.getCell(1).alignment = { wrapText: true, vertical: 'top' };
        description.height = Math.max(22, Math.ceil(String(description.getCell(1).value).length / (count * 18)) * 15 + 6);
        const header = sheet.addRow(fields.map(field => field.label));
        header.height = 32;
        header.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF334155' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        if (!fields.length || !section.rows.length) {
            const empty = sheet.addRow([section.empty_message]);
            sheet.mergeCells(empty.number, 1, empty.number, count);
            empty.getCell(1).alignment = { wrapText: true, vertical: 'top' };
            empty.height = 36;
        } else {
            section.rows.forEach(source => {
                const row = sheet.addRow(fields.map(field => excelReportValue(source[field.key], field)));
                row.eachCell({ includeEmpty: true }, (cell, index) => {
                    const field = fields[index - 1];
                    cell.numFmt = excelReportNumberFormat(field);
                    cell.alignment = { vertical: 'top', wrapText: true, horizontal: reportColumnAlignment(field) };
                    cell.font = { size: 10, bold: Boolean(field.primary), color: { argb: 'FF334155' } };
                    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
                });
                row.height = Math.min(409, Math.max(24, ...fields.map((field, index) => {
                    const text = formatReportValue(source[field.key], field, { empty: '' });
                    const available = Math.max(8, sheet.getColumn(index + 1).width - 2);
                    return text.split('\n').reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / available)), 0) * 14 + 8;
                })));
            });
            sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: sheet.rowCount, column: count } };
        }
        if (section.footer && Object.keys(section.footer).length) {
            const row = sheet.addRow(fields.map((field, index) => Object.hasOwn(section.footer, field.key)
                ? excelReportValue(section.footer[field.key], field) : index === 0 ? 'Total' : null));
            row.height = 26;
            row.eachCell({ includeEmpty: true }, (cell, index) => {
                cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.alignment = { vertical: 'middle', horizontal: reportColumnAlignment(fields[index - 1]) };
                cell.numFmt = excelReportNumberFormat(fields[index - 1]);
            });
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), reportFileName(report, 'xlsx'));
}
