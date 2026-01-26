# Repository Guidelines for Agents

## Project Snapshot
- Product: Dashboard El Rey, a Next.js 14 PWA for sales + inventory dashboards.
- Tech stack: Next.js App Router, TypeScript, Tailwind CSS, NextAuth, Google Sheets API, Mapbox GL.
- UI kits: shadcn/ui patterns in `src/components/ui` (Radix + class-variance-authority).
- State: mostly React hooks/context; no external state manager.
- API: Next.js route handlers in `src/app/api` calling Google Sheets.

## Directory Layout
- `src/app/`: App Router routes, layouts, and API route handlers.
- `pages/`: legacy Pages Router entry points; prefer `src/app` for new work.
- `src/components/`: feature components and app-specific UI.
- `src/components/ui/`: shared primitives (Button, Card, Dialog, etc.).
- `src/lib/`: shared utilities like `cn()`.
- `src/utils/`: domain utilities (auth, date, API helpers).
- `src/__tests__/`: Jest tests mirroring `src/` paths.
- `public/`: PWA assets, service worker, manifest files.

## Architecture Notes
- Mixed routing: App Router is primary; Pages Router is legacy only.
- App entry points: `src/app/layout.tsx` and `src/app/page.tsx`.
- Feature areas include dashboard, clients, inventory, and routes modules.
- API handlers live in `src/app/api/**/route.ts` and use Next.js route handlers.
- Some routes opt into dynamic rendering with `export const dynamic = "force-dynamic"`.
- Shared hooks are in `src/hooks/` and should stay lightweight.
- Business utilities belong in `src/utils/` and should avoid React dependencies.
- Keep generated PWA files in `public/` intact unless regenerating.

## Authentication & Authorization
- NextAuth is configured in `src/app/api/auth/[...nextauth]/route.ts`.
- Client auth uses `useSession` from `next-auth/react`.
- Server routes should validate sessions before calling Google APIs.
- Master account helpers live in `src/utils/auth.ts`.
- Some API routes accept `viewAsEmail`; guard it with master checks.
- Keep auth-related env vars in `.env.local` only.

## Google Sheets Integration
- Use the `googleapis` client with service-account credentials.
- `src/utils/googleAuth.ts` exposes shared auth helpers for Sheets.
- Use `google.sheets({ version: "v4", auth })` for requests.
- Validate and normalize Sheet data before returning to clients.
- Provide explicit 400/401/500 responses with `NextResponse.json`.
- Add context-rich logs around Sheets requests and payload parsing.

## PWA & Offline
- `next-pwa` is wired in `next.config.js`.
- Service worker sources live in `public/service-worker.js`.
- Generated PWA assets may appear in `public/workbox-*.js` or `public/sw.js`.
- Update `public/manifest.json` when altering app identity or icons.
- Avoid editing generated assets by hand unless rebuilding them.

## Maps & Geospatial
- Mapbox GL powers map views; see `src/components/ui/Map.tsx`.
- Require `MAPBOX_ACCESS_TOKEN` in `.env.local` for runtime maps.
- Mapbox is mocked in `jest.setup.js` for tests.

## Localization & Formatting
- Date formatting uses Spanish locales (e.g., `"es-ES"`) in `src/utils/dateUtils.ts`.
- Preserve locale formatting for reports and labels.
- Currency formatting helpers are passed into UI components; keep consistent.
- Normalize user-entered strings before comparisons (see `src/utils/auth.ts`).

## Quality Gates & CI Notes
- `next.config.js` disables ESLint and TypeScript build blocking.
- Always run `npm run lint` and `npm run check` before shipping changes.
- Use `npm run test:ci` for CI parity with coverage.
- Optional typecheck: `npx tsc --noEmit`.

## Install, Build, Lint, Test
- Install: `npm ci`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start production: `npm run start`
- Static export (if needed): `npm run export`
- Lint (Biome): `npm run lint`
- Format (Biome): `npm run format`
- Full check (Biome lint + format): `npm run check`
- Test all: `npm run test`
- Test watch: `npm run test:watch`
- Test coverage: `npm run test:coverage`
- CI tests: `npm run test:ci`

## Running a Single Test
- By file: `npm run test -- src/__tests__/utils/dateUtils.test.ts`
- By name: `npm run test -- -t "date formatting"`
- Watch a single file: `npm run test -- --watch src/__tests__/utils/dateUtils.test.ts`
- Jest config: `jest.config.js` uses Next.js + `@/` alias.

## Formatting & Linting Rules (Biome)
- Quotes: double quotes (`"`) enforced in `biome.json`.
- Indentation: 2 spaces (spaces, not tabs).
- Imports: Biome organizes imports automatically; keep them sorted.
- Run `npm run format` before submitting UI changes.
- Linting is Biome-based; Next.js ESLint is disabled during builds.

## TypeScript & Types
- `strict: true` is enabled in `tsconfig.json`; avoid `any`.
- Prefer `unknown` + narrowing for untrusted data.
- Use `import type` for type-only imports.
- Keep return types explicit on shared utilities or exported functions.
- Use the `@/` alias for `src/` imports; avoid deep relative chains.

## React & Next.js Conventions
- Use functional components and hooks; components are `PascalCase`.
- Add `"use client"` at the top of client components in `src/app`.
- Favor App Router APIs (`next/navigation`, `NextResponse`) for new routes.
- Prefer colocated route handlers in `src/app/api/.../route.ts`.
- Use `React.forwardRef` in shared UI primitives.

## Styling Conventions
- Tailwind CSS is the default styling system.
- Use the `cn()` helper from `src/lib/utils.ts` to merge classes.
- Prefer composition through class-variance-authority for variants.
- Keep class lists readable; break long strings across lines as needed.

## Imports & Module Boundaries
- External packages first, then internal `@/` modules, then local files.
- Do not introduce new barrel exports unless a module already uses them.
- Keep utilities in `src/utils/` focused and stateless where possible.
- Avoid re-exporting server-only utilities into client components.

## Error Handling & Logging
- Validate request payloads in API routes before mutating state.
- Use `try/catch` in route handlers; respond with `NextResponse.json` and status codes.
- Add meaningful `console.log` context for integration-heavy flows (Sheets, uploads).
- Prefer explicit error messages over silent failures.

## Testing Guidelines
- Frameworks: Jest + React Testing Library + `@testing-library/jest-dom`.
- Tests live in `src/__tests__/` mirroring `src/` paths.
- Mock external services (Google APIs, Mapbox, NextAuth) in tests.
- Avoid network calls and time-based randomness; prefer deterministic fixtures.
- `jest.setup.js` already mocks Next.js router/navigation and Mapbox.

## Environment & Secrets
- Use `.env.local` for secrets; never commit credentials.
- Key env vars: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, Google service account vars, `MAPBOX_ACCESS_TOKEN`.
- PWA assets are in `public/` and `next-pwa` is enabled.

## Cursor Rule (from `.cursor/rules/regla.mdc`)
- For debugging tasks: enumerate 5-7 possible sources.
- Distill to 1-2 most likely causes.
- Add logs to validate assumptions before implementing a fix.

## Commit & PR Hygiene
- Commit messages are short, imperative phrases (often Spanish).
- One logical change per commit.
- PRs should include description, steps to verify, and UI screenshots when relevant.
