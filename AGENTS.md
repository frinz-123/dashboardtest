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
