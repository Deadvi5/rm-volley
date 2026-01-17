# 🚀 RAG System - Quick Start Guide

Get your RM Volley AI assistant running in 5 minutes!

## ⚡ Ultra-Quick Start (2 Commands!)

```bash
# 1. Run automated setup (detects your OS, installs everything)
cd rag-backend
./setup.sh

# 2. Start the system
./start.sh
```

Then open `rag-chat.html` in your browser!

## 📝 What the Setup Script Does

The `setup.sh` script automatically:
- ✅ Detects your OS (macOS/Linux/Windows)
- ✅ Installs Ollama (if needed)
- ✅ Downloads AI model (llama3.2:3b)
- ✅ Creates Python environment
- ✅ Installs all dependencies
- ✅ Indexes your volleyball data
- ✅ Starts Ollama service

**On macOS:** Uses Homebrew to install Ollama (or guides manual install)
**On Linux:** Uses official Ollama install script
**On Windows WSL:** Linux instructions apply

## 🎯 After Setup

Just run:
```bash
cd rag-backend
./start.sh
```

This starts:
1. Ollama service (if not running)
2. RAG API server on http://localhost:8000

Then open the chat interface:
```bash
open ../rag-chat.html
```

## 🔧 Manual Setup (If You Prefer)

### 1️⃣ Install Ollama

**macOS:**
```bash
# Option A: Via Homebrew
brew install ollama

# Option B: Download from website
# Visit https://ollama.com/download
# Download .dmg, drag to Applications
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Pull the model:
```bash
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

### 3️⃣ Start Everything

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start RAG API
cd rag-backend
source venv/bin/activate
python main.py

# Open chat interface
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
