# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dashboard El Rey — A Next.js PWA for sales and inventory management. Google Sheets is the primary database. The app is mobile-first, supports offline use, and is used by a small team of field sales reps in Mexico/Colombia.

## Essential Commands

```bash
# Development
npm run dev          # Start dev server on http://localhost:3000

# Build & Production
npm run build        # Production build
npm run start        # Start production server

# Code Quality (Biome — not ESLint)
npm run check        # biome check (lint + format check)
npm run lint         # biome lint
npm run format       # biome format --write

# Testing
npm test             # Jest unit tests
npm run test:watch   # Jest watch mode
npx playwright test  # E2E tests
```

> There is no `npm run export` that works — `next export` is deprecated in Next.js 16.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, App Router (primary) |
| Auth | NextAuth v5 (beta) — Google OAuth, JWT sessions |
| Database | Google Sheets API via service account |
| UI | shadcn/ui + Radix UI + Tailwind CSS |
| Charts | recharts |
| Animations | `motion/react` (Motion v12) — see LazyMotion note below |
| Maps | Mapbox GL + @mapbox/mapbox-gl-draw + turf.js |
| Code Quality | Biome (replaces ESLint + Prettier) |
| Testing | Jest + Playwright |
| Node | 20.9.0 (see `.nvmrc`) |

## App Routes

| Route | Description |
|---|---|
| `/` | Main sales dashboard — KPIs, period analytics, goal tracking |
| `/form` | Sales order form — product entry, GPS validation, photo capture |
| `/clientes` | Client management — location map, analytics, visit history |
| `/recorridos` | Sales route management — scheduling, visit tracking |
| `/rutas` | Route planning interface |
| `/navegar` | Map-based turn-by-turn client navigation |
| `/inventario` | Stock management — entries and exits |
| `/inventario-carro` | Vehicle/car inventory tracking |
| `/buzon` | Inbox — feed posts and notifications |
| `/transacciones` | Transaction log with filters |
| `/inspector-periodos` | Period-based inspection analytics |
| `/admin` | Admin panel (role-restricted) |
| `/auth/signin` | Google OAuth sign-in |
| `/auth/error` | Auth error display |

## API Routes (`src/app/api/`)

All API routes check auth via `await auth()` and return `NextResponse.json()`. They access Google Sheets via service account.

- `submit-form` — Submit sales order (GPS validation, photo upload, deduplication)
- `clientes` — Client data, analytics, seller analytics
- `recorridos` — Route CRUD + reschedule + update
- `transacciones` — Transaction log with pagination/filtering
- `inventario-carros` — Vehicle inventory data
- `inventory/add-entrada` — Add inventory entry
- `upload-photo` — Photo upload to AWS S3 or Google Drive
- `buzon-unseen` — Unseen notification count
- `feed-reviews` — Feed posts for inspector
- `auth/[...nextauth]` — NextAuth OAuth handler
- `auth/token` — Token management

## Key Files

```
src/
  auth.ts                          # NextAuth v5 config — allowed emails list, JWT setup
  app/layout.tsx                   # Root layout — MotionProvider, AuthProvider, Script (SW)
  app/globals.css                  # Global styles incl. animation keyframes
  components/providers/
    AuthProvider.tsx               # SessionProvider wrapper
    MotionProvider.tsx             # LazyMotion provider (MUST wrap motion consumers)
  utils/
    auth.ts                        # Email→vendor mapping, MASTER_ACCOUNTS, role lists
    googleAuth.ts                  # Google service account + OAuth2 setup
    dateUtils.ts                   # Period calculations, Spanish date formatting
    transacciones.ts               # Transaction row parsing and filtering
    photoStore.ts                  # IndexedDB photo cache
    submissionQueue.ts             # Offline form submission queue
    haptics.ts                     # Mobile haptic feedback
  hooks/
    use-mobile.tsx                 # Responsive breakpoint detection
    useBuzonNotifications.ts       # Polls /api/buzon-unseen every 60s
    useSubmissionQueue.ts          # Offline queue management
  lib/utils.ts                     # cn() utility (clsx + tailwind-merge)
```

## Coding Conventions

### Path Aliases
Always use `@/` for imports from `src/`:
```typescript
import { cn } from "@/lib/utils";
import AppHeader from "@/components/AppHeader";
```

### Animations — LazyMotion Pattern
`MotionProvider` (in layout.tsx) sets up LazyMotion app-wide. **Always use `m` not `motion`**:
```typescript
// ✅ Correct
import { m, AnimatePresence } from "motion/react";
<m.div animate={{ opacity: 1 }} />

// ❌ Wrong — bypasses LazyMotion, costs ~30kb
import { motion } from "motion/react";
<motion.div animate={{ opacity: 1 }} />
```

### Heavy Components — Dynamic Imports
Lazy-load chart-heavy or conditionally-rendered components:
```typescript
import dynamic from "next/dynamic";
const HeavyChart = dynamic(() => import("./HeavyChart"), { ssr: false });
```

### Styling
Use `cn()` from `@/lib/utils` for conditional Tailwind classes:
```typescript
import { cn } from "@/lib/utils";
className={cn("base-class", condition && "conditional-class")}
```

### Date Localization
Use Spanish Colombia locale for user-facing dates:
```typescript
date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
```

## Authentication & Authorization

- **Config**: `src/auth.ts` — NextAuth v5, Google OAuth provider
- **Allowed emails**: hardcoded list in `src/auth.ts` (13 addresses + `OVERRIDE_EMAIL` env var)
- **Roles** (defined in `src/utils/auth.ts`):
  - `MASTER_ACCOUNTS` — 5 superusers, can view any vendor's data
  - `INVENTARIO_CARRO_ACCOUNTS` — access to vehicle inventory
  - `EMAIL_TO_VENDOR_LABELS` — maps email → display name for 13+ sellers
- **Session check in API routes**: `const session = await auth(); if (!session) return 401`

## Google Sheets Integration

### Sheet IDs
| Module | Spreadsheet ID |
|---|---|
| Sales / Form data | `NEXT_PUBLIC_SPREADSHEET_ID` env var |
| Clients & Routes | `1QSJBRRbKm5fAmJT71oGBfgwsYLAOhZSbqT36c3l_RdU` |
| Inventory | `1Iy8KJOmFsgfU7fcn0eLO70xz7pW-nP_YP6C0MdRz2Ho` |

### Sheet Names
- `Form_Data` — primary sales transaction log (columns A–AQ)
- `Clientes_Rutas`, `Rutas_Performance`, `Programacion_Semanal`, `Configuracion`, `Metricas_Rutas`, `Visitas_Individuales`, `Visitas_Reprogramadas`

### Auth
Service account credentials are set up in `src/utils/googleAuth.ts`. The service account JSON is read from environment variables (prefixed `GOOGLE_SERVICE_ACCOUNT_`).

## Environment Variables

Required in `.env.local`:
```
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Google Sheets / Drive
NEXT_PUBLIC_SPREADSHEET_ID=
NEXT_PUBLIC_SHEET_NAME=Form_Data
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_REDIRECT_URI=
GOOGLE_SERVICE_ACCOUNT_TYPE=
GOOGLE_SERVICE_ACCOUNT_PROJECT_ID=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_CLIENT_ID=

# Maps
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_GOOGLE_API_KEY=

# App Config
NEXT_PUBLIC_OVERRIDE_EMAIL=    # Comma-separated emails to bypass GPS validation
NEXT_PUBLIC_ADMIN_PASSWORD=
ADMIN_PASSWORD=
```

## PWA & Offline

- Service worker registered via `next/script` in `layout.tsx` (`strategy="afterInteractive"`)
- Service worker file at `public/service-worker.js`
- `ClientDataPrefetcher` component preloads data on mount for offline use
- `useSubmissionQueue` / `submissionQueue.ts` queue form submissions when offline
- `photoStore.ts` caches photos in IndexedDB

## Known Issues / Gotchas

1. **TypeScript**: `ignoreBuildErrors: true` is set in `next.config.mjs`. There are pre-existing TS errors in `admin/page.tsx`, `api/clientes/route.ts`, and `navegar/page.tsx` — do not attempt to fix them unless explicitly asked.

2. **Mixed Router**: App Router (`src/app/`) is primary. Pages Router (`src/pages/`) exists but is mostly legacy. Prefer App Router for new features.

3. **Linter**: The project uses **Biome**, not ESLint. Run `npm run check` not `npm run lint:eslint`.

4. **No `next export`**: Static export is broken in Next.js 16. Use `npm run build` + `npm run start` for production.

5. **Large page files**: Several pages (`clientes`, `form`, `inspector-periodos`, `recorridos`) exceed 1000–3000 lines. When editing, read the relevant section first before making changes.

6. **Form validation (GPS)**: `submit-form` API enforces: GPS accuracy ≤100m, location age ≤90s, distance to client ≤450m. Emails in `NEXT_PUBLIC_OVERRIDE_EMAIL` bypass these checks.
