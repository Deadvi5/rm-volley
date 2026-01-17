# 🚀 RAG System - Quick Start Guide

Get your RM Volley AI assistant running in 5 minutes!

## One-Line Installation

```bash
cd rag-backend && ./setup.sh
```

That's it! The script will:
- ✅ Check prerequisites
- ✅ Create virtual environment
- ✅ Install dependencies
- ✅ Pull Ollama model
- ✅ Index your data

## Manual 3-Step Setup

If you prefer manual setup:

### 1️⃣ Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull llama3.2:3b
```

### 2️⃣ Setup Python Backend

```bash
cd rag-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python indexer.py
```

### 3️⃣ Start and Use

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start RAG API
cd rag-backend
source venv/bin/activate
python main.py

# Terminal 3: Open chat (or just double-click rag-chat.html)
open ../rag-chat.html
```

## Verify Installation

```bash
# Check health
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","database_count":341,"ollama_available":true,"model":"llama3.2:3b"}
```

## First Question

Open `rag-chat.html` and try:
- "How did RM VOLLEY #18 perform in January?"
- "What's the current standing of Serie D Femminile?"
- "Show me all 3-0 victories"

## Troubleshooting

### "Cannot connect to Ollama"
```bash
ollama serve
```

### "Collection not found"
```bash
cd rag-backend
python indexer.py
```

### "Model not found"
```bash
ollama pull llama3.2:3b
```

## Common Commands

```bash
# Update data
cd ..
python update_gare.py
cd rag-backend
python indexer.py

# Change model
ollama pull mistral:7b
# Edit .env: OLLAMA_MODEL=mistral:7b
python main.py

# Run tests
python test_system.py

# Check logs
# Server logs appear in terminal where you ran: python main.py
```

## File Locations

```
rm-volley/
├── rag-chat.html          # Open this in browser
├── rag-chat.js            # Frontend logic
├── RAG_SETUP.md           # Detailed guide
└── rag-backend/
    ├── main.py            # Start with: python main.py
    ├── indexer.py         # Run to update: python indexer.py
    ├── setup.sh           # Auto-setup: ./setup.sh
    ├── test_system.py     # Test all: python test_system.py
    └── volleyball_db/     # Database (auto-created)
```

## Need Help?

1. **Run tests**: `python test_system.py`
2. **Read detailed guide**: [RAG_SETUP.md](RAG_SETUP.md)
3. **Check backend README**: [rag-backend/README.md](rag-backend/README.md)

## System Requirements

- **Python**: 3.9+
- **RAM**: 8GB minimum
- **Disk**: 10GB free
- **OS**: macOS, Linux, or Windows with WSL

## Performance

First query takes ~5-10 seconds (model loading).
Subsequent queries: ~3-5 seconds.

To speed up:
```bash
# Use faster model
ollama pull phi3:mini
# Edit .env: OLLAMA_MODEL=phi3:mini
```

---

**Ready to chat! 🏐** Open [rag-chat.html](rag-chat.html) and start asking questions!
