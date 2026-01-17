# RM Volley RAG System - Setup Guide

Complete guide to set up and use the RAG (Retrieval-Augmented Generation) system for RM Volley volleyball statistics.

## 🎯 What is this?

The RAG system allows you to ask natural language questions about your volleyball data:
- **"How did RM VOLLEY #18 perform in January?"**
- **"What's the current standing of Serie D Femminile?"**
- **"Show me all 3-0 victories"**

The system uses:
- **ChromaDB**: Vector database for semantic search
- **SentenceTransformers**: Convert text to embeddings
- **Ollama**: Local LLM for generating answers
- **FastAPI**: REST API backend
- **Vanilla JS**: Frontend chat interface

---

## 📋 Prerequisites

### Required Software

1. **Python 3.9+**
   ```bash
   python --version  # Should be 3.9 or higher
   ```

2. **Ollama** (Local LLM runtime)
   - Install from: https://ollama.com
   - macOS/Linux:
     ```bash
     curl -fsSL https://ollama.com/install.sh | sh
     ```
   - Verify installation:
     ```bash
     ollama --version
     ```

3. **Git** (for cloning repository)

### Hardware Requirements

- **Minimum**: 8GB RAM, 10GB free disk space
- **Recommended**: 16GB RAM, 20GB free disk space, SSD
- **GPU**: Optional (speeds up embeddings and LLM inference)

---

## 🚀 Installation Steps

### Step 1: Install Ollama and Download Model

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the recommended model (3.2GB download)
ollama pull llama3.2:3b

# Alternative models:
# ollama pull mistral:7b        # Better quality, 7GB
# ollama pull phi3:mini         # Fastest, 2GB

# Verify model is installed
ollama list
```

### Step 2: Set Up Python Environment

Navigate to the RAG backend directory:

```bash
cd rag-backend
```

**Option A: Using venv (recommended)**
```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt
```

**Option B: Using conda**
```bash
# Create conda environment
conda create -n rm-volley python=3.11

# Activate it
conda activate rm-volley

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Index Your Data

This step processes your volleyball data and creates the vector database:

```bash
# Make sure you're in rag-backend directory
cd rag-backend

# Run the indexer
python indexer.py
```

**Expected output:**
```
============================================================
🏐 RM VOLLEY RAG INDEXER
============================================================
🔧 Initializing RM Volley RAG Indexer...
   Data directory: /path/to/rm-volley
   Database path: ./volleyball_db
📦 Loading embedding model: all-MiniLM-L6-v2
✅ Model loaded (embedding dimension: 384)
✅ Created new collection: rm_volley

📊 Processing matches from Gare.xls...
   Loaded 247 match records
   Generating embeddings...
   Adding to vector database...
✅ Indexed 247 matches

🏆 Processing standings from classifica.json...
   Loaded 10 leagues
   Generating embeddings...
   Adding to vector database...
✅ Indexed 94 standings

============================================================
📈 INDEXING COMPLETE
============================================================
Total chunks indexed: 341
Collection count: 341
Embedding dimension: 384
```

**Troubleshooting:**
- If `Gare.xls` not found: Make sure you're running from `rag-backend/` directory
- If embedding fails: Check internet connection (model downloads on first run)
- If out of memory: Reduce batch size in indexer.py (line 193: `batch_size=16`)

### Step 4: Start Ollama Server

In a **new terminal window**:

```bash
# Start Ollama server
ollama serve
```

Keep this running in the background.

**Note:** On macOS, Ollama may auto-start. Check with:
```bash
curl http://localhost:11434/api/tags
```

### Step 5: Start FastAPI Backend

In another **new terminal window**:

```bash
# Navigate to backend directory
cd rag-backend

# Activate virtual environment
source venv/bin/activate  # Or conda activate rm-volley

# Start the server
python main.py

# Alternative: Use uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
============================================================
🏐 RM VOLLEY RAG API SERVER
============================================================

📊 Initializing retriever...
✅ Connected to collection 'rm_volley' (341 documents)

🔤 Initializing embedder...
Loading embedding model: all-MiniLM-L6-v2
Model loaded. Embedding dimension: 384

🤖 Initializing LLM client...
✅ Connected to Ollama: llama3.2:3b @ http://localhost:11434

✅ All components initialized successfully!
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Step 6: Open the Chat Interface

Open your browser and navigate to:

```
file:///path/to/rm-volley/rag-chat.html
```

Or use a local server (recommended):

```bash
# From the rm-volley root directory
python -m http.server 8080

# Then open: http://localhost:8080/rag-chat.html
```

---

## 🧪 Testing the System

### Test 1: API Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database_count": 341,
  "ollama_available": true,
  "model": "llama3.2:3b"
}
```

### Test 2: Direct Search (No LLM)

```bash
curl -X GET "http://localhost:8000/search?query=RM%20VOLLEY%2018&n_results=3"
```

### Test 3: RAG Query

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How did RM VOLLEY #18 perform recently?",
    "n_results": 5,
    "temperature": 0.5
  }'
```

### Test 4: Frontend Chat

1. Open `rag-chat.html` in browser
2. Check status indicator (should show "Connesso")
3. Click a quick question button
4. Wait for response (~3-10 seconds)

---

## 📁 File Structure

```
rm-volley/
├── rag-backend/
│   ├── main.py                 # FastAPI server
│   ├── indexer.py             # Data indexing script
│   ├── embeddings.py          # Embedding generation
│   ├── retriever.py           # Vector search
│   ├── llm_client.py          # Ollama integration
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example           # Configuration template
│   ├── volleyball_db/         # ChromaDB database (created by indexer)
│   └── venv/                  # Virtual environment (if using venv)
├── rag-chat.html              # Chat interface UI
├── rag-chat.js                # Chat interface logic
├── Gare.xls                   # Match data (source)
├── classifica.json            # Standings data (source)
└── RAG_SETUP.md              # This file
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in `rag-backend/`:

```bash
cp .env.example .env
```

Edit `.env` to customize:

```env
# Change Ollama model
OLLAMA_MODEL=mistral:7b

# Change embedding model
EMBEDDING_MODEL=all-mpnet-base-v2

# Change API port
API_PORT=8080

# Enable debug logging
LOG_LEVEL=debug
```

### Changing the LLM Model

To use a different model:

```bash
# Pull the model
ollama pull mistral:7b

# Update .env
echo "OLLAMA_MODEL=mistral:7b" >> rag-backend/.env

# Restart the server
```

**Available models:**
- `llama3.2:3b` - Fast, good quality (recommended)
- `mistral:7b` - Better reasoning
- `phi3:mini` - Smallest/fastest
- `llama3.1:8b` - Most capable

### Changing the Embedding Model

Edit `rag-backend/.env`:

```env
EMBEDDING_MODEL=all-mpnet-base-v2
```

Then re-run indexer:
```bash
python indexer.py
```

**Available embedding models:**
- `all-MiniLM-L6-v2` - Fast, 384 dimensions (default)
- `all-mpnet-base-v2` - Better quality, 768 dimensions
- `paraphrase-multilingual-MiniLM-L12-v2` - Multilingual

---

## 🎮 Usage Guide

### Example Questions

**Match Results:**
- "How did RM VOLLEY #18 perform in their last match?"
- "Show me all matches from January 2026"
- "What was the score against Team X?"
- "List all 3-0 victories"

**Standings:**
- "What's the current standing of Serie D Femminile?"
- "Where is RM VOLLEY #18 in the table?"
- "Show me the top 5 teams in Under 16 F"

**Statistics:**
- "What's our win rate at home?"
- "How many sets did we win in total?"
- "Compare performance home vs away"

**Advanced:**
- "Which team are we playing next?"
- "What's our longest winning streak?"
- "Show me close matches (3-2 or 2-3)"

### Quick Questions (Pre-configured)

The chat interface includes quick question buttons:
1. **Risultati RM VOLLEY #18** - Recent performance
2. **Classifica Serie D** - Serie D standings
3. **Prossima partita** - Next match

---

## 🔄 Updating Data

When new match data is available:

### Step 1: Update Source Files

```bash
# Run the existing update script
python update_gare.py

# Or manually update Gare.xls and classifica.json
```

### Step 2: Re-index

```bash
cd rag-backend
python indexer.py
```

The indexer will:
- Delete old embeddings
- Process new data
- Rebuild the vector database

### Step 3: Restart API (if running)

```bash
# The API will automatically pick up the new database
# If using --reload flag, it will restart automatically
```

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to Ollama"

**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve

# Verify model is installed
ollama list
```

### Problem: "Collection 'rm_volley' not found"

**Solution:**
```bash
# Run the indexer
cd rag-backend
python indexer.py
```

### Problem: Slow response times

**Possible causes:**
1. **Large model**: Switch to `phi3:mini`
2. **No GPU**: Enable GPU acceleration if available
3. **Too many results**: Reduce `n_results` to 3

**Solutions:**
```bash
# Use faster model
ollama pull phi3:mini
# Update .env: OLLAMA_MODEL=phi3:mini

# Reduce context in main.py
# Line 152: max_length=1000 (instead of 2000)
```

### Problem: Out of memory during indexing

**Solution:**
Reduce batch size in `indexer.py`:

```python
# Line 193, change batch_size
embeddings = self.embedder.encode(
    documents,
    show_progress_bar=True,
    batch_size=16  # Reduce from 32
)
```

### Problem: CORS errors in browser

**Solution:**
Update CORS origins in `main.py`:

```python
# Line 25-30
allow_origins=[
    "http://localhost:5500",  # Add your dev server
    "*"  # Or allow all (development only)
]
```

### Problem: "Model not found"

**Solution:**
```bash
# Pull the model
ollama pull llama3.2:3b

# List available models
ollama list
```

---

## 🔒 Security Considerations

### For Development
- ✅ CORS is wide open (`allow_origins=["*"]`)
- ✅ No authentication required
- ✅ Runs on localhost only

### For Production Deployment

**DO NOT deploy without:**
1. **Restricting CORS**: Limit to your domain
2. **Adding authentication**: API keys or OAuth
3. **Rate limiting**: Prevent abuse
4. **HTTPS**: Use SSL/TLS
5. **Input validation**: Sanitize user queries

**Production checklist:**
```python
# main.py - Update CORS
allow_origins=["https://yourdomain.com"]

# Add authentication middleware
from fastapi.security import APIKeyHeader

# Add rate limiting
from slowapi import Limiter
```

---

## 📊 Performance Optimization

### Speed up Indexing

1. **Use GPU** (if available):
   ```bash
   pip install sentence-transformers[gpu]
   ```

2. **Increase batch size**:
   ```python
   # indexer.py, line 193
   batch_size=64  # If you have enough RAM
   ```

### Speed up Queries

1. **Reduce context**:
   ```python
   # main.py, line 152
   max_length=1000  # From 2000
   ```

2. **Use smaller model**:
   ```bash
   ollama pull phi3:mini
   ```

3. **Reduce retrieval**:
   ```python
   # Frontend: rag-chat.js, line 84
   n_results: 3  // From 5
   ```

### Monitor Performance

```bash
# Check API response times
curl -w "@curl-format.txt" http://localhost:8000/health

# Monitor Ollama
ollama ps
```

---

## 🎓 Advanced Usage

### Custom Prompts

Edit the system prompt in `llm_client.py:153`:

```python
system_prompt = """You are an expert volleyball analyst...
- Provide detailed statistics
- Compare teams
- Suggest strategies
"""
```

### Adding More Data Sources

To index player statistics from Firebase:

1. Add Firebase credentials to `indexer.py`
2. Create `index_player_stats()` method
3. Call in `main()` function

### API Endpoints

Full API documentation: http://localhost:8000/docs (when server is running)

**Available endpoints:**
- `GET /health` - Health check
- `POST /ask` - RAG query with LLM
- `GET /search` - Vector search only
- `GET /matches` - Search matches
- `GET /standings` - Search standings
- `GET /team/{name}` - Team-specific data
- `GET /stats` - System statistics

### Streaming Responses

For real-time streaming (future enhancement):

```python
# llm_client.py
response = client.generate(..., stream=True)
for chunk in response:
    yield chunk
```

---

## 📚 Resources

### Documentation
- **Ollama**: https://ollama.com/library
- **ChromaDB**: https://docs.trychroma.com/
- **SentenceTransformers**: https://www.sbert.net/
- **FastAPI**: https://fastapi.tiangolo.com/

### Model Cards
- **Llama 3.2**: https://ollama.com/library/llama3.2
- **Mistral**: https://ollama.com/library/mistral
- **Phi-3**: https://ollama.com/library/phi3

### Tutorials
- RAG fundamentals: https://www.pinecone.io/learn/retrieval-augmented-generation/
- Vector databases: https://www.pinecone.io/learn/vector-database/

---

## 🤝 Support

### Getting Help

1. **Check logs**: Look at terminal output for errors
2. **Verify setup**: Run test commands above
3. **Search docs**: Check this file and linked resources
4. **GitHub issues**: Create issue with error logs

### Common Solutions

| Problem | Solution |
|---------|----------|
| Connection refused | Start Ollama: `ollama serve` |
| Model not found | Pull model: `ollama pull llama3.2:3b` |
| Collection error | Run indexer: `python indexer.py` |
| Slow responses | Use smaller model: `phi3:mini` |
| CORS error | Check CORS config in `main.py` |

---

## 🎉 Quick Start Recap

```bash
# 1. Install Ollama and pull model
ollama pull llama3.2:3b

# 2. Set up Python environment
cd rag-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Index data
python indexer.py

# 4. Start Ollama (separate terminal)
ollama serve

# 5. Start API server (separate terminal)
python main.py

# 6. Open chat interface
open ../rag-chat.html
# Or: python -m http.server 8080 (then http://localhost:8080/rag-chat.html)
```

**That's it! Start asking questions!** 🏐

---

**Last Updated**: 2026-01-17
**Version**: 1.0
**Author**: RM Volley Technical Team
