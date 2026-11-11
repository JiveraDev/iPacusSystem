# System-wide error isolation plan

Prepared: 2026-10-16. Status: shared infrastructure and cross-page rendering isolation implemented; scoped request handling implemented for availability, booking management, queue management, intake, pet activity, inventory, and status displays. See the [implementation record](../docs/error_isolation.md) for evidence and validation limits. The full acceptance matrix is not a claim of complete business-flow certification.

## Intended behavior

A failed booking table, calendar, chart, image, document preview, or external integration replaces only the affected content with a useful message and an appropriate recovery action. Independent sections, navigation, theme selection, and unaffected form drafts remain usable.

Example fallback: **Booking availability could not be loaded.** Show a restrained warning icon, a short explanation, and **Retry availability**. A successful retry restores that section without reloading the page. An error must never be presented as an empty result, zero total, available appointment, or completed transaction.

Scope includes public pages, every dashboard route, all account roles, shared dialogs and overlays, media, integrations, and both status-display applications. The accompanying [route inventory](error-isolation-route-inventory.csv) maps route entry points to work packages and distinguishes implemented protection from route-specific fault testing.

The inventory contains all 59 registered dashboard route patterns, eight public route/alias entries, and the standalone display entry: 68 entries in total. Shared Home and Profile routes list their role-dependent components. Existing normalization and status-host aliases retain the same coverage as their destination screen. The client role expressions are recorded for navigation coverage; PHP authorization remains authoritative.

## Baseline source findings, before implementation

The following findings describe the original source reviewed before this rollout. Implemented changes and remaining verification are recorded in the implementation document and route inventory.

| Finding | Current source | Planned response |
| --- | --- | --- |
| No application Error Boundary implementation was found in `src`. | Search for `ErrorBoundary`, `componentDidCatch`, and `getDerivedStateFromError`; [dashboard rendering](../src/components/Dashboard.jsx) currently uses Suspense. | Add reusable boundaries for rendering failures at root, page, section, and selected independent-item levels. Retain Suspense for loading. |
| An application-wide down state replaces the entire application, including public content. | [App.jsx](../src/App.jsx), `if (serverStatus.isDown)`. | Preserve the public page and dashboard shell during backend outages. Scope data failures and disable dependent actions. Reserve the root fallback for failures that actually prevent the application from rendering. |
| Some individual request failures can publish global unavailability; unrelated successful responses can clear it. | [apiClient.js](../src/services/apiClient.js): `apiFetch`, `performApiRequest`, `reportServerUnavailable`, and `reportServerAvailable`. Database-unavailable responses are promoted even when suppression was requested. | Separate request errors from confirmed service health. Give the health coordinator authority over service-status transitions and prevent old or unrelated responses from clearing newer failures. |
| Several screens already handle request errors locally, but behavior varies. | [My List](../src/components/VetrinarianComponents/VetMylistinService.jsx), [record requests](../src/components/AdminDashboardsComponent/RecordUpdateRequestsManagement.jsx), and [boarding](../src/components/AdminDashboardsComponent/PetBoardingManagement.jsx). | Preserve useful existing handling and migrate to a consistent state and recovery contract. |
| A failed pet booking/queue request becomes an empty array. | [PetProfile.jsx](../src/components/PetOwnerDashboard/PetProfile.jsx), `fetchPetActivity`. | Track each result independently. Show unavailable content rather than a false “no records” state; retain eligible last-known results with a freshness notice. |
| Booking and queue loading are coupled in Pet Intake. | [PetIntake.jsx](../src/components/AdminDashboardsComponent/PetIntake.jsx), `Promise.all([fetchQueues(), fetchBookings()])`. | Identify which displays can load separately; preserve dependency checks needed for matching, eligibility, and duplicate prevention. |
| Calendar errors have a local message, but recovery is incomplete. | [ClinicAvailabilityCalendar.jsx](../src/components/shared/ClinicAvailabilityCalendar.jsx). Only a non-background load clears the error at its start; a successful background load does not explicitly clear it. | Add scoped retry, clear errors on valid successful recovery, and expose stale/unverified availability. |
| JSON parsing can return a default object instead of exposing an unreadable response. | [apiClient.js](../src/services/apiClient.js), `readJsonResponse`. | Validate expected successful payloads. Distinguish an intentional empty response from malformed or incompatible data; do not break legitimate no-content endpoints. |
| Auto-refresh backoff depends on callback rejection. | [useAutoRefresh.js](../src/hooks/useAutoRefresh.js). Several consumers catch errors without propagating failure. | Define a consistent refresh result contract so handled failures still affect backoff. Handle promises started by buttons and effects so failures do not become unhandled rejections. |

These are source findings. No production failure, database repair, or complete browser certification is claimed by this plan.

## 1. Rules for choosing the error scope

| Situation | Scope and recovery |
| --- | --- |
| Invalid form field or HTTP 400/422 | Keep the form and draft. Mark relevant fields or show a form message. Retry after correction. |
| Session expiry/authentication required | Retain the central session-expiry flow. Clear private state and require login; never keep protected records available through a fallback. |
| HTTP 403 | Deny the affected action or resource. A required page permission blocks page content; an optional resource denial stays local. Do not automatically retry or reuse inaccessible cached data. |
| Missing individual record/HTTP 404 | Show a missing-record state in that detail area. Retain navigation and unrelated content. |
| Conflict/HTTP 409 | Explain that the record changed. Refresh authoritative state and ask the user to review before resubmission. |
| Rate limit/HTTP 429 | Keep the affected action local and observe the server's retry delay where supplied. Prevent retry loops. |
| One request times out, fails, or returns HTTP 5xx | Mark the owning section unavailable or stale. Do not replace the application. |
| One request reports a database outage | Show the section failure immediately and schedule a coordinated health check. Treat the signal as suspected shared failure until verified. |
| Health check confirms a shared API/database outage | Show a service notice, retain static/public content and navigation, and block operations whose authoritative dependencies are unavailable. Retain only permitted in-memory read-only data, visibly stale. |
| Browser appears offline | Show an offline notice and local recovery states. Browser connectivity indicators are hints; actual requests determine recovery. Do not introduce private offline storage or offline writes. |
| Component rendering crashes | The nearest appropriate boundary replaces that subtree. Log safe diagnostics and provide a bounded retry/reset. |
| Image, video, document, or external SDK fails | Use its event/request error handling and a local placeholder or fallback. React boundaries alone do not catch all such failures. |
| Providers or application shell cannot render | Use a minimal root fallback that does not depend on the failing provider, network, icon package, or shared control tree. |

Independent sections can use separately handled requests or `Promise.allSettled()`. Truly dependent operations remain grouped. Do not mechanically replace every `Promise.all()` or put a boundary around every `div`.

Independent successful sections should render as soon as their own data arrives. `Promise.allSettled()` still waits for every input promise; use separately published resource states when one slow source should not delay its siblings.

Proposed initial health-coordinator settings: one in-flight probe, a 500 ms debounce for simultaneous failure signals, a five-second probe timeout, and two consecutive failed probes separated by two seconds before confirming a shared outage. Health probes do not also use the ordinary GET retry loop. After confirmation, keep the existing 15-second recovery cadence, with a manual retry available. A current successful `/health` response with `ok: true` clears the outage; obsolete probes and unrelated feature responses cannot do so. These defaults are to be verified with injected failures before rollout.

## 2. Shared implementation contract

The following shared modules are now implemented. Adoption of the resource hook is scoped to the migrated loaders; existing loaders elsewhere retain their own request handling.

| Proposed change | Responsibility |
| --- | --- |
| `src/components/shared/ErrorBoundary.jsx` | One small React class boundary with safe logging, a fallback, explicit retry, and stable reset keys. Function components remain the normal application style. No new runtime package is needed. |
| `src/components/shared/SectionErrorState.jsx` | Theme-aware icon, useful title, short message, and named retry action. Support compact, section, and page presentations using existing UI primitives. |
| `src/components/shared/ServiceStatusNotice.jsx` | Non-blocking service/offline status without unmounting healthy content. Put any essential root fallback outside provider dependencies. |
| `src/lib/errorPolicy.js` | Pure classification of request errors, cancellation, required dependencies, retry eligibility, and safe presentation. Reuse existing `ApiError` and error sanitization. |
| `src/hooks/useSectionResource.js` | A reusable GET resource contract for data, request identity, initial loading, refreshing, error, stale data, last success, and retry. Integrate with `useAutoRefresh`; avoid a second polling mechanism. Adopt incrementally rather than rewriting every loader. |
| `src/services/serviceHealth.js` | Own health checks, deduplication, outage confirmation, recovery sequencing, and publication of service health. The API client reports request facts without deciding that every feature failure is an app outage. |
| Existing API services | Pass the necessary request options and validate response shapes near their domain. Preserve authorization, bounded GET retries, de-duplication, and existing timeout support. |

### Resource state

- Initial loading: show a section-sized skeleton or progress state.
- Successful data: render the section and clear its prior error.
- Successful empty result: display the actual empty-state message.
- Initial failure: show the local error state and retry.
- Background failure after success: retain eligible last-known data with a freshness notice. Do not silently keep availability, payment state, stock, or permissions actionable.
- Refreshing: retain content and use quiet feedback; avoid full-page loading replacements.
- Cancellation or obsolete response: ignore it. A response for a different pet, branch, account, date, or filter must never update the current resource.
- Logout, identity change, or access denial: discard private data from the previous identity or scope.

Each resource key includes its relevant user, branch, record, and filter inputs. Manual retry and polling share concurrency protection. Cancelling one consumer must not unexpectedly abort a request shared with another consumer. Any new request options that change response/error behavior must have explicit de-duplication semantics.

### Rendering boundaries

Use a root boundary outside providers, a route-content boundary inside the dashboard shell, and section boundaries around independent features. Transformations and selectors that can throw must execute inside the protected subtree; wrapping only the final table does not protect a crashing parent calculation.

Keep page headers, navigation, and independent form state outside smaller section boundaries. Use stable record/route identities to reset a boundary; do not reset it on every poll, render, or theme change. A component that repeatedly crashes stays in its fallback until a deliberate recovery action or relevant context change.

Handle lazy-import failures explicitly. Remounting the same rejected `React.lazy` component may not retry the import. Detect asset/version failures and offer a deliberate application reload when needed, while retaining supported drafts. Module-import and startup failures that happen before React mounts need bootstrap-level fallback handling; an in-tree boundary cannot catch them.

### Saves, payments, uploads, and other mutations

GET retries do not authorize automatic retries of writes. A timeout may occur after the server committed a payment, booking, clinical record, stock movement, or uploaded document. Show an uncertain-result message and check authoritative status before offering resubmission. Preserve transaction/duplicate protections and add idempotency only where the backend supports it.

Keep validation and save errors near the action. Preserve editable values where safe. Reuse existing draft exclusions for passwords, tokens, signatures, payment proofs, and other sensitive fields. A child retry must not discard a separate unsaved clinical form.

The backend remains authoritative. Isolation must not turn a missing prerequisite, failed permission check, unverified price, or unavailable consent into permission to continue. Failed optional delivery after a committed action must not misrepresent the committed action as failed.

## 3. Coverage by work package

Every dashboard entry point is listed in the CSV. Dynamic records require populated, missing, forbidden, and changed-record variants, and shared routes require all applicable account roles.

| Package | Pages and features | Independent areas and required safeguards |
| --- | --- | --- |
| EI-01 Foundation | Root, providers, App, API client, shared refresh, dashboard shell | Implement classification, resource states, boundaries, service-status coordination, and safe fallbacks. Preserve route/debug bypass declarations. |
| EI-02 Public and authentication | Landing, all service content, registration/profile registration, verification, password recovery, login | Isolate booking availability, hotel rooms, vet presence, maps/media, Google and OTP providers. Static content and theme selection stay available. Identity validation and verification failures block only the dependent auth action. |
| EI-03 Dashboard home | All role variants of Home and Super Admin report home | Separate cards, charts, lists, and announcements by actual data dependency. Unknown metrics display unavailable, never a fabricated zero. |
| EI-04 Booking and queues | Booking forms/payment/confirmation, booking management, self-service queue, queue management | Separate history, availability, attachments, and optional lookups. Block submission/receipt/assignment if required identity, slot, clinic-network, consent, or assignment checks cannot be verified. |
| EI-05 Pet Intake and My List | Both intake URL aliases and veterinarian My List | Distinguish booking and queue failures without duplicate patients. Keep in-progress, appointments, completed visits, and consent loading independent where possible. Preserve examination/consent gating and same-day diagnosis rules. |
| EI-06 Pet information and registration | My Pets, add/register/edit, pet information, shared ownership | Separate identity, activity, vaccinations, documents, certificates, and owner information. Missing core identity blocks dependent editing. Preserve the bottom-center action dock and the issued-medical-certificate visibility rule. |
| EI-07 Clinical records | Diagnosis, EMR, histories, owner medical records, admin/vet record-update requests | Keep optional history and previews separate from active work. Block clinical saves when required patient/assignment/consent data is unavailable. Distinguish partial records from a complete empty history. |
| EI-08 Grooming and boarding | Grooming jobs/reviews; hotel rooms, stays, observations, care tasks, documents, material use | Separate optional photos/documents from core workflow and billing prerequisites. Preserve capacity and release/payment rules. Do not allow unavailable material/stock data to create misleading charges. |
| EI-09 POS and inventory | POS, catalog, add item, stock-in, low stock, expiry, disposal, refunds | Isolate history/receipt previews and optional metadata. Keep financial totals and stock transactions within their required consistency boundary. Invalid rows cannot silently disappear from totals or stock counts. |
| EI-10 Reports and governance | Reports/export, activity log, accounts, pet-owner accounts, payment methods, media monitoring | Keep independent report sources distinguishable. Label incomplete results and prevent exports from appearing complete. Permission/configuration failures block dependent actions. |
| EI-11 Profile, schedules, notifications | All profile roles, appearance, calendar/TODOs, preferences, in-app notifications | Independent panels fail locally. Preference saves do not disable the whole profile. Failed delivery is distinct from an unavailable notification list or failed subscription. |
| EI-12 Online consultations | Owner video, vet online list, online diagnosis, video-call provider | Meeting SDK/network failures stay in meeting UI. Retain required consultation authorization and recording workflow. A failed call does not automatically close clinical records or billing. |
| EI-13 Shared media and documents | Protected images/documents, photo viewer, consent preview/signature, upload UI, global previews | Use scoped media error events, placeholders, and recovery. Preserve protected access and complete consent-document rules. Do not reveal private paths or replace protected URLs with public shortcuts. |
| EI-14 Status, PWA, integrations, recovery | React TV display, standalone PHP/JS display, install/service worker, backup download, workers/providers | Show unknown/stale status distinctly from available/current status. Handle standalone display failures without React assumptions. SDK/install failures leave core work usable. Backup/export failures must not report success. |

## 4. Delivery order and acceptance gates

Work is delivered in reviewable batches. Every batch updates the inventory status and its evidence. No batch is complete merely because an error was caught.

| Batch | Work | Gate before expanding coverage |
| --- | --- | --- |
| A: rules and foundations | EI-01; capture baseline; add pure error-policy regressions, resource/boundary behavior tests, and scoped UI primitives. | Request failures, health status, authentication, cancellation, and unknown mutation outcomes are distinguishable. A route crash leaves the dashboard shell usable. |
| B: first complete demonstration | EI-02 landing availability/hotel/presence, EI-05 My List, EI-06 pet activity/certificates. | Independently fail each source, show its fallback, retry it, and recover without clearing siblings or drafts. Static landing content survives failed health checks. |
| C: clinical and booking operations | Remaining EI-04 through EI-08, including clinical forms and online dependencies. | Required checks still block writes; consent, assignments, access, and status rules retain meaningful regression coverage. |
| D: financial and administrative operations | EI-09, EI-10, remaining EI-03 and EI-11. | No silent missing amounts, false zeroes, duplicate payment/stock changes, or incomplete exports presented as complete. |
| E: shared overlays and deployment-specific features | EI-12 through EI-14; remaining nested panels, provider failures, and standalone display. | SDK, media, portal, lazy asset, offline, and shared-service scenarios have explicit recovery and preserve access restrictions. |
| F: full coverage audit | Every inventory route, shared component, role variant, and integration dependency. | Record completed fault tests, accessibility/theme checks, and configured-environment limitations. Any untested scenario remains marked unverified. |

The implemented rollout includes route boundaries, shared card/table/dialog/sheet protection, and section boundaries throughout public and dashboard screens. Request migrations and browser evidence are listed separately: a route boundary alone does not establish independent recovery for every request on that route.

## 5. Fault-injection and verification matrix

Use synthetic data and the existing isolated sandbox. Do not create real bookings, payments, messages, or clinical changes as fault-injection fixtures.

| Test | Required observation |
| --- | --- |
| One endpoint fails while its siblings succeed | Only its section shows an error; no app-wide unavailable replacement. |
| HTTP 200 with empty data | Genuine empty state, with no error styling. |
| HTTP 200 with malformed JSON or invalid required structure | Unreadable-data fallback; no false empty state or render crash escaping the section. |
| Render exception in one widget, dialog, or independent item | Nearest intended boundary catches it; siblings and navigation work. Test the parent transformations as well as the final leaf. |
| Timeout, HTTP 500/503, disconnected request, offline indication | Local unavailable/stale state; bounded retry; shared health confirmation follows policy. |
| Background failure followed by recovery | Data is visibly stale where retained; successful valid refresh clears the error and staleness. No flicker or repeated toast flood. |
| Fast pet/clinic/date/filter changes and navigation/unmount | Late or cancelled results cannot overwrite the active scope; no private-data crossover. |
| Session expiry, HTTP 403, missing record | Existing auth and access controls remain authoritative; stale protected data is cleared as needed. |
| Missing consent, stock, slot, price, or other required dependency | The dependent action stays blocked, with a useful explanation. |
| Double click or response lost after write commit | No blind resubmission; reconcile committed result and preserve backend duplicate protections. |
| Concurrent consumers of a GET and manual retry during polling | No conflicting requests, cross-consumer cancellation, endless refresh, or retry multiplication. |
| Health responses arrive out of order | A stale success cannot clear a newer confirmed outage. A feature success alone does not certify database health. |
| Cached lazy-import rejection or stale deployed assets | Local fallback explains recovery; retries do not spin indefinitely. Deliberate reload is available where required. |
| Optional notification/media/provider failure after business commit | Saved action remains accurately reported; failed secondary work is recoverable and visible at its own scope. |

Automate behavior with the existing Node runner for pure policies and resource-state transitions; use browser fault injection for actual boundaries, portals, event handling, retries, focus, and sibling preservation. Add database-backed checks only where changed behavior requires them, using synthetic sandbox records.

Run `npm test`, `npm run lint`, `npm run build`, and the relevant portions of `npm run check` after implementation changes. Run PHP syntax/regressions for changed handlers and sandbox tests for changed transactional behavior. Planning documents alone do not require a new application build.

Review fallbacks in all eight existing palettes. Check 320/390 px phone, approximately 820 px tablet, 1920 px desktop, and 3840 px wide layouts. Preserve original Light palette values. Verify readable icons/text/disabled controls, visible keyboard focus, named retry buttons, appropriate status announcements, and reduced-motion behavior. Repeated background failures must not repeatedly interrupt screen readers or move focus.

## 6. Diagnostics and guardrails

- Reuse existing error-message sanitization. User messages do not contain SQL, stack traces, tokens, credentials, private file paths, or clinical notes.
- Record only approved diagnostic metadata: normalized route/section key, operation, error category/status, timestamp, and an existing or generated correlation identifier. Keep reporting failures from crashing the fallback itself.
- Do not add external telemetry services, send notifications, change database schema, or deploy as part of the frontend isolation rollout without a concrete need within the approved implementation scope.
- Preserve backend authorization, ownership, branch, veterinarian assignment, transaction, payment, consent, and certificate rules. Preserve debug bypass declarations in Dashboard and dashboardRouter exactly as instructed.
- Preserve user interface decisions already made: the eight palettes, the landing-only borderless sun/moon selector, the pet action dock, flat page headers, and My List without workload summary counters.
- Keep the existing isolated database, credentials, storage, and disabled external-delivery settings separate from the configured normal application.
- Preserve unrelated user changes, including the current diagram relocations.

## Technical references

React boundaries protect descendant rendering failures, have limitations for asynchronous/event errors, and should be placed at meaningful recovery points. The shared class boundary follows [React's Error Boundary guidance](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).

Independent request results can be handled separately with [Promise.allSettled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled). HTTP status and response parsing still require explicit checks; see [Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).

Local references: [API client](../src/services/apiClient.js), [refresh hook](../src/hooks/useAutoRefresh.js), [error presentation](../src/lib/errorPresentation.js), [system capabilities](../docs/CURRENT_SYSTEM_CAPABILITIES.md), [database sandbox](../docs/database_sandbox.md), and [theme audit](../docs/theme_audit.md).
