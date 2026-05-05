# Setspace — Agency Management Platform

## Overview

Full-stack internal management platform for a video editing agency. Built as a pnpm monorepo with TypeScript throughout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Replit Auth (OIDC/PKCE) via `openid-client` v6
- **Mobile Auth**: `POST /api/mobile-auth/token-exchange` → `{ token: sid }`, use `Authorization: Bearer <sid>` for all mobile API calls
- **File storage**: GCS-backed object storage via Replit object storage
- **Email**: Nodemailer (meeting invites — requires EMAIL_HOST, EMAIL_USER, EMAIL_PASS env vars)
- **Frontend**: React 18 + Vite + Tailwind v4 + shadcn/ui + framer-motion + recharts
- **Mobile**: Expo (React Native) — dark-only theme matching web, Expo Go compatible
- **IMPORTANT**: Tailwind v4 JIT does not reliably scan dynamic TS strings for color classes. All dynamic per-user colors MUST use inline CSS `style={}` (see `user-colors.ts`), never Tailwind class names.

## Features

- **Dashboard**: KPI summaries, attendance overview, recent activity
- **Task Management**: Kanban-style board with assignees, priority, due dates. Done tasks can be archived (hidden from default view) or deleted; admin/HR only. Archive toggle in Done column header shows count of archived tasks.
- **KPI & Payroll**: Simplified payroll view with 3 salary components (Basic Salary, Dependability Deduction, KPI Payment Deduction) — deductions auto-triggered from attendance/task data. Plus Editor Performance tracking.
- **Attendance**: Clock in/out with month-grouped records, sticky clock card, basic/overtime hours breakdown. Day-boundary clock-out fix for overnight sessions.
- **Quality Checks**: 1–5 star peer reviews with feedback, task name shown, newest-first ordering, month filter.
- **Leaderboard**: Automated "Employee of the Month" scoring (On-Time Tasks 40%, Quality 25%, Attendance 20%, Punctuality 15%). Only tasks WITH explicit due dates count toward on-time score; neutral 50 if no due-dated tasks. Schedule slots auto-seeded at startup for all employees including Ateeb (Mon-Fri 5:30 PM, 6h).
- **Team Chat**: Real-time-style threaded messages
- **Meetings**: Scheduling with attendees, email notifications, and calendar links
- **Notifications**: Per-user notification feed
- **Public Review**: Client-facing public review link (`/review/:token`) — removed internal Video Studio UI for now
- **Mobile App**: Expo app with Login, Home (attendance clock in/out + task summary), Chat, Tasks, and Profile (notifications + sign out) screens

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/          # Express API (port via $PORT, serves at /api)
│   ├── setspace/            # React+Vite frontend (port via $PORT, base path /)
│   └── setspace-mobile/     # Expo mobile app (Expo Go, dark theme)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks + setBaseUrl/setAuthTokenGetter
│   ├── api-zod/             # Generated Zod schemas
│   ├── db/                  # Drizzle ORM schema + connection
│   ├── replit-auth-web/     # Replit Auth hooks for frontend
│   └── object-storage-web/  # Uppy-based upload component for frontend
├── scripts/
│   └── src/seed.ts          # Database seed script (run: pnpm --filter @workspace/scripts run seed)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

Tables: `users`, `sessions`, `tasks`, `kpis`, `kpi_entries`, `attendance`, `quality_checks`, `messages`, `meetings`, `meeting_attendees`, `notifications`, `video_projects`, `video_versions`, `video_comments`, `video_share_tokens`, `salaries`

## Key Routes (API)

- `GET /api/healthz` — health check
- `GET/POST /api/tasks` — task management
- `GET/POST /api/kpis`, `/api/kpi-entries` — KPI tracking
- `GET/POST /api/attendance` — clock in/out
- `GET/POST /api/quality-checks` — quality reviews
- `GET/POST /api/messages` — team chat
- `GET/POST /api/meetings` — meeting scheduling
- `GET /api/leaderboard` — employee of the month rankings (3 metrics: on-time 50%, quality 30%, attendance 20%)
- `GET /api/salaries` — payroll view with deduction triggers (admin/HR only)
- `PUT /api/salaries/:userId` — upsert salary config (admin/HR only)
- `GET/POST /api/video-projects`, `/api/video-versions`, `/api/video-comments` — video studio
- `POST /api/video-versions/:id/share-token` — generate public share link
- `GET/POST /api/review/:token` — public client review (no auth required)
- `GET /api/login`, `GET /api/callback`, `GET /api/logout` — Replit OIDC auth
- `POST /api/mobile-auth/token-exchange` — mobile login → `{ token: sid }`
- `POST /api/mobile-auth/logout` — mobile logout
- `POST /api/storage/uploads/request-url` — presigned upload URL
- `GET /api/storage/objects/*` — serve stored files

## API Client — Mobile Support

`lib/api-client-react/src/custom-fetch.ts` exports:
- `setBaseUrl(url)` — prepends absolute domain to all relative `/api/...` requests
- `setAuthTokenGetter(fn)` — called before every request; return the Bearer token string or null

Call both at module level in `app/_layout.tsx` (outside any component) to configure the client for mobile.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` (`composite: true`). Root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root**: `pnpm run typecheck`
- **`emitDeclarationOnly`** — JS bundling handled by esbuild/tsx/vite
- **Project references** — cross-package imports need references in tsconfig.json

## Root Scripts

- `pnpm run build` — typecheck then recursively build all packages
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/scripts run seed` — seed DB with demo data

## Seed Data

5 team members (Alex Ramos/admin, Jessica Kim, Marcus Bell, Sofia Patel, Ryan Chen), 6 tasks (Nike/Spotify/Tesla clients), KPIs, attendance records, quality checks, messages, meetings, notifications, and 3 video projects with versions and comments.
