import{t as e}from"./jsx-runtime-BBGNhj8U.js";import{t}from"./history-DkkyBtlr.js";import{t as n}from"./printer-C6nT-9aK.js";import{t as r}from"./button-MLtKCUxK.js";import{t as i}from"./DashboardPageHeader-D4JbRO1S.js";import{t as a}from"./StaffActivityHistory-q7zaP28K.js";var o=e();function s(){return(0,o.jsxs)(`div`,{className:`activity-log-page mx-auto max-w-[1800px] space-y-5`,children:[(0,o.jsx)(`style`,{children:`@media print {
                    @page { size: A4 landscape; margin: 9mm; }
                    html, body, #root {
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: #ffffff !important;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * { visibility: hidden !important; }
                    [data-slot="dashboard-mobile-header"],
                    [data-slot="dashboard-sidebar"],
                    .activity-log-print-hidden { display: none !important; }
                    [data-slot="dashboard-shell"],
                    [data-slot="dashboard-shell"] > div:last-of-type,
                    [data-slot="dashboard-shell"] > div:last-of-type > div:last-child,
                    [data-dashboard-content],
                    .activity-log-page {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        transform: none !important;
                        background: #ffffff !important;
                    }
                    .activity-log-report,
                    .activity-log-report * { visibility: visible !important; color: #0f172a !important; }
                    .activity-log-report {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        border: 0 !important;
                        box-shadow: none !important;
                        background: #ffffff !important;
                    }
                    .activity-log-print-heading { display: block !important; margin-bottom: 16px !important; }
                    .activity-log-print-row { display: table-row !important; }
                    .activity-log-print-details {
                        display: grid !important;
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    }
                    .activity-log-report [class*="bg-"] { background: #ffffff !important; }
                    .activity-log-report [class*="border-"] { border-color: #cbd5e1 !important; }
                    .activity-log-report [class*="overflow-x-auto"] {
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                    }
                    .activity-log-table {
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                        table-layout: fixed !important;
                        border-collapse: collapse !important;
                        font-size: 7.5pt !important;
                    }
                    .activity-log-table thead { display: table-header-group !important; }
                    .activity-log-table tr {
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                    }
                    .activity-log-table th,
                    .activity-log-table td {
                        max-width: none !important;
                        padding: 4px !important;
                        white-space: normal !important;
                        overflow: visible !important;
                        overflow-wrap: anywhere !important;
                        word-break: break-word !important;
                        vertical-align: top !important;
                    }
                }`}),(0,o.jsx)(`div`,{className:`activity-log-print-hidden`,children:(0,o.jsx)(i,{title:`Activity Log`,description:`Review detailed staff activity across clinic branches, including timing, record references, planning status, and quiet periods.`,icon:t,layout:`stacked`,actions:(0,o.jsxs)(r,{type:`button`,variant:`outline`,onClick:()=>window.print(),className:`h-10 justify-center gap-2 whitespace-nowrap`,children:[(0,o.jsx)(n,{className:`size-4`,"aria-hidden":`true`}),`Print Activity Log`]})})}),(0,o.jsxs)(`section`,{className:`activity-log-report rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6`,children:[(0,o.jsxs)(`div`,{className:`activity-log-print-heading hidden border-b border-slate-300 pb-4`,children:[(0,o.jsx)(`h1`,{className:`text-xl font-bold`,children:`Activity Log Report`}),(0,o.jsxs)(`p`,{className:`mt-1 text-sm`,children:[`Detailed branch staff audit record · Prepared `,new Date().toLocaleString()]})]}),(0,o.jsx)(a,{scope:`all`,pageSize:250,showHeading:!1})]})]})}export{s as default};