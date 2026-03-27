# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project is the **SRP AI Idea-to-MVP Engine** — a pre-sales web app for Silk Road Professionals where potential clients chat with Claude AI about their software idea, receive a qualification score, provide their email, and get a generated prototype (clickable HTML or Technical Concept Summary).

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
- **AI**: Anthropic Claude (via `@workspace/integrations-anthropic-ai`)
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, React Query, Wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/             # Express API server
│   └── srp-idea-engine/        # React+Vite frontend (SRP AI Idea Engine)
├── lib/                        # Shared libraries
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-client-react/       # Generated React Query hooks
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   ├── db/                     # Drizzle ORM schema + DB connection
│   └── integrations-anthropic-ai/  # Anthropic AI client wrapper
├── scripts/                    # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Application Features

### Public-facing Chat Flow
1. **Landing page** (`/`) — Hero with input field for the initial idea
2. **Chat view** — SSE-streamed Claude conversation guided by SRP system prompt
3. **Email capture** — After ~4+ messages, prompt for email (triggers qualification + prototype generation)
4. **Prototype preview** (`/preview/:id`) — Shows clickable HTML or technical summary

### Admin Dashboard
- Path: `/admin?token=srp-admin-2024`
- Shows all leads with qualification scores, segments, idea summaries
- Can view full conversation transcripts and prototypes
- Can update lead status, notes, next actions

### API Endpoints
- `POST /api/conversations` — Start new conversation (rate-limited: 3/IP/day)
- `GET /api/conversations/:sessionId` — Get conversation + messages
- `POST /api/conversations/:sessionId/messages` — Send message (SSE stream)
- `POST /api/conversations/:sessionId/contact` — Capture email → triggers qualification + prototype generation
- `GET /api/conversations/:sessionId/score` — Get lead score
- `GET /api/prototypes/:id` — Get prototype data
- `POST /api/prototypes/:id/generate` — (Re)generate prototype
- `GET /api/leads?token=srp-admin-2024` — List all leads (admin)
- `GET /api/leads/:id?token=srp-admin-2024` — Get lead details (admin)
- `PATCH /api/leads/:id?token=srp-admin-2024` — Update lead (admin)

### Backend Libs
- `artifacts/api-server/src/lib/srp-system-prompt.ts` — Claude system prompts for conversation + qualification + prototype generation
- `artifacts/api-server/src/lib/qualification.ts` — Claude-powered lead scoring (0-100)
- `artifacts/api-server/src/lib/prototype-generator.ts` — Generates `clickable_web` or `technical_summary` prototypes
- `artifacts/api-server/src/lib/rate-limiter.ts` — In-memory rate limiter (3 conversations/IP/day)

## Database Schema

### `leads`
Full lead record: sessionId, email, name, company, roleTitle, qualificationScore (0-100), qualificationSegment (high_fit/medium_fit/low_fit/not_qualified), ideaSummary, productType, platform, primaryFeatures (json), prototypeType, prototypeUrl, status, notes, nextAction, converted, dealValue, etc.

### `prototypes`
- id (uuid), leadId (fk), type (clickable_web | technical_summary), status (pending/generating/ready/failed), htmlContent (full HTML stored inline)

### `chat_messages`
- id (uuid), leadId (fk), role (user | assistant), content, createdAt

### `conversations` / `messages`
- Legacy Anthropic demo tables (serial int IDs)

## Admin Access
- Query param: `?token=srp-admin-2024`
- Header: `x-admin-token: srp-admin-2024`
- Can also configure via `ADMIN_TOKEN` env var

## Lead Qualification Segments
- `high_fit` — score 70-100
- `medium_fit` — score 40-69
- `low_fit` — score 15-39
- `not_qualified` — score 0-14

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request/response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts`, `conversations.ts`, `leads.ts`, `prototypes.ts`, `anthropic.ts`, `health.ts`
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-anthropic-ai`

### `artifacts/srp-idea-engine` (`@workspace/srp-idea-engine`)

React + Vite frontend. Single-page app with Wouter routing.

- Pages: `src/pages/chat.tsx` (main), `src/pages/admin.tsx`, `src/pages/preview.tsx`
- Hooks: `src/hooks/use-chat-stream.ts` — SSE streaming logic
- Components: `src/components/chat-bubble.tsx`, shadcn/ui in `src/components/ui/`
- Images: `public/images/hero-bg.png`, `public/images/logo.png`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/leads.ts`, `prototypes.ts`, `chat-messages.ts`, `conversations.ts`, `messages.ts`
- Run migrations: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.
Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/integrations-anthropic-ai` (`@workspace/integrations-anthropic-ai`)

Anthropic AI client wrapper (via Replit AI Integrations proxy). Exports `anthropic` client instance.

### `scripts` (`@workspace/scripts`)

Utility scripts package.
