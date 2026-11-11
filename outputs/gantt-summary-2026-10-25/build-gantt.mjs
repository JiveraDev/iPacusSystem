import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BACKUP = 'D:/recovery back up-20261012T091915Z-1-002/recovery back up';
const PHASE1 = path.join(BACKUP, 'timeline - Phase 1.xlsx');
const LATEST = path.join(BACKUP, 'iPawcus_Revised_Gantt.xlsx');
const METHOD = 'C:/Users/loren/Downloads/Software Methodology.txt';
const OUTPUT = path.join(OUT, 'iPawcus_Gantt_Auto_Color_2026.xlsx');
const DAY = 86400000;
const C = {
    ink: '22272B', dark: '343A3D', muted: '637078', grid: 'D7DCDE',
    pale: 'F2F4F3', white: 'FFFFFF', green: '70AD47', yellow: 'FFD966',
    blue: '1765A6', blueFill: 'F0F7FE', section: 'DFE7E2',
};
const date = s => new Date(`${s}T00:00:00.000Z`);
const iso = d => d.toISOString().slice(0, 10);
const days = (a, b) => Math.round((b - a) / DAY) + 1;
const add = (d, n) => new Date(d.getTime() + n * DAY);
const serial = d => Math.round(d.getTime() / DAY) + 25569;
const short = d => `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
const fill = color => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } });
const ruleFill = color => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` }, bgColor: { argb: `FF${color}` } });
const font = (size = 10, bold = false, color = C.ink) => ({ name: 'Calibri', size, bold, color: { argb: `FF${color}` } });
const hair = color => ({ style: 'hair', color: { argb: `FF${color}` } });
const sourceHash = async p => createHash('sha256').update(await fs.readFile(p)).digest('hex');
const sourceHashes = Object.fromEntries(await Promise.all([PHASE1, LATEST, METHOD].map(async p => [p, await sourceHash(p)])));

const increments = [
    {
        number: 1, name: 'Access and authentication',
        summary: 'Landing page, registration, login, OTP recovery, sessions and Google access.',
        stages: [
            ['Design', '2026-04-20', '2026-04-26', 'Requirements adjustment; entry-page prototypes; account, OTP and session schema; Google onboarding and account-linking flow; health-check recovery flow.'],
            ['Coding', '2026-04-27', '2026-05-10', 'Landing page; registration/login; email verification and password recovery; staff-account creation; authenticated sessions; Google sign-in, onboarding and linking; server health and recovery screens.'],
            ['Testing', '2026-05-11', '2026-05-19', 'Registration, expired/resend OTPs, duplicate accounts, login/recovery, sessions, Google identity linking, inactive accounts, outage recovery and user feedback.'],
        ],
    },
    {
        number: 2, name: 'Profiles and access control',
        summary: 'Profiles, staff/owner controls, branch permissions, schedules and activity history.',
        stages: [
            ['Design', '2026-05-11', '2026-05-19', 'Requirements adjustment; role/profile interfaces; branch and feature permissions; personnel and veterinarian schedules; notification preferences; activity-history access; shared theme and refresh behavior.'],
            ['Coding', '2026-05-20', '2026-06-03', 'Owner/staff profiles; account activation and protected removal; branch and feature restrictions; availability and clinic configuration; preferences; activity history; theme controls and quiet refresh.'],
            ['Testing', '2026-06-04', '2026-06-10', 'Profile persistence, role/branch boundaries, feature permissions, protected accounts, schedules, activity-history privacy, preference settings, theme and responsive behavior.'],
        ],
    },
    {
        number: 3, name: 'Pet profiles and medical records',
        summary: 'Pet linking/co-ownership, clinical records, prescriptions, attachments and corrections.',
        stages: [
            ['Design', '2026-06-04', '2026-06-10', 'Requirements adjustment; pet registration/linking and co-owner approval; clinical-record relationships; structured diagnosis and extra consent; owner visibility; record-correction workflow.'],
            ['Coding', '2026-06-11', '2026-06-26', 'Pet profiles and ownership; EMR and diagnosis; allergy/vaccination data; prescriptions, laboratory files and attachments; extra diagnosis consent; print/email copies; controlled record updates and change notifications.'],
            ['Testing', '2026-06-27', '2026-07-03', 'Pet linking/co-owner approval, grouped medical records, diagnosis with optional vaccination, extra consent, attachment permissions, print/email, meaningful-change notifications and correction requests.'],
        ],
    },
    {
        number: 4, name: 'Bookings, consultations and payments',
        summary: 'Appointments, Jitsi consultations, home service, consent, payment proof and calendar.',
        stages: [
            ['Design', '2026-06-27', '2026-07-03', 'Requirements adjustment; booking/calendar interfaces; veterinarian presence, lunch and conflict rules; consultation access; home service; digital consent and proof submission; saved booking intent and personal tasks.'],
            ['Coding', '2026-07-04', '2026-07-19', 'Service bookings; approval/rescheduling/cancellation; veterinarian availability and presence; Jitsi access and documentation; home service; consent/signatures; payment proof and verification; booking-intent recovery; personal calendar and reminder hooks.'],
            ['Testing', '2026-07-20', '2026-07-26', 'Booking conflicts and branch/service rules; presence/lunch rules; saved booking handoff; authorized consultation access; consent/proof verification; home-service details; calendars, reminders and missed-booking handling.'],
        ],
    },
    {
        number: 5, name: 'Clinic operations, billing and inventory',
        summary: 'Queue/TV display, grooming, boarding, POS, service pricing and inventory.',
        stages: [
            ['Design', '2026-07-20', '2026-07-26', 'Requirements adjustment; queue/public-display flow; grooming and boarding operations; service catalog and price projections; visit/POS links; stock movement, branch transfer and safe product deletion.'],
            ['Coding', '2026-07-27', '2026-08-12', 'Network-restricted queue and TV status; grooming intake/photos/review/pickup; boarding rooms, care tasks and checkout; service catalog and estimates; POS/invoices; stock batches, expiry, deductions, transfers and safe deletion; operational notifications and lifecycle automation.'],
            ['Testing', '2026-08-13', '2026-08-19', 'Queue consent, duplicates and assignment; TV privacy/refresh; grooming and boarding lifecycles; room conflicts; invoice/payment totals; materials/stock reversals; transfers and expiry alerts; deletion preserves history; operational notifications.'],
        ],
    },
    {
        number: 6, name: 'Reporting, media and backup',
        summary: 'Reports, comparisons, PDF/Excel exports, protected media and recoverable backups.',
        stages: [
            ['Design', '2026-08-13', '2026-08-19', 'Requirements adjustment; KPI/report filters and comparisons; PDF/Excel layouts; media-access views; operational alerts; backup package, emergency workbook and recovery workflow.'],
            ['Coding', '2026-08-20', '2026-09-05', 'Reporting dashboard/center; date/branch filters; comparisons and drill-downs; PDF/Excel exports; protected media and consistency checks; notification/alert integration; database/media backup, manifests/checksums and emergency workbook.'],
            ['Testing', '2026-09-06', '2026-09-12', 'Reconcile reports/exports with source records; verify filters, comparisons, role access, protected media and alerts; inspect backup SQL/files/manifests and rehearse recovery; prepare integrated release.'],
        ],
    },
];

const featurePlacement = [
    ['Google sign-in, onboarding and account linking', 'Not explicitly named', 'Increment 1; profile indicator in 2', 'Requirements + Design/Coding/Testing', 'Add Google identity verification, registration/linking, duplicate-link prevention and inactive-account checks. Include profile connection feedback in Increment 2.', '349-372'],
    ['API/database health checks and outage recovery', 'Not explicitly named', 'Increment 1', 'Design/Coding/Testing', 'Add service-availability checks, recovery screen, retry behavior and recovery testing.', '9, 11, 18-19, 23'],
    ['Persistent theme and quiet automatic refresh', 'Not explicitly named', 'Increment 2; shared across modules', 'Design/Coding/Testing', 'Add shared light/dark mode, retained preferences and quiet refresh; verify readability and updates in later increments.', '29-35'],
    ['Protected staff-account removal', 'Broad account controls only', 'Increment 2', 'Coding/Testing', 'Specify soft removal, confirmation controls, protection of self/Super Admin accounts and preservation of historical records.', '37-43'],
    ['Staff activity history and privacy', 'Not explicitly named', 'Increment 2', 'Requirements + Design/Coding/Testing', 'Add own-history and Super Admin views, sign-in/action/navigation records, pagination, scoped access, credential redaction and retention.', '373-393'],
    ['Daily veterinarian presence and lunch rules', 'General schedules already covered', 'Increment 2 configuration; Increment 4 booking enforcement', 'Design/Coding/Testing', 'Distinguish daily clinic presence from weekly availability; show presence and enforce applicable lunch restrictions during booking changes.', '232-244'],
    ['Extra diagnosis consent and optional vaccination', 'Records/consent broadly covered', 'Increment 3', 'Design/Coding/Testing', 'Specify additional signed diagnosis consent and allow clinical diagnoses to be saved without a vaccination entry.', '55, 58-59, 69-70'],
    ['Notifications for meaningful medical-record changes', 'Not explicitly named', 'Increment 3', 'Coding/Testing', 'Notify the owner when meaningful clinical content changes; avoid notifications for unchanged saves and confirm the destination link.', '66-67, 71-72'],
    ['Booking intent retained through authentication', 'Not explicitly named', 'Increment 4; Increment 1 handoff', 'Design/Coding/Testing', 'Preserve selected service/booking details through sign-in and revalidate ownership, availability and expiry when resuming.', '241-244'],
    ['Personal task/TODO calendar', 'Appointment calendar already covered', 'Increment 4', 'Design/Coding/Testing', 'Distinguish personal tasks from appointments; include month/week/day/agenda views, slot/range selection and stored start/end dates.', '151-155, 164'],
    ['Notification center, delivery and reminder processing', 'Preferences/events already covered', 'Increment 2 foundation; 4/5 event integration; 6 alerts', 'Design/Coding/Testing', 'Name the full notification feed, filters/read state, in-app/email/push delivery and reminder processing; connect each module to this shared service.', '35-36, 145-148, 159-160, 268'],
    ['Public queue/TV status display', 'Queue monitoring broadly covered', 'Increment 5', 'Design/Coding/Testing', 'Add privacy-safe public status display, quiet refresh and React/standalone deployment verification.', '105, 120-121, 129-130, 210'],
    ['Missed-booking and expired-queue automation', 'Read-only consistency report already covered in 6', 'Increment 4 bookings; Increment 5 queue', 'Coding/Testing', 'Add lifecycle expiry, eligible rescheduling/cancellation and date-boundary testing. Keep the existing consistency-report scope in Increment 6.', '122-123, 128'],
    ['Configurable service price projections', 'Catalog prices already covered', 'Increment 5; booking display in 4', 'Design/Coding/Testing', 'Specify configurable general-service, grooming/kap on, home-service and boarding estimates, add-ons and reset/default behavior.', '225, 306-312, 321'],
    ['Inventory deletion preserves invoice history', 'Inventory operations already covered', 'Increment 5', 'Coding/Testing', 'Add password/branch/reason controls, linked-material safeguards, transaction handling, audit history and retention of invoice descriptions.', '273-287'],
    ['Protected PDF/document viewing and download', 'Protected attachments already covered', 'Increment 3; consent integration in 4', 'Design/Coding/Testing', 'State preview/open/download behavior for supported documents while retaining the existing role and ownership access checks.', '65, 201-202, 229'],
    ['Report comparisons, drill-downs and action summaries', 'Reports broadly covered', 'Increment 6', 'Design/Coding/Testing', 'Add previous-period comparisons, management summaries and KPI drill-down navigation; verify values against source records.', '313-320, 322'],
    ['Backup recovery, emergency workbook and package integrity', 'Backup creation/contents already covered', 'Increment 6; integrated test during final testing', 'Design/Coding/Testing', 'Extend backup scope to SQL/media/activity files, emergency operational workbook, restore instructions, manifests/checksums, cleanup and a recovery rehearsal.', '323-348'],
    ['Ordered migrations and clean/upgrade database validation', 'Deployment setup broadly covered', 'Each increment; final testing', 'Coding/Testing + deployment readiness', 'Apply versioned schema changes with the affected increment; compare clean and upgraded databases and verify preservation of existing records.', '166, 170-182, 187-193'],
    ['Cross-module, responsive and access regression', 'Per-increment testing already covered', 'Each increment; final testing Sep 13-19', 'Testing', 'Include connected booking/queue/diagnosis/billing/stock flows, branch/role/media boundaries, notifications and phone/tablet/desktop layouts.', '165, 212-220, 292, 396-399'],
    ['Production environment and release readiness', 'Hosting/deployment already covered', 'Final testing; deployment/readiness preparation', 'Testing + deployment', 'Verify build/API/database, Jitsi, mail/push, protected uploads, HTTPS/CORS and TV subdomain; prepare the release and operational checklist.', '203-211, 230, 346, 370-371, 391, 400'],
];
featurePlacement[13][4] = featurePlacement[13][4].replace('kap on', 'kapon');

const wb = new ExcelJS.Workbook();
wb.creator = 'iPawcus project planning';
wb.subject = 'Suggested overlapping incremental schedule';
wb.title = 'iPawcus summarized Gantt 2026';
wb.description = 'Suggested dates; green development and other activities; yellow testing. Phase 1 retains source dates.';
wb.created = new Date('2026-10-25T08:00:00Z');
wb.modified = wb.created;
wb.calcProperties.fullCalcOnLoad = true;
wb.calcProperties.forceFullCalc = true;
wb.calcProperties.calcMode = 'auto';
const main = wb.addWorksheet('Summary Gantt');
const detail = wb.addWorksheet('Increment Gantt');
const schedule = wb.addWorksheet('Edit Schedule');
const placement = wb.addWorksheet('Feature Placement');
const guide = wb.addWorksheet('Guide');
for (const s of wb.worksheets) {
    s.properties.defaultRowHeight = 19;
    s.views = [{ showGridLines: false }];
    s.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } };
    s.headerFooter.oddFooter = '&LiPawcus | Suggested schedule&RP&P of &N';
}

function mergedText(s, r, start, end, value, options = {}) {
    s.mergeCells(r, start, r, end);
    const c = s.getCell(r, start);
    c.value = value;
    c.font = font(options.size ?? 10, options.bold ?? false, options.color ?? C.ink);
    c.fill = fill(options.fill ?? C.white);
    c.alignment = { vertical: 'middle', horizontal: options.align ?? 'left', wrapText: true, indent: options.indent ?? 1 };
    if (options.height) s.getRow(r).height = options.height;
    return c;
}

function title(s, end, name, subtitle) {
    mergedText(s, 1, 2, end, name, { size: 21, bold: true, fill: C.dark, color: C.white, height: 35 });
    mergedText(s, 2, 2, end, subtitle, { size: 10, fill: C.dark, color: C.white, height: 24 });
    mergedText(s, 3, 2, end, 'GREEN  Design, coding and other activities     |     YELLOW  Testing     |     Dates are suggested calendar-day allocations', { size: 9, height: 22 });
}

const scheduleHeaders = ['ID', 'Phase', 'Increment / group', 'Stage', 'Activity', 'Start', 'Finish', 'Deliverable / scope', 'Sequence / handoff'];
const scheduleWidths = [14, 13, 35, 21, 43, 15, 15, 102, 64];
schedule.columns = scheduleWidths.map(width => ({ width }));
mergedText(schedule, 1, 1, 9, 'iPawcus | Editable schedule', { size: 20, bold: true, fill: C.dark, color: C.white, height: 33 });
mergedText(schedule, 2, 1, 9, 'Edit the blue Start and Finish cells here, or type a range directly into Date column C on Summary Gantt. Coloring reads the displayed Date range.', { size: 11, height: 25 });
mergedText(schedule, 3, 1, 9, 'Phase 1 dates come from the supplied workbook. Phase 2 is a suggested overlapping allocation. Requirements adjustments are included in Design.', { size: 10, height: 24 });
schedule.getRow(5).values = scheduleHeaders;
const tasks = [];
const taskById = new Map();
const mainRowsById = new Map();

function addTask(id, phase, group, stage, name, start, end, scope, handoff = '') {
    const row = 6 + tasks.length;
    const t = { id, phase, group, stage, name, start: start ? date(start) : null, end: end ? date(end) : null, scope, handoff, row };
    tasks.push(t);
    taskById.set(id, t);
    const r = schedule.getRow(row);
    r.values = [id, phase, group, stage, name, t.start, t.end, scope, handoff];
    r.height = phase === 'Phase 1' ? 40 : 59;
    for (let col = 1; col <= 9; col++) {
        const c = r.getCell(col);
        c.font = font(col >= 8 ? 10 : 10.5);
        c.alignment = { vertical: 'middle', wrapText: true };
        c.border = { bottom: hair(C.grid) };
    }
    r.getCell(4).fill = fill(stage === 'Testing' ? C.yellow : C.section);
    for (const col of [6, 7]) {
        const c = r.getCell(col);
        c.font = font(11, false, C.blue);
        c.fill = fill(C.blueFill);
        c.numFmt = 'dd mmm yyyy';
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.dataValidation = { type: 'date', operator: 'between', allowBlank: true,
            formulae: [date('2026-01-01'), date('2026-12-31')], showErrorMessage: true,
            errorTitle: 'Enter a date', error: 'Enter an Excel date in 2026, or leave the cell blank.' };
    }
    return t;
}

const source1 = new ExcelJS.Workbook();
await source1.xlsx.readFile(PHASE1);
const source1Sheet = source1.getWorksheet('Gantt');
function sourceDate(value) {
    if (value instanceof Date) return iso(value);
    const m = String(value).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    assert(m, `Unrecognized Phase 1 date: ${value}`);
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[2]) + 1;
    return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
for (let i = 5; i <= 14; i++) {
    const r = source1Sheet.getRow(i);
    addTask(`P1-${i - 4}`, 'Phase 1', 'Research and proposal', 'Preparation', r.getCell(1).text.trim(),
        sourceDate(r.getCell(2).value), sourceDate(r.getCell(3).value), r.getCell(1).text.trim(), `Supplied Phase 1 workbook, Gantt row ${i}.`);
}
for (const inc of increments) {
    for (const [index, [stage, start, end, scope]] of inc.stages.entries()) {
        const id = `I${inc.number}-${['D', 'C', 'T'][index]}`;
        const handoff = stage === 'Design'
            ? inc.number === 1 ? 'Development starts April 20. Requirements and design are combined.' : `Runs during Increment ${inc.number - 1} testing; prepares the next accepted module.`
            : stage === 'Coding' ? inc.number === 1 ? 'Begins after this increment design.' : `Begins after this design and Increment ${inc.number - 1} testing finish.`
                : 'Begins after this increment coding; includes functional checks, fixes and feedback.';
        addTask(id, 'Phase 2', `Increment ${inc.number} - ${inc.name}`, stage, `${stage} - ${inc.name}`, start, end, scope, handoff);
    }
}
addTask('FINAL-T', 'Phase 2', 'Final testing', 'Testing', 'Final system and integration testing', '2026-09-13', '2026-09-19', 'Integrated clinical workflows; regression and access checks; representative-data totals; responsive layouts; backup recovery; build/API/database and production readiness.', 'After all six increment tests finish.');
addTask('EVAL', 'Phase 2', 'Data gathering', 'Evaluation', 'Data gathering and system evaluation', '2026-09-21', '2026-09-26', 'Clinic/end-user and evaluator feedback; evaluation instruments, results and supporting evidence.', 'After final system testing.');
addTask('DOC', 'Phase 2', 'Documentation', 'Documentation', 'Documentation finalization', '2026-09-29', '2026-09-30', 'Finalize manuscript, evaluation results, appendices, user/deployment materials and defense evidence.', 'Finalizes earlier documentation after evaluation.');
addTask('DEF', 'Phase 2', 'Defense', 'Milestone', 'Final defense', '2026-10-03', '2026-10-03', 'Final defense presentation and system demonstration.', 'After documentation finalization.');
addTask('SYS-REV', 'Phase 2', 'System revision', 'Revision', 'System revision', '2026-10-05', '2026-10-21', 'System changes following defense feedback.', 'User-supplied post-defense revision dates.');
addTask('PAPER-REV', 'Phase 2', 'Paper revision', 'Revision', 'Paper revision', '2026-10-06', '2026-10-30', 'Manuscript changes following panel feedback.', 'User-supplied post-defense revision dates.');
schedule.autoFilter = `A5:I${5 + tasks.length}`;
schedule.views = [{ state: 'frozen', xSplit: 5, ySplit: 5, showGridLines: false }];
schedule.pageSetup.printTitlesRow = '1:5';
schedule.pageSetup.printArea = `A1:I${5 + tasks.length}`;

function tableHeader(s, row, count) {
    for (let col = 1; col <= count; col++) {
        const c = s.getCell(row, col);
        c.font = font(10, true, C.white);
        c.fill = fill(C.dark);
        c.alignment = { vertical: 'middle', wrapText: true };
    }
    s.getRow(row).height = 28;
}
tableHeader(schedule, 5, 9);

const stageSummaries = {
    1: {
        Design: 'Access flow, page prototypes, account/OTP schema, Google linking and recovery design.',
        Coding: 'Landing page, registration/login, OTP recovery, sessions, Google access and health checks.',
        Testing: 'Verify access, OTP expiry/retry, recovery, Google linking, inactive accounts and outages.',
    },
    2: {
        Design: 'Profile forms, roles, branch permissions, schedules, preferences and activity-history design.',
        Coding: 'Profiles, account controls, role/branch restrictions, availability, activity history and theme.',
        Testing: 'Verify profile saves, permissions, schedules, protected accounts, activity privacy and refresh.',
    },
    3: {
        Design: 'Pet/owner links, EMR data, clinical forms, extra consent and correction-request workflow.',
        Coding: 'Pet profiles, EMR, prescriptions, vaccination, attachments, consent and record updates.',
        Testing: 'Verify linking, records, optional vaccination, consent, print/email and correction requests.',
    },
    4: {
        Design: 'Booking/calendar flow, vet presence, consultation access, consent and payment-proof design.',
        Coding: 'Bookings, Jitsi, home service, consent, payment verification, saved intent and task calendar.',
        Testing: 'Verify conflicts, schedules, presence/lunch rules, consultation access, consent and payments.',
    },
    5: {
        Design: 'Queue/TV, grooming, boarding, catalog/POS, pricing and inventory movement design.',
        Coding: 'Queue/TV, grooming, boarding, billing, service pricing, stock movement and transfers.',
        Testing: 'Verify service lifecycles, room conflicts, invoices, payments, stock and operational alerts.',
    },
    6: {
        Design: 'Report/KPI layouts, filters, exports, protected media and backup/recovery design.',
        Coding: 'Reports, comparisons, PDF/Excel exports, media access, backups and emergency workbook.',
        Testing: 'Verify report totals/filters, export files, media permissions, backup contents and recovery.',
    },
};

const sections = [
    { section: 'PHASE 1 | RESEARCH, PLANNING AND PROPOSAL' },
    { id: 'P1-A', label: 'Interviews and concept development', ids: ['P1-1', 'P1-2', 'P1-3'], deliverable: 'Initial interviews, clinic requirements and concept development.' },
    { id: 'P1-B', label: 'Clinic collaboration', ids: ['P1-4'], deliverable: 'Clinic coordination and validation of the proposed system.' },
    { id: 'P1-C', label: 'Title defense', ids: ['P1-5'], deliverable: 'Title defense and initial panel feedback.' },
    { id: 'P1-D', label: 'Chapter 1 and adviser review', ids: ['P1-6', 'P1-7'], deliverable: 'Chapter 1 revisions and adviser consultation.' },
    { id: 'P1-E', label: 'Chapters 2 and 3 revision', ids: ['P1-8', 'P1-9'], deliverable: 'Literature, methodology and design documentation.' },
    { id: 'P1-F', label: 'Title proposal', ids: ['P1-10'], deliverable: 'Title-proposal preparation and submission.' },
    { section: 'PHASE 2 | OVERLAPPING INCREMENTAL DEVELOPMENT AND EVALUATION' },
    ...increments.flatMap(i => [
        { section: `INCREMENT ${i.number} | ${i.name.toUpperCase()}` },
        ...i.stages.map(([stage], index) => {
            const id = `I${i.number}-${['D', 'C', 'T'][index]}`;
            return { id, label: stage, ids: [id], deliverable: stageSummaries[i.number][stage] };
        }),
    ]),
    ...['FINAL-T', 'EVAL', 'DOC', 'DEF', 'SYS-REV', 'PAPER-REV'].map(id => {
        const t = taskById.get(id);
        return { id, label: t.group === 'Data gathering' ? 'Data gathering / evaluation' : t.name, ids: [id], deliverable: {
            'FINAL-T': 'Integrated workflow, regression, access and release-readiness checks.',
            EVAL: 'Clinic/user and evaluator feedback with supporting results.',
            DOC: 'Manuscript, appendices and defense evidence finalized.',
            DEF: 'Final defense and system demonstration.',
            'SYS-REV': 'System changes following defense feedback.',
            'PAPER-REV': 'Manuscript changes following panel feedback.',
        }[id] };
    }),
];

function groupSpan(ids) {
    const a = ids.map(id => taskById.get(id)).filter(t => t.start && t.end);
    return a.length ? { start: new Date(Math.min(...a.map(t => t.start))), end: new Date(Math.max(...a.map(t => t.end))) } : null;
}
function dateLabel(ids) {
    const span = groupSpan(ids);
    return span ? `${short(span.start)} - ${short(span.end)}` : '';
}
function dateFormula(ids) {
    const starts = ids.map(id => `'Edit Schedule'!F${taskById.get(id).row}`).join(',');
    const ends = ids.map(id => `'Edit Schedule'!G${taskById.get(id).row}`).join(',');
    return `IF(COUNT(${starts})=0,"",TEXT(MIN(${starts}),"d mmm")&" - "&TEXT(MAX(${ends}),"d mmm"))`;
}
function parsedDateFormula(row, end = false) {
    const text = `TRIM(SUBSTITUTE(SUBSTITUTE($C${row},"–","-"),"—","-"))`;
    const split = end ? `MID(${text},FIND("-",${text})+1,99)` : `LEFT(${text},FIND("-",${text})-1)`;
    const part = `TRIM(IFERROR(${split},${text}))`;
    return `IF($C${row}="","",IF(ISNUMBER($C${row}),INT($C${row}),IFERROR(DATEVALUE(${part}&" 2026"),IFERROR(DATEVALUE(${part}),""))))`;
}
function activeFormula(row, dateRef, ctx) {
    const a = `$${ctx.startLetter}${row}`;
    const b = `$${ctx.endLetter}${row}`;
    return `AND(ISNUMBER(${a}),ISNUMBER(${b}),${dateRef}>=${a},${dateRef}<=${b})`;
}
function valueOn(ids, d) {
    const active = ids.map(id => taskById.get(id)).filter(t => t.start && d >= t.start && d <= t.end);
    return active.some(t => t.stage === 'Testing') ? 2 : active.length ? 1 : 0;
}
function barFormula(ids, row, dateRef, ctx) {
    const activityType = ids.some(id => taskById.get(id).stage === 'Testing') ? 2 : 1;
    return `IF(${activeFormula(row, dateRef, ctx)},${activityType},0)`;
}

function ganttHeader(s, start, end, name, subtitle, dayWidth, deliverableWidth) {
    const axis = Array.from({ length: days(start, end) }, (_, i) => add(start, i));
    const first = 4;
    const last = first + axis.length - 1;
    const delivery = last + 1;
    s.getColumn(1).hidden = true;
    s.getColumn(2).width = 33;
    s.getColumn(3).width = 23;
    s.getColumn(delivery).width = deliverableWidth;
    for (let col = first; col <= last; col++) s.getColumn(col).width = dayWidth;
    title(s, delivery, name, subtitle);
    s.getCell(3, 2).value = s === main
        ? 'EDIT DATE COLUMN C OR EDIT SCHEDULE  |  Example: 5 Oct - 21 Oct  |  Green: design/coding and other work  |  Yellow: testing'
        : 'LINKED VIEW  |  Date column C follows Summary Gantt  |  Green: design/coding and other work  |  Yellow: testing';
    for (const [col, text] of [[2, 'Task'], [3, 'Date'], [delivery, 'DELIVERABLES']]) {
        s.mergeCells(4, col, 6, col);
        const c = s.getCell(4, col);
        c.value = text;
        c.fill = fill('E5E8E6'); c.font = font(11, true);
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.border = { top: hair(C.muted), bottom: hair(C.muted), left: hair(C.muted), right: hair(C.muted) };
    }
    mergedText(s, 4, first, last, '2026', { bold: true, align: 'center', fill: 'E5E8E6', height: 21, size: 12, indent: 0 });
    let i = 0;
    while (i < axis.length) {
        let j = i;
        while (j + 1 < axis.length && axis[j + 1].getUTCMonth() === axis[i].getUTCMonth()) j++;
        const partial = axis[i].getUTCDate() > 1 || axis[j].getUTCDate() < 28;
        const month = axis[i].toLocaleString('en-US', { month: partial ? 'short' : 'long', timeZone: 'UTC' }).toUpperCase();
        const c = mergedText(s, 5, first + i, first + j, month, { bold: true, align: 'center', fill: 'E5E8E6', height: 22, size: 10, indent: 0 });
        c.border = { left: hair(C.muted), right: hair(C.muted), bottom: hair(C.grid) };
        let k = i;
        while (k <= j) {
            let l = k;
            const week = Math.min(3, Math.floor((axis[k].getUTCDate() - 1) / 7));
            while (l + 1 <= j && Math.min(3, Math.floor((axis[l + 1].getUTCDate() - 1) / 7)) === week) l++;
            const h = mergedText(s, 6, first + k, first + l, `W${week + 1}`, { align: 'center', fill: C.pale, height: 20, size: 9, indent: 0 });
            h.border = { left: hair(C.grid), right: hair(C.grid), bottom: hair(C.muted) };
            k = l + 1;
        }
        i = j + 1;
    }
    s.getRow(7).hidden = true;
    for (let n = 0; n < axis.length; n++) {
        const c = s.getCell(7, first + n);
        c.value = axis[n]; c.numFmt = 'd mmm yyyy';
    }
    s.views = [{ state: 'frozen', xSplit: 3, ySplit: 7, showGridLines: false, zoomScale: s === main ? 75 : 80 }];
    s.pageSetup.printTitlesRow = '1:7';
    const startCol = delivery + 1;
    const endCol = delivery + 2;
    s.getColumn(startCol).hidden = true;
    s.getColumn(endCol).hidden = true;
    return { axis, first, last, delivery, startCol, endCol, startLetter: s.getColumn(startCol).letter, endLetter: s.getColumn(endCol).letter, rows: [] };
}

function addGanttRow(s, ctx, row, item, { height = 35 } = {}) {
    if (item.section) {
        mergedText(s, row, 2, ctx.delivery, item.section, { size: 10.5, bold: true, fill: C.section, height: 25 });
        ctx.rows.push({ row, section: item.section });
        return;
    }
    s.getRow(row).height = height;
    s.getCell(row, 1).value = item.id;
    const label = s.getCell(row, 2);
    label.value = item.label; label.font = font(10.5, true);
    label.fill = fill(C.pale);
    label.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    const span = groupSpan(item.ids);
    const isMain = s === main;
    if (isMain) mainRowsById.set(item.id, row);
    const mainRow = mainRowsById.get(item.id);
    const dc = s.getCell(row, 3);
    dc.value = { formula: isMain ? dateFormula(item.ids) : `'Summary Gantt'!C${mainRow}`, result: dateLabel(item.ids) };
    dc.numFmt = 'General';
    dc.font = font(11, false, isMain ? C.blue : C.ink);
    dc.fill = fill(isMain ? C.blueFill : C.pale);
    dc.alignment = { vertical: 'middle', horizontal: 'center' };
    if (isMain) {
        dc.note = 'Coloring reads this range directly. You may type 5 Oct - 21 Oct here, or retain this formula and edit the source dates on Edit Schedule.';
    }
    s.getCell(row, ctx.startCol).value = { formula: parsedDateFormula(row), result: span ? serial(span.start) : '' };
    s.getCell(row, ctx.endCol).value = { formula: parsedDateFormula(row, true), result: span ? serial(span.end) : '' };
    const out = s.getCell(row, ctx.delivery);
    out.value = item.deliverable; out.font = font(s === main ? 10 : 10.5);
    out.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    for (const col of [2, 3, ctx.delivery]) s.getCell(row, col).border = { bottom: hair(C.grid), right: hair(C.grid) };
    for (let n = 0; n < ctx.axis.length; n++) {
        const col = ctx.first + n;
        const c = s.getCell(row, col);
        const boundary = n === 0 || [1, 8, 15, 22].includes(ctx.axis[n].getUTCDate());
        const activityType = valueOn(item.ids, ctx.axis[n]);
        c.value = { formula: barFormula(item.ids, row, `${s.getColumn(col).letter}$7`, ctx), result: activityType };
        c.numFmt = ';;;';
        c.fill = fill(activityType === 2 ? C.yellow : activityType === 1 ? C.green : C.white);
        c.border = { bottom: hair(C.grid), ...(boundary ? { left: hair(C.grid) } : {}) };
    }
    const ref = `${s.getColumn(ctx.first).letter}${row}:${s.getColumn(ctx.last).letter}${row}`;
    const active = activeFormula(row, `${s.getColumn(ctx.first).letter}$7`, ctx);
    const activeColor = item.ids.some(id => taskById.get(id).stage === 'Testing') ? C.yellow : C.green;
    s.addConditionalFormatting({ ref, rules: [
        { type: 'expression', formulae: [active], style: { fill: ruleFill(activeColor) }, priority: row * 2, stopIfTrue: true },
        { type: 'expression', formulae: [`NOT(${active})`], style: { fill: ruleFill(C.white) }, priority: row * 2 + 1, stopIfTrue: true },
    ] });
    ctx.rows.push({ row, id: item.id, label: item.label, ids: item.ids, date: dateLabel(item.ids), deliverable: item.deliverable, cells: ctx.axis.map(d => valueOn(item.ids, d)) });
}

const mainCtx = ganttHeader(main, date('2026-01-01'), date('2026-12-31'), 'iPawcus | Summarized Project Gantt', 'Phase 1 and Phase 2 | Suggested schedule | Design overlaps the previous increment testing; coding follows its completion', 0.30, 58);
let mainRow = 8;
for (const section of sections) addGanttRow(main, mainCtx, mainRow++, section, { height: 30 });
mergedText(main, mainRow++, 2, mainCtx.delivery, 'Development: 20 Apr-12 Sep  |  Final testing: 13-19 Sep  |  Evaluation: 21-26 Sep  |  Documentation: 29-30 Sep  |  Defense: 3 Oct', { size: 9.5, height: 24 });
mergedText(main, mainRow++, 2, mainCtx.delivery, 'Bars read the displayed range in Date column C. Type a range such as 5 Oct - 21 Oct, or keep the formula and change Start/Finish on Edit Schedule.', { size: 9, height: 24, color: C.muted });
main.pageSetup.printArea = `B1:${main.getColumn(mainCtx.delivery).letter}${mainRow - 1}`;
main.pageSetup.fitToHeight = 2;


const detailCtx = ganttHeader(detail, date('2026-04-01'), date('2026-12-31'), 'iPawcus | Increment Design, Coding and Testing', 'Suggested Phase 2 allocation | One calendar month per increment | Next Design overlaps previous Testing; next Coding starts afterward', 0.49, 108);
let detailRow = 8;
for (const inc of increments) {
    const ids = [`I${inc.number}-D`, `I${inc.number}-C`, `I${inc.number}-T`];
    addGanttRow(detail, detailCtx, detailRow++, { section: `INCREMENT ${inc.number} | ${inc.name.toUpperCase()}` });
    for (const id of ids) {
        const t = taskById.get(id);
        addGanttRow(detail, detailCtx, detailRow++, { id, label: t.stage === 'Design' ? 'Design + requirements adjustment' : t.stage, ids: [id], deliverable: t.scope }, { height: 52 });
    }
}
addGanttRow(detail, detailCtx, detailRow++, { section: 'INTEGRATION, EVALUATION AND DEFENSE' });
for (const id of ['FINAL-T', 'EVAL', 'DOC', 'DEF', 'SYS-REV', 'PAPER-REV']) {
    const t = taskById.get(id);
    addGanttRow(detail, detailCtx, detailRow++, { id, label: t.name, ids: [id], deliverable: t.scope }, { height: 48 });
}
detail.pageSetup.printArea = `B1:${detail.getColumn(detailCtx.delivery).letter}${detailRow - 1}`;
detail.pageSetup.fitToHeight = 2;

placement.columns = [43, 31, 43, 37, 108, 21].map(width => ({ width }));
mergedText(placement, 1, 1, 6, 'iPawcus | Feature placement in the methodology', { size: 20, bold: true, fill: C.dark, color: C.white, height: 33 });
mergedText(placement, 2, 1, 6, 'Comparison: supplied Software Methodology.txt against 395 named tasks in iPawcus_Revised_Gantt.xlsx. This is a documentation-coverage review, not a new implementation audit.', { size: 10.5, height: 29 });
mergedText(placement, 3, 1, 6, 'Not explicitly named means absent as a named feature in the supplied increment text. Broadly covered items need a short clarification rather than a new increment.', { size: 10.5, height: 28 });
placement.getRow(5).values = ['Feature / task group', 'Current methodology coverage', 'Suggested placement', 'Add to these stages', 'Suggested addition to the existing description', 'Source task row(s)'];
tableHeader(placement, 5, 6);
for (let i = 0; i < featurePlacement.length; i++) {
    const r = placement.getRow(i + 6); r.values = featurePlacement[i]; r.height = 64;
    for (let c = 1; c <= 6; c++) {
        r.getCell(c).font = font(10.5, c === 1);
        r.getCell(c).alignment = { vertical: 'middle', wrapText: true };
        r.getCell(c).border = { bottom: hair(C.grid) };
    }
}
placement.autoFilter = `A5:F${5 + featurePlacement.length}`;
placement.views = [{ state: 'frozen', xSplit: 1, ySplit: 5, showGridLines: false, zoomScale: 80 }];
placement.pageSetup.printTitlesRow = '1:5';
placement.pageSetup.printArea = `A1:F${5 + featurePlacement.length}`;

guide.columns = [42, 105, 22, 22, 22].map(width => ({ width }));
mergedText(guide, 1, 1, 5, 'iPawcus | Schedule guide', { size: 20, bold: true, fill: C.dark, color: C.white, height: 34 });
const notes = [
    ['Purpose', 'A suggested paper-facing planning schedule. Phase 1 retains supplied dates; Phase 2 dates are newly allocated for the agreed timeline rather than presented as verified historical completion dates.'],
    ['Development window', 'April 20-September 12, 2026: 146 calendar days, including both dates. Each of the six increments spans one calendar month.'],
    ['Overlap rule', 'The next increment Design runs during the preceding increment Testing. Its Coding begins after its own Design and the previous Testing finish. The first overlap is 9 days; the remaining four overlaps are 7 days each.'],
    ['Design', 'Requirements adjustment, interface/workflow design and data-structure preparation share one Design block.'],
    ['Coding and refinement', 'Feature development and associated refinements are consolidated into the relevant module allocation. The shortened blocks are planning assumptions, not a conversion of recorded task-days into measured effort.'],
    ['Testing', 'Yellow blocks include functional checks, fixes/rechecks and feedback. Final testing on September 13-19 covers connected workflows and release readiness.'],
    ['Data gathering', 'September 21-26: clinic/user and evaluator feedback and supporting results.'],
    ['Documentation', 'September 29-30 means finalization. Earlier research and documentation preparation are retained in Phase 1 and module Design.'],
    ['Defense and revisions', 'Defense is October 3, 2026. System Revision is October 5-21 and Paper Revision is October 6-30, as supplied by the user.'],
    ['Color key', 'Green = Design, Coding and other scheduled activities. Yellow = Testing. Colors indicate activity type, not verified completion status.'],
    ['Monthly week headings', 'Every month shows W1, W2, W3 and W4. W1 = days 1-7; W2 = days 8-14; W3 = days 15-21; W4 = day 22 through month-end. Bars retain exact daily dates, including the longer W4. Blank cells before April 20 or after the scheduled work do not add activities.'],
    ['Editing', 'Bars read the displayed Date range in column C. Type 5 Oct - 21 Oct directly, or keep the Date formula and edit Start/Finish on Edit Schedule. Typing over a Date formula makes that row a manual override; future source edits apply only while its source formula is retained. Increment Gantt follows the Date ranges on Summary Gantt. The calendar extends through December.'],
    ['Feature review', 'Feature Placement lists missing named items and understated details in the supplied methodology, with the relevant increment/stage and original workbook row references. Existing broadly covered features are identified as such.'],
    ['Scope', 'The six module groups follow the supplied methodology: grooming/boarding and inventory are grouped with clinic operations in Increment 5; backup is included in Increment 6.'],
];
guide.getRow(3).values = ['Item', 'Explanation']; tableHeader(guide, 3, 2);
for (let i = 0; i < notes.length; i++) {
    const r = guide.getRow(i + 4); r.values = notes[i]; r.height = 47;
    for (const c of [1, 2]) { r.getCell(c).font = font(11, c === 1); r.getCell(c).alignment = { vertical: 'middle', wrapText: true }; r.getCell(c).border = { bottom: hair(C.grid) }; }
}
let gr = notes.length + 6;
guide.getRow(gr).values = ['Increment', 'Design', 'Coding', 'Testing', 'Allocation']; tableHeader(guide, gr++, 5);
for (const inc of increments) {
    guide.getRow(gr).values = [`Increment ${inc.number}`, ...inc.stages.map(([, a, b]) => `${short(date(a))}-${short(date(b))}`), 'One calendar month'];
    guide.getRow(gr++).height = 25;
}
gr += 2;
const elapsedRows = [
    ['Development through increment 6 testing', '2026-09-12'],
    ['Development through final testing', '2026-09-19'],
    ['Development through documentation', '2026-09-30'],
    ['Development through defense', '2026-10-03'],
];
guide.getRow(gr).values = ['Elapsed calendar time from April 20', 'Inclusive day count']; tableHeader(guide, gr++, 2);
for (const [label, finish] of elapsedRows) { guide.getRow(gr++).values = [label, `${days(date('2026-04-20'), date(finish))} days`]; }
gr += 2;
for (const [label, p] of [['Phase 1 source', PHASE1], ['Latest task inventory', LATEST], ['Methodology/increment source', METHOD]]) {
    guide.getRow(gr).values = [label, p]; guide.getRow(gr).height = 33;
    guide.getCell(gr, 2).alignment = { wrapText: true, vertical: 'middle' }; gr++;
}
guide.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
guide.pageSetup.printArea = `A1:E${gr}`;

// Validate dates, month lengths, handoffs, preserved source records and cached bars.
assert.equal(tasks.filter(t => t.phase === 'Phase 1').length, 10);
assert.equal(tasks.filter(t => t.phase === 'Phase 2').length, 24);
for (const inc of increments) {
    const d = taskById.get(`I${inc.number}-D`), c = taskById.get(`I${inc.number}-C`), t = taskById.get(`I${inc.number}-T`);
    assert.equal(iso(add(d.end, 1)), iso(c.start));
    assert.equal(iso(add(c.end, 1)), iso(t.start));
    const monthEnd = new Date(d.start);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    assert.equal(iso(add(monthEnd, -1)), iso(t.end), `Increment ${inc.number} must span one calendar month`);
    if (inc.number > 1) {
        const previous = taskById.get(`I${inc.number - 1}-T`);
        assert.equal(iso(d.start), iso(previous.start));
        assert.equal(iso(d.end), iso(previous.end));
        assert.equal(iso(c.start), iso(add(previous.end, 1)));
    }
    assert(t.end <= date('2026-09-12'));
}
assert.equal(iso(taskById.get('I1-D').start), '2026-04-20');
assert.equal(iso(taskById.get('I6-T').end), '2026-09-12');
assert.equal(iso(taskById.get('FINAL-T').start), '2026-09-13');
assert.equal(iso(taskById.get('FINAL-T').end), '2026-09-19');
assert.equal(iso(taskById.get('EVAL').start), '2026-09-21');
assert.equal(iso(taskById.get('EVAL').end), '2026-09-26');
assert.equal(iso(taskById.get('DOC').start), '2026-09-29');
assert.equal(iso(taskById.get('DOC').end), '2026-09-30');
assert.equal(iso(taskById.get('DEF').start), '2026-10-03');
assert.equal(iso(taskById.get('SYS-REV').start), '2026-10-05');
assert.equal(iso(taskById.get('SYS-REV').end), '2026-10-21');
assert.equal(iso(taskById.get('PAPER-REV').start), '2026-10-06');
assert.equal(iso(taskById.get('PAPER-REV').end), '2026-10-30');
for (const t of tasks) if (t.start) assert(t.start <= t.end);
assert.equal(days(date('2026-04-20'), date('2026-09-12')), 146);
const raw1 = source1Sheet;
for (let n = 1; n <= 10; n++) {
    const t = taskById.get(`P1-${n}`);
    assert.equal(iso(t.start), sourceDate(raw1.getCell(n + 4, 2).value));
    assert.equal(iso(t.end), sourceDate(raw1.getCell(n + 4, 3).value));
}
for (const ctx of [mainCtx, detailCtx]) for (const r of ctx.rows.filter(r => r.ids)) {
    for (let i = 0; i < ctx.axis.length; i++) assert.equal(r.cells[i], valueOn(r.ids, ctx.axis[i]));
}
for (const [s, ctx] of [[main, mainCtx], [detail, detailCtx]]) {
    const weekLabels = [];
    for (let col = ctx.first; col <= ctx.last; col++) {
        const cell = s.getCell(6, col);
        if (!cell.isMerged || cell.master.address === cell.address) weekLabels.push(cell.text);
    }
    assert.deepEqual(weekLabels, Array.from({ length: s === main ? 12 : 9 }, () => ['W1', 'W2', 'W3', 'W4']).flat());
    assert.equal(iso(ctx.axis.at(-1)), '2026-12-31');
}

await wb.xlsx.writeFile(OUTPUT);
// ExcelJS only emits fullCalcOnLoad; explicitly persist automatic recalculation.
const zipped = await JSZip.loadAsync(await fs.readFile(OUTPUT));
const workbookXml = await zipped.file('xl/workbook.xml').async('string');
zipped.file('xl/workbook.xml', workbookXml.replace(/<calcPr\b[^>]*\/>/, '<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'));
await fs.writeFile(OUTPUT, await zipped.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
const check = new ExcelJS.Workbook(); await check.xlsx.readFile(OUTPUT);
assert.deepEqual(check.worksheets.map(s => s.name), ['Summary Gantt', 'Increment Gantt', 'Edit Schedule', 'Feature Placement', 'Guide']);
assert.equal(check.getWorksheet('Summary Gantt').getCell(mainRowsById.get('I6-T'), 3).value.result, '6 Sep - 12 Sep');
assert.equal(check.getWorksheet('Summary Gantt').getCell(mainRowsById.get('SYS-REV'), 3).value.result, '5 Oct - 21 Oct');
assert.equal(check.getWorksheet('Summary Gantt').getCell(mainRowsById.get('PAPER-REV'), 3).value.result, '6 Oct - 30 Oct');
for (const [s, ctx] of [[check.getWorksheet('Summary Gantt'), mainCtx], [check.getWorksheet('Increment Gantt'), detailCtx]]) {
    assert.equal(s.conditionalFormattings.length, ctx.rows.filter(r => r.ids).length);
    for (const r of ctx.rows.filter(r => r.ids)) {
        const span = groupSpan(r.ids);
        assert.equal(s.getCell(r.row, 3).value.result, dateLabel(r.ids));
        for (const [col, expected] of [[ctx.startCol, span.start], [ctx.endCol, span.end]]) {
            const cell = s.getCell(r.row, col);
            assert(cell.value.formula.includes(`$C${r.row}`));
            assert.equal(cell.value.result instanceof Date ? serial(cell.value.result) : cell.value.result, serial(expected));
        }
        for (let i = 0; i < ctx.axis.length; i++) {
            const cell = s.getCell(r.row, ctx.first + i);
            const v = cell.value;
            assert.equal(typeof v.formula, 'string');
            assert.equal(v.result ?? 0, r.cells[i]);
            const expected = r.cells[i] === 2 ? C.yellow : r.cells[i] === 1 ? C.green : C.white;
            assert.equal(cell.fill.fgColor.argb, `FF${expected}`, `Saved color mismatch: ${s.name}!${cell.address}`);
        }
    }
}
for (const inc of increments) for (const suffix of ['D', 'C', 'T']) {
    const id = `I${inc.number}-${suffix}`;
    assert(mainCtx.rows.some(r => r.id === id), `Main Gantt is missing stage ${id}`);
}
const savedZip = await JSZip.loadAsync(await fs.readFile(OUTPUT));
assert((await savedZip.file('xl/workbook.xml').async('string')).includes('calcMode="auto"'));
for (const [p, before] of Object.entries(sourceHashes)) assert.equal(await sourceHash(p), before, `Source modified: ${p}`);

const plan = { title: 'iPawcus | Summarized Project Gantt', colors: C,
    axis: mainCtx.axis.map(iso), summaryRows: mainCtx.rows, increments,
    tasks: tasks.map(t => ({ ...t, start: t.start ? iso(t.start) : null, end: t.end ? iso(t.end) : null })), sourceHashes,
    totals: { development: 146, throughFinalTesting: 153, throughDocumentation: 164, throughDefense: 167 } };
await fs.writeFile(path.join(OUT, 'suggested-plan.json'), JSON.stringify(plan, null, 2));
const md = [
    '# Methodology feature placement', '',
    'Scope: the supplied `Software Methodology.txt` compared with the 395 named tasks in `iPawcus_Revised_Gantt.xlsx`. This identifies wording coverage in the provided increment section; it does not claim the features are absent from every chapter of the paper or verify current implementation.', '',
    'Broadly covered items need a short clarification. They do not require additional increments. Timeline discrepancies are not included in the Gantt views.', '',
    '| Feature / task group | Coverage in supplied methodology | Placement | Stages | Suggested addition | Workbook task rows |',
    '|---|---|---|---|---|---|',
    ...featurePlacement.map(a => `| ${a.join(' | ')} |`), '',
    'Already explicitly covered: OTP and recovery; branch/feature access; veterinarian schedules; co-parent approval; grouped medical records and protected attachments; prescriptions/laboratory records; record-update requests; Jitsi; consent and payment proof; queue network checks; grooming/boarding; POS and inventory transfers; report exports; media monitoring; consistency reporting; backup creation.', '',
    'The new Gantt stage descriptions incorporate these additional task groups within the existing six increments. Detailed implementation tasks such as individual schema fields, housekeeping, and cosmetic cleanup do not need separate paper-level increments.',
];
await fs.writeFile(path.join(OUT, 'methodology-feature-placement.md'), md.join('\n'));
await fs.writeFile(path.join(OUT, 'validation.json'), JSON.stringify({ passed: true, sourceTasks: 395, preservedPhase1Records: 10, scheduledPhase2Rows: 24, featurePlacementGroups: featurePlacement.length, workbookSheets: check.worksheets.map(s => s.name), monthlyIncrementSpans: increments.map(i => ({ increment: i.number, start: i.stages[0][1], end: i.stages[2][2], days: days(date(i.stages[0][1]), date(i.stages[2][2])) })), totals: plan.totals, originalsUnchanged: true }, null, 2));
console.log(JSON.stringify({ file: OUTPUT, bytes: (await fs.stat(OUTPUT)).size, sheets: check.worksheets.map(s => s.name), increments: plan.increments.map(i => ({ increment: i.number, stages: i.stages.map(([stage, start, end]) => ({ stage, start, end, days: days(date(start), date(end)) })) })), validation: 'passed' }, null, 2));
