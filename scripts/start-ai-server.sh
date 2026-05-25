#!/bin/bash

# Script để start AI server locally (không dùng Docker)

echo "🚀 Starting DeutschFlow AI Server..."

# Check if deutschflow_model exists
if [ ! -d "deutschflow_model" ]; then
    echo "❌ Error: deutschflow_model folder not found!"
    echo "Please ensure the model is in the project root directory."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed!"
    exit 1
fi

# Navigate to ai-server directory
cd ai-server || exit 1

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Start the server
echo "✅ Starting AI server on http://localhost:8000"
echo "📖 API docs available at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python ai_server.py
