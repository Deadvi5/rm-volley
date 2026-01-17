#!/bin/bash

# Quick re-indexing script
# Use this when you update the indexer or add new data

echo "🔄 Re-indexing volleyball data..."
echo ""

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "❌ Virtual environment not found. Run ./setup.sh first"
    exit 1
fi

# Run indexer
python indexer.py

echo ""
echo "✅ Re-indexing complete!"
echo ""
echo "Restart the server to use the new index:"
echo "  ./start.sh"
