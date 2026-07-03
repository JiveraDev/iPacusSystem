# Repository Guidelines

#### don't change any of the debug bypass in the dashboard and dashboardrouter
## Project Structure & Module Organization

- `src/` holds frontend source code.
- `src/components/` contains dashboard and page-level React components.
- `src/ui/` contains reusable UI primitives.
- `src/services/` contains API helper modules.
- `src/assets/` contains bundled image assets.
- `public/` contains static files and uploaded media.
- `php/` contains backend endpoints; routing starts in `php/index.php`.
- `tables.sql` documents the database schema; `inventory_test_seed.sql` contains inventory seed data.
- `dist/` is generated build output.

## Build, Test, and Development Commands

- `npm run dev`: start the Vite development server.
- `npm run build`: create a production build in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint against frontend and server JavaScript.

Example local workflow:

```bas
npm install
npm run dev
npm run lint
npm run build
```

## Coding Style & Naming Conventions

Use ES modules and React function components. Component filenames use PascalCase, for example `BookingManagement.jsx`; services and utilities use camelCase, for example `addPet.js`.

Follow the existing style: 4-space indentation in most React/PHP files, single quotes in JSX modules, and Tailwind utility classes. Prefer UI primitives from `src/ui/` before creating new controls. ESLint checks `src/**/*.{js,jsx}` and `server/**/*.js`; unused variables are errors unless they match the uppercase ignore pattern.

## UI Design Guardrails

Before changing dashboard, table, form, inventory, booking, queue, profile, or reporting screens, preserve the existing visual system and fix inconsistent UI patterns instead of adding new ones.

- Tables and data lists must have clear priority: primary identifiers and status should be easiest to scan, secondary metadata should be quieter, and row actions should stay aligned in a predictable final column.
- Do not overuse colored badges, tinted cells, borders, shadows, or cards. Use color only for meaningful state such as success, warning, danger, pending, active, inactive, paid, unpaid, available, low stock, or out of stock.
- Keep data coloring consistent across the app. The same state should use the same color family, contrast level, and dark-mode treatment wherever it appears.
- Date selectors, date ranges, and filter bars should use one shared layout pattern: label, control, icon, helper/error text when needed, and stable spacing. Do not create one-off date picker styles per page.
- Icons should come from the existing icon library already used in the project, usually `lucide-react`. Icon size, stroke weight, and color should be consistent inside buttons, inputs, tabs, empty states, and row actions.
- Cards should group meaningful content only. Avoid nested cards, decorative card stacks, and card wrappers around every table or form section when spacing or a simple panel is enough.
- Dense operational screens should prioritize scannability over decoration: compact spacing, aligned columns, restrained colors, visible selected/hover/focus states, and no marketing-style hero layouts.
- Light and dark themes must both be checked for contrast, especially table rows, date controls, disabled controls, icons, badges, and card surfaces.
- Prefer shared UI primitives from `src/ui/` and existing shared components before creating a new control. If a repeated table, date filter, badge, or icon-button pattern appears, consolidate it instead of duplicating styles.
- Keep typography disciplined: page titles, section headings, table headers, body text, helper text, and badges should use predictable size and weight hierarchy. Do not use oversized headings inside compact dashboard panels.
- Use consistent spacing rhythm. Related controls should be grouped tightly, unrelated sections should have clear separation, and filter/toolbars should not jump in height between pages.
- Every interactive control needs a clear hover, focus, active, disabled, loading, and error state when applicable. Disabled controls must remain readable in both themes.
- Empty, loading, and error states should be calm and useful: include the relevant icon, short message, and action when recovery is possible. Do not leave blank tables, broken cards, or raw error text.
- Forms should align labels, inputs, validation text, and actions consistently. Primary actions belong at the end of the flow; destructive actions should be visually distinct but not oversized.
- Responsive layouts must be checked at phone, tablet, 1080p desktop, and large 2K/4K-style desktop widths. Important content should not be hidden, clipped, overlapped, or forced into unreadable columns at any size.
- Phone layouts should prioritize the main task first, then filters/actions, then supporting metadata. Use stacked controls, full-width inputs, compact action menus, and horizontal table scroll only when the data genuinely needs columns.
- Tablet layouts should avoid awkward half-desktop designs. Use two-column layouts only when both columns remain readable; otherwise keep the phone-style stacked flow with better spacing.
- 1080p desktop layouts should feel dense but not crowded. Tables, filters, cards, and side panels should align to a clear grid, with enough whitespace to scan repeated operational data quickly.
- Large desktop layouts should not stretch content endlessly. Use max-widths, readable table column limits, balanced grid columns, and anchored toolbars so screens remain usable on wide monitors.
- Tables should not crush important identifiers on small screens. Use horizontal scroll, sticky priority columns, stacked metadata, column hiding, or row detail expansion when needed.
- Use motion sparingly and only for feedback or orientation. Avoid decorative animations that distract from dashboard, booking, queue, inventory, and reporting tasks.
- Maintain accessible contrast, keyboard focus visibility, readable hit targets, and meaningful button labels or aria-labels for icon-only controls.

## Live Data Refresh

GET-backed dashboard views should auto-refresh while they are open so database updates appear without a manual browser reload. Use the shared `useAutoRefresh` hook from `src/hooks/useAutoRefresh.js`; the default interval is 4 seconds. Keep refreshes quiet after the first load when possible so tables and cards update without replacing the screen with a loading state.

## Theme Controller

The app theme is controlled by `ThemeProvider` from `src/context/ThemeProvider.jsx` and the `useTheme` hook from `src/hooks/useTheme.js`. The selected mode is stored in `localStorage` under `ipawcus-theme` and applied by toggling the `dark` class on the document root. Profile screens should use the shared `ThemeToggle` component from `src/components/shared/ThemeToggle.jsx` instead of creating separate theme controls.

## Testing Guidelines

No automated test framework is currently configured in `package.json`. For now, validate changes with:

- `npm run lint`
- `npm run build`
- PHP syntax checks for changed endpoints, for example `php -l php/get_bookings.php`
- Manual browser testing for booking, queue, inventory, and profile flows touched by the change

If tests are added later, place them near the related module or in a test directory, using `*.test.jsx` or `*.spec.jsx`.

Pull requests should include a summary, affected areas, verification commands, database/schema notes when relevant, and screenshots for visible UI changes.

## Security & Configuration Tips

Keep secrets in `.env`; do not commit credentials or local database passwords. Uploaded files should go through the existing upload endpoint and land under the relevant `public/` upload subdirectory.
