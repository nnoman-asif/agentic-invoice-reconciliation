# Frontend - Agentic Invoice Reconciliation

Production-grade React + TypeScript UI for the Invoice Reconciliation Agent backend.

## Tech Stack

- React 18 + Vite + TypeScript
- TailwindCSS + shadcn/ui (Radix UI primitives)
- Framer Motion (animations)
- React Three Fiber + drei (3D scene)
- TanStack Query (server state)
- Zustand (UI state)
- React Router 6
- react-pdf (PDF rendering)
- Sonner (toasts)
- Lucide Icons

## Pages

1. `/` — Landing hero
2. `/dashboard` — Stats, charts, activity feed
3. `/invoices` — Inbox with drag-drop upload + live status
4. `/invoices/:id` — Reconciliation detail with tabs
5. `/invoices/:id/compare` — Side-by-side PDF + matched data **(Wow #2)**
6. `/pipeline` — Live agent pipeline visualizer **(Wow #1)**
7. `/flow` — 3D Three.js scene **(Wow #3)**
8. `/exceptions` — Pending review with approve/reject
9. `/purchase-orders` — Searchable PO table
10. `/settings` — Theme, system health, about

Plus: **Cmd+K** command palette for global navigation.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit **http://localhost:5173**.

The dev server proxies `/api` and `/health` to the backend at `http://localhost:8000`.

## Build

```bash
npm run build
npm run preview
```

## Docker

```bash
docker build -t ira-frontend .
docker run -p 3000:80 ira-frontend
```

Or run via the root `docker-compose.yml`:

```bash
docker compose up -d
# Frontend at http://localhost:3000
# Backend at http://localhost:8000
```

## Environment

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend FastAPI URL |
