# Rewamp

> An AI-powered book exploration and question-answering platform that connects high-fidelity PDF reading with grounded conversational AI assistance.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [High-Level Architecture](#high-level-architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [How to Use Rewamp](#how-to-use-rewamp)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Limitations and License](#limitations-and-license)

---

## Project Overview

**Rewamp** is a full-stack reading and literary research application designed to combine classic literature with grounded conversational AI assistance. Built with a **React 19 / TypeScript** frontend and a **FastAPI** backend, Rewamp allows readers to browse a digital book collection, read PDFs through an interactive reader, and ask natural-language questions about any book.

Answers are grounded in the text of the selected book rather than generic pre-trained knowledge. Every response includes verifiable citation cards that link directly into the embedded PDF reader at the referenced page, allowing users to inspect the original source material instantly.

---

## Key Features

- **Interactive In-Browser PDF Reader**: Full-screen reading powered by React-PDF and PDF.js with zoom controls, fit-to-width, multi-page navigation, and theme customization.
- **Book-Isolated Question Answering**: Questions are strictly evaluated against passages retrieved from the selected book to prevent cross-document confusion.
- **Page-Linked Citations**: Answers provide source citations detailing page numbers, chapter context, and excerpt text, with one-click navigation to the exact page in the reader.
- **Grounded Responses**: The retrieval pipeline checks whether retrieved passages contain sufficient evidence and explains when details are missing instead of generating speculative content.
- **Asynchronous Ingestion**: Ingests, chunks, embeds, and indexes books into vector storage with background job processing and persistent status tracking.
- **Adaptive Theming**: Built-in support for dark, light, and system themes across the entire interface.

---

## Technology Stack

| Layer | Technologies & Libraries | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite 6 | Client application and fast development tooling |
| **Routing** | React Router DOM 7 | Client-side page navigation (`/`, `/library`, `/read`, `/chat`) |
| **PDF Rendering** | React-PDF 9, PDF.js Dist 4.10 | Canvas and text-layer rendering for PDF reading |
| **Backend Framework** | Python 3.10+, FastAPI, Uvicorn | Asynchronous REST API service and static file streaming |
| **Document Processing**| PyMuPDF (`fitz`), PyPDF | Page-level text extraction, metadata parsing, and cover rendering |
| **Embeddings** | FastEmbed (`BAAI/bge-small-en-v1.5`) | Local dense vector embeddings (384 dimensions) |
| **Vector Database** | Qdrant Cloud | Scalable vector search with book-level filtering |
| **LLM Provider** | Groq Python SDK (`qwen/qwen3.8-27b`) | Grounded answer generation and conversational assistance |
| **State Persistence** | SQLite3 (WAL mode) | Background job tracking and ingestion status storage |
| **Testing** | Pytest (Backend), Vitest & Testing Library (Frontend) | Unit, integration, and component testing |

---

## High-Level Architecture

Rewamp pairs a client-side Single-Page Application (SPA) with an asynchronous FastAPI backend service:

- **Frontend (React 19 / TypeScript / Vite)**: Handles route transitions across the library catalog, interactive PDF reader, and chat workspace. It connects to the backend via typed HTTP requests and uses Vite's proxy during development.
- **Backend (FastAPI / Uvicorn)**: Manages book metadata, streams PDF files, generates cover thumbnails on demand, tracks ingestion jobs via SQLite, and coordinates the question-answering workflow.
- **RAG Workflow**:
  The retrieval-augmented generation workflow follows a focused multi-stage pipeline:

  **PDF text extraction → text chunking and embeddings → vector indexing → relevant-context retrieval → grounded AI answers with page-linked citations.**

  1. **Extraction & Chunking**: PyMuPDF extracts text page by page. The chunker divides pages into token-bounded passages while tracking page numbers and chapter boundaries.
  2. **Vector Indexing**: FastEmbed generates dense embeddings that are stored in Qdrant Cloud with book-scoped metadata.
  3. **Retrieval**: When a question is submitted, the system queries Qdrant for passages matching the active book, applies candidate deduplication, and verifies evidence sufficiency.
  4. **Generation & Grounding**: Groq generates a plain-text answer strictly from the retrieved excerpts, and valid citation references are extracted for direct navigation.

---

## Project Structure

```text
Rewamp/
├── backend/
│   ├── main.py                  # FastAPI application entry point and route definitions
│   ├── requirements.txt         # Backend Python dependencies
│   ├── data/
│   │   ├── books/               # PDF book collection
│   │   ├── covers/              # Generated cover thumbnail cache (gitignored)
│   │   ├── rag_state.db         # Persistent SQLite database for ingestion state
│   │   └── ingestion_status.json# Ingestion status snapshot
│   ├── rag/                     # RAG pipeline implementation
│   │   ├── chunker.py           # Structure- and token-aware text chunking
│   │   ├── config.py            # Centralized settings and credentials management
│   │   ├── embedder.py          # FastEmbed model wrapper
│   │   ├── extractor.py         # PyMuPDF text and metadata extraction
│   │   ├── generator.py         # Groq LLM answer generation and caching
│   │   ├── ingestion.py         # Background indexing orchestrator
│   │   ├── pipeline.py          # Query orchestration and diagnostic assembly
│   │   ├── retriever.py         # Multi-angle search, deduplication, and evidence evaluation
│   │   ├── schemas.py           # Pydantic request and response contracts
│   │   ├── state_store.py       # SQLite state store with crash recovery
│   │   └── vector_store.py      # Qdrant Cloud client and versioned upserts
│   └── tests/
│       └── test_rag.py          # Backend test suite
├── frontend/
│   ├── package.json             # Frontend dependencies and scripts
│   ├── vite.config.ts           # Vite configuration and API proxy
│   ├── vitest.config.ts         # Vitest configuration
│   └── src/
│       ├── App.tsx              # Route configuration
│       ├── api/                 # Typed API client functions
│       ├── components/          # Reusable UI components (BookCard, Nav, Backgrounds)
│       ├── context/             # ThemeContext provider
│       ├── pages/               # LandingPage, LibraryPage, ReaderPage, ChatPage
│       └── test/                # Frontend test suites
└── .env.example                 # Template for environment configuration
```

---

## Prerequisites

Ensure you have the following installed before setting up the application:

- **Python**: Version `3.10` or higher
- **Node.js**: Version `18.x` or `20.x` LTS (with `npm`)
- **Qdrant Cloud Account**: Cluster URL and API key (or a self-hosted Qdrant instance)
- **Groq API Key**: An active key from the [Groq Console](https://console.groq.com/)

---

## Installation and Setup

### 1. Clone Repository & Setup Backend

```bash
# Navigate to project directory
cd Rewamp

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Setup Frontend

```bash
cd frontend
npm install
cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and provide your Qdrant and Groq credentials.

---

## Running Locally

Start the backend and frontend services in separate terminal windows:

### Terminal 1: Backend API

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

- **API URL**: [http://localhost:8000](http://localhost:8000)
- **Interactive Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### Terminal 2: Frontend App

```bash
cd frontend
npm run dev
```

- **Application URL**: [http://localhost:5173](http://localhost:5173)

---

## Environment Variables

Settings are managed in `backend/rag/config.py` and loaded from the root `.env` file:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `QDRANT_URL` | **Yes** | — | HTTPS endpoint of your Qdrant cluster |
| `QDRANT_API_KEY` | **Yes** | — | Authentication key for Qdrant Cloud |
| `QDRANT_COLLECTION_NAME` | No | `book_chunks` | Target vector collection name |
| `GROQ_API_KEY` | **Yes** | — | API key for Groq LLM inference |
| `GROQ_MODEL` | No | `qwen/qwen3.8-27b` | Preferred conversational LLM model |
| `EMBEDDING_MODEL_NAME` | No | `BAAI/bge-small-en-v1.5` | FastEmbed dense model name |
| `CHUNK_TARGET_TOKENS` | No | `384` | Target token length for passages |
| `CHUNK_OVERLAP_TOKENS` | No | `64` | Token overlap between adjacent chunks |
| `CHUNK_MAX_TOKENS` | No | `490` | Upper token limit per chunk |
| `MAX_CONTEXT_TOKENS` | No | `2200` | Context token budget for LLM generation |
| `CACHE_TTL_SECONDS` | No | `300` | Time-to-live for in-memory query cache entries |

---

## How to Use Rewamp

1. **Browse the Library**: Navigate to [http://localhost:5173/library](http://localhost:5173/library) to view available titles.
2. **Ingest a Book**: Books showing a `pending` status must be indexed before querying. Click **Ingest** on a book card (or **Ingest All**) to extract and store vectors in Qdrant.
3. **Read a Book**: Click **Read** on any card to launch the reader (`/read/:bookId`). Use the pagination controls, zoom buttons, and fit-width toggle to navigate the text.
4. **Chat with AI**: Click **Chat** on an ingested book (`/chat/:bookId`) to open the discussion interface. Ask questions regarding events, characters, or themes.
5. **Inspect Citations**: When the assistant generates an answer with citations, click any citation badge to view the source excerpt or jump directly to that page in the PDF reader.

---

## API Reference

The backend provides complete OpenAPI schemas at `http://localhost:8000/docs`. Key endpoints include:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health check and dependency connectivity |
| `GET` | `/api/rag/status` | Vector store and LLM provider configuration status |
| `GET` | `/api/books` | List catalog books with current ingestion status |
| `GET` | `/api/books/{book_id}` | Retrieve metadata for an individual book |
| `GET` | `/api/books/{book_id}/cover` | Serve rendered cover thumbnail image |
| `GET` | `/api/books/{book_id}/pdf` | Stream original PDF file |
| `GET` | `/api/rag/books` | List ingestion progress across all catalog books |
| `GET` | `/api/rag/books/{book_id}/status` | Get ingestion state of a specific book |
| `POST` | `/api/rag/ingest/{book_id}` | Start background ingestion for a single book |
| `POST` | `/api/rag/ingest-all` | Trigger background ingestion for all catalog books |
| `GET` | `/api/rag/jobs/{job_id}` | Poll progress of an ingestion background job |
| `POST` | `/api/chat` | Submit a grounded question about a book (`book_id`, `question`, `top_k`) |

---

## Testing

### Backend Tests

Run the Pytest suite covering extraction, chunking, and API endpoints:

```bash
source .venv/bin/activate
pytest backend/tests/test_rag.py -v
```

### Frontend Checks and Tests

```bash
cd frontend

# Type checking
npm run typecheck

# Unit and component tests
npm test

# Production build
npm run build
```

---

## Troubleshooting

- **Missing Credentials**: If `/health` indicates services are disconnected or chat queries fail, verify that `.env` contains valid `QDRANT_URL`, `QDRANT_API_KEY`, and `GROQ_API_KEY` values without extra quotation marks.
- **First-Run Embedding Download**: On its first run, FastEmbed downloads the `bge-small-en-v1.5` ONNX model weights (~130MB), which can introduce a brief initial delay.
- **Port Conflicts**: If port `8000` or `5173` is occupied, change the port in Uvicorn (`--port <port>`) and update the proxy target in `frontend/vite.config.ts`.
- **Interrupted Ingestion**: The SQLite state store includes restart recovery that resets books left in `processing` status if the server stops unexpectedly.

---

## Limitations and License

### Limitations
- **Single-Book Context**: Queries are scoped to one selected book at a time rather than answering across multiple books simultaneously.
- **Local Settings**: Theme preferences and reading position states are stored locally in the browser session rather than in persistent user accounts.

### License
No explicit license file is currently present in the repository (license is unspecified).
