import { formatReportDateLabel, formatReportDateRange } from './date';

function isReportDateColumn(column) {
    const key = String(column?.key || '').toLowerCase();

    return key.includes('date') || key.endsWith('_at') || key.endsWith('at');
}

function formatReportValue(value, column, preserveNumbers = false) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (isReportDateColumn(column)) {
        return formatReportDateLabel(value, { fallback: String(value) });
    }

    if (Array.isArray(value)) {
        return value.join(', ');
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    if (preserveNumbers && typeof value === 'number') {
        return value;
    }

    return String(value);
}

function humanizeKey(key) {
    return String(key || '')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function reportMetadata(report) {
    return {
        dateRange: formatReportDateRange(report.date_range?.start_date, report.date_range?.end_date, {
            fallback: report.date_range?.label || 'N/A'
        }),
        generatedAt: formatReportDateLabel(report.generated_at, { fallback: report.generated_at || 'N/A' }),
        generatedBy: report.generated_by || 'Super Admin'
    };
}

function reportFileName(report, extension) {
    const title = String(report.title || 'Report')
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'Report';
    const startDate = report.date_range?.start_date || 'start';
    const endDate = report.date_range?.end_date || 'end';

    return `iPawcus_${title}_${startDate}_to_${endDate}.${extension}`;
}

function cleanPdfText(value) {
    return String(value ?? '')
        .replaceAll('₱', 'PHP ')
        .replace(/[–—]/g, '-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replaceAll('•', '-');
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

    const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
    ]);
    const autoTable = autoTableModule.autoTable || autoTableModule.default;
    const columns = Array.isArray(report.columns) ? report.columns : [];
    const rows = Array.isArray(report.rows) ? report.rows : [];
    const summary = report.summary || {};
    const breakdowns = Array.isArray(summary.breakdowns) ? summary.breakdowns : [];
    const managementActions = Array.isArray(summary.management_actions)
        ? summary.management_actions
        : (Array.isArray(summary.managementActions) ? summary.managementActions : []);
    const comparisonRows = Array.isArray(report.comparison?.rows) ? report.comparison.rows : [];
    const metadata = reportMetadata(report);
    const orientation = columns.length > 6 ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageWidth - (margin * 2);
    let cursorY = 40;

    const ensureSpace = (height = 40) => {
        if (cursorY + height > pageHeight - 42) {
            doc.addPage();
            cursorY = 40;
        }
    };
    const addSection = (heading, paragraphs) => {
        const entries = (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).filter(Boolean);
        if (!entries.length) return;

        ensureSpace(42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(cleanPdfText(heading).toUpperCase(), margin, cursorY);
        cursorY += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);

        entries.forEach(entry => {
            const lines = doc.splitTextToSize(cleanPdfText(entry), contentWidth);
            lines.forEach(line => {
                ensureSpace(13);
                doc.text(line, margin, cursorY);
                cursorY += 12;
            });
            cursorY += 3;
        });
        cursorY += 5;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 93, 252);
    doc.text('iPawcus', margin, cursorY);
    cursorY += 20;
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(report.title || 'Report'), margin, cursorY);
    cursorY += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Vetfocus Animal Care Clinic | ${cleanPdfText(metadata.dateRange)}`, margin, cursorY);
    cursorY += 13;
    doc.text(`Generated ${cleanPdfText(metadata.generatedAt)} by ${cleanPdfText(metadata.generatedBy)}`, margin, cursorY);
    cursorY += 22;

    addSection('Executive Summary', summary.executive_text || summary.executiveText || summary.text || 'No summary available.');
    addSection('Operational Reading', summary.operational_context || summary.operationalContext);
    addSection(
        'Comparative Reading',
        [
            report.comparison?.text || summary.comparison_text,
            ...comparisonRows.map(row => `${row.label}: current ${row.current}, previous ${row.previous}, change ${row.change} (${row.change_percent || 'N/A'})`)
        ]
    );
    addSection('Key Breakdowns', breakdowns.map(item => `${item.label}: ${item.value}${item.detail ? ` - ${item.detail}` : ''}`));
    addSection('Management Follow-Up', managementActions.map((action, index) => `${index + 1}. ${action}`));
    addSection('Totals', Object.entries(report.totals || {}).map(([key, value]) => `${humanizeKey(key)}: ${formatReportValue(value)}`));

    ensureSpace(70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Detailed Records', margin, cursorY);
    cursorY += 10;

    if (columns.length) {
        autoTable(doc, {
            startY: cursorY,
            head: [columns.map(column => cleanPdfText(column.label))],
            body: rows.length
                ? rows.map(row => columns.map(column => cleanPdfText(formatReportValue(row[column.key], column))))
                : [columns.map((column, index) => index === 0 ? 'No detailed records for this report.' : '')],
            theme: 'grid',
            margin: { left: margin, right: margin, bottom: 34 },
            styles: {
                cellPadding: 4,
                font: 'helvetica',
                fontSize: columns.length > 8 ? 6.5 : 7.5,
                lineColor: [226, 232, 240],
                lineWidth: 0.5,
                overflow: 'linebreak',
                textColor: [51, 65, 85],
                valign: 'top'
            },
            headStyles: {
                fillColor: [21, 93, 252],
                fontStyle: 'bold',
                textColor: [255, 255, 255]
            },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });
    }

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

export async function exportReportExcel(report) {
    if (!report) return;

    const excelModule = await import('exceljs');
    const Workbook = excelModule.Workbook || excelModule.default?.Workbook;
    if (!Workbook) {
        throw new Error('The Excel export library could not be loaded.');
    }

    const workbook = new Workbook();
    const metadata = reportMetadata(report);
    const summary = report.summary || {};
    const columns = Array.isArray(report.columns) ? report.columns : [];
    const rows = Array.isArray(report.rows) ? report.rows : [];
    const breakdowns = Array.isArray(summary.breakdowns) ? summary.breakdowns : [];
    const managementActions = Array.isArray(summary.management_actions)
        ? summary.management_actions
        : (Array.isArray(summary.managementActions) ? summary.managementActions : []);
    const comparisonRows = Array.isArray(report.comparison?.rows) ? report.comparison.rows : [];
    const appliedFilters = Array.isArray(summary.filters) ? summary.filters : [];
    const summarySheet = workbook.addWorksheet('Summary', {
        views: [{ showGridLines: false }]
    });

    workbook.creator = 'iPawcus';
    workbook.company = 'Vetfocus Animal Care Clinic';
    workbook.created = new Date();
    workbook.modified = new Date();

    summarySheet.columns = [
        { key: 'label', width: 28 },
        { key: 'value', width: 34 },
        { key: 'detail', width: 58 },
        { key: 'extra', width: 22 }
    ];

    const addMergedTitle = (value, size = 16) => {
        const row = summarySheet.addRow([value]);
        summarySheet.mergeCells(row.number, 1, row.number, 4);
        row.height = size + 10;
        row.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' }, size };
        row.getCell(1).alignment = { vertical: 'middle' };
        return row;
    };
    const addSectionHeading = (value) => {
        summarySheet.addRow([]);
        const row = summarySheet.addRow([value]);
        summarySheet.mergeCells(row.number, 1, row.number, 4);
        row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155DFC' } };
        row.getCell(1).alignment = { vertical: 'middle' };
        row.height = 22;
    };
    const addWrappedRow = (values) => {
        const row = summarySheet.addRow(values);
        row.alignment = { vertical: 'top', wrapText: true };
        return row;
    };

    const brandRow = summarySheet.addRow(['iPawcus']);
    brandRow.getCell(1).font = { bold: true, color: { argb: 'FF155DFC' }, size: 12 };
    addMergedTitle(report.title || 'Report');
    addWrappedRow(['Date Range', metadata.dateRange]);
    addWrappedRow(['Generated At', metadata.generatedAt]);
    addWrappedRow(['Generated By', metadata.generatedBy]);
    addWrappedRow(['Detailed Records', summary.record_count ?? rows.length]);
    addWrappedRow(['Filters', appliedFilters.length ? appliedFilters.map(filter => `${filter.label}: ${filter.value}`).join('; ') : 'None']);

    addSectionHeading('Executive Summary');
    const executiveRow = addWrappedRow([summary.executive_text || summary.executiveText || summary.text || 'No summary available.']);
    summarySheet.mergeCells(executiveRow.number, 1, executiveRow.number, 4);
    if (summary.operational_context || summary.operationalContext) {
        const operationalRow = addWrappedRow([summary.operational_context || summary.operationalContext]);
        summarySheet.mergeCells(operationalRow.number, 1, operationalRow.number, 4);
    }

    if (report.comparison?.text || summary.comparison_text || comparisonRows.length) {
        addSectionHeading('Comparative Reading');
        if (report.comparison?.text || summary.comparison_text) {
            const comparisonTextRow = addWrappedRow([report.comparison?.text || summary.comparison_text]);
            summarySheet.mergeCells(comparisonTextRow.number, 1, comparisonTextRow.number, 4);
        }
        addWrappedRow(['Measure', 'Current', 'Previous', 'Change / Relative']).font = { bold: true };
        comparisonRows.forEach(row => addWrappedRow([
            row.label,
            row.current,
            row.previous,
            `${row.change} / ${row.change_percent || 'N/A'}`
        ]));
    }

    if (breakdowns.length) {
        addSectionHeading('Key Breakdowns');
        addWrappedRow(['Measure', 'Value', 'Reading']).font = { bold: true };
        breakdowns.forEach(item => addWrappedRow([item.label, item.value, item.detail]));
    }

    if (managementActions.length) {
        addSectionHeading('Management Follow-Up');
        managementActions.forEach((action, index) => addWrappedRow([index + 1, action]));
    }

    addSectionHeading('Totals');
    Object.entries(report.totals || {}).forEach(([key, value]) => {
        addWrappedRow([humanizeKey(key), formatReportValue(value, null, true)]);
    });
    summarySheet.eachRow(row => {
        row.eachCell(cell => {
            cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true };
        });
    });

    const detailSheet = workbook.addWorksheet('Detailed Records', {
        views: [{ state: 'frozen', ySplit: 1, showGridLines: false }]
    });
    if (columns.length) {
        detailSheet.columns = columns.map(column => ({
            header: column.label,
            key: column.key,
            width: Math.min(42, Math.max(14, String(column.label || '').length + 4))
        }));
        rows.forEach(sourceRow => {
            const outputRow = {};
            columns.forEach(column => {
                outputRow[column.key] = formatReportValue(sourceRow[column.key], column, true);
            });
            detailSheet.addRow(outputRow);
        });
        detailSheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length }
        };
        const headerRow = detailSheet.getRow(1);
        headerRow.height = 24;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155DFC' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        detailSheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell(cell => {
                    cell.alignment = { vertical: 'top', wrapText: true };
                    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
                });
            }
        });
        columns.forEach((column, index) => {
            const columnValues = rows.slice(0, 500).map(row => formatReportValue(row[column.key], column));
            const longestValue = columnValues.reduce((maximum, value) => Math.max(maximum, String(value).length), String(column.label || '').length);
            detailSheet.getColumn(index + 1).width = Math.min(42, Math.max(14, longestValue + 2));
        });
    } else {
        detailSheet.addRow(['No detailed records are available for this report.']);
        detailSheet.getColumn(1).width = 52;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        reportFileName(report, 'xlsx')
    );
}
