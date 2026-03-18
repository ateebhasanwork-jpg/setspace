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
- **File storage**: GCS-backed object storage via Replit object storage
- **Email**: Nodemailer (meeting invites — requires EMAIL_HOST, EMAIL_USER, EMAIL_PASS env vars)
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui + framer-motion + recharts

## Features

- **Dashboard**: KPI summaries, attendance overview, recent activity
- **Task Management**: Kanban-style board with assignees, priority, due dates
- **KPIs**: Per-employee KPI tracking with target vs. actual entries
- **Attendance**: Clock in/out with daily records and status tracking
- **Quality Checks**: 1–5 star peer reviews with feedback and approval workflow
- **Leaderboard**: Automated "Employee of the Month" scoring (KPI 35%, attendance 25%, quality 25%, on-time 15%)
- **Team Chat**: Real-time-style threaded messages
- **Meetings**: Scheduling with attendees, email notifications, and calendar links
- **Notifications**: Per-user notification feed
- **Video Review Studio**: Native Frame.io-style — video upload via presigned URLs, timestamped comments, version history, approval workflow, public client share links (`/review/:token`)

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/          # Express API (port via $PORT, serves at /api)
│   └── setspace/            # React+Vite frontend (port via $PORT, base path /)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
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

Tables: `users`, `sessions`, `tasks`, `kpis`, `kpi_entries`, `attendance`, `quality_checks`, `messages`, `meetings`, `meeting_attendees`, `notifications`, `video_projects`, `video_versions`, `video_comments`, `video_share_tokens`

## Key Routes (API)

- `GET /api/healthz` — health check
- `GET/POST /api/tasks` — task management
- `GET/POST /api/kpis`, `/api/kpi-entries` — KPI tracking
- `GET/POST /api/attendance` — clock in/out
- `GET/POST /api/quality-checks` — quality reviews
- `GET/POST /api/messages` — team chat
- `GET/POST /api/meetings` — meeting scheduling
- `GET /api/leaderboard` — employee of the month rankings
- `GET/POST /api/video-projects`, `/api/video-versions`, `/api/video-comments` — video studio
- `POST /api/video-versions/:id/share-token` — generate public share link
- `GET/POST /api/review/:token` — public client review (no auth required)
- `GET /api/login`, `GET /api/callback`, `GET /api/logout` — Replit OIDC auth
- `POST /api/storage/uploads/request-url` — presigned upload URL
- `GET /api/storage/objects/*` — serve stored files

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
