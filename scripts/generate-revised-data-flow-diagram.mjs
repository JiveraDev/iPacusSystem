import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildCorrectedDfdPages,
    buildProfessionalDfdPages,
} from './dfd-corrected-model.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const professionalMode = process.argv.includes('--professional');
const outputPath = path.join(
    repositoryRoot,
    professionalMode
        ? 'ipawcus-data-flow-diagram-professional.drawio'
        : 'ipawcus-data-flow-diagram-corrected.drawio',
);
const figJamDirectory = path.join(repositoryRoot, 'docs', 'figjam');
const figJamContextPath = path.join(figJamDirectory, 'IPAWCUS-Context-Diagram-FigJam.svg');
const figJamLevelOnePath = path.join(figJamDirectory, 'IPAWCUS-Level-1-DFD-FigJam.svg');
const figJamBoardPath = path.join(figJamDirectory, 'IPAWCUS-Data-Flow-FigJam-Board.svg');

const node = (id, label, type, x, y, width, height, options = {}) => ({
    id,
    label,
    type,
    x,
    y,
    width,
    height,
    ...options,
});

const flow = (
    id,
    source,
    target,
    label,
    sourceSide,
    targetSide,
    options = {},
) => ({
    id,
    source,
    target,
    label,
    sourceSide,
    targetSide,
    ...options,
});

const contextPage = {
    id: 'ipawcus-context',
    name: '01 - Context Diagram',
    title: 'IPAWCUS Context Diagram',
    subtitle: 'Process 0 and the four external user roles — centered snowflake layout',
    width: 2200,
    height: 1600,
    directionNote: 'External role  →  Process 0  →  External role response',
    nodes: [
        node(
            'ctx-system',
            '0\nIPAWCUS\nIntegrated Pet Care and Clinic Management System',
            'context-process',
            820,
            610,
            560,
            300,
        ),
        node('ctx-super', 'SUPER ADMIN\nClinic Owner / System Overseer', 'entity', 870, 170, 460, 140),
        node('ctx-admin', 'ADMIN\nNurse / Clinic Staff', 'entity', 100, 690, 400, 140),
        node('ctx-vet', 'VETERINARIAN\nClinical Care Provider', 'entity', 1700, 690, 400, 140),
        node('ctx-owner', 'PET OWNER\nClient / Pet Parent', 'entity', 870, 1280, 460, 140),
    ],
    edges: [
        flow(
            'ctx-super-in',
            'ctx-super',
            'ctx-system',
            'Credentials; personnel, role, branch,\npayment-setting, report and recovery requests',
            'bottom',
            'top',
            { labelWidth: 300, labelHeight: 58, labelOffsetX: -165, labelOffsetY: -18, balanceKey: 'super-in' },
        ),
        flow(
            'ctx-super-out',
            'ctx-system',
            'ctx-super',
            'Access, account and configuration status;\ndashboards, audits, recovery results and reports',
            'top',
            'bottom',
            { labelWidth: 300, labelHeight: 58, labelOffsetX: 165, labelOffsetY: -18, balanceKey: 'super-out' },
        ),
        flow(
            'ctx-admin-in',
            'ctx-admin',
            'ctx-system',
            'Credentials; pet, booking, queue, boarding,\ninventory, billing and record-request actions',
            'right',
            'left',
            { labelWidth: 300, labelHeight: 58, labelOffsetY: -48, balanceKey: 'admin-in' },
        ),
        flow(
            'ctx-admin-out',
            'ctx-system',
            'ctx-admin',
            'Access and branch permissions; pet, booking,\nvisit, stock, billing and payment status',
            'left',
            'right',
            { labelWidth: 300, labelHeight: 58, labelOffsetY: 48, balanceKey: 'admin-out' },
        ),
        flow(
            'ctx-vet-in',
            'ctx-vet',
            'ctx-system',
            'Credentials; availability, assignment, diagnosis,\ntreatment, record and task updates',
            'left',
            'right',
            { labelWidth: 300, labelHeight: 58, labelOffsetY: -48, balanceKey: 'vet-in' },
        ),
        flow(
            'ctx-vet-out',
            'ctx-system',
            'ctx-vet',
            'Access and branch assignment; schedules, assigned\ncases, pet history, consultation and reminders',
            'right',
            'left',
            { labelWidth: 300, labelHeight: 58, labelOffsetY: 48, balanceKey: 'vet-out' },
        ),
        flow(
            'ctx-owner-in',
            'ctx-owner',
            'ctx-system',
            'Credentials, profile and notification preferences;\npet, booking, consent, payment, queue and consultation data',
            'top',
            'bottom',
            { labelWidth: 320, labelHeight: 64, labelOffsetX: -175, labelOffsetY: 16, balanceKey: 'owner-in' },
        ),
        flow(
            'ctx-owner-out',
            'ctx-system',
            'ctx-owner',
            'Access, pet, booking, payment and queue status;\nreminders, diagnoses and medical records',
            'bottom',
            'top',
            { labelWidth: 300, labelHeight: 58, labelOffsetX: 175, labelOffsetY: 16, balanceKey: 'owner-out' },
        ),
    ],
};

const levelOnePage = {
    id: 'ipawcus-level-1',
    name: '02 - Level 1 Data Flow',
    title: 'IPAWCUS Level 1 Data Flow Diagram',
    subtitle: 'Right-to-left layout: external roles feed system processes, which validate and persist data in logical stores',
    width: 3000,
    height: 2250,
    directionNote: 'LOGICAL DATA STORES  <-  SYSTEM PROCESSES  <-  EXTERNAL ROLES',
    zones: [
        { id: 'stores-zone', label: 'LOGICAL DATA STORES', x: 70, y: 130, width: 620, height: 2040 },
        { id: 'process-zone', label: 'SYSTEM PROCESSES', x: 1120, y: 130, width: 800, height: 2040 },
        { id: 'roles-zone', label: 'EXTERNAL ROLES', x: 2420, y: 130, width: 500, height: 2040 },
    ],
    nodes: [
        node('d1', 'D1\nUsers, Profiles and Access', 'store', 120, 170, 520, 140),
        node('d2', 'D2\nPets, Ownership and Medical Records', 'store', 120, 450, 520, 140),
        node('d3', 'D3\nBranches, Services and Schedules', 'store', 120, 730, 520, 140),
        node('d4', 'D4\nBookings, Consent, Queues and Visits', 'store', 120, 1010, 520, 140),
        node('d5', 'D5\nBoarding and Inventory', 'store', 120, 1290, 520, 140),
        node('d6', 'D6\nCharges, Payments and Refunds', 'store', 120, 1570, 520, 140),
        node('d7', 'D7\nNotifications, Tasks and Reporting Events', 'store', 120, 1850, 520, 140),

        node('p1', '1.0\nUSER AND PET MANAGEMENT', 'process', 1220, 190, 600, 220),
        node('p2', '2.0\nBOOKING AND CLINICAL CARE', 'process', 1220, 690, 600, 220),
        node('p3', '3.0\nCLINIC OPERATIONS AND BILLING', 'process', 1220, 1190, 600, 220),
        node('p4', '4.0\nNOTIFICATIONS, TASKS AND REPORTING', 'process', 1220, 1690, 600, 220),

        node('owner', 'PET OWNER\nClient / Pet Parent', 'entity', 2520, 210, 360, 150),
        node('admin', 'ADMIN\nNurse / Clinic Staff', 'entity', 2520, 700, 360, 150),
        node('vet', 'VETERINARIAN\nClinical Care Provider', 'entity', 2520, 1190, 360, 150),
        node('super', 'SUPER ADMIN\nClinic Owner / System Overseer', 'entity', 2520, 1680, 360, 150),
    ],
    edges: [
        flow('e01', 'owner', 'p1', 'Credentials, profile, preferences\nand pet-ownership data', 'top', 'right', { balanceKey: 'owner-in' }),
        flow('e02', 'p1', 'owner', 'Access, account, pet and\nownership status', 'right', 'top', { balanceKey: 'owner-out' }),
        flow('e03', 'admin', 'p1', 'Credentials and profile data', 'top', 'right', { balanceKey: 'admin-in' }),
        flow('e04', 'p1', 'admin', 'Access and branch permissions', 'right', 'top', { balanceKey: 'admin-out' }),
        flow('e05', 'vet', 'p1', 'Credentials and profile data', 'top', 'right', { balanceKey: 'vet-in' }),
        flow('e06', 'p1', 'vet', 'Access and branch assignment', 'right', 'top', { balanceKey: 'vet-out' }),
        flow('e07', 'super', 'p1', 'Credentials; personnel, role\nand branch actions', 'top', 'right', { balanceKey: 'super-in' }),
        flow('e08', 'p1', 'super', 'Access and account status', 'right', 'top', { balanceKey: 'super-out' }),

        flow('e09', 'owner', 'p2', 'Booking, consent, queue, consultation\nand record-request data', 'left', 'right', { balanceKey: 'owner-in' }),
        flow('e10', 'p2', 'owner', 'Booking, queue, care\nand medical-record status', 'right', 'left', { balanceKey: 'owner-out' }),
        flow('e11', 'admin', 'p2', 'Pet, booking, queue, payment-review\nand record-request decisions', 'left', 'right', { balanceKey: 'admin-in' }),
        flow('e12', 'p2', 'admin', 'Pet directory, bookings, queue,\nvisits and request data', 'right', 'left', { balanceKey: 'admin-out' }),
        flow('e13', 'vet', 'p2', 'Availability, assignment, diagnosis,\ntreatment and record updates', 'left', 'right', { balanceKey: 'vet-in' }),
        flow('e14', 'p2', 'vet', 'Schedule, assigned cases, pet history\nand consultation data', 'right', 'left', { balanceKey: 'vet-out' }),

        flow('e15', 'owner', 'p3', 'Payment proof and boarding requests', 'left', 'right', { balanceKey: 'owner-in' }),
        flow('e16', 'p3', 'owner', 'Billing, payment, refund\nand boarding status', 'right', 'left', { balanceKey: 'owner-out' }),
        flow('e17', 'admin', 'p3', 'Boarding, catalog, stock, charge,\npayment and refund transactions', 'left', 'right', { balanceKey: 'admin-in' }),
        flow('e18', 'p3', 'admin', 'Room, service, stock, billing\nand payment status', 'right', 'left', { balanceKey: 'admin-out' }),
        flow('e19', 'super', 'p3', 'Payment-method configuration', 'left', 'right', { balanceKey: 'super-in' }),
        flow('e20', 'p3', 'super', 'Payment-configuration status', 'right', 'left', { balanceKey: 'super-out' }),

        flow('e21', 'p4', 'owner', 'Notifications, reminders and\nservice-status updates', 'right', 'bottom', { balanceKey: 'owner-out' }),
        flow('e22', 'p4', 'admin', 'Branch alerts and operational\nnotifications', 'right', 'bottom', { balanceKey: 'admin-out' }),
        flow('e23', 'p4', 'vet', 'Case, schedule and task reminders', 'right', 'bottom', { balanceKey: 'vet-out' }),
        flow('e24', 'super', 'p4', 'Report filters, monitoring\nand recovery requests', 'left', 'right', { balanceKey: 'super-in' }),
        flow('e25', 'p4', 'super', 'Dashboards, reports, audit and\nrecovery results', 'right', 'left', { balanceKey: 'super-out' }),

        flow('e26', 'p1', 'd1', 'Account, profile and access updates', 'left', 'right'),
        flow('e27', 'd1', 'p1', 'Users, roles and branch-access data', 'right', 'left'),
        flow('e28', 'p1', 'd2', 'Owner, pet and ownership updates', 'left', 'right'),
        flow('e29', 'd2', 'p1', 'Pet and owner-link data', 'right', 'left'),

        flow('e30', 'p2', 'd2', 'Medical-record and request updates', 'left', 'right'),
        flow('e31', 'd2', 'p2', 'Pet, allergy, vaccine and history data', 'right', 'left'),
        flow('e32', 'p2', 'd3', 'Veterinarian availability\nand schedule updates', 'left', 'right'),
        flow('e33', 'd3', 'p2', 'Branch, service, room\nand schedule data', 'right', 'left'),
        flow('e34', 'p2', 'd4', 'Booking, consent, queue, visit\nand diagnosis updates', 'left', 'right'),
        flow('e35', 'd4', 'p2', 'Booking, queue, visit\nand consultation data', 'right', 'left'),

        flow('e36', 'p3', 'd3', 'Service catalog and\nroom-configuration updates', 'left', 'right'),
        flow('e37', 'd3', 'p3', 'Service, branch and room data', 'right', 'left'),
        flow('e38', 'p3', 'd5', 'Boarding and stock transactions', 'left', 'right'),
        flow('e39', 'd5', 'p3', 'Room, item, batch and stock data', 'right', 'left'),
        flow('e40', 'p3', 'd6', 'Charge, payment and refund records', 'left', 'right'),
        flow('e41', 'd6', 'p3', 'Prices, balances and payment status', 'right', 'left'),

        flow('e42', 'p4', 'd7', 'Notification, task, audit\nand report-event records', 'left', 'right'),
        flow('e43', 'd7', 'p4', 'Preferences, reminders, delivery\nand reporting-event data', 'right', 'left'),

        flow('e44', 'p1', 'p2', 'Authorized actor and\npet-owner context', 'bottom', 'top'),
        flow('e45', 'p1', 'p4', 'Account and security events', 'left', 'left'),
        flow('e46', 'p2', 'p3', 'Service usage, boarding requests\nand visit charges', 'bottom', 'top'),
        flow('e47', 'p3', 'p2', 'Payment and availability status', 'top', 'bottom'),
        flow('e48', 'p2', 'p4', 'Booking, queue and clinical events', 'left', 'left'),
        flow('e49', 'p3', 'p4', 'Boarding, stock and billing events', 'bottom', 'top'),
    ],
};

const individualizedContextPage = {
    id: 'ipawcus-context',
    name: '01 - Context Diagram',
    title: 'IPAWCUS Context Diagram',
    subtitle: 'Process 0 and four external roles - every input and output is an individual data flow',
    width: 3600,
    height: 2800,
    directionNote: 'INDIVIDUAL REQUEST FLOWS  ->  PROCESS 0  ->  INDIVIDUAL RESPONSE FLOWS',
    nodes: [
        node(
            'ctx-system',
            '0\nIPAWCUS\nIntegrated Pet Care and Clinic Management System',
            'context-process',
            1550,
            1250,
            500,
            300,
            { minWidth: 500, minHeight: 300 },
        ),
        node('ctx-super', 'SUPER ADMIN', 'entity', 1650, 200, 300, 100),
        node('ctx-admin', 'ADMIN', 'entity', 100, 1350, 300, 100),
        node('ctx-vet', 'VETERINARIAN', 'entity', 3200, 1350, 300, 100),
        node('ctx-owner', 'PET OWNER', 'entity', 1650, 2500, 300, 100),
    ],
    edges: [
        flow('ctx-s01-in', 'ctx-super', 'ctx-system', 'Login credentials', 'bottom', 'top', { balanceKey: 'super-in' }),
        flow('ctx-s01-out', 'ctx-system', 'ctx-super', 'Authentication and account status', 'top', 'bottom', { balanceKey: 'super-out' }),
        flow('ctx-s02-in', 'ctx-super', 'ctx-system', 'Personnel and role updates', 'bottom', 'top', { balanceKey: 'super-in' }),
        flow('ctx-s02-out', 'ctx-system', 'ctx-super', 'Personnel and role status', 'top', 'bottom', { balanceKey: 'super-out' }),
        flow('ctx-s03-in', 'ctx-super', 'ctx-system', 'Branch assignment updates', 'bottom', 'top', { balanceKey: 'super-in' }),
        flow('ctx-s03-out', 'ctx-system', 'ctx-super', 'Branch assignment status', 'top', 'bottom', { balanceKey: 'super-out' }),
        flow('ctx-s04-in', 'ctx-super', 'ctx-system', 'Payment-method settings', 'bottom', 'top', { balanceKey: 'super-in' }),
        flow('ctx-s04-out', 'ctx-system', 'ctx-super', 'Payment configuration status', 'top', 'bottom', { balanceKey: 'super-out' }),
        flow('ctx-s05-in', 'ctx-super', 'ctx-system', 'Report filters', 'left', 'top', { balanceKey: 'super-in' }),
        flow('ctx-s05-out', 'ctx-system', 'ctx-super', 'Dashboards and reports', 'top', 'left', { balanceKey: 'super-out' }),
        flow('ctx-s06-in', 'ctx-super', 'ctx-system', 'Monitoring and recovery requests', 'right', 'top', { balanceKey: 'super-in' }),
        flow('ctx-s06-out', 'ctx-system', 'ctx-super', 'Audit and recovery results', 'top', 'right', { balanceKey: 'super-out' }),

        flow('ctx-a01-in', 'ctx-admin', 'ctx-system', 'Login credentials', 'top', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a01-out', 'ctx-system', 'ctx-admin', 'Access and branch permissions', 'left', 'top', { balanceKey: 'admin-out' }),
        flow('ctx-a02-in', 'ctx-admin', 'ctx-system', 'Pet and ownership updates', 'top', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a02-out', 'ctx-system', 'ctx-admin', 'Pet and ownership directory', 'left', 'top', { balanceKey: 'admin-out' }),
        flow('ctx-a03-in', 'ctx-admin', 'ctx-system', 'Booking decisions', 'top', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a03-out', 'ctx-system', 'ctx-admin', 'Booking and payment submissions', 'left', 'top', { balanceKey: 'admin-out' }),
        flow('ctx-a04-in', 'ctx-admin', 'ctx-system', 'Queue and veterinarian assignment', 'bottom', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a04-out', 'ctx-system', 'ctx-admin', 'Queue, visit and request data', 'left', 'bottom', { balanceKey: 'admin-out' }),
        flow('ctx-a05-in', 'ctx-admin', 'ctx-system', 'Boarding transactions', 'bottom', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a05b-out', 'ctx-system', 'ctx-admin', 'Boarding status', 'left', 'bottom', { balanceKey: 'admin-out' }),
        flow('ctx-a05-out', 'ctx-system', 'ctx-admin', 'Room, service and stock status', 'left', 'bottom', { balanceKey: 'admin-out' }),
        flow('ctx-a06-in', 'ctx-admin', 'ctx-system', 'Service and inventory transactions', 'bottom', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a06-out', 'ctx-system', 'ctx-admin', 'Billing, payment and refund status', 'left', 'bottom', { balanceKey: 'admin-out' }),
        flow('ctx-a07-in', 'ctx-admin', 'ctx-system', 'Charge, payment and refund data', 'right', 'left', { balanceKey: 'admin-in' }),
        flow('ctx-a07-out', 'ctx-system', 'ctx-admin', 'Operational alerts', 'left', 'right', { balanceKey: 'admin-out' }),
        flow('ctx-a08-in', 'ctx-admin', 'ctx-system', 'Medical-record request decisions', 'bottom', 'left', { balanceKey: 'admin-in' }),

        flow('ctx-v01-in', 'ctx-vet', 'ctx-system', 'Login credentials', 'top', 'right', { balanceKey: 'vet-in' }),
        flow('ctx-v01-out', 'ctx-system', 'ctx-vet', 'Access and branch assignment', 'right', 'top', { balanceKey: 'vet-out' }),
        flow('ctx-v02-in', 'ctx-vet', 'ctx-system', 'Availability and schedule updates', 'top', 'right', { balanceKey: 'vet-in' }),
        flow('ctx-v02-out', 'ctx-system', 'ctx-vet', 'Veterinarian schedule', 'right', 'top', { balanceKey: 'vet-out' }),
        flow('ctx-v03-in', 'ctx-vet', 'ctx-system', 'Case assignment actions', 'top', 'right', { balanceKey: 'vet-in' }),
        flow('ctx-v03-out', 'ctx-system', 'ctx-vet', 'Assigned queue and case data', 'right', 'bottom', { balanceKey: 'vet-out' }),
        flow('ctx-v04-in', 'ctx-vet', 'ctx-system', 'Diagnosis and treatment data', 'bottom', 'right', { balanceKey: 'vet-in' }),
        flow('ctx-v04-out', 'ctx-system', 'ctx-vet', 'Pet clinical history', 'right', 'bottom', { balanceKey: 'vet-out' }),
        flow('ctx-v05-in', 'ctx-vet', 'ctx-system', 'Prescription and record updates', 'bottom', 'right', { balanceKey: 'vet-in' }),
        flow('ctx-v05-out', 'ctx-system', 'ctx-vet', 'Consultation and request data', 'right', 'bottom', { balanceKey: 'vet-out' }),
        flow('ctx-v06-in', 'ctx-vet', 'ctx-system', 'Task and preference updates', 'left', 'right', { balanceKey: 'vet-in' }),
        flow('ctx-v06-out', 'ctx-system', 'ctx-vet', 'Case, schedule and task reminders', 'right', 'left', { balanceKey: 'vet-out' }),

        flow('ctx-o01-in', 'ctx-owner', 'ctx-system', 'Login credentials', 'top', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o01-out', 'ctx-system', 'ctx-owner', 'Authentication and account status', 'bottom', 'top', { balanceKey: 'owner-out' }),
        flow('ctx-o02-in', 'ctx-owner', 'ctx-system', 'Profile and notification preferences', 'top', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o02-out', 'ctx-system', 'ctx-owner', 'Profile and preference status', 'bottom', 'top', { balanceKey: 'owner-out' }),
        flow('ctx-o03-in', 'ctx-owner', 'ctx-system', 'Pet registration and ownership data', 'top', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o03-out', 'ctx-system', 'ctx-owner', 'Pet and ownership status', 'bottom', 'top', { balanceKey: 'owner-out' }),
        flow('ctx-o04-in', 'ctx-owner', 'ctx-system', 'Booking and consent request', 'left', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o04-out', 'ctx-system', 'ctx-owner', 'Schedule and booking confirmation', 'bottom', 'left', { balanceKey: 'owner-out' }),
        flow('ctx-o05-in', 'ctx-owner', 'ctx-system', 'Payment proof and refund request', 'right', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o05-out', 'ctx-system', 'ctx-owner', 'Payment and refund status', 'bottom', 'right', { balanceKey: 'owner-out' }),
        flow('ctx-o06-in', 'ctx-owner', 'ctx-system', 'Queue and consultation request', 'left', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o06-out', 'ctx-system', 'ctx-owner', 'Queue and consultation status', 'bottom', 'left', { balanceKey: 'owner-out' }),
        flow('ctx-o07-in', 'ctx-owner', 'ctx-system', 'Medical-record and update request', 'right', 'bottom', { balanceKey: 'owner-in' }),
        flow('ctx-o07-out', 'ctx-system', 'ctx-owner', 'Diagnosis, prescription and medical record', 'bottom', 'right', { balanceKey: 'owner-out' }),
        flow('ctx-o08-out', 'ctx-system', 'ctx-owner', 'Notifications and reminders', 'bottom', 'top', { balanceKey: 'owner-out' }),
    ],
};

const correctedPages = professionalMode
    ? buildProfessionalDfdPages(individualizedContextPage)
    : buildCorrectedDfdPages(individualizedContextPage);
const activeContextPage = correctedPages.contextPage;
const activeLevelOnePage = correctedPages.levelOnePage;
const pages = [
    activeContextPage,
    ...(correctedPages.supplementalPages || []),
    activeLevelOnePage,
    ...correctedPages.levelTwoPages,
];

function fittedLineCount(lines, charactersPerLine) {
    return lines.reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
        0,
    );
}

function fitNodesToContent(page) {
    for (const item of page.nodes) {
        const centerX = item.x + item.width / 2;
        const centerY = item.y + item.height / 2;
        const parts = String(item.label).split('\n');

        if (item.fixedSize) {
            if (item.type === 'process' || item.type === 'process-ref') {
                item.headerHeight = 42;
            }
            item.x = Math.round(item.x / 10) * 10;
            item.y = Math.round(item.y / 10) * 10;
            item.width = Math.round(item.width / 10) * 10;
            item.height = Math.round(item.height / 10) * 10;
            continue;
        }

        if (item.type === 'entity') {
            item.label = parts[0].trim();
            item.width = Math.max(
                item.minWidth || 0,
                140,
                Math.min(230, item.label.length * 8.4 + 34),
            );
            item.height = Math.max(70, item.minHeight || 0);
        } else if (item.type === 'store') {
            const storeName = parts.slice(1).join(' ').trim();
            const nameWidth = Math.max(150, Math.min(330, storeName.length * 7.1 + 26));
            item.width = Math.max(item.minWidth || 0, 58 + nameWidth);
            const nameLineCount = Math.max(1, Math.ceil((storeName.length * 7.1) / (nameWidth - 22)));
            item.height = Math.max(item.minHeight || 0, 50, nameLineCount * 18 + 20);
        } else if (item.type === 'process' || item.type === 'context-process') {
            const bodyLines = parts.slice(1);
            const longestLine = Math.max(...bodyLines.map((line) => line.length));
            item.width = Math.max(
                item.minWidth || 0,
                270,
                Math.min(500, longestLine * 7.7 + 42),
            );
            const charactersPerLine = Math.max(24, Math.floor((item.width - 34) / 7.7));
            const bodyLineCount = fittedLineCount(bodyLines, charactersPerLine);
            item.headerHeight = 42;
            item.height = Math.max(
                item.minHeight || 0,
                item.headerHeight + Math.max(54, bodyLineCount * 19 + 22),
            );
        }

        item.x = Math.round((centerX - item.width / 2) / 10) * 10;
        item.y = Math.round((centerY - item.height / 2) / 10) * 10;
        item.width = Math.round(item.width / 10) * 10;
        item.height = Math.round(item.height / 10) * 10;
    }
}

for (const page of pages) {
    fitNodesToContent(page);
}

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const labelXml = (value) => String(value)
    .split('\n')
    .map(escapeXml)
    .join('&#xa;');

const grid = 10;
const clearance = 26;
const headerBottom = 128;

class MinHeap {
    constructor() {
        this.items = [];
    }

    push(item) {
        this.items.push(item);
        let index = this.items.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.items[parent].priority <= item.priority) break;
            this.items[index] = this.items[parent];
            index = parent;
        }
        this.items[index] = item;
    }

    pop() {
        if (this.items.length === 0) return null;
        const root = this.items[0];
        const tail = this.items.pop();
        if (this.items.length === 0) return root;
        let index = 0;
        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            if (left >= this.items.length) break;
            const next = right < this.items.length
                && this.items[right].priority < this.items[left].priority
                ? right
                : left;
            if (this.items[next].priority >= tail.priority) break;
            this.items[index] = this.items[next];
            index = next;
        }
        this.items[index] = tail;
        return root;
    }

    get size() {
        return this.items.length;
    }
}

const directions = [
    { name: 'left', dx: -grid, dy: 0 },
    { name: 'right', dx: grid, dy: 0 },
    { name: 'up', dx: 0, dy: -grid },
    { name: 'down', dx: 0, dy: grid },
];

const snap = (value) => Math.round(value / grid) * grid;
const pointKey = (point) => String(point.x) + ',' + String(point.y);
const stateKey = (point, direction) => pointKey(point) + ',' + direction;
const segmentKey = (a, b) => [pointKey(a), pointKey(b)].sort().join('|');

function rectangle(item, padding = 0) {
    return {
        x: item.x - padding,
        y: item.y - padding,
        width: item.width + padding * 2,
        height: item.height + padding * 2,
    };
}

function containsPoint(rect, point) {
    return point.x >= rect.x
        && point.x <= rect.x + rect.width
        && point.y >= rect.y
        && point.y <= rect.y + rect.height;
}

function rectanglesOverlap(a, b, padding = 0) {
    return a.x - padding < b.x + b.width
        && a.x + a.width + padding > b.x
        && a.y - padding < b.y + b.height
        && a.y + a.height + padding > b.y;
}

function makePort(item, side, slotIndex, slotCount) {
    const distributedCoordinate = (minimum, maximum) => {
        const first = Math.ceil(minimum / grid) * grid;
        const last = Math.floor(maximum / grid) * grid;
        const availableSlots = Math.floor((last - first) / grid) + 1;
        if (slotCount > availableSlots) {
            throw new Error(
                'Box ' + item.id + ' is too small for ' + slotCount + ' ports on its ' + side + ' side',
            );
        }
        if (slotCount === 1) return snap((first + last) / 2);
        const selectedSlot = Math.floor(
            slotIndex * (availableSlots - 1) / (slotCount - 1),
        );
        return first + selectedSlot * grid;
    };
    if (side === 'top' || side === 'bottom') {
        const inset = Math.min(18, item.width / 6);
        const x = distributedCoordinate(item.x + inset, item.x + item.width - inset);
        const y = side === 'top' ? item.y : item.y + item.height;
        const extensionY = side === 'top'
            ? Math.floor((y - clearance - grid) / grid) * grid
            : Math.ceil((y + clearance + grid) / grid) * grid;
        return {
            boundary: { x, y },
            extension: { x, y: extensionY },
            anchor: {
                x: (x - item.x) / item.width,
                y: side === 'top' ? 0 : 1,
            },
        };
    }

    const inset = Math.min(10, item.height / 6);
    const y = distributedCoordinate(item.y + inset, item.y + item.height - inset);
    const x = side === 'left' ? item.x : item.x + item.width;
    const extensionX = side === 'left'
        ? Math.floor((x - clearance - grid) / grid) * grid
        : Math.ceil((x + clearance + grid) / grid) * grid;
    return {
        boundary: { x, y },
        extension: { x: extensionX, y },
        anchor: {
            x: side === 'left' ? 0 : 1,
            y: (y - item.y) / item.height,
        },
    };
}

function simplify(points) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
        const previous = result[result.length - 1];
        const current = points[index];
        const next = points[index + 1];
        const collinear = previous.x === current.x && current.x === next.x
            || previous.y === current.y && current.y === next.y;
        if (!collinear) result.push(current);
    }
    result.push(points[points.length - 1]);
    return result;
}

function routeBetween(start, end, obstacles, page, usedSegments, usedPoints) {
    const minX = grid;
    const minY = headerBottom;
    const maxX = Math.floor((page.width - grid) / grid) * grid;
    const maxY = Math.floor((page.height - grid) / grid) * grid;
    const blocked = (point) => obstacles.some((obstacle) => containsPoint(obstacle, point));
    const open = new MinHeap();
    const costs = new Map();
    const previous = new Map();
    const initialKey = stateKey(start, 'start');
    costs.set(initialKey, 0);
    open.push({
        point: start,
        direction: 'start',
        cost: 0,
        priority: Math.abs(start.x - end.x) + Math.abs(start.y - end.y),
    });
    let final = null;

    while (open.size > 0) {
        const current = open.pop();
        const currentKey = stateKey(current.point, current.direction);
        if (current.cost !== costs.get(currentKey)) continue;
        if (current.point.x === end.x && current.point.y === end.y) {
            final = current;
            break;
        }

        for (const direction of directions) {
            const next = {
                x: current.point.x + direction.dx,
                y: current.point.y + direction.dy,
            };
            if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY) continue;
            if (!(next.x === end.x && next.y === end.y) && blocked(next)) continue;
            if (usedSegments.has(segmentKey(current.point, next))) continue;
            const bendPenalty = current.direction !== 'start'
                && current.direction !== direction.name
                ? 8
                : 0;
            const occupiedPointPenalty = (usedPoints.get(pointKey(next)) || 0) * 7;
            const nextCost = current.cost + 1 + bendPenalty + occupiedPointPenalty;
            const nextKey = stateKey(next, direction.name);
            if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
            costs.set(nextKey, nextCost);
            previous.set(nextKey, currentKey);
            const heuristic = (
                Math.abs(next.x - end.x)
                + Math.abs(next.y - end.y)
            ) / grid;
            open.push({
                point: next,
                direction: direction.name,
                cost: nextCost,
                priority: nextCost + heuristic,
            });
        }
    }

    if (!final) {
        throw new Error(
            'Unable to route ' + pointKey(start) + ' to ' + pointKey(end) + ' on ' + page.name,
        );
    }

    const route = [];
    let key = stateKey(final.point, final.direction);
    while (key) {
        const parts = key.split(',');
        route.push({ x: Number(parts[0]), y: Number(parts[1]) });
        key = previous.get(key);
    }
    return simplify(route.reverse());
}

function intersectsRectangle(a, b, rect) {
    if (a.x === b.x) {
        return a.x > rect.x
            && a.x < rect.x + rect.width
            && Math.max(a.y, b.y) > rect.y
            && Math.min(a.y, b.y) < rect.y + rect.height;
    }
    if (a.y === b.y) {
        return a.y > rect.y
            && a.y < rect.y + rect.height
            && Math.max(a.x, b.x) > rect.x
            && Math.min(a.x, b.x) < rect.x + rect.width;
    }
    return true;
}

function markSegments(points, usedSegments, usedPoints) {
    for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        const steps = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / grid;
        for (let step = 0; step < steps; step += 1) {
            const from = {
                x: a.x + Math.sign(b.x - a.x) * grid * step,
                y: a.y + Math.sign(b.y - a.y) * grid * step,
            };
            const to = {
                x: a.x + Math.sign(b.x - a.x) * grid * (step + 1),
                y: a.y + Math.sign(b.y - a.y) * grid * (step + 1),
            };
            usedSegments.add(segmentKey(from, to));
            usedPoints.set(pointKey(to), (usedPoints.get(pointKey(to)) || 0) + 1);
        }
    }
}

function createContextRoutes(page, nodesById, edgePorts) {
    const routes = new Map();
    const roleIds = ['ctx-super', 'ctx-admin', 'ctx-vet', 'ctx-owner'];
    const roleEdges = new Map(
        roleIds.map((roleId) => [
            roleId,
            page.edges.filter((edge) => edge.source === roleId || edge.target === roleId),
        ]),
    );

    for (const edge of page.edges) {
        const roleId = roleIds.find(
            (candidate) => edge.source === candidate || edge.target === candidate,
        );
        if (!roleId) throw new Error('Context flow has no external role: ' + edge.id);
        const index = roleEdges.get(roleId).findIndex((candidate) => candidate.id === edge.id);
        const { sourcePort, targetPort } = edgePorts.get(edge.id);
        const actorIsSource = edge.source === roleId;
        const actorPort = actorIsSource ? sourcePort : targetPort;
        const systemPort = actorIsSource ? targetPort : sourcePort;
        const actorSide = actorIsSource ? edge.sourceSide : edge.targetSide;
        let actorToSystem;

        if (roleId === 'ctx-admin') {
            const channelY = 980 + index * 52;
            const actorStageX = 420 + index * 8;
            const systemStageX = 1500 - index * 8;
            const actorFanY = actorSide === 'top'
                ? 1280 - index * 12
                : actorSide === 'bottom'
                    ? 1520 + index * 12
                    : actorPort.extension.y;
            actorToSystem = [
                actorPort.boundary,
                actorPort.extension,
                { x: actorPort.extension.x, y: actorFanY },
                { x: actorStageX, y: actorFanY },
                { x: actorStageX, y: channelY },
                { x: systemStageX, y: channelY },
                { x: systemStageX, y: systemPort.extension.y },
                systemPort.extension,
                systemPort.boundary,
            ];
        } else if (roleId === 'ctx-vet') {
            const channelY = 980 + index * 52;
            const actorStageX = 3180 - index * 8;
            const systemStageX = 2100 + index * 8;
            const actorFanY = actorSide === 'top'
                ? 1280 - index * 12
                : actorSide === 'bottom'
                    ? 1520 + index * 12
                    : actorPort.extension.y;
            actorToSystem = [
                actorPort.boundary,
                actorPort.extension,
                { x: actorPort.extension.x, y: actorFanY },
                { x: actorStageX, y: actorFanY },
                { x: actorStageX, y: channelY },
                { x: systemStageX, y: channelY },
                { x: systemStageX, y: systemPort.extension.y },
                systemPort.extension,
                systemPort.boundary,
            ];
        } else if (roleId === 'ctx-super') {
            const channelX = index < 6
                ? 900 + index * 55
                : 2425 + (index - 6) * 55;
            const actorStageY = 400 + index * 8;
            const systemStageY = 1180 - index * 8;
            const actorFanX = actorSide === 'left'
                ? 1540 - index * 12
                : actorSide === 'right'
                    ? 2060 + index * 12
                    : actorPort.extension.x;
            actorToSystem = [
                actorPort.boundary,
                actorPort.extension,
                { x: actorFanX, y: actorPort.extension.y },
                { x: actorFanX, y: actorStageY },
                { x: channelX, y: actorStageY },
                { x: channelX, y: systemStageY },
                { x: systemPort.extension.x, y: systemStageY },
                systemPort.extension,
                systemPort.boundary,
            ];
        } else {
            const channelX = index < 8
                ? 900 + index * 55
                : 2280 + (index - 8) * 55;
            const actorStageY = 2380 - index * 8;
            const systemStageY = 1770 + index * 8;
            const actorFanX = actorSide === 'left'
                ? 1540 - index * 12
                : actorSide === 'right'
                    ? 2060 + index * 12
                    : actorPort.extension.x;
            actorToSystem = [
                actorPort.boundary,
                actorPort.extension,
                { x: actorFanX, y: actorPort.extension.y },
                { x: actorFanX, y: actorStageY },
                { x: channelX, y: actorStageY },
                { x: channelX, y: systemStageY },
                { x: systemPort.extension.x, y: systemStageY },
                systemPort.extension,
                systemPort.boundary,
            ];
        }

        const complete = simplify(
            actorIsSource ? actorToSystem : [...actorToSystem].reverse(),
        );
        for (let pointIndex = 0; pointIndex < complete.length - 1; pointIndex += 1) {
            const a = complete[pointIndex];
            const b = complete[pointIndex + 1];
            if (a.x !== b.x && a.y !== b.y) {
                throw new Error('Non-orthogonal context route for ' + edge.id);
            }
        }
        routes.set(edge.id, {
            sourceAnchor: sourcePort.anchor,
            targetAnchor: targetPort.anchor,
            points: complete.slice(1, -1),
            complete,
        });
    }

    return routes;
}

function distributedLane(index, count, minimum, maximum) {
    if (count <= 1) return snap((minimum + maximum) / 2);
    return snap(minimum + index * (maximum - minimum) / (count - 1));
}

function createBandedRoutes(page, nodesById, edgePorts) {
    const routes = new Map();
    const groups = new Map();

    for (const edge of page.edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const process = source.type === 'process' ? source : target;
        let corridor;
        if (source.type === 'entity' || target.type === 'entity') {
            corridor = 'right';
        } else if (source.type === 'store' || target.type === 'store') {
            corridor = 'left';
        } else {
            corridor = 'internal';
        }
        const groupKey = corridor === 'internal'
            ? 'internal'
            : String(process.bandIndex) + ':' + corridor;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(edge);
    }

    const orderedGroups = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
    for (const [groupKey, groupEdges] of orderedGroups) {
        const corridor = groupKey === 'internal' ? 'internal' : groupKey.split(':')[1];
        const sortedEdges = [...groupEdges].sort((left, right) => left.id.localeCompare(right.id));

        for (let edgeIndex = 0; edgeIndex < sortedEdges.length; edgeIndex += 1) {
            const edge = sortedEdges[edgeIndex];
            const source = nodesById.get(edge.source);
            const target = nodesById.get(edge.target);
            const { sourcePort, targetPort } = edgePorts.get(edge.id);
            let complete;

            if (corridor === 'internal') {
                const processRight = Math.max(source.x + source.width, target.x + target.width);
                const laneX = snap(processRight + 180 + edgeIndex * 42);
                complete = simplify([
                    sourcePort.boundary,
                    sourcePort.extension,
                    { x: laneX, y: sourcePort.extension.y },
                    { x: laneX, y: targetPort.extension.y },
                    targetPort.extension,
                    targetPort.boundary,
                ]);
            } else {
                const process = source.type === 'process' ? source : target;
                const other = source.type === 'process' ? target : source;
                const minimum = corridor === 'left'
                    ? other.x + other.width + 110
                    : process.x + process.width + 390;
                const maximum = corridor === 'left'
                    ? process.x - 390
                    : other.x - 110;
                if (maximum <= minimum) {
                    throw new Error(
                        'Insufficient ' + corridor + ' routing corridor for ' + edge.id
                            + ' on ' + page.name,
                    );
                }
                const laneX = distributedLane(edgeIndex, sortedEdges.length, minimum, maximum);
                complete = simplify([
                    sourcePort.boundary,
                    sourcePort.extension,
                    { x: laneX, y: sourcePort.extension.y },
                    { x: laneX, y: targetPort.extension.y },
                    targetPort.extension,
                    targetPort.boundary,
                ]);
            }

            for (const item of page.nodes) {
                if (item.id === source.id || item.id === target.id) continue;
                const itemRect = rectangle(item);
                for (let pointIndex = 0; pointIndex < complete.length - 1; pointIndex += 1) {
                    if (intersectsRectangle(
                        complete[pointIndex],
                        complete[pointIndex + 1],
                        itemRect,
                    )) {
                        throw new Error(
                            'Banded flow ' + edge.id + ' intersects ' + item.id
                                + ' on ' + page.name,
                        );
                    }
                }
            }

            routes.set(edge.id, {
                sourceAnchor: sourcePort.anchor,
                targetAnchor: targetPort.anchor,
                points: complete.slice(1, -1),
                complete,
            });
        }
    }

    return routes;
}

function createHorizontalRoutes(page, nodesById) {
    const routes = new Map();
    const boundaryPort = (item, side, y) => {
        if (side !== 'left' && side !== 'right') {
            throw new Error('Horizontal flow requested a non-horizontal side on ' + item.id);
        }
        if (y < item.y + 8 || y > item.y + item.height - 8) {
            throw new Error('Horizontal landing lane falls outside ' + item.id + ' on ' + page.name);
        }
        return {
            point: {
                x: side === 'left' ? item.x : item.x + item.width,
                y,
            },
            anchor: {
                x: side === 'left' ? 0 : 1,
                y: (y - item.y) / item.height,
            },
        };
    };

    for (const edge of page.edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const sourcePort = boundaryPort(source, edge.sourceSide, edge.laneY);
        const targetPort = boundaryPort(target, edge.targetSide, edge.laneY);
        const complete = [sourcePort.point, targetPort.point];
        if (sourcePort.point.y !== targetPort.point.y) {
            throw new Error('Non-horizontal route generated for ' + edge.id);
        }
        for (const item of page.nodes) {
            if (item.id === source.id || item.id === target.id) continue;
            if (intersectsRectangle(complete[0], complete[1], rectangle(item))) {
                throw new Error(
                    'Horizontal flow ' + edge.id + ' intersects ' + item.id + ' on ' + page.name,
                );
            }
        }
        routes.set(edge.id, {
            sourceAnchor: sourcePort.anchor,
            targetAnchor: targetPort.anchor,
            points: [],
            complete,
        });
    }
    return routes;
}

function createRoutes(page) {
    const nodesById = new Map(page.nodes.map((item) => [item.id, item]));
    if (nodesById.size !== page.nodes.length) {
        throw new Error('Duplicate node ID on ' + page.name);
    }

    if (page.routeStyle === 'horizontal') {
        return createHorizontalRoutes(page, nodesById);
    }

    const portCounts = new Map();
    for (const edge of page.edges) {
        if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
            throw new Error('Unknown endpoint for ' + edge.id + ' on ' + page.name);
        }
        for (const endpoint of [
            [edge.source, edge.sourceSide],
            [edge.target, edge.targetSide],
        ]) {
            const key = endpoint[0] + ':' + endpoint[1];
            portCounts.set(key, (portCounts.get(key) || 0) + 1);
        }
    }

    const portIndexes = new Map();
    const obstacles = page.nodes.map((item) => ({
        id: item.id,
        // Keep unrelated routes outside the short lead-in segment used by ports.
        rect: rectangle(item, clearance + grid),
    }));
    const usedSegments = new Set();
    const usedPoints = new Map();
    const routes = new Map();
    const routingEdges = [...page.edges].sort((left, right) => {
        const leftSource = nodesById.get(left.source);
        const leftTarget = nodesById.get(left.target);
        const rightSource = nodesById.get(right.source);
        const rightTarget = nodesById.get(right.target);
        const leftDistance = Math.abs(
            leftSource.x + leftSource.width / 2 - leftTarget.x - leftTarget.width / 2,
        ) + Math.abs(
            leftSource.y + leftSource.height / 2 - leftTarget.y - leftTarget.height / 2,
        );
        const rightDistance = Math.abs(
            rightSource.x + rightSource.width / 2 - rightTarget.x - rightTarget.width / 2,
        ) + Math.abs(
            rightSource.y + rightSource.height / 2 - rightTarget.y - rightTarget.height / 2,
        );
        return page.id === 'ipawcus-context'
            ? leftDistance - rightDistance
            : rightDistance - leftDistance;
    });

    const edgePorts = new Map();
    const portOwners = new Map();
    for (const edge of routingEdges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const sourceKey = source.id + ':' + edge.sourceSide;
        const targetKey = target.id + ':' + edge.targetSide;
        const sourceIndex = portIndexes.get(sourceKey) || 0;
        const targetIndex = portIndexes.get(targetKey) || 0;
        portIndexes.set(sourceKey, sourceIndex + 1);
        portIndexes.set(targetKey, targetIndex + 1);
        const sourcePort = makePort(
            source,
            edge.sourceSide,
            sourceIndex,
            portCounts.get(sourceKey),
        );
        const targetPort = makePort(
            target,
            edge.targetSide,
            targetIndex,
            portCounts.get(targetKey),
        );
        for (const endpoint of [
            { nodeId: source.id, port: sourcePort },
            { nodeId: target.id, port: targetPort },
        ]) {
            const key = endpoint.nodeId + ':' + pointKey(endpoint.port.boundary);
            if (portOwners.has(key)) {
                throw new Error(
                    'Duplicate connector port on ' + endpoint.nodeId + ': '
                        + portOwners.get(key) + ' / ' + edge.id,
                );
            }
            portOwners.set(key, edge.id);
            markSegments(
                [endpoint.port.boundary, endpoint.port.extension],
                usedSegments,
                usedPoints,
            );
        }
        edgePorts.set(edge.id, { sourcePort, targetPort });
    }

    if (page.id === 'ipawcus-context') {
        return createContextRoutes(page, nodesById, edgePorts);
    }
    if (page.routeStyle === 'banded-deterministic') {
        return createBandedRoutes(page, nodesById, edgePorts);
    }

    for (const edge of routingEdges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const { sourcePort, targetPort } = edgePorts.get(edge.id);
        const routeObstacles = obstacles
            .filter((obstacle) => obstacle.id !== source.id && obstacle.id !== target.id)
            .map((obstacle) => obstacle.rect);
        let routePoints;
        try {
            routePoints = routeBetween(
                sourcePort.extension,
                targetPort.extension,
                routeObstacles,
                page,
                usedSegments,
                usedPoints,
            );
        } catch (error) {
            throw new Error('Flow ' + edge.id + ' routing failed: ' + error.message);
        }
        const complete = simplify([
            sourcePort.boundary,
            ...routePoints,
            targetPort.boundary,
        ]);

        for (const item of page.nodes) {
            if (item.id === source.id || item.id === target.id) continue;
            const itemRect = rectangle(item);
            for (let index = 0; index < complete.length - 1; index += 1) {
                if (intersectsRectangle(complete[index], complete[index + 1], itemRect)) {
                    throw new Error(
                        'Flow ' + edge.id + ' intersects ' + item.id + ' on ' + page.name,
                    );
                }
            }
        }

        markSegments(complete, usedSegments, usedPoints);
        routes.set(edge.id, {
            sourceAnchor: sourcePort.anchor,
            targetAnchor: targetPort.anchor,
            points: routePoints,
            complete,
        });
    }

    return routes;
}

function renderEntityNode(item) {
    const style = [
        'rounded=0',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'align=center',
        'verticalAlign=middle',
        'fillColor=#ffffff',
        'strokeColor=#111827',
        'strokeWidth=2',
        'fontColor=#111827',
        'fontFamily=Helvetica',
        'fontSize=14',
        'fontStyle=1',
        'spacing=8',
        'shadow=0',
    ].join(';') + ';';
    return [
        '        <mxCell id="' + item.id + '" value="' + labelXml(item.label) + '"',
        ' style="' + style + '" vertex="1" parent="1">',
        '          <mxGeometry x="' + item.x + '" y="' + item.y,
        '" width="' + item.width + '" height="' + item.height + '" as="geometry"/>',
        '        </mxCell>',
    ].join('');
}

function renderProcessNode(item) {
    const parts = String(item.label).split('\n');
    const processNumber = parts.shift();
    const processName = parts.join('\n');
    const headerHeight = item.headerHeight || 42;
    const isReference = item.type === 'process-ref';
    const outerStyle = [
        'rounded=0',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'align=center',
        'verticalAlign=middle',
        'fillColor=#ffffff',
        'strokeColor=#4F8FFF',
        'strokeWidth=2',
        isReference ? 'dashed=1' : 'dashed=0',
        'shadow=0',
    ].join(';') + ';';
    const headerStyle = [
        'rounded=0',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'align=center',
        'verticalAlign=middle',
        'fillColor=#dae8fc',
        'strokeColor=#4F8FFF',
        'strokeWidth=2',
        isReference ? 'dashed=1' : 'dashed=0',
        'fontColor=#111827',
        'fontFamily=Helvetica',
        'fontSize=14',
        'fontStyle=1',
        'shadow=0',
    ].join(';') + ';';
    const bodyStyle = [
        'text',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'align=center',
        'verticalAlign=middle',
        'fillColor=none',
        'strokeColor=none',
        'fontColor=#111827',
        'fontFamily=Helvetica',
        'fontSize=' + (item.type === 'context-process' ? 13 : 14),
        'fontStyle=1',
        'spacing=8',
    ].join(';') + ';';
    return [
        '        <mxCell id="' + item.id + '" value=""',
        ' style="' + outerStyle + '" vertex="1" parent="1">',
        '          <mxGeometry x="' + item.x + '" y="' + item.y,
        '" width="' + item.width + '" height="' + item.height + '" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="' + item.id + '-header" value="' + escapeXml(processNumber),
        '" style="' + headerStyle + '" vertex="1" connectable="0" parent="' + item.id + '">',
        '          <mxGeometry x="0" y="0" width="' + item.width,
        '" height="' + headerHeight + '" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="' + item.id + '-body" value="' + labelXml(processName),
        '" style="' + bodyStyle + '" vertex="1" connectable="0" parent="' + item.id + '">',
        '          <mxGeometry x="0" y="' + headerHeight + '" width="' + item.width,
        '" height="' + (item.height - headerHeight) + '" as="geometry"/>',
        '        </mxCell>',
    ].join('\n');
}

function renderStoreNode(item) {
    const parts = String(item.label).split('\n');
    const storeCode = parts.shift();
    const storeName = parts.join(' ');
    const codeWidth = 58;
    const outerStyle = [
        'rounded=0',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'fillColor=#ffffff',
        'strokeColor=#111827',
        'strokeWidth=2',
        'shadow=0',
    ].join(';') + ';';
    const textStyle = [
        'text',
        'html=0',
        'whiteSpace=wrap',
        'overflow=hidden',
        'align=center',
        'verticalAlign=middle',
        'fillColor=none',
        'strokeColor=none',
        'fontColor=#111827',
        'fontFamily=Helvetica',
        'fontSize=13',
        'fontStyle=1',
        'spacing=5',
    ].join(';') + ';';
    const dividerStyle = 'rounded=0;fillColor=#111827;strokeColor=none;';
    return [
        '        <mxCell id="' + item.id + '" value="" style="' + outerStyle,
        '" vertex="1" parent="1">',
        '          <mxGeometry x="' + item.x + '" y="' + item.y,
        '" width="' + item.width + '" height="' + item.height + '" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="' + item.id + '-code" value="' + escapeXml(storeCode),
        '" style="' + textStyle + '" vertex="1" connectable="0" parent="' + item.id + '">',
        '          <mxGeometry x="0" y="0" width="' + codeWidth,
        '" height="' + item.height + '" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="' + item.id + '-divider" value="" style="' + dividerStyle,
        '" vertex="1" connectable="0" parent="' + item.id + '">',
        '          <mxGeometry x="' + codeWidth + '" y="0" width="2" height="'
            + item.height + '" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="' + item.id + '-name" value="' + escapeXml(storeName),
        '" style="' + textStyle + '" vertex="1" connectable="0" parent="' + item.id + '">',
        '          <mxGeometry x="' + (codeWidth + 2) + '" y="0" width="'
            + (item.width - codeWidth - 2) + '" height="' + item.height + '" as="geometry"/>',
        '        </mxCell>',
    ].join('\n');
}

function renderNode(item) {
    if (item.type === 'process' || item.type === 'context-process' || item.type === 'process-ref') {
        return renderProcessNode(item);
    }
    if (item.type === 'store') return renderStoreNode(item);
    return renderEntityNode(item);
}

function renderZone(zone) {
    const style = [
        'text',
        'html=0',
        'whiteSpace=wrap',
        'align=center',
        'verticalAlign=middle',
        'fillColor=none',
        'strokeColor=none',
        'fontColor=#475569',
        'fontSize=13',
        'fontStyle=1',
    ].join(';') + ';';
    return [
        '        <mxCell id="' + zone.id + '" value="' + escapeXml(zone.label),
        '" style="' + style + '" vertex="1" parent="1">',
        '          <mxGeometry x="' + zone.x + '" y="' + zone.y,
        '" width="' + zone.width + '" height="34" as="geometry"/>',
        '        </mxCell>',
    ].join('');
}

function drawIoLabelMetrics(edge) {
    const maxCharacters = 36;
    const lines = [];
    for (const explicitLine of String(edge.label).split('\n')) {
        const words = explicitLine.trim().split(/\s+/);
        let current = '';
        for (const word of words) {
            const candidate = current ? current + ' ' + word : word;
            if (candidate.length > maxCharacters && current) {
                lines.push(current);
                current = word;
            } else {
                current = candidate;
            }
        }
        if (current) lines.push(current);
    }
    const longestLine = Math.max(...lines.map((line) => line.length));
    return {
        lines,
        width: Math.max(90, Math.min(245, longestLine * 6.2 + 18)),
        height: Math.max(24, lines.length * 14 + 8),
    };
}

function routeSegments(route, edgeId) {
    const result = [];
    for (let index = 0; index < route.complete.length - 1; index += 1) {
        const a = route.complete[index];
        const b = route.complete[index + 1];
        const horizontal = a.y === b.y;
        const length = horizontal ? Math.abs(a.x - b.x) : Math.abs(a.y - b.y);
        if (length > 0) result.push({ edgeId, a, b, horizontal, length });
    }
    return result;
}

function horizontalLabelMetrics(edge) {
    const maxCharacters = 54;
    const lines = [];
    for (const explicitLine of String(edge.label).split('\n')) {
        const words = explicitLine.trim().split(/\s+/);
        let current = '';
        for (const word of words) {
            const candidate = current ? current + ' ' + word : word;
            if (candidate.length > maxCharacters && current) {
                lines.push(current);
                current = word;
            } else {
                current = candidate;
            }
        }
        if (current) lines.push(current);
    }
    const longestLine = Math.max(...lines.map((line) => line.length));
    return {
        lines,
        width: Math.max(120, Math.min(520, longestLine * 6.4 + 26)),
        height: Math.max(26, lines.length * 15 + 10),
    };
}

function placeHorizontalLabels(page, routes) {
    const placements = new Map();
    for (const edge of page.edges) {
        const metrics = horizontalLabelMetrics(edge);
        const route = routes.get(edge.id);
        const source = route.complete[0];
        const target = route.complete[route.complete.length - 1];
        const centerX = (source.x + target.x) / 2;
        const rect = {
            x: centerX - metrics.width / 2,
            y: source.y - metrics.height - 7,
            width: metrics.width,
            height: metrics.height,
        };
        placements.set(edge.id, {
            edgeId: edge.id,
            lines: metrics.lines,
            width: metrics.width,
            height: metrics.height,
            orientation: 'horizontal',
            rotation: 0,
            rect,
            geometry: rect,
            segment: {
                edgeId: edge.id,
                a: source,
                b: target,
                horizontal: true,
                length: Math.abs(target.x - source.x),
            },
            gap: 7,
            score: 0,
        });
    }
    return placements;
}

function placeDrawIoLabels(page, routes) {
    if (page.routeStyle === 'horizontal') {
        return placeHorizontalLabels(page, routes);
    }
    const placements = new Map();
    const occupied = [];
    const nodeRects = page.nodes.map((item) => rectangle(item, 8));
    const allSegments = page.edges.flatMap((edge) => routeSegments(routes.get(edge.id), edge.id));
    const orderedEdges = [...page.edges].sort((left, right) => {
        const leftMetrics = drawIoLabelMetrics(left);
        const rightMetrics = drawIoLabelMetrics(right);
        return rightMetrics.width * rightMetrics.height - leftMetrics.width * leftMetrics.height;
    });

    for (const edge of orderedEdges) {
        const metrics = drawIoLabelMetrics(edge);
        const ownSegments = allSegments
            .filter((segment) => segment.edgeId === edge.id)
            .sort((left, right) => right.length - left.length);
        const candidates = [];

        for (const segment of ownSegments) {
            if (segment.horizontal) {
                const minimumX = Math.min(segment.a.x, segment.b.x);
                const maximumX = Math.max(segment.a.x, segment.b.x);
                const usableMinimum = minimumX + metrics.width / 2 + 8;
                const usableMaximum = maximumX - metrics.width / 2 - 8;
                const rawCenters = [
                    (minimumX + maximumX) / 2,
                    minimumX + segment.length * 0.32,
                    minimumX + segment.length * 0.68,
                    minimumX + segment.length * 0.20,
                    minimumX + segment.length * 0.80,
                    minimumX + segment.length * 0.10,
                    minimumX + segment.length * 0.90,
                ];
                for (const rawCenter of rawCenters) {
                    for (const gap of [8, 36, 64, 92, 120, 160, 200, 240, 300, 360]) {
                        const centerX = usableMinimum <= usableMaximum
                            ? Math.max(usableMinimum, Math.min(usableMaximum, rawCenter))
                            : rawCenter;
                        const rect = {
                            x: centerX - metrics.width / 2,
                            y: segment.a.y - metrics.height - gap,
                            width: metrics.width,
                            height: metrics.height,
                        };
                        candidates.push({
                            orientation: 'horizontal',
                            rotation: 0,
                            rect,
                            geometry: rect,
                            segment,
                            gap,
                            fitPenalty: Math.max(0, metrics.width + 16 - segment.length) * 500,
                        });
                    }
                }
            } else {
                const minimumY = Math.min(segment.a.y, segment.b.y);
                const maximumY = Math.max(segment.a.y, segment.b.y);
                const visualWidth = metrics.height;
                const visualHeight = metrics.width;
                const usableMinimum = minimumY + visualHeight / 2 + 8;
                const usableMaximum = maximumY - visualHeight / 2 - 8;
                const rawCenters = [
                    (minimumY + maximumY) / 2,
                    minimumY + segment.length * 0.32,
                    minimumY + segment.length * 0.68,
                ];
                for (const side of ['right', 'left']) {
                    for (const rawCenter of rawCenters) {
                        for (const gap of [9, 36, 64, 92, 120, 160, 200, 240, 300]) {
                            const centerY = usableMinimum <= usableMaximum
                                ? Math.max(usableMinimum, Math.min(usableMaximum, rawCenter))
                                : rawCenter;
                            const visualX = side === 'right'
                                ? segment.a.x + gap
                                : segment.a.x - visualWidth - gap;
                            const visualRect = {
                                x: visualX,
                                y: centerY - visualHeight / 2,
                                width: visualWidth,
                                height: visualHeight,
                            };
                            const geometryCenterX = visualRect.x + visualRect.width / 2;
                            const geometryCenterY = visualRect.y + visualRect.height / 2;
                            candidates.push({
                                orientation: 'vertical',
                                rotation: 270,
                                rect: visualRect,
                                geometry: {
                                    x: geometryCenterX - metrics.width / 2,
                                    y: geometryCenterY - metrics.height / 2,
                                    width: metrics.width,
                                    height: metrics.height,
                                },
                                segment,
                                side,
                                gap,
                                fitPenalty: Math.max(0, visualHeight + 16 - segment.length) * 500,
                            });
                        }
                    }
                }
            }
        }

        let best = null;
        for (const candidate of candidates) {
            const rect = candidate.rect;
            let score = candidate.fitPenalty - candidate.segment.length * 0.2;
            score += Math.max(0, (candidate.gap || 8) - 8) * 1.5;
            if (candidate.orientation === 'vertical') score += 180;
            if (candidate.side === 'left') score += 40;
            if (rect.x < 12) score += (12 - rect.x) * 100000;
            if (rect.y < headerBottom + 4) score += (headerBottom + 4 - rect.y) * 100000;
            if (rect.x + rect.width > page.width - 12) {
                score += (rect.x + rect.width - page.width + 12) * 100000;
            }
            if (rect.y + rect.height > page.height - 12) {
                score += (rect.y + rect.height - page.height + 12) * 100000;
            }
            for (const nodeRect of nodeRects) {
                score += intersectionArea(rect, nodeRect, 4) * 10000;
            }
            for (const priorRect of occupied) {
                score += intersectionArea(rect, priorRect, 5) * 12000;
            }
            for (const otherSegment of allSegments) {
                if (otherSegment.edgeId === edge.id) continue;
                if (intersectsRectangle(otherSegment.a, otherSegment.b, rect)) {
                    score += 1000000000;
                }
            }
            if (!best || score < best.score) {
                best = {
                    edgeId: edge.id,
                    lines: metrics.lines,
                    width: metrics.width,
                    height: metrics.height,
                    ...candidate,
                    score,
                };
            }
        }

        if (!best) throw new Error('Unable to place flow label for ' + edge.id);
        placements.set(edge.id, best);
        occupied.push(best.rect);
    }

    return placements;
}

function renderEdge(edge, route) {
    const style = [
        'edgeStyle=orthogonalEdgeStyle',
        'rounded=0',
        'orthogonalLoop=1',
        'jettySize=auto',
        'jumpStyle=arc',
        'jumpSize=11',
        'html=0',
        'strokeColor=#334155',
        'strokeWidth=1.6',
        'endArrow=block',
        'endFill=1',
        'endSize=8',
        'exitDx=0',
        'exitDy=0',
        'entryDx=0',
        'entryDy=0',
        'exitX=' + route.sourceAnchor.x.toFixed(4),
        'exitY=' + route.sourceAnchor.y.toFixed(4),
        'entryX=' + route.targetAnchor.x.toFixed(4),
        'entryY=' + route.targetAnchor.y.toFixed(4),
    ].join(';') + ';';
    const points = route.points
        .map((point) => '              <mxPoint x="' + point.x + '" y="' + point.y + '"/>')
        .join('\n');
    return [
        '        <mxCell id="' + edge.id + '" value="" style="' + style,
        '" edge="1" parent="1" source="' + edge.source + '" target="' + edge.target + '">',
        '          <mxGeometry relative="1" as="geometry">',
        '            <Array as="points">',
        points,
        '            </Array>',
        '          </mxGeometry>',
        '        </mxCell>',
    ].join('\n');
}

function attachedLabelGeometry(route, placement) {
    const center = {
        x: placement.rect.x + placement.rect.width / 2,
        y: placement.rect.y + placement.rect.height / 2,
    };
    const segments = routeSegments(route, placement.edgeId);
    const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
    let traveled = 0;
    let anchor = null;

    for (const segment of segments) {
        const sameSegment = (
            segment.a.x === placement.segment.a.x
            && segment.a.y === placement.segment.a.y
            && segment.b.x === placement.segment.b.x
            && segment.b.y === placement.segment.b.y
        );
        if (!sameSegment) {
            traveled += segment.length;
            continue;
        }
        anchor = segment.horizontal
            ? {
                x: Math.max(Math.min(segment.a.x, segment.b.x), Math.min(
                    Math.max(segment.a.x, segment.b.x),
                    center.x,
                )),
                y: segment.a.y,
            }
            : {
                x: segment.a.x,
                y: Math.max(Math.min(segment.a.y, segment.b.y), Math.min(
                    Math.max(segment.a.y, segment.b.y),
                    center.y,
                )),
            };
        traveled += segment.horizontal
            ? Math.abs(anchor.x - segment.a.x)
            : Math.abs(anchor.y - segment.a.y);
        break;
    }

    if (!anchor || totalLength === 0) {
        anchor = route.complete[Math.floor(route.complete.length / 2)];
        traveled = totalLength / 2;
    }
    return {
        relativeX: Math.max(-1, Math.min(1, traveled / totalLength * 2 - 1)),
        offsetX: center.x - anchor.x,
        offsetY: center.y - anchor.y,
    };
}

function renderFlowLabel(edge, route, placement) {
    const style = [
        'edgeLabel',
        'html=0',
        'whiteSpace=wrap',
        'overflow=visible',
        'align=center',
        'verticalAlign=middle',
        'fillColor=none',
        'strokeColor=none',
        'labelBackgroundColor=none',
        'labelBorderColor=none',
        'fontColor=#111827',
        'fontFamily=Helvetica',
        'fontSize=11',
        'fontStyle=0',
        'spacing=2',
        'rotation=' + placement.rotation,
        'resizable=0',
        'movable=1',
        'points=[]',
    ].join(';') + ';';
    const attachment = attachedLabelGeometry(route, placement);
    const geometry = placement.geometry;
    return [
        '        <mxCell id="' + edge.id + '-label" value="'
            + labelXml(placement.lines.join('\n')) + '" style="' + style,
        '" vertex="1" connectable="0" parent="' + edge.id + '">',
        '          <mxGeometry x="' + attachment.relativeX.toFixed(5) + '" y="0"',
        ' width="' + geometry.width.toFixed(1) + '" height="' + geometry.height.toFixed(1),
        '" relative="1" as="geometry">',
        '            <mxPoint x="' + attachment.offsetX.toFixed(1) + '" y="'
            + attachment.offsetY.toFixed(1) + '" as="offset"/>',
        '          </mxGeometry>',
        '        </mxCell>',
    ].join('');
}

function renderPage(page, routes) {
    const titleStyle = [
        'text',
        'html=0',
        'align=left',
        'verticalAlign=middle',
        'fontColor=#0f172a',
        'fontSize=25',
        'fontStyle=1',
        'strokeColor=none',
        'fillColor=none',
    ].join(';') + ';';
    const subtitleStyle = [
        'text',
        'html=0',
        'align=left',
        'verticalAlign=middle',
        'fontColor=#475569',
        'fontSize=12',
        'strokeColor=none',
        'fillColor=none',
    ].join(';') + ';';
    const noteStyle = [
        'rounded=1',
        'arcSize=8',
        'html=0',
        'whiteSpace=wrap',
        'align=center',
        'verticalAlign=middle',
        'fillColor=#f8fafc',
        'strokeColor=#cbd5e1',
        'fontColor=#334155',
        'fontSize=12',
        'fontStyle=1',
        'spacing=8',
    ].join(';') + ';';
    const legendStyle = [
        'rounded=1',
        'arcSize=8',
        'html=0',
        'whiteSpace=wrap',
        'align=left',
        'verticalAlign=middle',
        'fillColor=#ffffff',
        'strokeColor=#cbd5e1',
        'fontColor=#334155',
        'fontSize=11',
        'spacing=8',
    ].join(';') + ';';
    const zonesXml = (page.zones || []).map(renderZone).join('\n');
    const nodesXml = page.nodes.map(renderNode).join('\n');
    const labelPlacements = placeDrawIoLabels(page, routes);
    const edgesXml = page.edges
        .map((edge) => renderEdge(edge, routes.get(edge.id)))
        .join('\n');
    const labelsXml = page.edges
        .map((edge) => renderFlowLabel(
            edge,
            routes.get(edge.id),
            labelPlacements.get(edge.id),
        ))
        .join('\n');
    const noteWidth = page.id === 'ipawcus-context' ? 900 : 810;
    const noteX = page.width - noteWidth - 30;
    const legend = page.legend || (page.id === 'ipawcus-context'
        ? 'Plain box = external role    Blue table = Process 0    Each arrow = one distinct data flow'
        : 'Plain box = external role    Blue table = process    Split row = data store    Flow labels sit above or beside their route');

    return [
        '  <diagram id="' + page.id + '" name="' + escapeXml(page.name) + '">',
        '    <mxGraphModel dx="1500" dy="900" grid="1" gridSize="10" guides="1"',
        ' tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1"',
        ' pageWidth="' + page.width + '" pageHeight="' + page.height,
        '" math="0" shadow="0" background="#ffffff">',
        '      <root>',
        '        <mxCell id="0"/>',
        '        <mxCell id="1" parent="0"/>',
        '        <mxCell id="page-title" value="' + escapeXml(page.title),
        '" style="' + titleStyle + '" vertex="1" parent="1">',
        '          <mxGeometry x="30" y="16" width="1000" height="34" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="page-subtitle" value="' + escapeXml(page.subtitle),
        '" style="' + subtitleStyle + '" vertex="1" parent="1">',
        '          <mxGeometry x="30" y="54" width="1350" height="24" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="direction-note" value="' + escapeXml(page.directionNote),
        '" style="' + noteStyle + '" vertex="1" parent="1">',
        '          <mxGeometry x="' + noteX + '" y="18" width="' + noteWidth,
        '" height="42" as="geometry"/>',
        '        </mxCell>',
        '        <mxCell id="page-legend" value="' + escapeXml(legend),
        '" style="' + legendStyle + '" vertex="1" parent="1">',
        '          <mxGeometry x="' + (page.width - 930) + '" y="70" width="900" height="40" as="geometry"/>',
        '        </mxCell>',
        zonesXml,
        edgesXml,
        nodesXml,
        labelsXml,
        '      </root>',
        '    </mxGraphModel>',
        '  </diagram>',
    ].filter(Boolean).join('\n');
}

function svgText(lines, x, centerY, fontSize, weight, color, anchor = 'middle') {
    const normalizedLines = Array.isArray(lines) ? lines : String(lines).split('\n');
    const lineHeight = fontSize * 1.3;
    const firstY = centerY - (normalizedLines.length - 1) * lineHeight / 2;
    const tspans = normalizedLines.map((line, index) => [
        '<tspan x="' + x + '" y="' + (firstY + index * lineHeight).toFixed(1) + '">',
        escapeXml(line),
        '</tspan>',
    ].join('')).join('');
    return [
        '<text x="' + x + '" y="' + centerY + '" text-anchor="' + anchor + '"',
        ' dominant-baseline="middle" font-family="Inter, Arial, sans-serif"',
        ' font-size="' + fontSize + '" font-weight="' + weight + '" fill="' + color + '">',
        tspans,
        '</text>',
    ].join('');
}

function wrapSvgLines(label, maxCharacters) {
    const result = [];
    for (const explicitLine of String(label).split('\n')) {
        const words = explicitLine.trim().split(/\s+/);
        let current = '';
        for (const word of words) {
            const candidate = current ? current + ' ' + word : word;
            if (candidate.length > maxCharacters && current) {
                result.push(current);
                current = word;
            } else {
                current = candidate;
            }
        }
        if (current) result.push(current);
    }
    return result.length > 0 ? result : [''];
}

function pointAlongPolyline(points, fraction) {
    const lengths = [];
    let totalLength = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
        const length = Math.abs(points[index + 1].x - points[index].x)
            + Math.abs(points[index + 1].y - points[index].y);
        lengths.push(length);
        totalLength += length;
    }
    const targetLength = totalLength * Math.max(0, Math.min(1, fraction));
    let traversed = 0;
    for (let index = 0; index < lengths.length; index += 1) {
        if (traversed + lengths[index] >= targetLength) {
            const segmentFraction = lengths[index] === 0
                ? 0
                : (targetLength - traversed) / lengths[index];
            return {
                x: points[index].x
                    + (points[index + 1].x - points[index].x) * segmentFraction,
                y: points[index].y
                    + (points[index + 1].y - points[index].y) * segmentFraction,
            };
        }
        traversed += lengths[index];
    }
    return points[points.length - 1];
}

function intersectionArea(left, right, padding = 0) {
    const overlapWidth = Math.max(
        0,
        Math.min(left.x + left.width, right.x + right.width + padding)
            - Math.max(left.x, right.x - padding),
    );
    const overlapHeight = Math.max(
        0,
        Math.min(left.y + left.height, right.y + right.height + padding)
            - Math.max(left.y, right.y - padding),
    );
    return overlapWidth * overlapHeight;
}

function placeSvgLabels(page, routes) {
    const placements = new Map();
    const occupied = [];
    const nodeRects = page.nodes.map((item) => rectangle(item, 12));
    const connectorSegments = [];
    for (const routeEdge of page.edges) {
        const points = routes.get(routeEdge.id).complete;
        for (let index = 0; index < points.length - 1; index += 1) {
            connectorSegments.push({
                edgeId: routeEdge.id,
                a: points[index],
                b: points[index + 1],
            });
        }
    }
    const fractions = [0.29, 0.20, 0.38, 0.50, 0.62, 0.76, 0.86, 0.12];
    const deltaXs = [0, -70, 70, -140, 140];
    const deltaYs = [0, -48, 48, -84, 84, -122, 122];

    for (let edgeIndex = 0; edgeIndex < page.edges.length; edgeIndex += 1) {
        const edge = page.edges[edgeIndex];
        const route = routes.get(edge.id);
        const requestedWidth = edge.labelWidth || 250;
        const maxCharacters = Math.max(22, Math.floor((requestedWidth - 24) / 6.1));
        const lines = wrapSvgLines(edge.label, maxCharacters);
        const width = requestedWidth;
        const height = Math.max(edge.labelHeight || 56, lines.length * 14 + 18);
        const preferredFraction = ((edge.labelRelativeX ?? -0.42) + 1) / 2;
        const baseOffsetX = edge.labelOffsetX || 0;
        const baseOffsetY = edge.labelOffsetY ?? (edgeIndex % 2 === 0 ? -20 : 20);
        const candidateFractions = [
            preferredFraction,
            ...fractions.filter((value) => Math.abs(value - preferredFraction) > 0.03),
        ];
        let best = null;

        for (const fraction of candidateFractions) {
            const anchor = pointAlongPolyline(route.complete, fraction);
            for (const deltaX of deltaXs) {
                for (const deltaY of deltaYs) {
                    const centerX = anchor.x + baseOffsetX + deltaX;
                    const centerY = anchor.y + baseOffsetY + deltaY;
                    const rect = {
                        x: centerX - width / 2,
                        y: centerY - height / 2,
                        width,
                        height,
                    };
                    let overlap = 0;
                    for (const nodeRect of nodeRects) {
                        overlap += intersectionArea(rect, nodeRect, 6);
                    }
                    for (const prior of occupied) {
                        overlap += intersectionArea(rect, prior, 8) * 1.6;
                    }
                    let connectorPenalty = 0;
                    for (const segment of connectorSegments) {
                        if (segment.edgeId === edge.id) continue;
                        if (intersectsRectangle(segment.a, segment.b, rect)) {
                            connectorPenalty += 4500;
                        }
                    }
                    let boundaryPenalty = 0;
                    if (rect.x < 18) boundaryPenalty += (18 - rect.x) * 10000;
                    if (rect.y < headerBottom + 5) {
                        boundaryPenalty += (headerBottom + 5 - rect.y) * 10000;
                    }
                    if (rect.x + rect.width > page.width - 18) {
                        boundaryPenalty += (rect.x + rect.width - page.width + 18) * 10000;
                    }
                    if (rect.y + rect.height > page.height - 18) {
                        boundaryPenalty += (rect.y + rect.height - page.height + 18) * 10000;
                    }
                    const movementPenalty = Math.abs(fraction - preferredFraction) * 850
                        + Math.abs(deltaX) * 0.8
                        + Math.abs(deltaY) * 0.7;
                    const score = overlap * 100
                        + connectorPenalty
                        + boundaryPenalty
                        + movementPenalty;
                    if (!best || score < best.score) {
                        best = {
                            edgeId: edge.id,
                            x: rect.x,
                            y: rect.y,
                            width,
                            height,
                            centerX,
                            centerY,
                            lines,
                            score,
                            overlap,
                        };
                    }
                }
            }
        }

        placements.set(edge.id, best);
        occupied.push({
            x: best.x,
            y: best.y,
            width: best.width,
            height: best.height,
        });
    }

    return placements;
}

function validateSvgLabelLayout(page, routes) {
    const placements = placeSvgLabels(page, routes);
    const problems = [];
    const placementList = page.edges.map((edge) => placements.get(edge.id));

    for (const placement of placementList) {
        for (const item of page.nodes) {
            if (intersectionArea(placement, rectangle(item), 2) > 0) {
                problems.push(
                    'Flow label ' + placement.edgeId + ' overlaps node ' + item.id,
                );
            }
        }
        if (
            placement.x < 0
            || placement.y < headerBottom
            || placement.x + placement.width > page.width
            || placement.y + placement.height > page.height
        ) {
            problems.push('Flow label ' + placement.edgeId + ' is outside the usable canvas');
        }
    }

    for (let leftIndex = 0; leftIndex < placementList.length; leftIndex += 1) {
        for (
            let rightIndex = leftIndex + 1;
            rightIndex < placementList.length;
            rightIndex += 1
        ) {
            if (intersectionArea(placementList[leftIndex], placementList[rightIndex], 2) > 0) {
                problems.push(
                    'Flow labels overlap: '
                        + placementList[leftIndex].edgeId
                        + ' / '
                        + placementList[rightIndex].edgeId,
                );
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(page.name + ' SVG label validation failed:\n- ' + problems.join('\n- '));
    }
}

function svgPathData(points) {
    return points.map((point, index) => (
        (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y
    )).join(' ');
}

function renderSvgZone(zone) {
    return [
        '<g id="' + escapeXml(zone.id) + '">',
        '<rect x="' + zone.x + '" y="' + zone.y + '" width="' + zone.width,
        '" height="' + zone.height + '" rx="12" fill="#ffffff" fill-opacity="0"',
        ' stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="8 8"/>',
        svgText(zone.label, zone.x + zone.width / 2, zone.y + 27, 13, 700, '#475569'),
        '</g>',
    ].join('');
}

function renderSvgNode(item) {
    let shape;
    if (item.type === 'context-process') {
        shape = [
            '<ellipse cx="' + (item.x + item.width / 2) + '" cy="' + (item.y + item.height / 2),
            '" rx="' + item.width / 2 + '" ry="' + item.height / 2,
            '" fill="#eff6ff" stroke="#1d4ed8" stroke-width="2.5"/>',
        ].join('');
    } else if (item.type === 'process') {
        shape = [
            '<rect x="' + item.x + '" y="' + item.y + '" width="' + item.width,
            '" height="' + item.height + '" rx="46" fill="#eff6ff"',
            ' stroke="#2563eb" stroke-width="2.5"/>',
        ].join('');
    } else if (item.type === 'store') {
        shape = [
            '<rect x="' + item.x + '" y="' + item.y + '" width="' + item.width,
            '" height="' + item.height + '" fill="#f0fdf4"/>',
            '<path d="M ' + item.x + ' ' + item.y + ' H ' + (item.x + item.width),
            ' M ' + item.x + ' ' + (item.y + item.height) + ' H ' + (item.x + item.width),
            ' M ' + (item.x + 18) + ' ' + item.y + ' V ' + (item.y + item.height),
            '" fill="none" stroke="#15803d" stroke-width="2.5"/>',
        ].join('');
    } else {
        shape = [
            '<rect x="' + item.x + '" y="' + item.y + '" width="' + item.width,
            '" height="' + item.height + '" rx="5" fill="#ffffff"',
            ' stroke="#374151" stroke-width="2.5"/>',
        ].join('');
    }
    const fontSize = item.type === 'context-process' ? 18 : item.type === 'process' ? 16 : 14;
    return [
        '<g id="' + escapeXml(item.id) + '">',
        shape,
        svgText(item.label, item.x + item.width / 2, item.y + item.height / 2, fontSize, 700, '#111827'),
        '</g>',
    ].join('');
}

function renderSvgConnector(edge, route, markerId) {
    const pathData = svgPathData(route.complete);
    return [
        '<g id="' + escapeXml(edge.id) + '-connector">',
        '<path d="' + pathData + '" fill="none" stroke="#ffffff" stroke-width="8"',
        ' stroke-linecap="round" stroke-linejoin="round"/>',
        '<path d="' + pathData + '" fill="none" stroke="#334155" stroke-width="1.8"',
        ' stroke-linecap="round" stroke-linejoin="round" marker-end="url(#' + markerId + ')"/>',
        '</g>',
    ].join('');
}

function renderSvgFlowLabel(edge, placement) {
    return [
        '<g id="' + escapeXml(edge.id) + '-label">',
        svgText(
            placement.lines,
            placement.centerX.toFixed(1),
            placement.centerY.toFixed(1),
            11,
            400,
            '#0f172a',
        ),
        '</g>',
    ].join('');
}

function svgMarker(markerId) {
    return [
        '<marker id="' + markerId + '" markerWidth="10" markerHeight="10"',
        ' refX="8.5" refY="5" orient="auto" markerUnits="strokeWidth">',
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/>',
        '</marker>',
    ].join('');
}

function renderSvgPageContent(page, routes, markerId) {
    const placements = placeSvgLabels(page, routes);
    const noteWidth = page.id === 'ipawcus-context' ? 650 : 810;
    const noteX = page.width - noteWidth - 30;
    const legend = page.id === 'ipawcus-context'
        ? 'Rectangle = external entity    Oval = Process 0    Arrow label = data crossing the system boundary'
        : 'Rectangle = external entity    Rounded box = process    Open-ended box = logical data store    Arrow label = data moved';
    return [
        '<rect x="0" y="0" width="' + page.width + '" height="' + page.height + '" fill="#ffffff"/>',
        svgText(page.title, 30, 38, 25, 750, '#0f172a', 'start'),
        svgText(page.subtitle, 30, 68, 12, 400, '#475569', 'start'),
        '<rect x="' + noteX + '" y="18" width="' + noteWidth + '" height="42"',
        ' rx="7" fill="#f8fafc" stroke="#cbd5e1"/>',
        svgText(page.directionNote, noteX + noteWidth / 2, 39, 12, 700, '#334155'),
        '<rect x="' + (page.width - 930) + '" y="70" width="900" height="40"',
        ' rx="7" fill="#ffffff" stroke="#cbd5e1"/>',
        svgText(legend, page.width - 915, 90, 11, 400, '#334155', 'start'),
        (page.zones || []).map(renderSvgZone).join(''),
        page.edges.map((edge) => renderSvgConnector(edge, routes.get(edge.id), markerId)).join(''),
        page.nodes.map(renderSvgNode).join(''),
        page.edges.map((edge) => renderSvgFlowLabel(edge, placements.get(edge.id))).join(''),
    ].join('');
}

function renderSvgDocument(page, routes) {
    const markerId = page.id + '-arrow';
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + page.width,
        '" height="' + page.height + '" viewBox="0 0 ' + page.width + ' ' + page.height,
        '" role="img" aria-labelledby="' + page.id + '-title">',
        '<title id="' + page.id + '-title">' + escapeXml(page.title) + '</title>',
        '<desc>FigJam-importable IPAWCUS data-flow diagram with editable vector shapes and text.</desc>',
        '<defs>' + svgMarker(markerId) + '</defs>',
        '<g id="' + page.id + '-board">',
        renderSvgPageContent(page, routes, markerId),
        '</g>',
        '</svg>',
        '',
    ].join('\n');
}

function renderCombinedFigJamBoard(routeCache) {
    const gap = 120;
    const outerMargin = 60;
    const headerHeight = 110;
    const boardWidth = outerMargin * 2 + activeContextPage.width + gap + levelOnePage.width;
    const boardHeight = headerHeight + Math.max(activeContextPage.height, levelOnePage.height) + outerMargin;
    const contextX = outerMargin;
    const contextY = headerHeight + (Math.max(levelOnePage.height, activeContextPage.height) - activeContextPage.height) / 2;
    const levelX = contextX + activeContextPage.width + gap;
    const levelY = headerHeight;
    const contextMarker = 'combined-context-arrow';
    const levelMarker = 'combined-level-arrow';

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + boardWidth,
        '" height="' + boardHeight + '" viewBox="0 0 ' + boardWidth + ' ' + boardHeight,
        '" role="img" aria-labelledby="figjam-board-title">',
        '<title id="figjam-board-title">IPAWCUS Data Flow — FigJam Board</title>',
        '<desc>Combined context and Level 1 data-flow diagrams, arranged as two FigJam-ready frames.</desc>',
        '<defs>' + svgMarker(contextMarker) + svgMarker(levelMarker) + '</defs>',
        '<rect x="0" y="0" width="' + boardWidth + '" height="' + boardHeight + '" fill="#e2e8f0"/>',
        svgText('IPAWCUS DATA FLOW — FIGJAM BOARD', outerMargin, 45, 28, 800, '#0f172a', 'start'),
        svgText(
            'Import this SVG into FigJam, then ungroup it to edit individual vector elements.',
            outerMargin,
            78,
            13,
            400,
            '#475569',
            'start',
        ),
        '<g id="context-frame" transform="translate(' + contextX + ' ' + contextY + ')">',
        '<rect x="-8" y="-8" width="' + (activeContextPage.width + 16) + '" height="'
            + (activeContextPage.height + 16) + '" rx="16" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>',
        renderSvgPageContent(
            activeContextPage,
            routeCache.get(activeContextPage.id),
            contextMarker,
        ),
        '</g>',
        '<g id="level-one-frame" transform="translate(' + levelX + ' ' + levelY + ')">',
        '<rect x="-8" y="-8" width="' + (levelOnePage.width + 16) + '" height="'
            + (levelOnePage.height + 16) + '" rx="16" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>',
        renderSvgPageContent(
            levelOnePage,
            routeCache.get(levelOnePage.id),
            levelMarker,
        ),
        '</g>',
        '</svg>',
        '',
    ].join('\n');
}

function validatePage(page, routes) {
    const problems = [];
    for (const item of page.nodes) {
        if (
            item.x < 0
            || item.y < headerBottom
            || item.x + item.width > page.width
            || item.y + item.height > page.height
        ) {
            problems.push('Node is outside the usable page: ' + item.id);
        }
    }
    for (let leftIndex = 0; leftIndex < page.nodes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < page.nodes.length; rightIndex += 1) {
            const left = page.nodes[leftIndex];
            const right = page.nodes[rightIndex];
            if (rectanglesOverlap(left, right, 24)) {
                problems.push('Nodes too close or overlapping: ' + left.id + ' / ' + right.id);
            }
        }
    }

    const segmentOwners = new Map();
    for (const edge of page.edges) {
        const complete = routes.get(edge.id).complete;
        for (let index = 0; index < complete.length - 1; index += 1) {
            const a = complete[index];
            const b = complete[index + 1];
            const steps = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / grid;
            for (let step = 0; step < steps; step += 1) {
                const from = {
                    x: a.x + Math.sign(b.x - a.x) * grid * step,
                    y: a.y + Math.sign(b.y - a.y) * grid * step,
                };
                const to = {
                    x: a.x + Math.sign(b.x - a.x) * grid * (step + 1),
                    y: a.y + Math.sign(b.y - a.y) * grid * (step + 1),
                };
                const key = segmentKey(from, to);
                if (segmentOwners.has(key) && segmentOwners.get(key) !== edge.id) {
                    problems.push(
                        'Shared connector segment ' + key + ': '
                            + segmentOwners.get(key) + ' / ' + edge.id,
                    );
                }
                segmentOwners.set(key, edge.id);
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(page.name + ' validation failed:\n- ' + problems.join('\n- '));
    }
}

function validateDrawIoLabelLayout(page, routes) {
    const placements = placeDrawIoLabels(page, routes);
    const problems = [];
    const placementList = page.edges.map((edge) => placements.get(edge.id));
    const allSegments = page.edges.flatMap((edge) => routeSegments(routes.get(edge.id), edge.id));

    for (const placement of placementList) {
        if (
            placement.rect.x < 0
            || placement.rect.y < headerBottom
            || placement.rect.x + placement.rect.width > page.width
            || placement.rect.y + placement.rect.height > page.height
        ) {
            problems.push('Flow label is outside the usable page: ' + placement.edgeId);
        }
        for (const item of page.nodes) {
            if (intersectionArea(placement.rect, rectangle(item), 1) > 0) {
                problems.push(
                    'Flow label ' + placement.edgeId + ' overlaps node ' + item.id,
                );
            }
        }
        for (const segment of allSegments) {
            if (segment.edgeId === placement.edgeId) continue;
            if (intersectsRectangle(segment.a, segment.b, placement.rect)) {
                problems.push(
                    'Connector ' + segment.edgeId + ' crosses flow label ' + placement.edgeId,
                );
            }
        }
    }

    for (let leftIndex = 0; leftIndex < placementList.length; leftIndex += 1) {
        for (
            let rightIndex = leftIndex + 1;
            rightIndex < placementList.length;
            rightIndex += 1
        ) {
            if (
                intersectionArea(
                    placementList[leftIndex].rect,
                    placementList[rightIndex].rect,
                    1,
                ) > 0
            ) {
                problems.push(
                    'Flow labels overlap: '
                        + placementList[leftIndex].edgeId
                        + ' / '
                        + placementList[rightIndex].edgeId,
                );
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(page.name + ' Draw.io label validation failed:\n- ' + problems.join('\n- '));
    }
}

function logicalRole(item) {
    if (item.logicalRole) return item.logicalRole;
    for (const role of ['super', 'admin', 'vet', 'owner']) {
        if (item.id.includes(role)) return role;
    }
    return null;
}

function addCount(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

function boundaryCounts(page, endpointType) {
    const nodesById = new Map(page.nodes.map((item) => [item.id, item]));
    const counts = new Map();
    for (const edge of page.edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (endpointType === 'entity') {
            const entity = source.type === 'entity' ? source : target.type === 'entity' ? target : null;
            if (!entity) continue;
            const direction = source === entity ? 'in' : 'out';
            addCount(counts, [logicalRole(entity), direction, edge.label].join('|'));
        } else {
            const store = source.type === 'store' ? source : target.type === 'store' ? target : null;
            if (!store) continue;
            const direction = source === store ? 'in' : 'out';
            addCount(counts, [store.logicalStore, direction, edge.label].join('|'));
        }
    }
    return counts;
}

function assertCountsContained(expected, actual, message) {
    const missing = [];
    for (const [key, count] of expected) {
        if ((actual.get(key) || 0) < count) missing.push(key);
    }
    if (missing.length > 0) {
        throw new Error(message + ':\n- ' + missing.join('\n- '));
    }
}

function validateDfdSemantics(page) {
    const nodesById = new Map(page.nodes.map((item) => [item.id, item]));
    const incoming = new Map();
    const outgoing = new Map();
    const problems = [];
    for (const edge of page.edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (source.type !== 'process' && target.type !== 'process'
            && source.type !== 'context-process' && target.type !== 'context-process') {
            problems.push('Flow has no process endpoint: ' + edge.id);
        }
        if (/^(after|before|then|triggered|when)\b/i.test(edge.label.trim())) {
            problems.push('Control/timing label used as data: ' + edge.label);
        }
        outgoing.set(source.id, (outgoing.get(source.id) || 0) + 1);
        incoming.set(target.id, (incoming.get(target.id) || 0) + 1);
    }
    for (const item of page.nodes) {
        if (item.type !== 'process' && item.type !== 'context-process') continue;
        if (!incoming.get(item.id)) problems.push('Process has no input: ' + item.id);
        if (!outgoing.get(item.id)) problems.push('Process has no output: ' + item.id);
    }
    if (page.kind === 'level2') {
        const prefix = String(Number.parseInt(page.parentProcess, 10)) + '.';
        for (const item of page.nodes.filter((candidate) => candidate.type === 'process')) {
            const number = String(item.label).split('\n')[0];
            if (!number.startsWith(prefix)) {
                problems.push('Subprocess number ' + number + ' does not belong to ' + page.parentProcess);
            }
        }
    }
    if (problems.length > 0) {
        throw new Error(page.name + ' semantic validation failed:\n- ' + problems.join('\n- '));
    }
}

function validateHorizontalFlowLayout(page, routes) {
    if (page.routeStyle !== 'horizontal') return;
    const problems = [];
    const nodesById = new Map(page.nodes.map((item) => [item.id, item]));
    const groups = new Map();
    const placements = placeHorizontalLabels(page, routes);

    for (const edge of page.edges) {
        const route = routes.get(edge.id);
        const start = route.complete[0];
        const end = route.complete[route.complete.length - 1];
        if (route.complete.length !== 2 || start.y !== end.y) {
            problems.push('Flow is not one straight horizontal arrow: ' + edge.id);
        }
        if (Math.abs(end.x - start.x) < 700) {
            problems.push('Flow has insufficient landing space: ' + edge.id);
        }
        const placement = placements.get(edge.id);
        const labelBottom = placement.rect.y + placement.rect.height;
        if (Math.abs(start.y - labelBottom - 7) > 0.1) {
            problems.push('Flow label is not directly above its arrow: ' + edge.id);
        }
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const process = source.type === 'process' || source.type === 'context-process'
            ? source
            : target;
        const key = process.id + ':' + edge.corridor;
        if (!groups.has(key)) groups.set(key, { input: [], output: [] });
        groups.get(key)[edge.flowDirection].push(edge.laneY);
    }

    for (const [key, lanes] of groups) {
        if (lanes.input.length === 0 || lanes.output.length === 0) continue;
        if (Math.max(...lanes.input) >= Math.min(...lanes.output)) {
            problems.push('Inputs and outputs are not grouped on ' + key);
        }
    }

    if (problems.length > 0) {
        throw new Error(page.name + ' horizontal-flow validation failed:\n- ' + problems.join('\n- '));
    }
}

assertCountsContained(
    boundaryCounts(activeContextPage, 'entity'),
    boundaryCounts(activeLevelOnePage, 'entity'),
    'Level 1 is not balanced with the Context Diagram',
);

for (const detailPage of correctedPages.levelTwoPages) {
    const parentNumber = detailPage.parentProcess;
    const parent = activeLevelOnePage.nodes.find(
        (item) => item.type === 'process'
            && String(item.label).split('\n')[0] === parentNumber,
    );
    const parentEdges = activeLevelOnePage.edges.filter(
        (edge) => edge.source === parent.id || edge.target === parent.id,
    );
    const parentPage = {
        nodes: activeLevelOnePage.nodes,
        edges: parentEdges,
    };
    assertCountsContained(
        boundaryCounts(parentPage, 'entity'),
        boundaryCounts(detailPage, 'entity'),
        'Level 2 ' + parentNumber + ' is missing an external boundary flow',
    );
    assertCountsContained(
        boundaryCounts(parentPage, 'store'),
        boundaryCounts(detailPage, 'store'),
        'Level 2 ' + parentNumber + ' is missing a data-store boundary flow',
    );
}

const routeCache = new Map();
for (const page of pages) {
    validateDfdSemantics(page);
    const routes = createRoutes(page);
    validateHorizontalFlowLayout(page, routes);
    validatePage(page, routes);
    validateDrawIoLabelLayout(page, routes);
    routeCache.set(page.id, routes);
}

if (process.env.IPAWCUS_DFD_PREVIEWS === '1') {
    const previewDirectory = path.join(
        repositoryRoot,
        'docs',
        professionalMode ? 'dfd-preview-professional' : 'dfd-preview',
    );
    fs.mkdirSync(previewDirectory, { recursive: true });
    for (const page of pages) {
        fs.writeFileSync(
            path.join(previewDirectory, `${page.id}.svg`),
            renderSvgDocument(page, routeCache.get(page.id)),
            'utf8',
        );
    }
}

const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="app.diagrams.net" modified="2026-08-16T00:00:00.000Z"',
    ' agent="Codex" version="24.7.17" type="device" compressed="false">',
    pages.map((page) => renderPage(page, routeCache.get(page.id))).join('\n'),
    '</mxfile>',
    '',
].join('\n');

const serializationProblems = [];
for (const page of pages) {
    for (const edge of page.edges) {
        const labelMarker = `id="${edge.id}-label"`;
        const occurrences = xml.split(labelMarker).length - 1;
        if (occurrences !== 1) {
            serializationProblems.push(`${edge.id}: expected one edge label, found ${occurrences}`);
            continue;
        }
        const start = xml.indexOf(labelMarker);
        const end = xml.indexOf('>', start);
        const tag = xml.slice(start, end + 1);
        for (const requirement of [
            'style="edgeLabel;',
            `parent="${edge.id}"`,
            'fillColor=none',
            'labelBackgroundColor=none',
            'labelBorderColor=none',
        ]) {
            if (!tag.includes(requirement)) {
                serializationProblems.push(`${edge.id}: missing ${requirement}`);
            }
        }
    }
}
if (serializationProblems.length > 0) {
    throw new Error(`Serialized edge-label validation failed:\n- ${serializationProblems.join('\n- ')}`);
}

fs.writeFileSync(outputPath, xml, 'utf8');
console.log('Generated ' + outputPath);
console.log(
    'Pages: ' + pages.length
    + '; nodes: ' + pages.reduce((sum, page) => sum + page.nodes.length, 0)
    + '; data flows: ' + pages.reduce((sum, page) => sum + page.edges.length, 0),
);
