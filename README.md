# Agentic Invoice Reconciliation

A production-grade, multi-agent system that automates 3-way invoice matching (Purchase Order vs Invoice vs Delivery Receipt) using LangGraph, with human-in-the-loop for exceptions, RAG over historical decisions, and full observability.

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

## Features

- **Stateful Multi-Agent Pipeline**: 4 specialized agents (Parser, Matcher, Anomaly, Resolution) orchestrated via LangGraph with conditional routing and error handling
- **3-Way Line-Item Matching**: Compares invoice line items against PO and delivery receipt data at the individual line level
- **8 Anomaly Detection Checks**: Duplicate invoices, price deviations, quantity mismatches, missing POs, missing receipts, date anomalies, amount overages, unauthorized vendors
- **Human-in-the-Loop**: Exceptions route to humans via API with agent-generated recommendations
- **RAG Over Historical Decisions**: Past reconciliation outcomes are embedded and retrieved to improve future recommendations
- **Full Observability**: Every agent step traced via Langfuse with processing time metrics
- **Production-Ready**: Docker deployment, async processing, Redis queuing, health checks

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

### 5. Start the application

```bash
# Terminal 1: FastAPI server
uvicorn app.main:app --reload --port 8000

# Terminal 2: Background worker
python -m app.worker
```

### 6. (Optional) Start Langfuse for observability

```bash
docker compose --profile observability up -d
# Langfuse UI at http://localhost:3000
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

```bash
# Trigger processing for an existing invoice
curl -X POST http://localhost:8000/api/webhooks/invoice-received \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "..."}'
```

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
Invoice_Reconciliation_Agent/
├── app/
│   ├── main.py                     # FastAPI app entrypoint
│   ├── config.py                   # Settings via pydantic-settings
│   ├── worker.py                   # Redis queue consumer
│   ├── api/
│   │   ├── routes/
│   │   │   ├── invoices.py         # Upload, list, detail, reconciliation
│   │   │   ├── purchase_orders.py  # CRUD for purchase orders
│   │   │   ├── delivery_receipts.py# CRUD for delivery receipts
│   │   │   ├── exceptions.py       # Human approve/reject endpoints
│   │   │   ├── dashboard.py        # Aggregation stats
│   │   │   └── health.py           # Service health check
│   │   └── webhooks/
│   │       └── invoice_webhook.py  # External processing trigger
│   ├── agents/
│   │   ├── state.py                # LangGraph state definition
│   │   ├── graph.py                # State machine (nodes + edges)
│   │   ├── parser_agent.py         # LLM-based PDF data extraction
│   │   ├── matcher_agent.py        # PO/receipt 3-way matching
│   │   ├── anomaly_agent.py        # Rule-based discrepancy detection
│   │   └── resolution_agent.py     # LLM+RAG approval decision
│   ├── tools/
│   │   ├── pdf_extractor.py        # PyMuPDF text extraction
│   │   ├── db_queries.py           # Vendor/PO/receipt lookups
│   │   ├── matching_logic.py       # 3-way line-item matching algorithm
│   │   └── anomaly_checks.py       # 8 anomaly detection rules
│   ├── rag/
│   │   ├── embeddings.py           # Ollama embedding generation
│   │   ├── indexer.py              # Store reconciliations in pgvector
│   │   └── retriever.py            # Similar case retrieval
│   ├── models/
│   │   ├── database.py             # SQLAlchemy ORM models (12 tables)
│   │   └── schemas.py              # Pydantic request/response schemas
│   ├── db/
│   │   ├── setup_db.py             # Raw SQL table creation script
│   │   ├── session.py              # Async DB session factory
│   │   └── seed.py                 # Sample data seeder
│   ├── services/
│   │   ├── invoice_service.py      # Pipeline orchestration + DB persistence
│   │   └── reconciliation_service.py # Human review + RAG indexing
│   └── observability/
│       └── tracing.py              # Langfuse v3 integration
├── eval/
│   └── promptfoo.yaml              # LLM evaluation config + test cases
├── sample_data/
│   ├── invoices/                   # 3 generated sample invoice PDFs
│   ├── purchase_orders.json        # 5 sample POs with line items
│   ├── delivery_receipts.json      # 5 sample receipts
│   └── generate_sample_pdfs.py     # PDF generation script
├── tests/
│   └── conftest.py                 # Pytest fixtures
├── docker-compose.yml              # PostgreSQL, Redis, Langfuse v3
├── Dockerfile                      # Python 3.11 container
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment variable template
├── .gitignore
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
