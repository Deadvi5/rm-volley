#!/bin/bash

# RM Volley RAG Setup Script
# Automates the installation and setup process

set -e  # Exit on error

echo "============================================================"
echo "🏐 RM VOLLEY RAG SYSTEM SETUP"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python $PYTHON_VERSION found"
else
    print_error "Python 3 not found. Please install Python 3.9 or higher."
    exit 1
fi

# Check Ollama
if command_exists ollama; then
    print_success "Ollama found"
else
    print_error "Ollama not found. Please install from https://ollama.com"
    echo ""
    echo "Installation command:"
    echo "  curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi

echo ""

# Step 2: Create virtual environment
echo "🐍 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_info "Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate
print_success "Virtual environment activated"
echo ""

# Step 3: Install dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt
print_success "Dependencies installed"
echo ""

# Step 4: Check/Pull Ollama model
echo "🤖 Checking Ollama model..."
MODEL="llama3.2:3b"

if ollama list | grep -q "$MODEL"; then
    print_success "Model $MODEL already installed"
else
    print_info "Pulling model $MODEL (this may take a few minutes)..."
    ollama pull "$MODEL"
    print_success "Model $MODEL installed"
fi
echo ""

# Step 5: Check data files
echo "📊 Checking data files..."
if [ -f "../Gare.xls" ]; then
    print_success "Match data found (Gare.xls)"
else
    print_error "Gare.xls not found in parent directory"
    echo "Please run update_gare.py first to download match data"
fi

if [ -f "../classifica.json" ]; then
    print_success "Standings data found (classifica.json)"
else
    print_error "classifica.json not found in parent directory"
    echo "Please run update_gare.py first to download standings data"
fi
echo ""

# Step 6: Create .env file
echo "⚙️  Setting up configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "Configuration file created (.env)"
    print_info "You can edit .env to customize settings"
else
    print_info ".env file already exists"
fi
echo ""

# Step 7: Index data
echo "🔍 Would you like to index the data now? (y/n)"
read -r INDEX_NOW

if [ "$INDEX_NOW" = "y" ] || [ "$INDEX_NOW" = "Y" ]; then
    echo ""
    echo "Indexing data (this may take a minute)..."
    python indexer.py
    print_success "Data indexed successfully"
else
    print_info "Skipping indexing. Run 'python indexer.py' when ready."
fi
echo ""

# Step 8: Final instructions
echo "============================================================"
echo "✅ SETUP COMPLETE!"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start Ollama server (in a new terminal):"
echo "   ${GREEN}ollama serve${NC}"
echo ""
echo "2. Start the RAG API server (in another terminal):"
echo "   ${GREEN}cd rag-backend${NC}"
echo "   ${GREEN}source venv/bin/activate${NC}"
echo "   ${GREEN}python main.py${NC}"
echo ""
echo "3. Open the chat interface:"
echo "   ${GREEN}open ../rag-chat.html${NC}"
echo "   Or use a local server:"
echo "   ${GREEN}python -m http.server 8080${NC}"
echo "   Then visit: http://localhost:8080/rag-chat.html"
echo ""
echo "For detailed documentation, see: RAG_SETUP.md"
echo ""
echo "============================================================"
echo "🏐 Happy chatting!"
echo "============================================================"
