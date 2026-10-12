import { FileText } from 'lucide-react';
import ReportTable from './ReportTable';
import { getReportNarrative, getReportSections, reportMetadata } from '../../lib/reportPresentation';

export default function ReportPreview({ report, reportTitle = 'report' }) {
    if (!report) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                <FileText className="mx-auto mb-3 size-6 text-slate-400" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview the {reportTitle} to see its findings and records.</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the period and filters above, then select Preview Report.</p>
            </div>
        );
    }

    const summary = report.summary || {};
    const narrative = getReportNarrative(report);
    const sections = getReportSections(report);
    const metadata = reportMetadata(report);
    const comparison = report.comparison || {};
    const comparisonRows = Array.isArray(comparison.rows) ? comparison.rows : [];
    const comparisonColumns = [
        { key: 'label', label: 'Measure', primary: true, width: 2 },
        { key: 'current', label: 'Current period', align: 'right' },
        { key: 'previous', label: 'Previous period', align: 'right' },
        { key: 'change', label: 'Change', align: 'right' },
        { key: 'change_percent', label: 'Relative change', align: 'right' }
    ];

    return (
        <article className="report-print-area report-standard-preview mx-auto max-w-[1600px] space-y-7 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-7 print:border-0 print:bg-white print:p-0 print:text-slate-950">
            <header className="border-b border-slate-200 pb-5 dark:border-slate-700 print:border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#155dfc]">iPawcus · Vetfocus Animal Care Clinic</p>
                <h1 className="mt-2 text-xl font-bold text-slate-950 dark:text-white sm:text-2xl print:text-slate-950">{report.title}</h1>
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {[
                        ['Period', metadata.dateRange],
                        ['Generated', metadata.generatedAt],
                        ['Prepared by', metadata.generatedBy],
                        ['Included', `${summary.record_count ?? report.rows?.length ?? 0} ${summary.record_unit || 'records'}`]
                    ].map(([label, value]) => (
                        <div key={label} className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold text-slate-800 dark:text-slate-100 print:text-slate-800">{label}:</dt>
                            <dd className="text-slate-600 dark:text-slate-300 print:text-slate-600">{value}</dd>
                        </div>
                    ))}
                </dl>
                {narrative.filters.length ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400 print:text-slate-600">
                        <span className="font-semibold">Filters: </span>{narrative.filters.map(filter => `${filter.label}: ${filter.value}`).join('; ')}
                    </p>
                ) : null}
                {narrative.scope ? <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 print:text-slate-600">{narrative.scope}</p> : null}
            </header>

            <section className="report-print-section space-y-2" aria-labelledby="report-executive-summary">
                <h2 id="report-executive-summary" className="text-base font-semibold text-slate-950 dark:text-white print:text-slate-950">Executive Summary</h2>
                <p className="max-w-[100ch] text-sm leading-7 text-slate-700 dark:text-slate-200 print:text-slate-700">{narrative.executive}</p>
            </section>

            {narrative.discussion.length ? (
                <section className="report-discussion space-y-2" aria-labelledby="report-discussion">
                    <h2 id="report-discussion" className="text-base font-semibold text-slate-950 dark:text-white print:text-slate-950">Discussion</h2>
                    {narrative.discussion.map((paragraph, index) => <p key={index} className="max-w-[100ch] text-sm leading-7 text-slate-700 dark:text-slate-200 print:text-slate-700">{paragraph}</p>)}
                </section>
            ) : null}

            {narrative.breakdowns.length ? (
                <dl className="report-print-section flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-4 dark:border-slate-700 print:border-slate-200">
                    {narrative.breakdowns.map((item, index) => (
                        <div key={`${item.label}-${index}`} className="min-w-[9rem] max-w-sm">
                            <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">{item.label}</dt>
                            <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white print:text-slate-900">{item.value}</dd>
                            {item.detail ? <dd className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 print:text-slate-600">{item.detail}</dd> : null}
                        </div>
                    ))}
                </dl>
            ) : null}

            {comparison.text || comparisonRows.length ? (
                <section className="space-y-3">
                    <div className="report-section-heading space-y-1">
                        <h2 className="text-base font-semibold text-slate-950 dark:text-white print:text-slate-950">Comparison with the Previous Period</h2>
                        {comparison.text ? <p className="max-w-[100ch] text-sm leading-6 text-slate-600 dark:text-slate-300 print:text-slate-600">{comparison.text}</p> : null}
                    </div>
                    {comparisonRows.length ? <ReportTable columns={comparisonColumns} rows={comparisonRows} title="Comparison with the Previous Period" /> : null}
                </section>
            ) : null}

            {sections.map(section => (
                <section key={section.id} className="report-record-section space-y-3">
                    <div className="report-section-heading space-y-1">
                        <h2 className="text-base font-semibold text-slate-950 dark:text-white print:text-slate-950">{section.title}</h2>
                        {section.description ? <p className="max-w-[100ch] text-sm leading-6 text-slate-600 dark:text-slate-300 print:text-slate-600">{section.description}</p> : null}
                    </div>
                    <ReportTable title={section.title} columns={section.columns} rows={section.rows} footer={section.footer} rowDetails={section.row_details} emptyMessage={section.empty_message} />
                </section>
            ))}

            {narrative.actions.length ? (
                <section className="report-print-section space-y-2">
                    <h2 className="text-base font-semibold text-slate-950 dark:text-white print:text-slate-950">Follow-Up Actions</h2>
                    <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200 print:text-slate-700">
                        {narrative.actions.map((action, index) => <li key={index}>{action}</li>)}
                    </ol>
                </section>
            ) : null}

            {narrative.missing.length ? (
                <section className="report-print-section space-y-2 border-l-2 border-amber-400 pl-4">
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-white print:text-slate-950">Data Notes</h2>
                    {narrative.missing.map((note, index) => <p key={index} className="text-sm leading-6 text-slate-600 dark:text-slate-300 print:text-slate-600">{note}</p>)}
                </section>
            ) : null}

            <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 print:border-slate-200 print:text-slate-600">
                Prepared from iPawcus records for Vetfocus Animal Care Clinic.
            </footer>
        </article>
    );
}
