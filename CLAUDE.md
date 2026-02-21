# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Data Updates
```bash
# Update match data and standings from FIPAV
python update_gare.py

# The script auto-creates a venv if needed; manual setup:
pip install -r requirements.txt
```

### RAG Backend (local AI assistant)
```bash
cd rag-backend

# First-time setup (installs Ollama, pulls llama3.2:3b model, indexes data)
./setup.sh

# Start the FastAPI server (port 8000)
python main.py

# Re-index after data updates
python indexer.py

# Test individual components
python retriever.py
python llm_client.py
```

The RAG chat UI is at `rag-chat.html` (needs backend running at localhost:8000).

### Local Development
No build process — open `index.html` directly in a browser. `Gare.xls` must be present in the root.

## Architecture

### Data Flow
1. `update_gare.py` downloads Excel files from FIPAV URLs → merges into `Gare.xls`, scrapes standings → `classifica.json`
2. GitHub Actions runs this daily at 08:00 UTC (see `.github/workflows/update_matches.yml`)
3. Frontend (`app.js`) fetches `Gare.xls` via SheetJS, `classifica.json` directly, and `config.json` for settings
4. Firebase Realtime Database powers live match scores and chat

### Frontend Structure
Multi-page app — each page is self-contained HTML+JS:
- `index.html` / `app.js` — main dashboard (overview, teams, matches, stats, insights tabs)
- `scout.html` / `scout.js` — admin tool for recording player actions during live matches
- `live-match.html` / `live-match.js` — live scoring + fan chat via Firebase
- `player-stats.html` / `player-stats.js` — aggregated stats from scout sessions
- `social.html` / `social.js` — admin tool generating downloadable social media graphics
- `rag-chat.html` / `rag-chat.js` — natural language query interface to the RAG backend

Shared modules: `auth-simple.js` (session auth), `auth-tabs.js` (role-based tab visibility), `utils.js` (debounce, throttle, chunk processing), `firebase-config.js`, `sw.js` (PWA service worker).

### Configuration (`config.json`)
Single source of truth for all runtime settings:
- `team.matchPatterns` — regex-like strings used to identify RM Volley teams in Excel data (e.g. `"RM VOLLEY"`, `"RMVOLLEY"`)
- `categories` — maps team number suffix (e.g. `"18"`) to display category name (e.g. `"Under 18 F"`)
- `leagues` — maps league name to FIPAV standings URL for scraping
- `dataSources` — FIPAV export URLs for match data download
- `admins` — SHA-256 hashed credentials; generate hashes via `hash-generator.html`
- `output.matchesFile` / `output.standingsFile` — output file paths for the Python script

### RAG Backend (`rag-backend/`)
Separate local service — not deployed, purely for local use:
- **FastAPI** server (`main.py`) at port 8000
- **ChromaDB** vector database (`volleyball_db/` directory, created by `indexer.py`)
- **SentenceTransformers** (`all-MiniLM-L6-v2`) for embeddings
- **Ollama** (`llama3.2:3b` by default) for LLM responses
- Config via `rag-backend/.env` (copy from `.env.example`)

Key RAG endpoints: `POST /ask`, `GET /search`, `GET /matches`, `GET /standings`, `GET /team/{name}`.

### Authentication
Client-side only — SHA-256 password hashes stored in `config.json`. Roles: `admin` and `socialmediamanager`. Session stored in `sessionStorage` with 8-hour timeout. No backend auth.

### Team Identification
Teams in Excel data are matched via `config.json.team.matchPatterns`. Team numbers (e.g. `#18`) map to categories via `config.json.categories`. When adding a new team, update both fields.
