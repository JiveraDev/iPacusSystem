import { Fragment } from 'react';
import { ClipboardList } from 'lucide-react';
import { formatReportValue, reportColumnAlignment, reportColumnFormat, reportColumnWidths, reportRowDetails, reportSecondaryFields } from '../../lib/reportPresentation';

function alignmentClass(column) {
    return { right: 'text-right', center: 'text-center', left: 'text-left' }[reportColumnAlignment(column)] || 'text-left';
}

function statusClass(value) {
    const states = String(value || '').toLowerCase().split(/[;,]/).map(state => state.trim().replace(/[ -]/g, '_'));
    if (states.some(state => ['cancelled', 'canceled', 'expired', 'out_of_stock', 'rejected', 'refunded'].includes(state))) return 'text-red-700 dark:text-red-300 print:text-red-800';
    if (states.some(state => ['pending', 'waiting', 'partial', 'unpaid', 'unverified', 'completion_unverified', 'low_stock', 'near_expiry', 'past_due', 'due_today'].includes(state))) return 'text-amber-700 dark:text-amber-300 print:text-amber-800';
    if (states.some(state => ['completed', 'verified', 'signed', 'released', 'paid', 'ok'].includes(state))) return 'text-emerald-700 dark:text-emerald-300 print:text-emerald-800';
    if (states.some(state => ['in_progress', 'active', 'confirmed', 'reserved'].includes(state))) return 'text-blue-700 dark:text-blue-300 print:text-blue-800';
    return 'text-slate-700 dark:text-slate-200 print:text-slate-700';
}

export default function ReportTable({ columns = [], rows = [], maxRows, compact = false, footer, rowDetails = [], emptyMessage = 'No matching records are available.', title }) {
    const visibleRows = Number.isFinite(maxRows) ? rows.slice(0, maxRows) : rows;
    const widths = reportColumnWidths(columns);
    const hasFooter = footer && typeof footer === 'object' && Object.keys(footer).length > 0;

    if (!columns.length) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300 print:border-slate-200 print:text-slate-500">
                <ClipboardList className="size-5 shrink-0" aria-hidden="true" />
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="report-table-wrap overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 print:rounded-none print:border-slate-200">
            <table className="report-data-table w-full border-collapse text-sm" style={{ minWidth: columns.length > 3 ? `${columns.length * (compact ? 90 : 105)}px` : undefined }}>
                {title ? <caption className="sr-only">{title}</caption> : null}
                <colgroup>
                    {columns.map((column, index) => <col key={column.key} style={{ width: `${widths[index] * 100}%` }} />)}
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 print:border-slate-200 print:bg-slate-50 print:text-slate-600">
                    <tr>
                        {columns.map(column => (
                            <th key={column.key} scope="col" className={`px-3 py-3 font-semibold ${alignmentClass(column)}`}>
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 print:bg-white">
                    {visibleRows.length ? visibleRows.map((row, rowIndex) => {
                        const details = reportRowDetails({ row_details: rowDetails }, row);
                        const identity = row.id || row.visit_id || row.booking_id || row.queue_id || row.request_number || rowIndex;
                        return (
                            <Fragment key={`${identity}-${rowIndex}`}>
                                <tr className={`align-top ${details.length ? '' : 'border-b border-slate-100 last:border-0 dark:border-slate-800 print:border-slate-200'}`}>
                                    {columns.map(column => {
                                        const numeric = ['currency', 'number', 'quantity', 'percent'].includes(reportColumnFormat(column));
                                        const secondary = reportSecondaryFields(column, row);
                                        return (
                                            <td key={column.key} className={`${compact ? 'px-3 py-2' : 'px-3 py-3'} ${alignmentClass(column)} ${numeric ? 'whitespace-nowrap tabular-nums' : 'break-words'} text-slate-700 dark:text-slate-200 print:text-slate-700`}>
                                                <span className={`${column.primary ? 'font-semibold text-slate-950 dark:text-white print:text-slate-950' : ''} ${reportColumnFormat(column) === 'status' ? statusClass(row[column.key]) : ''}`}>
                                                    {formatReportValue(row[column.key], column)}
                                                </span>
                                                {secondary.map(field => (
                                                    <span key={field.key} className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400 print:text-slate-600">
                                                        {field.label ? `${field.label}: ` : ''}{field.value}
                                                    </span>
                                                ))}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {details.length ? (
                                    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800 print:border-slate-200">
                                        <td colSpan={columns.length} className="px-3 pb-4">
                                            <dl className="report-row-details grid gap-x-6 gap-y-2 border-l-2 border-slate-200 pl-3 text-sm md:grid-cols-2 dark:border-slate-700 print:border-slate-200">
                                                {details.map(field => (
                                                    <div key={field.key} className="min-w-0">
                                                        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">{field.label}</dt>
                                                        <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-slate-700 dark:text-slate-200 print:text-slate-700">{field.value}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        </td>
                                    </tr>
                                ) : null}
                            </Fragment>
                        );
                    }) : (
                        <tr>
                            <td colSpan={columns.length} className="px-3 py-7 text-center text-slate-500 dark:text-slate-300 print:text-slate-500">
                                <ClipboardList className="mx-auto mb-2 size-5" aria-hidden="true" />
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
                {hasFooter ? (
                    <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white print:border-slate-200 print:bg-slate-50 print:text-slate-900">
                        <tr>
                            {columns.map((column, index) => (
                                <td key={column.key} className={`px-3 py-3 tabular-nums ${alignmentClass(column)}`}>
                                    {Object.hasOwn(footer, column.key) ? formatReportValue(footer[column.key], column) : index === 0 ? 'Total' : ''}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                ) : null}
            </table>
            {visibleRows.length < rows.length ? <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">Showing {visibleRows.length} of {rows.length} records.</p> : null}
        </div>
    );
}
