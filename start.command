#!/bin/bash
cd "$(dirname "$0")"
export PORT="${PORT:-8080}"
echo "Starting ForwardDesk on http://localhost:$PORT …"
python3 server.py
