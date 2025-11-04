#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping FinForesight Services...${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$PROJECT_ROOT/logs"

if [ -d "$LOGS_DIR" ]; then
    # Kill all services
    for pidfile in "$LOGS_DIR"/*.pid; do
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            service_name=$(basename "$pidfile" .pid)
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                echo -e "${GREEN}Stopped $service_name (PID: $pid)${NC}"
            fi
            rm "$pidfile"
        fi
    done
else
    echo -e "${RED}No logs directory found. Services may not be running.${NC}"
fi

echo -e "${GREEN}All services stopped!${NC}"

