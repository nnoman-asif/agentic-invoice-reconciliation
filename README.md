# Agentic Invoice Reconciliation

A production-grade, full-stack multi-agent system that automates 3-way invoice matching (Purchase Order vs Invoice vs Delivery Receipt) using LangGraph, with human-in-the-loop for exceptions, RAG over historical decisions, full observability via Langfuse, and an Apple-quality React frontend featuring a live pipeline visualizer, side-by-side document comparison, and a 3D reconciliation flow.

## Architecture

```
                          +------------------+
                          |  Invoice Upload  |
                          |     (PDF)        |
                          +--------+---------+
                                   |
                                   v
+-------------+           +------------------+
|   FastAPI   +---------->+   Redis Queue    |
|  (REST API) |           +--------+---------+
+-------------+                    |
                                   v
                          +------------------+
                          | Background Worker|
                          +--------+---------+
                                   |
              +--------------------+--------------------+
              |        LangGraph Agent Pipeline         |
              |                                         |
              |  +----------+  +----------+  +--------+ |
              |  |  Parser  +->+ Matcher  +->+Anomaly | |
              |  |  Agent   |  |  Agent   |  | Agent  | |
              |  |(LLM+PDF) |  |(SQL+Emb) |  |(Rules) | |
              |  +----------+  +----------+  +---+----+ |
              |                                  |      |
              |                          +-------v----+ |
              |                          | Resolution | |
              |                          |   Agent    | |
              |                          | (LLM+RAG)  | |
              |                          +------+-----+ |
              +---------------------------------+-------+
                                                |
                              +-----------------+-----------------+
                              |                                   |
                      +-------v-------+                 +---------v---------+
                      |  Auto-Approve |                 |   Human Review    |
                      |  (no issues)  |                 | (pending review)  |
                      +---------------+                 +-------------------+

Infrastructure: PostgreSQL+pgvector | Redis | Ollama (Qwen 2.5 7B) | Langfuse
```

## Tech Stack

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| LLM | Qwen 2.5 7B (via Ollama) | Invoice parsing, resolution recommendations |
| Embeddings | Qwen3-Embedding-0.6B (via Ollama) | 1024-dim vectors for RAG + description matching |
| Agent Framework | LangGraph | Stateful agent orchestration with checkpointing |
| Backend | FastAPI (async) | REST API with webhook support |
| Database | PostgreSQL 16 + pgvector | Structured data + vector similarity search |
| Cache / Queue | Redis 7 | Job queuing for async invoice processing |
| Observability | Langfuse v3 (self-hosted) | End-to-end pipeline tracing |
| Eval | Promptfoo | LLM output evaluation and regression testing |
| Deployment | Docker + Docker Compose | Containerized services |

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Build tool | Vite 5 | Lightning-fast dev server |
| Framework | React 18 + TypeScript | Type-safe UI with FastAPI types mirrored |
| Styling | TailwindCSS + shadcn/ui | Apple-quality component library |
| Animations | Framer Motion | Spring physics, page transitions |
| 3D | React Three Fiber + drei | Three.js with React |
| Server state | TanStack Query | Auto-caching, polling, mutations |
| Charts | Tremor / custom | Match rate, processing time, discrepancies |
| PDF | react-pdf | PDF rendering for compare view |

## Features

### Backend

- **Stateful Multi-Agent Pipeline**: 4 specialized agents (Parser, Matcher, Anomaly, Resolution) orchestrated via LangGraph with conditional routing and error handling
- **3-Way Line-Item Matching**: Compares invoice line items against PO and delivery receipt data at the individual line level
- **8 Anomaly Detection Checks**: Duplicate invoices, price deviations, quantity mismatches, missing POs, missing receipts, date anomalies, amount overages, unauthorized vendors
- **Human-in-the-Loop**: Exceptions route to humans via API with agent-generated recommendations
- **RAG Over Historical Decisions**: Past reconciliation outcomes are embedded and retrieved to improve future recommendations
- **Full Observability**: Every agent step traced via Langfuse with processing time metrics
- **Production-Ready**: Docker deployment, async processing, Redis queuing, health checks

### Frontend

- **Apple-quality UI**: Light/dark mode with system-aware toggle, generous whitespace, soft shadows, frosted glass effects, spring-physics animations
- **Live Pipeline Visualizer**: Watch each agent execute in real-time with timing and click any stage to inspect its output
- **Side-by-Side Document Compare**: PDF viewer next to matched PO/delivery data with animated SVG match lines
- **3D Reconciliation Flow**: Cinematic Three.js scene of invoices flowing through the pipeline
- **Cmd+K Command Palette**: Global search and navigation
- **Real-time Updates**: TanStack Query polls for status changes during processing
- **Mobile-Responsive**: Works on phones, tablets, and desktops

## Database Schema

12 normalized tables with proper FK constraints, CHECK constraints, and indices:

```
vendors ---< purchase_orders ---< po_line_items
   |              |
   |              +---< delivery_receipts ---< delivery_line_items
   |
invoices ---< invoice_line_items
   |
   +---< reconciliations ---< line_item_matches
              |                    |
              +---< discrepancies -+
              +---< human_reviews
              +---< reconciliation_embeddings (pgvector)
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/download)
- [Python 3.11+](https://www.python.org/downloads/)
- [Node.js LTS](https://nodejs.org/) (for Promptfoo)

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/nnoman-asif/agentic-invoice-reconciliation.git
cd agentic-invoice-reconciliation

cp .env.example .env
# Edit .env if you need to change defaults
```

### 2. Pull Ollama models

```bash
ollama pull qwen2.5:7b
ollama pull qwen3-embedding:0.6b
```

### 3. Start infrastructure

```bash
# Core services (PostgreSQL + Redis)
docker compose up -d postgres redis

# Wait for services to be healthy, then create tables
pip install -r requirements.txt
python -m app.db.setup_db

# Seed sample data
python -m app.db.seed
```

### 4. Generate sample invoice PDFs

```bash
pip install reportlab
python -m sample_data.generate_sample_pdfs
```

### 5. Start the backend

```bash
# Terminal 1: FastAPI server
uvicorn app.main:app --reload --port 8000

# Terminal 2: Background worker
python -m app.worker
```

### 6. Start the frontend

```bash
# Terminal 3: Vite dev server
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 7. (Optional) Start Langfuse for observability

```bash
docker compose --profile observability up -d
# Langfuse UI at http://localhost:3000
# Note: this conflicts with the frontend Docker service on port 3000
# Run frontend in dev mode (npm run dev on 5173) when using observability profile
```

### Full Docker setup (alternative)

To run everything in containers:

```bash
docker compose up -d
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

## API Reference

### Invoice Processing

```bash
# Upload an invoice for processing
curl -X POST http://localhost:8000/api/invoices/upload \
  -F "file=@sample_data/invoices/invoice_clean_match.pdf"

# List all invoices
curl http://localhost:8000/api/invoices

# Get invoice details
curl http://localhost:8000/api/invoices/{invoice_id}

# Get reconciliation result
curl http://localhost:8000/api/invoices/{invoice_id}/reconciliation
```

### Human-in-the-Loop

```bash
# List exceptions pending review
curl http://localhost:8000/api/exceptions

# Approve an exception
curl -X POST http://localhost:8000/api/exceptions/{reconciliation_id}/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewer_notes": "Price increase was pre-approved", "decided_by": "admin"}'

# Reject an exception
curl -X POST http://localhost:8000/api/exceptions/{reconciliation_id}/reject \
  -H "Content-Type: application/json" \
  -d '{"reviewer_notes": "Unauthorized price change", "decided_by": "admin"}'
```

### Data Management

```bash
# List purchase orders
curl http://localhost:8000/api/purchase-orders

# Dashboard stats
curl http://localhost:8000/api/dashboard/stats

# Health check
curl http://localhost:8000/health
```

### Webhook

`POST /api/webhooks/invoice-received` re-queues an existing invoice for
processing. Use it when:

- An ERP / upstream system has dropped a row directly into the
  `invoices` table and you want the agent pipeline to pick it up.
- An invoice ended up stuck in `queued` (e.g., the worker was down
  when the upload happened) or `failed` and you want to retry it.

```bash
curl -X POST http://localhost:8000/api/webhooks/invoice-received \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "<uuid>"}'
```

Returns `200 {"status": "queued", "invoice_id": "..."}` on success,
`409` if the invoice is already `parsing`/`matching`/`resolving`/`completed`,
`400` for a bad UUID, or `404` if the id is unknown.

Interactive API docs available at **http://localhost:8000/docs** (Swagger UI).

## Agent Pipeline

```
+-------------------+     +--------------------+     +-------------------+
| 1. Parser Agent   |     | 2. Matcher Agent   |     | 3. Anomaly Agent  |
|                   | --> |                    | --> |                   |
| LLM extracts      |     | SQL finds matching |     | Rule engine runs  |
| structured data   |     | PO & delivery      |     | 8 checks for      |
| from invoice PDF  |     | receipts, does     |     | discrepancies     |
|                   |     | 3-way line match   |     |                   |
+-------------------+     +--------------------+     +--------+----------+
                                                              |
                                                              v
                                                  +-------------------+
                                                  | 4. Resolution     |
                                                  |    Agent          |
                                                  |                   |
                                                  | LLM + RAG decides |
                                                  | auto-approve or   |
                                                  | human review      |
                                                  +-------------------+
```

## Eval Suite

Run LLM evaluations with Promptfoo:

```bash
cd eval
npx promptfoo@latest eval -c promptfoo.yaml
npx promptfoo@latest view
```

Tests cover:
- Parser accuracy (field extraction from different invoice formats)
- Structured JSON output validation
- Edge cases (missing fields, different date formats)

## Project Structure

```
agentic-invoice-reconciliation/
├── app/                            # FastAPI backend
│   ├── main.py                     # App entrypoint with CORS + static files
│   ├── config.py                   # Settings via pydantic-settings
│   ├── worker.py                   # Redis queue consumer
│   ├── api/routes/                 # 6 route modules + webhook
│   ├── agents/                     # LangGraph state machine + 4 agents
│   ├── tools/                      # PDF extraction, DB queries, matching, anomalies
│   ├── rag/                        # Embeddings, indexer, retriever
│   ├── models/                     # SQLAlchemy ORM + Pydantic schemas
│   ├── db/                         # Raw SQL setup, async session, seeder
│   ├── services/                   # Invoice + reconciliation orchestration
│   └── observability/              # Langfuse v3 tracing
├── frontend/                       # React + Vite frontend
│   ├── src/
│   │   ├── api/                    # TanStack Query hooks per resource
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui primitives
│   │   │   ├── layout/             # Sidebar, TopBar, ThemeToggle, CommandPalette
│   │   │   ├── invoice/            # Status badges, upload zone, table, line matches
│   │   │   ├── pipeline/           # Live agent visualizer (Wow #1)
│   │   │   ├── compare/            # Side-by-side document compare (Wow #2)
│   │   │   ├── flow/               # 3D Three.js scene (Wow #3)
│   │   │   ├── dashboard/          # Stat cards, charts, activity feed
│   │   │   └── shared/             # PageHeader, AnimatedNumber, ConfidenceBar, etc.
│   │   ├── pages/                  # 10 routed pages
│   │   ├── hooks/                  # useTheme, useLivePipeline
│   │   ├── lib/                    # cn(), format helpers, route constants
│   │   ├── store/                  # Zustand UI state
│   │   └── styles/globals.css      # Tailwind + design tokens
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── Dockerfile                  # Multi-stage build with nginx
│   └── nginx.conf                  # SPA routing + caching
├── eval/promptfoo.yaml             # LLM eval suite
├── sample_data/                    # Sample PDFs and JSON seed data
├── tests/conftest.py               # Pytest fixtures
├── docker-compose.yml              # All services (incl. frontend + Langfuse profile)
├── Dockerfile                      # Backend Python container
├── requirements.txt
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## Known Simplifications

These are intentional scope decisions for v1:

- **1:1 invoice-to-PO mapping**: Multi-PO invoices are not supported (each invoice matches at most one PO)
- **No authentication**: Human reviewer identity is stored as a plain string, no auth system
- **No soft deletes**: Records are hard-deleted
- **Single currency**: Cross-currency reconciliation flags a discrepancy rather than converting

## Docker Commands

```bash
# Start core services only
docker compose up -d postgres redis

# Start everything including Langfuse
docker compose --profile observability up -d

# View logs
docker compose logs -f app

# Reset database
python -m app.db.setup_db --reset
python -m app.db.seed

# Stop all
docker compose down
```

## License

All Rights Reserved
