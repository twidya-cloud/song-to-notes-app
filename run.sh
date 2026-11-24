#!/bin/bash
# NoteScribe - Audio Listener & Sheet Music Transcriber Launcher

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "=========================================================="
echo "𝄞 Launching NoteScribe - Listen to Audio & Draw Notes"
echo "=========================================================="

if [ "$1" == "--server" ]; then
    PORT=8081
    echo "Starting local HTTP server at http://localhost:$PORT..."
    open "http://localhost:$PORT"
    ruby -run -e httpd . -p $PORT
else
    echo "Opening NoteScribe in your default web browser..."
    open "$APP_DIR/index.html"
fi
