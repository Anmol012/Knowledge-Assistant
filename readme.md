# Enterprise Knowledge Assistant (RAG)

A scalable enterprise RAG platform for document search and question answering, built with
**FastAPI**, **LangGraph**, **Qdrant**, **Celery/Redis**, **MySQL**, and **Ollama**.

## Features

- **Web UI** — React (Vite + Tailwind) frontend served at `http://localhost:3000` in a
  Gemini/OpenAI-style layout: collapsible sidebar (auto-collapses by viewport, icon rail
  on tablets, overlay drawer on mobile), light/dark theme toggle, chat with markdown
  answers, clickable `[n]` citation chips, expandable sources strip, progressive-reveal
  typing effect, and a model switcher in the composer.
- **Model switcher** — pick the LLM per chat from the composer (like Gemini/OpenAI/DeepSeek):
  always-available local Ollama, external Ollama servers, and any user-configured provider
  (OpenAI, Anthropic, Groq, Gemini, Azure, Mistral, Together). Ollama model lists are
  fetched live from the server; other providers offer curated model lists.
- **Knowledge bases** — group documents into knowledge bases; chat searches one or more
  selected bases (multi-select in the composer). Uploads without a base go to an
  auto-created "Default" base. Bases and their documents are user-private.
- **Async ingestion pipeline** — documents are uploaded, queued via Celery (Redis broker),
  and processed by background workers (extract → chunk → embed → index into Qdrant).
- **Semantic retrieval with Qdrant** — user-scoped vector search with document-level access control.
- **LangGraph RAG pipeline** — conversational memory (last N turns), context-aware generation,
  and **source citations** `[1][2]` with filenames and chunk references in every answer.
- **User-configurable LLM providers** — per-user API keys saved (encrypted, Fernet) in the
  database for OpenAI, Anthropic, Groq, Gemini, Azure, Mistral, Together, and Ollama
  (external Ollama via base URL); falls back to the default local Ollama model
  (`gemma:2b`) when unconfigured.
- **JWT authentication + RBAC** — access/refresh tokens, hashed refresh-token storage
  (revocable), `admin` and `user` roles, admin-only management endpoints.
- **Containerized** — Docker Compose (local) and Kubernetes manifests (cluster).

## Architecture

| Component | Role |
|---|---|
| **FastAPI** | REST API (`/api/v1`) |
| **LangGraph** | Orchestrates chat: load memory → retrieve → generate |
| **Qdrant** | Vector database (cosine similarity, user-scoped filters) |
| **Celery + Redis** | Async document ingestion + task broker/result backend |
| **MySQL** | Persistent metadata: users, documents, chats, messages, provider configs |
| **Ollama** | Local LLM inference (default `gemma:2b`) |
| **SentenceTransformers** | Embeddings (`all-MiniLM-L6-v2`) |

```
┌─────────┐   upload    ┌──────────┐  task  ┌────────┐  extract/chunk/embed  ┌────────┐
│ Client  │ ──────────► │  FastAPI │ ─────► │ Celery │ ───────────────────► │ Qdrant │
└─────────┘             │   API    │        │ Worker │                       └────────┘
     ▲                  └──────────┘        └────────┘
     │  answer+sources      │ chat (LangGraph)     │ metadata reads/writes
     └──────────────────────┴──────────────────────┴──────────┐
                                                             ▼
                                                     ┌─────────────┐
                                                     │    MySQL    │
                                                     └─────────────┘
```

## Project Layout

```
├── api/                  # FastAPI service (auth, documents, chat, providers, admin)
├── worker/               # Celery worker (ingest_document, delete_document)
├── shared/rag_lib/       # Shared code: config, models, chunking, embeddings,
│                         #   vector store, providers, celery app
├── frontend/             # React (Vite + Tailwind) web UI served by Nginx
├── k8s/                  # Kubernetes manifests
├── docker-compose.yml
└── .env.example
```

## Setup (Docker Compose)

1. Copy the environment file and adjust secrets:
   ```bash
   cp .env.example .env
   ```

2. Build and run:
   ```bash
   docker compose up --build
   ```
   First startup downloads the default Ollama model (`gemma:2b`, ~1.4GB).

Services: `frontend` (port 3000), `api` (port 8000), `mysql` (3306), `redis`, `qdrant` (6333), `ollama` (11434), `worker`.

- **Web UI:** http://localhost:3000
- **API docs:** http://localhost:8000/docs

The frontend proxies `/api/v1` to the API through Nginx (same-origin, no CORS issues).

## Quick Start

Open http://localhost:3000, register an account (first user becomes admin), upload a
document, and start chatting. Answers render `[n]` citation chips that expand the source
snippet inline.

Or use the API directly:

```bash
# 1. Register (first user automatically becomes admin)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo-password-123","full_name":"Demo User"}'

# 2. Upload a PDF (returns 202; worker processes asynchronously)
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@sample.pdf"

# 3. Chat with the document (answer + sources with citations)
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is this document about?"}'
```

Or run the interactive client: `python client_example.py` (place `sample.pdf` in the repo root).

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register (first user becomes `admin`) |
| POST | `/api/v1/auth/login` | Login → access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| GET | `/api/v1/auth/me` | Current user |

### Documents
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/documents/upload` | Upload PDF/TXT/MD → queues ingestion (202); optional `knowledge_base_id` form field |
| GET | `/api/v1/documents` | List own documents + status |
| GET | `/api/v1/documents/{id}` | Document status (pending/processing/ready/failed) |
| DELETE | `/api/v1/documents/{id}` | Queue deletion |

### Knowledge Bases
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/knowledge-bases` | Create a knowledge base |
| GET | `/api/v1/knowledge-bases` | List own bases with document counts |
| PATCH | `/api/v1/knowledge-bases/{id}` | Rename / update description |
| DELETE | `/api/v1/knowledge-bases/{id}` | Queue deletion (docs + vectors + base) |

### Chat
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/chat` | Ask question (`chat_id`, `provider`, `model`, `knowledge_base_ids` optional) → answer + sources |
| GET | `/api/v1/chat` | List own chats (with saved model/KB selection) |
| GET | `/api/v1/chat/{id}/messages` | Chat history with sources |
| DELETE | `/api/v1/chat/{id}` | Delete a chat |

### Providers (per-user LLM config)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/providers` | List saved provider configs (keys masked) |
| PUT | `/api/v1/providers` | Save provider + API key + model + optional `base_url` (Ollama: external base URL, no key required) |
| DELETE | `/api/v1/providers/{provider}` | Remove a provider config |
| GET | `/api/v1/providers/models?provider=ollama` | Live model list (Ollama reads server `/api/tags`; others return curated lists) |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/admin/users` | List all users (admin only) |
| PATCH | `/api/v1/admin/users/{id}/role` | Change user role (admin only) |
| GET | `/api/v1/admin/stats` | Platform stats (admin only) |

### Other
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |

## Supported LLM Providers

`openai`, `anthropic`, `groq`, `gemini`, `azure`, `mistral`, `together`, `ollama`.

Resolution order per chat: the `provider`/`model` chosen in the model switcher (saved on
the chat) → user's saved provider config (from `/settings`) → env default
(`DEFAULT_PROVIDER=ollama`, `OLLAMA_MODEL=gemma:2b`).

Ollama is always available as the default. To use a remote Ollama server, save a provider
config with provider `ollama` and its `base_url` (e.g. `http://192.168.1.10:11434`) — no
API key needed.

## Configuration

See `.env.example` for all options. Key variables:

- `JWT_SECRET` — JWT signing secret (**change in production**)
- `FERNET_KEY` — Fernet key for provider API key encryption (defaults to derived from `JWT_SECRET`)
- `OLLAMA_MODEL` — default local model (e.g. `gemma:2b`, `phi3:mini`, `qwen2:1.5b`)
- `DATABASE_URL` / `MYSQL_*` — metadata store connection
- `QDRANT_HOST` / `QDRANT_PORT` — vector store connection
- `CHUNK_SIZE` / `CHUNK_OVERLAP` / `TOP_K` / `MEMORY_TURNS` — RAG tuning

## Kubernetes Deployment

```bash
# Optionally build and push images, then update image refs in k8s/*.yaml
kubectl apply -f k8s/
```

The manifests deploy: namespace, ConfigMap, Secrets, MySQL/Qdrant StatefulSets (PVCs),
Redis, Ollama, API (2 replicas), worker, frontend (2 replicas), and an Ingress
(`rag.example.com` — update the host). The Ingress routes `/api/v1` to the API and
everything else to the frontend. The uploads PVC requires a ReadWriteMany storage class
(e.g. NFS) so API and worker pods can share uploaded files; swap to `emptyDir` for
single-node testing.

## Frontend Development (local, without Docker)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api/v1 → localhost:8000
```

## Security Notes

- Provider API keys are encrypted at rest (Fernet).
- Refresh tokens are stored hashed (SHA-256) and rotated on every use.
- All document/chat endpoints enforce ownership — users can only access their own data
  (payload-level Qdrant filters + DB ownership checks).
- Change `JWT_SECRET` (and ideally `FERNET_KEY`) before any non-local deployment.

## Development (without Docker)

```bash
pip install -r api/requirements.txt -r worker/requirements.txt
ollama serve &   # or run ollama container
ollama pull gemma:2b
export DATABASE_URL="mysql+pymysql://root:password@localhost:3306/ragdb?charset=utf8mb4"
export REDIS_URL="redis://localhost:6379/0" QDRANT_HOST=localhost OLLAMA_HOST=localhost
uvicorn app.main:app --app-dir api --host 0.0.0.0 --port 8000 &
celery -A app.tasks worker --app-dir worker --loglevel=info
```

## Troubleshooting

- **First response is slow** — model weights are being loaded into memory; subsequent calls are faster.
- **Document stuck on `pending`/`processing`** — check worker logs: `docker compose logs worker`.
- **No relevant documents found** — confirm the document status is `ready` and it was uploaded by the same user.
- **Changing the default model** — set `OLLAMA_MODEL` in `.env`, rebuild, and the `ollama-setup` container pulls it on next `docker compose up`.