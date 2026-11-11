# Error isolation implementation

Implemented locally on 2026-10-16. No database migration or new runtime dependency is required.

## Recovery behavior

Rendering failures are contained by the nearest `ErrorBoundary`. Application/provider failures have a minimal reload fallback. Public pages and dashboard routes have page boundaries; dashboard navigation remains outside the page boundary. Section boundaries protect public content, operational panels, reports, and clinical screens. Shared cards, tables, dialogs, sheets, and document previews also have boundaries. Report charts, metrics, and tables protect their own computations so one widget can fail independently.

`Retry display` remounts only the affected subtree. It preserves sibling state, including drafts in independent sections. State inside a crashed subtree may be lost when it is remounted. A reload action remains available for rejected lazy imports or stale assets that a component remount cannot repair. Initial JavaScript/module loading failures have a fallback in `index.html`, before React starts.

Expected request failures use local error states. `useSectionResource` and `createSectionResource` track initial loading, refreshing, valid data, errors, stale data, last success, cancellation, and retry. Concurrent refreshes share a request; obsolete results cannot publish after disposal or scope changes. Successful recovery clears errors. Access and missing-record failures clear protected data; access, validation, conflict, and missing-record failures stop automatic polling until recovery is requested or the scope changes. Transient failures use the existing auto-refresh backoff.

Resource ownership is keyed by pet, user, branch, or calendar selection as applicable. Dashboard screens remount when their route path or account identity changes. Query-only changes preserve screen state. Debug bypass declarations in Dashboard and dashboardRouter were preserved.

## Request scopes changed

| Area | Implemented behavior |
| --- | --- |
| Landing/dashboard availability | A failed calendar has an icon and `Retry availability`; static content remains. Invalid responses are failures rather than empty availability. Failed clinic discovery is described as unavailable. |
| Booking and queue management | Tables have local loading/error/retry states. Failed background refreshes hide actionable worklists until fresh data is available. Open status/assignment actions check the resource error before submitting. |
| Pet Intake | Bookings and queues remain one required dependency group because matching prevents duplicate examinations. A failed dependency hides the worklist, marks counts unavailable, and blocks examination/consent/assignment saves. Existing editor drafts remain mounted during request failures. |
| Veterinarian My List | Queue and booking failures remain independent. Successful background recovery clears errors; failed refreshes participate in backoff. Failed patient lists cannot offer diagnosis/reopen actions. Consent template errors have a local retry and block dependent signing. |
| Pet information | Identity has local recovery; booking and queue activity use separate resources. A failed source is not shown as “no records.” Consent activity and certificate discovery have local errors/retry. Floating actions and issued-medical-certificate visibility rules remain. |
| Inventory items | Item and location requests load independently. Branch changes cancel obsolete results. Failed locations do not suppress loaded products, but stock changes require both resources to be verified. Failed item counts are unavailable rather than zero. |
| Dashboard Home | Sources publish independently as they settle; failed refreshes do not replace previously loaded sources with empty arrays. Partial worklists include a recovery notice. |
| React status display | Feed errors have local retry, stale status is identified, and initial failure does not show zero counts or empty queues. Branch changes use separate resource lifetimes. |
| Standalone status display | Feed timeout, payload checks, retry, backoff, stale/unknown labels, and initial-failure hiding are handled without React. |

Other screens inherit page/section/shared-component render isolation and retain their existing request, permission, validation, and transaction handling. That is distinct from migrating every loader to the resource hook. The [route inventory](../proposals/error-isolation-route-inventory.csv) records this distinction.

## API and service health

An individual endpoint failure schedules a coordinated health probe; it cannot replace the whole application. The coordinator shares one in-flight probe, debounces failure signals for 500 ms, and schedules confirmation after two seconds. Two failed probes confirm an outage. The notice checks for recovery every 15 seconds and allows a manual check. Only a valid successful health response clears the notice; unrelated feature responses cannot clear an outage.

Successful API responses must contain readable JSON, except intentional HTTP 204 responses. Booking, queue, activity, availability, inventory, and status resources validate their expected collection/container shapes. Existing authentication redirects, request deduplication, and timeouts remain. Writes are never automatically retried. A connection failure, timeout, or unreadable write response reports an uncertain result and asks the user to refresh the record before another attempt.

PWA installation/service-worker initialization failures are handled separately from application rendering. Existing media placeholders and protected-document error handling remain in use. No external telemetry or delivery was introduced.

## Verification

- Node regressions: 114 tests passed, including 21 new policy, resource, API, and health tests. These cover independent resources, stale data/recovery, protected-data clearing, malformed payloads, concurrent reads, cancellation, obsolete responses, StrictMode reactivation, uncertain writes, and outage confirmation/recovery.
- Browser fault injection: 51 checks passed for availability, confirmed outage/recovery, booking and queue recovery, inventory items surviving a failed location request, floating pet actions, and render retry preserving an unsaved sibling draft. No unexpected page exceptions were observed.
- Additional browser checks: fallback text and button contrast measured at least 4.5:1 across all nine theme options, including the legacy Dark alias. Layout checks covered 320, 390, 768, 820, 1920, 2560, and 3840 px widths. Startup-module failure and standalone feed recovery were checked separately.
- Build, ESLint, PHP syntax, database-free regressions, and local API routing use the existing project audit command. Current logs are in ignored `tmp/project-audit/`; targeted browser artifacts are in ignored `tmp/error-isolation-plan/`.

Browser checks used synthetic intercepted responses. They do not certify every role-specific transaction or real Google/OTP/video/mail/payment-provider outage. The broader fault matrix in the original plan remains a verification checklist. Existing PHP business rules and database schema were not changed. No production writes, deployment, or real outbound messages were performed.

## Adding a new independent section

Use `useSectionResource` for an independent GET, with a stable key containing its user/entity/filter scope. Pass the supplied abort signal into the service. Validate required response shapes before treating the response as data. Render with `ResourceSection`, or use `SectionErrorState` where the existing layout needs a custom presentation. Keep a boundary around the component that performs its calculations; wrapping only a leaf does not catch calculations made in its parent.

Group required dependencies when partial results could compromise identity, permission, clinical consent, appointment matching, stock, or payment consistency. Keep mutations inside explicit handlers with existing validation and duplicate protections. An error boundary does not catch asynchronous request failures or event-handler errors automatically.
