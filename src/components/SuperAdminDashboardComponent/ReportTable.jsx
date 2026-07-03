import { formatReportDateLabel } from '../../lib/date';

function isDateColumn(column) {
    const key = String(column?.key || '').toLowerCase();

    return key.includes('date') || key.endsWith('_at') || key.endsWith('at');
}

function displayValue(value) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }

    if (Array.isArray(value)) {
        return value.join(', ');
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}

function displayCellValue(value, column) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }

    if (isDateColumn(column)) {
        return formatReportDateLabel(value, { fallback: String(value) });
    }

    return displayValue(value);
}

export default function ReportTable({ columns = [], rows = [], maxRows, compact = false }) {
    const visibleRows = Number.isFinite(maxRows) ? rows.slice(0, maxRows) : rows;

    if (!columns.length) {
        return (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 print:border-slate-200 print:bg-slate-50 print:text-slate-500">
                No report columns are available.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-200 scrollbar-hide">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800 print:divide-slate-200">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300 print:bg-slate-50 print:text-slate-500">
                    <tr>
                        {columns.map(column => (
                            <th key={column.key} className="whitespace-nowrap px-3 py-3 font-black">
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900 print:divide-slate-100 print:bg-white">
                    {visibleRows.length ? visibleRows.map((row, rowIndex) => (
                        <tr key={row.id || row.visit_id || row.booking_id || row.queue_id || `${rowIndex}-${columns[0]?.key}`} className="align-top">
                            {columns.map(column => (
                                <td key={column.key} className={`${compact ? 'px-3 py-2' : 'px-3 py-3'} max-w-[18rem] text-slate-700 dark:text-slate-200 print:text-slate-700`}>
                                    <span className="line-clamp-3">{displayCellValue(row[column.key], column)}</span>
                                </td>
                            ))}
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={columns.length} className="px-3 py-8 text-center font-semibold text-slate-500 dark:text-slate-300 print:text-slate-500">
                                No records found for this date range.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
