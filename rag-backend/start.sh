#!/bin/bash

# RM Volley RAG - Quick Start Script
# Starts Ollama and the API server automatically

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "============================================================"
echo "🏐 RM VOLLEY RAG SYSTEM - QUICK START"
echo "============================================================"
echo ""

# Check if setup was run
if [ ! -d "venv" ]; then
    print_error "Virtual environment not found. Please run setup.sh first:"
    echo "   ./setup.sh"
    exit 1
fi

if [ ! -d "volleyball_db" ]; then
    print_error "Database not found. Please run setup.sh first:"
    echo "   ./setup.sh"
    exit 1
fi

# Check if Ollama is installed
if ! command_exists ollama; then
    print_error "Ollama not found. Please run setup.sh first:"
    echo "   ./setup.sh"
    exit 1
fi

# Load model name from .env file
if [ -f ".env" ]; then
    OLLAMA_MODEL=$(grep -E "^OLLAMA_MODEL=" .env | cut -d'=' -f2 | tr -d ' ')
fi
OLLAMA_MODEL=${OLLAMA_MODEL:-llama3.2:3b}  # Default fallback

print_info "Configured model: $OLLAMA_MODEL"

# Start Ollama if not running
print_info "Checking Ollama service..."
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    print_success "Ollama is already running"
else
    print_info "Starting Ollama..."
    nohup ollama serve >/dev/null 2>&1 &

    # Wait for it to start
    for i in {1..10}; do
        if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
            print_success "Ollama started"
            break
        fi
        sleep 1
    done
fi

# Check if the model is available, pull if not
print_info "Checking if model '$OLLAMA_MODEL' is available..."
if ollama list | grep -q "^${OLLAMA_MODEL%%:*}"; then
    print_success "Model '$OLLAMA_MODEL' is available"
else
    print_info "Model '$OLLAMA_MODEL' not found. Pulling it now..."
    print_info "This may take a few minutes depending on the model size..."
    if ollama pull "$OLLAMA_MODEL"; then
        print_success "Model '$OLLAMA_MODEL' downloaded successfully"
    else
        print_error "Failed to pull model '$OLLAMA_MODEL'. Please check the model name."
        exit 1
    fi
fi

# Activate virtual environment
print_info "Activating Python environment..."
source venv/bin/activate
print_success "Python environment activated"

# Kill any existing process on port 8000
API_PORT=8000
if lsof -ti:$API_PORT >/dev/null 2>&1; then
    print_info "Port $API_PORT is in use. Killing existing process..."
    lsof -ti:$API_PORT | xargs kill -9 2>/dev/null
    sleep 1
    print_success "Port $API_PORT cleared"
fi

# Start the API server
echo ""
echo "============================================================"
echo "🚀 STARTING RAG API SERVER"
echo "============================================================"
echo ""
print_info "Server will start on: http://localhost:8000"
print_info "API docs available at: http://localhost:8000/docs"
echo ""
print_info "To open the chat interface, run in another terminal:"
echo "   open ../rag-chat.html"
echo ""
print_info "Press Ctrl+C to stop the server"
echo ""
echo "============================================================"
echo ""

# Start the server (this will block)
python main.py
