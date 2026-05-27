# SimplifyRepo — AI-Enabled GitHub Repository Analyzer

> Medicaps University | B.Tech CSE VII Semester | Jan–June 2026  
> Vivek Tripathi · Yuvraj Dev Parmar · Yuvraj Joshi  
> Guide: Prof. Priyanka Jain | Co-Guide: Dr. Hare Ram Jha

---

## Overview

SimplifyRepo is a full-stack web application that uses AI (GEMINI gemini-3.5-flash) to instantly analyze any public GitHub repository and provide:

| Module | Description | SRS Req |
|--------|-------------|---------|
| **P1 Repository Ingestion** | Validate URL, fetch metadata, clone, parse directory tree, detect entry points & tech stack | FR-1.1–1.9 |
| **P2 AI Summarization** | Context chunking, repo overview, module summaries, dependency analysis, design pattern detection | FR-2.1–2.7 |
| **P3 Interactive ChatBot** | Context-grounded Q&A with history management and fallback handling | FR-3.1–3.7 |
| **P4 Security Gate** | CWE-89/79/798/502/22 pattern matching + LLM validation + severity classification + Markdown export | FR-4.1–4.7 |
| **P5 Pro-Mode Visualizer** | Module graph builder → Mermaid.js code generation → SVG/PNG/MMD export | FR-5.1–5.6 |
| **P6 Wiki Generator** | Section-by-section AI generation + README gap analysis + live preview + .md export | FR-6.1–6.6 |
| **P7 Developer Terminal** | Real-time SSE log streaming, step status tracker, level filtering, log download | FR-7.1–7.5 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Mermaid.js, react-markdown |
| Backend | Node.js + Express.js |
| AI Engine | GEMINI gemini-3.5-flash |
| External API | GitHub REST API v3 |
| Real-time | Server-Sent Events (SSE) |
| Deployment | Frontend: Vercel · Backend: Render.com |

---

## Prerequisites

- Node.js 18+
- Git CLI installed on the backend server
- GEMINI_API_KEY
- GitHub personal access token (recommended — raises rate limit to 5,000 req/hr)

---

## Setup

### 1. Clone this repository

```bash
git clone https://github.com/your-org/simplifyrepo.git
cd simplifyrepo
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in GEMINI_API_KEY and GITHUB_TOKEN
node src/index.js
# Server starts on http://localhost:5000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
# App starts on http://localhost:3000
```

---

## Project Structure

```
simplifyrepo/
├── backend/
│   ├── src/
│   │   ├── index.js                    # Express server entry point
│   │   ├── routes/
│   │   │   ├── analyze.js              # POST /api/analyze (P1+P2)
│   │   │   ├── chat.js                 # POST /api/chat (P3)
│   │   │   ├── security.js             # POST /api/security/scan (P4)
│   │   │   ├── visualizer.js           # POST /api/visualizer/generate (P5)
│   │   │   ├── wiki.js                 # POST /api/wiki/generate (P6)
│   │   │   └── terminal.js             # GET  /api/terminal/stream (P7 SSE)
│   │   ├── services/
│   │   │   ├── ingestionService.js     # P1: URL validation, clone, parse
│   │   │   ├── summaryService.js       # P2: AI summarization pipeline
│   │   │   ├── chatBotService.js       # P3: Context builder + OpenAI chat
│   │   │   ├── securityService.js      # P4: CWE matching + LLM validation
│   │   │   ├── visualizerService.js    # P5: Mermaid.js code generation
│   │   │   └── wikiService.js          # P6: Wiki section generation
│   │   ├── middleware/
│   │   │   ├── rateLimiter.js          # NFR-S5: 10 req/IP/hr
│   │   │   └── errorHandler.js         # NFR-U4: user-friendly errors
│   │   └── utils/
│   │       └── sessionStore.js         # In-memory session store + SSE broadcast (D1–D5)
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.jsx                     # Root: URL bar, tab routing, session state
    │   ├── services/api.js             # Axios API client
    │   ├── hooks/useSSE.js             # EventSource hook for P7
    │   └── components/tabs/
    │       ├── SummaryTab.jsx          # P2 frontend
    │       ├── ChatBotTab.jsx          # P3 frontend
    │       ├── SecurityTab.jsx         # P4 frontend
    │       ├── VisualizerTab.jsx       # P5 frontend (Mermaid.js rendering)
    │       ├── WikiTab.jsx             # P6 frontend
    │       └── TerminalTab.jsx         # P7 frontend (SSE consumer)
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Environment Variables

See `backend/.env.example` for all configurable values:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `5000` |
| `GEMINI_API_KEY` | GEMINI API key (required) | — |
| `GEMINI_MODEL` | Model to use | `gemini-3.5-flash` |
| `GITHUB_TOKEN` | GitHub PAT (recommended) | — |
| `SESSION_TTL_MS` | Session timeout (ms) | `3600000` (60 min) |
| `RATE_LIMIT_MAX` | Max analysis requests per IP/hr | `10` |
| `MAX_REPO_SIZE_MB` | Repository size cap | `500` |
| `CLONE_TIMEOUT_MS` | Git clone timeout (ms) | `30000` |
| `ALLOWED_ORIGIN` | CORS origin | `http://localhost:3000` |

---

## API Endpoints

| Method | Endpoint | Module | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/analyze` | P1+P2 | Start analysis. Returns `sessionId` immediately; pipeline runs async |
| `GET`  | `/api/analyze/:sessionId` | — | Get current session state |
| `POST` | `/api/chat` | P3 | Send a chat message |
| `DELETE` | `/api/chat/:sessionId/history` | P3 | Clear conversation history |
| `POST` | `/api/security/scan` | P4 | Run security scan |
| `GET`  | `/api/security/:sessionId/export` | P4 | Download security report as `.md` |
| `POST` | `/api/visualizer/generate` | P5 | Generate Mermaid.js diagram |
| `POST` | `/api/wiki/generate` | P6 | Generate wiki |
| `GET`  | `/api/wiki/:sessionId/export` | P6 | Download wiki as `.md` |
| `GET`  | `/api/terminal/stream?sessionId=` | P7 | SSE log stream |
| `GET`  | `/api/terminal/logs/:sessionId` | P7 | Get logs (REST fallback) |
| `GET`  | `/api/terminal/logs/:sessionId/export` | P7 | Download logs as `.txt` |

---

## Non-Functional Requirements Compliance

| NFR | Requirement | Implementation |
|-----|-------------|----------------|
| NFR-P1 | Summary < 15s for 50MB repos | Parallel P2 sub-processes with chunking |
| NFR-P2 | Clone < 30s for 100MB | `--depth=1 --single-branch` clone + 30s timeout |
| NFR-P3 | ChatBot < 5s p95 | 30s request timeout; streaming via SSE |
| NFR-S1 | HTTPS enforcement | TLS 1.2+ via Vercel+Render; `helmet()` middleware |
| NFR-S2 | API keys server-side only | All keys in `.env`; never sent to client |
| NFR-S3 | Input sanitization | URL regex validation; chat input strip + length limit |
| NFR-S5 | Rate limiting | `express-rate-limit`: 10 req/IP/hr on `/api/analyze` |
| NFR-R4 | Ephemeral cleanup | Session TTL 60 min; `fs.rmSync` on session destroy |
| NFR-M1 | Modular architecture | Each module is an independent service class + route |
| NFR-M2 | Env configuration | All secrets/config in `.env`; zero hardcoded values |

---

## Deployment

### Frontend (Vercel)
```bash
cd frontend && npm run build
# Deploy dist/ to Vercel or push to GitHub and connect to Vercel
# Set VITE_API_URL env var to your Render backend URL
```

### Backend (Render.com)
1. Create a new Web Service on Render
2. Set build command: `npm install`
3. Set start command: `node src/index.js`
4. Add all environment variables from `.env.example`
5. Ensure Git CLI is available in the runtime (it is by default on Render)

---

*SimplifyRepo v1.0 | Medicaps University | Jan–June 2026*
