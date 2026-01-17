#!/bin/bash

# RM Volley RAG Setup Script
# Fully automated installation for macOS, Linux, and WSL
# Detects OS and installs all dependencies automatically

set -e  # Exit on error

echo "============================================================"
echo "🏐 RM VOLLEY RAG SYSTEM - AUTOMATED SETUP"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;94m'
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

print_step() {
    echo -e "${BLUE}▶️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Install Homebrew (macOS only)
install_homebrew() {
    print_step "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    print_success "Homebrew installed"
}

# Install Ollama based on OS
install_ollama() {
    local os=$1

    print_step "Installing Ollama for $os..."

    case $os in
        macos)
            # Check if Homebrew is available
            if command_exists brew; then
                print_info "Using Homebrew to install Ollama..."
                brew install ollama
                print_success "Ollama installed via Homebrew"
            else
                print_info "Downloading Ollama from website..."
                print_info "Please follow these steps:"
                echo ""
                echo "1. Visit: https://ollama.com/download"
                echo "2. Download the macOS installer"
                echo "3. Open the .dmg file"
                echo "4. Drag Ollama to Applications"
                echo "5. Run Ollama from Applications"
                echo ""
                read -p "Press Enter after installing Ollama..."

                # Verify installation
                if command_exists ollama; then
                    print_success "Ollama installed successfully"
                else
                    print_error "Ollama not found. Please install manually and run this script again."
                    exit 1
                fi
            fi
            ;;

        linux)
            print_info "Installing Ollama for Linux..."
            curl -fsSL https://ollama.com/install.sh | sh
            print_success "Ollama installed"
            ;;

        *)
            print_error "Unsupported OS. Please install Ollama manually from https://ollama.com"
            exit 1
            ;;
    esac
}

# Start Ollama service
start_ollama() {
    print_step "Starting Ollama service..."

    # Check if Ollama is already running
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        print_success "Ollama is already running"
        return 0
    fi

    # Try to start Ollama
    if command_exists ollama; then
        # Start in background
        nohup ollama serve >/dev/null 2>&1 &

        # Wait for it to be ready
        print_info "Waiting for Ollama to start..."
        for i in {1..10}; do
            if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
                print_success "Ollama started successfully"
                return 0
            fi
            sleep 1
        done

        print_error "Ollama failed to start. Please start it manually with 'ollama serve'"
        exit 1
    else
        print_error "Ollama command not found"
        exit 1
    fi
}

# Main setup process
main() {
    # Detect operating system
    OS=$(detect_os)
    print_info "Detected OS: $OS"
    echo ""

    # Step 1: Check/Install Python
    print_step "Step 1/8: Checking Python..."
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION found"
    else
        print_error "Python 3 not found. Please install Python 3.9 or higher."
        case $OS in
            macos)
                echo "Install with: brew install python3"
                ;;
            linux)
                echo "Install with: sudo apt install python3 python3-pip"
                ;;
        esac
        exit 1
    fi
    echo ""

    # Step 2: Check/Install Ollama
    print_step "Step 2/8: Checking Ollama..."
    if command_exists ollama; then
        print_success "Ollama found"
    else
        print_info "Ollama not found. Installing..."
        install_ollama "$OS"
    fi
    echo ""

    # Step 3: Start Ollama
    print_step "Step 3/8: Starting Ollama service..."
    start_ollama
    echo ""

    # Step 4: Pull Ollama model
    print_step "Step 4/8: Downloading AI model..."
    # Estrae il valore dal file .env, rimuove eventuali virgolette e spazi
    MODEL=$(grep '^OLLAMA_MODEL=' .env | cut -d '=' -f2- | sed 's/^"//;s/"$//;s/^\x27//;s/\x27$//')


    if ollama list | grep -q "$MODEL"; then
        print_success "Model $MODEL already installed"
    else
        print_info "Downloading $MODEL (~2GB, this may take a few minutes)..."
        ollama pull "$MODEL"
        print_success "Model $MODEL downloaded"
    fi
    echo ""

    # Step 5: Create virtual environment
    print_step "Step 5/8: Setting up Python environment..."
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

    # Step 6: Install Python dependencies
    print_step "Step 6/8: Installing Python packages..."
    print_info "Upgrading pip..."
    pip install --upgrade pip > /dev/null 2>&1

    print_info "Installing dependencies (this may take a minute)..."
    pip install -r requirements.txt --quiet
    print_success "All Python packages installed"
    echo ""

    # Step 7: Create .env file
    print_step "Step 7/8: Creating configuration..."
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Configuration file created (.env)"
        print_info "You can edit .env to customize settings"
    else
        print_info ".env file already exists"
    fi
    echo ""

    # Step 8: Check data files and index
    print_step "Step 8/8: Indexing volleyball data..."

    if [ ! -f "../Gare.xls" ]; then
        print_error "Gare.xls not found in parent directory"
        print_info "Please run 'python update_gare.py' first to download match data"
        echo ""
    fi

    if [ ! -f "../classifica.json" ]; then
        print_error "classifica.json not found in parent directory"
        print_info "Please run 'python update_gare.py' first to download standings data"
        echo ""
    fi

    # Index if data files exist
    if [ -f "../Gare.xls" ] && [ -f "../classifica.json" ]; then
        print_info "Indexing data into vector database..."
        python indexer.py
        print_success "Data indexed successfully"
    else
        print_info "Skipping indexing (missing data files)"
    fi
    echo ""

    # Success message
    echo "============================================================"
    echo "✅ SETUP COMPLETE!"
    echo "============================================================"
    echo ""
    echo "🎉 Your RAG system is ready to use!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 QUICK START:"
    echo ""
    echo "1️⃣  Start the API server:"
    echo -e "   ${GREEN}source venv/bin/activate${NC}"
    echo -e "   ${GREEN}python main.py${NC}"
    echo ""
    echo "2️⃣  Open the chat interface (in another terminal):"
    echo -e "   ${GREEN}open ../rag-chat.html${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📚 Documentation:"
    echo "   • Quick Start: ../RAG_QUICK_START.md"
    echo "   • Full Guide:  ../RAG_SETUP.md"
    echo "   • API Docs:    http://localhost:8000/docs (when running)"
    echo ""
    echo "🧪 Test the system:"
    echo -e "   ${GREEN}python test_system.py${NC}"
    echo ""
    echo "❓ Example questions to ask:"
    echo "   • How did RM VOLLEY #18 perform in January?"
    echo "   • What's the current standing of Serie D Femminile?"
    echo "   • Show me all 3-0 victories"
    echo ""
    echo "============================================================"
    echo "🏐 Enjoy your AI volleyball assistant!"
    echo "============================================================"
}

# Run main function
main
