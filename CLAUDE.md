# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dashboard El Rey - A Next.js PWA for sales and inventory management with Google Sheets backend integration.

## Essential Commands

```bash
# Development
npm run dev          # Start development server on http://localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server
npm run export       # Static export for GitHub Pages deployment

# No test or lint commands currently configured
```

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **Authentication**: NextAuth.js with Google OAuth (whitelist-based)
- **Database**: Google Sheets API (primary data store)
- **UI**: shadcn/ui components with Tailwind CSS
- **Maps**: Mapbox GL for location tracking
- **PWA**: next-pwa with comprehensive offline support

### Core Application Structure

The app is organized around four main business modules:

1. **Dashboard** (`/src/app/dashboard/`): Real-time sales analytics with time period filtering
2. **Clients** (`/src/app/clientes/`): Client management and location tracking
3. **Inventory** (`/src/app/inventario/`): Stock management with entry/exit tracking
4. **Routes** (`/src/app/recorridos/`, `/rutas/`, `/navegar/`): Sales route planning and tracking

### API Routes Pattern

All API endpoints follow this structure in `/src/app/api/`:
- Use Google Sheets as backend via service account
- Return NextResponse with JSON data
- Handle authentication via NextAuth session checks

Example pattern:
```typescript
// src/app/api/[module]/route.ts
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Google Sheets integration
  const sheets = google.sheets({ version: 'v4', auth });
  // ... fetch and process data

  return NextResponse.json(data);
}
```

### Google Sheets Integration

The app uses specific Google Sheets as its database:
- **Dashboard**: Sheet ID `1-XStkIoYjYQ_WNjrQV8LIq01NmViQYpNBFMq37a_H6U`
- **Clients**: Sheet ID `1fyGH2Xpqkw49RLR0BvinN8UzSAiA7d-e5Mf0PAwYPos`
- **Inventory**: Sheet ID `1Iy8KJOmFsgfU7fcn0eLO70xz7pW-nP_YP6C0MdRz2Ho`
- **Routes**: Sheet ID `1QSJBRRbKm5fAmJT71oGBfgwsYLAOhZSbqT36c3l_RdU`

### Component Organization

- `/src/components/ui/`: shadcn/ui components (Button, Card, Dialog, etc.)
- `/src/components/`: Business logic components (VendorSelector, RouteAnalytics, etc.)
- `/src/components/providers/`: Context providers for state management

### Authentication Flow

NextAuth configuration restricts access to specific email addresses:
```typescript
// Only allows emails from: src/utils/auth.ts
const AUTHORIZED_EMAILS = [
  'ferchosaico26@gmail.com',
  'ventas1elrey@gmail.com',
  // ... other authorized emails
];
```

### PWA Configuration

The app includes comprehensive PWA features:
- Service worker with offline support
- App manifest for installability
- Caching strategies for API routes and assets
- Background sync capabilities

### Key Environment Variables

Required in `.env.local`:
```
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MAPBOX_ACCESS_TOKEN=
```

### Development Considerations

1. **Mixed Router Architecture**: Both App Router (`/src/app/`) and Pages Router (`/src/pages/`) are present. Prefer App Router for new features.

2. **TypeScript Configuration**: Strict mode is enabled but several rules are disabled in ESLint. Consider enabling them for better type safety.

3. **Data Fetching Pattern**: Uses client-side fetching with React hooks. API routes handle Google Sheets integration.

4. **State Management**: No external state management library. Uses React Context and local state.

5. **Styling**: Tailwind CSS with custom configuration. Use `cn()` utility from `/src/lib/utils` for conditional classes.

6. **Date Handling**: Spanish localization for dates using `toLocaleDateString('es-CO')`.

7. **Mobile Optimization**: Extensive mobile-first design with viewport prevention for zoom and touch gestures.