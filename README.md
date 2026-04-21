# SolNuv
## AI-native Solar Design, Verification, and Lifecycle Platform

SolNuv is a full-stack platform for solar project teams, partner organizations, and compliance stakeholders. It combines design simulation, financial modeling, verification rails, partner workflows, and report generation into one operating system.

## What SolNuv Does

- **Project design and simulation:** PV + BESS modeling, topology-aware flows (grid-tied, off-grid, hybrid), tariff-aware economics.
- **AI-assisted engineering workflows:** design feedback, risk insights, guided recommendations, and explainable report outputs.
- **Verification rails:** project verification, professional/company competency verification, and training institute attestation flows.
- **Partner network operations:** recycler, financier, and training institute portals with role-aware workflows.
- **Compliance and reporting:** NESREA-oriented exports, downloadable design reports, share links, and traceability metadata.
- **Content operations:** admin content studio and pitch/cms management for route-level content control.

## Core Capabilities (Current State)

### Product
- Public and authenticated design/report experiences.
- Advanced project design wizard with live preview.
- Shareable report pages and downloadable artifacts (PDF/Excel/pack).
- Training institute impact views and verification request queues.
- Admin controls for platform operations and content.

### Engineering
- Canonical report modernization blueprint at `docs/report-system-upgrade-blueprint.md`.
- Initial V2 report schema scaffolding in `backend/src/types/reportV2.ts`.
- Formula governance scaffolding in `backend/src/services/formulaRegistry.ts`.
- Simulation provenance metadata and uncertainty/risk support in report flows.
- V2 Oracle runtime (parallel to V1) under `/api/v2/*`.

## Architecture

- **Frontend:** Next.js (Pages Router), TypeScript, Tailwind.
- **Backend:** Node.js + Express + TypeScript.
- **Database/Auth:** Supabase (Postgres + Auth).
- **Hosting:** Vercel (frontend), Render (backend).
- **Integrations:** Paystack, Termii, Cal, and other operational services.

Repository layout:

```text
frontend/    Next.js application
backend/     API services, simulation/report controllers, integrations
database/    SQL migrations and seeds
docs/        Architecture, API, and rollout documentation
```

## Local Development

### Prerequisites
- Node.js 18+
- npm
- Supabase project (or equivalent env-backed Postgres setup)

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure environment variables

- Copy and fill:
  - `backend/.env.example` -> `backend/.env`
  - `frontend/.env.example` (or `.env.local`) for client-side vars
- Ensure backend has Supabase, JWT, payment, and messaging keys.
- Ensure frontend points to your backend API URL.

### 3) Run services

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

Frontend default: `http://localhost:3000`  
Backend default: `http://localhost:5000`

## Quality Checks

```bash
cd backend && npm run typecheck
cd ../frontend && npm run typecheck
cd ../frontend && npm run build
```

V2 smoke test:

```bash
cd backend
npm run test:v2-smoke -- https://api.solnuv.com
```

## Deployment Overview

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Supabase
- **Domain:** `solnuv.com` (frontend), `api.solnuv.com` (backend)

High-level deployment steps:
1. Push code to GitHub.
2. Apply database migrations from `database/migrations`.
3. Deploy backend with required env vars.
4. Deploy frontend with public env vars.
5. Configure DNS and callback URLs.
6. Run health and smoke checks.

## Important Docs

- V2 Oracle API: `docs/v2-oracle-api.md`
- Report modernization blueprint: `docs/report-system-upgrade-blueprint.md`
- Platform hardening runbook: `docs/platform-hardening-runbook.md`
- TypeScript migration rollout: `docs/typescript-migration-rollout.md`

## Selected API Surfaces

### Health
- `GET /api/health`
- `GET /api/v2/health`

### Simulation and reports
- project design, simulation run, report html/pdf/excel/pack, share links

### Verification and partners
- public professional/company search
- training institute requests/import/impact

### CMS and pitch/admin
- global CMS resolve/admin endpoints
- pitch deck public/admin endpoints

## Notes on Positioning

SolNuv is evolving from a traditional solar workflow app into an **AI-native execution and trust layer**: model, verify, govern, and prove outcomes with auditable data.

## Support

- Platform support: `compliance@solnuv.com`
- External platform docs:
  - [Supabase Docs](https://supabase.com/docs)
  - [Vercel Docs](https://vercel.com/docs)
  - [Render Docs](https://render.com/docs)

---

SolNuv — built for modern solar execution, verification, and lifecycle intelligence.
