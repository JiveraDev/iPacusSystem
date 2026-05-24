# Repository Guidelines

#### dont change any of the debug bypass in the dashboard and dashboardrouter
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

## Testing Guidelines

No automated test framework is currently configured in `package.json`. For now, validate changes with:

- `npm run lint`
- `npm run build`
- PHP syntax checks for changed endpoints, for example `php -l php/get_bookings.php`
- Manual browser testing for booking, queue, inventory, and profile flows touched by the change

If tests are added later, place them near the related module or in a test directory, using `*.test.jsx` or `*.spec.jsx`.

## Commit & Pull Request Guidelines

Recent history uses short messages such as `Update the table.sql` and `fixing errors on the inventory (current setup)`. Keep commits concise, but prefer clearer imperative messages, for example `Fix booking pet registration status`.

Pull requests should include a summary, affected areas, verification commands, database/schema notes when relevant, and screenshots for visible UI changes.

## Security & Configuration Tips

Keep secrets in `.env`; do not commit credentials or local database passwords. Uploaded files should go through the existing upload endpoint and land under the relevant `public/` upload subdirectory.
