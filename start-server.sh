#!/bin/bash
# Simple HTTP server for Bitcoin Pac-Man

echo "🎮 Starting Bitcoin Pac-Man Server..."
echo "📍 Open your browser to: http://localhost:8080"
echo "Press Ctrl+C to stop"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8080
