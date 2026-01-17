# RM Volley RAG Backend

Local RAG (Retrieval-Augmented Generation) system for volleyball statistics using Ollama, ChromaDB, and FastAPI.

## Quick Start

### ⚡ Automatic Setup (Recommended)

```bash
# 1. Run fully automated setup (detects OS, installs everything)
./setup.sh

# 2. Start the system
./start.sh

# 3. Open chat interface
open ../rag-chat.html
```

The `setup.sh` script automatically:
- Detects your OS (macOS/Linux)
- Installs Ollama if needed
- Downloads the AI model (llama3.2:3b)
- Creates Python virtual environment
- Installs all dependencies
- Starts Ollama service
- Indexes your volleyball data

### 🔧 Manual Setup (Alternative)

```bash
# 1. Install Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull model
ollama pull llama3.2:3b

# 3. Setup Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Index data
python indexer.py

# 5. Start servers
ollama serve              # Terminal 1
python main.py            # Terminal 2
```

## What's Inside

```
rag-backend/
├── main.py                 # FastAPI server with RAG endpoints
├── indexer.py             # Index match/standings data into vector DB
├── embeddings.py          # Text → vector embeddings
├── retriever.py           # Vector similarity search
├── llm_client.py          # Ollama LLM integration
├── requirements.txt       # Python dependencies
├── setup.sh              # Automated setup script
├── .env.example          # Configuration template
└── volleyball_db/        # ChromaDB database (created by indexer)
```

## Manual Setup

If you prefer manual setup over `setup.sh`:

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Index data
python indexer.py

# 5. Start server
python main.py
```

## API Endpoints

Once the server is running on `http://localhost:8000`:

### Main RAG Endpoint

**POST /ask** - Ask questions with LLM-generated answers
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How did RM VOLLEY #18 perform?",
    "n_results": 5,
    "temperature": 0.5
  }'
```

### Search Endpoints

**GET /search** - Vector search without LLM
```bash
curl "http://localhost:8000/search?query=RM%20VOLLEY%2018&n_results=5"
```

**GET /matches** - Search only match data
```bash
curl "http://localhost:8000/matches?query=January%202026"
```

**GET /standings** - Search only standings
```bash
curl "http://localhost:8000/standings?query=Serie%20D"
```

**GET /team/{name}** - Get team-specific data
```bash
curl "http://localhost:8000/team/RM%20VOLLEY%20%2318"
```

### System Endpoints

**GET /health** - Health check
```bash
curl http://localhost:8000/health
```

**GET /stats** - System statistics
```bash
curl http://localhost:8000/stats
```

**GET /docs** - Interactive API documentation
```
http://localhost:8000/docs
```

## Configuration

Create `.env` file (copy from `.env.example`):

```env
# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Database
DB_PATH=./volleyball_db

# Data Sources
DATA_DIR=../
MATCHES_FILE=Gare.xls
STANDINGS_FILE=classifica.json

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Server
API_HOST=0.0.0.0
API_PORT=8000
```

## Available Models

### LLM Models (via Ollama)

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `llama3.2:3b` | 3.2GB | Fast | Good | General use ⭐ |
| `mistral:7b` | 7GB | Medium | Better | Complex queries |
| `phi3:mini` | 2GB | Fastest | Basic | Simple stats |
| `llama3.1:8b` | 8GB | Slow | Best | Detailed analysis |

Change model:
```bash
ollama pull mistral:7b
# Update .env: OLLAMA_MODEL=mistral:7b
```

### Embedding Models

| Model | Dimensions | Quality | Best For |
|-------|------------|---------|----------|
| `all-MiniLM-L6-v2` | 384 | Good | Fast search ⭐ |
| `all-mpnet-base-v2` | 768 | Better | Accurate retrieval |
| `paraphrase-multilingual-*` | 384 | Good | Italian support |

## Updating Data

When new match data is available:

```bash
# 1. Update source data
cd ..
python update_gare.py

# 2. Re-index
cd rag-backend
python indexer.py

# 3. API will auto-reload (if using --reload flag)
```

## Testing

### Test Indexer
```bash
python indexer.py
```

### Test Retriever
```bash
python retriever.py
```

### Test LLM Client
```bash
python llm_client.py
```

### Test API
```bash
# Start server
python main.py

# In another terminal
curl http://localhost:8000/health
```

## Troubleshooting

### "Cannot connect to Ollama"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start it
ollama serve
```

### "Collection not found"
```bash
# Run indexer
python indexer.py
```

### "Model not found"
```bash
# Pull the model
ollama pull llama3.2:3b
```

### Slow responses
- Use faster model: `phi3:mini`
- Reduce `n_results` to 3
- Reduce `max_tokens` in LLM generation

### Out of memory
- Reduce batch size in indexer.py (line 193)
- Use smaller embedding model
- Close other applications

## Performance

Typical response times (on M1 MacBook):
- Embedding generation: ~50ms
- Vector search: ~10ms
- LLM generation: 3-10 seconds (depending on model)
- **Total**: ~5-12 seconds per query

Optimization tips:
- Use GPU if available
- Enable model quantization
- Increase batch sizes (if RAM allows)
- Cache frequent queries

## Architecture

```
┌─────────────┐
│  User Query │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Embedding Layer  │  (SentenceTransformers)
│ Text → Vector    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   ChromaDB       │  (Vector Database)
│ Similarity Search│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Top K Contexts  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Ollama LLM     │  (Local Language Model)
│ Context + Query  │
│   → Answer       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  JSON Response   │
└──────────────────┘
```

## Dependencies

Main libraries:
- **FastAPI** (0.109.0) - Web framework
- **ChromaDB** (0.4.22) - Vector database
- **sentence-transformers** (2.3.1) - Embeddings
- **pandas** (2.1.4) - Data processing
- **requests** (2.31.0) - HTTP client for Ollama

See [requirements.txt](requirements.txt) for full list.

## Security

⚠️ **Development only** - Not production-ready:
- CORS is wide open
- No authentication
- No rate limiting
- No input sanitization

For production deployment, add:
- API key authentication
- Request rate limiting
- Input validation
- HTTPS/SSL
- Restricted CORS
- Logging and monitoring

## License

Same as parent RM Volley project.

## Support

For setup help, see [RAG_SETUP.md](../RAG_SETUP.md)

For API documentation, visit: http://localhost:8000/docs (when running)

---

**Version**: 1.0
**Last Updated**: 2026-01-17
