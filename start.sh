#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting FinForesight Services...${NC}"

# Check if MongoDB is running
if ! nc -z localhost 27017 2>/dev/null; then
    echo -e "${YELLOW}Starting MongoDB...${NC}"
    brew services start mongodb/brew/mongodb-community@7.0
    sleep 3
fi

# Check if Redis is running
if ! nc -z localhost 6379 2>/dev/null; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    brew services start redis
    sleep 2
fi

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

echo -e "${GREEN}Starting Backend Services...${NC}"

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2
    local script=$3
    
    echo -e "${YELLOW}Starting $service_name on port $port...${NC}"
    cd "$BACKEND_DIR"
    node "$script" > "$PROJECT_ROOT/logs/$service_name.log" 2>&1 &
    echo $! > "$PROJECT_ROOT/logs/$service_name.pid"
}


# Start Node.js services
start_service "auth-service" "3008" "services/auth-service/index.js"
sleep 2

start_service "transaction-service" "3002" "services/transaction-service/index.js"
sleep 2

start_service "ml-service" "3003" "services/ml-service/index.js"
sleep 2

start_service "notification-service" "3004" "services/notification-service/index.js"
sleep 2

start_service "account-service" "3005" "services/account-service/index.js"
sleep 2

start_service "budget-service" "3006" "services/budget-service/index.js"
sleep 2

start_service "goal-service" "3007" "services/goal-service/index.js"
sleep 2

start_service "gateway" "3000" "gateway/index.js"
sleep 2

echo -e "${GREEN}All backend services started!${NC}"
echo -e "${GREEN}Starting Frontend...${NC}"

# Start Frontend
cd "$PROJECT_ROOT/frontend"
npm run dev > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
echo $! > "$PROJECT_ROOT/logs/frontend.pid"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}FinForesight is running!${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Frontend: ${YELLOW}http://localhost:3001${NC}"
echo -e "API Gateway: ${YELLOW}http://localhost:3000${NC}"
echo -e ""
echo -e "Service Status:"
echo -e "  - Auth Service: ${GREEN}http://localhost:3008${NC}"
echo -e "  - Transaction Service: ${GREEN}http://localhost:3002${NC}"
echo -e "  - ML Service: ${GREEN}http://localhost:3003${NC}"
echo -e "  - Notification Service: ${GREEN}http://localhost:3004${NC}"
echo -e "  - Account Service: ${GREEN}http://localhost:3005${NC}"
echo -e "  - Budget Service: ${GREEN}http://localhost:3006${NC}"
    echo -e "  - Goal Service: ${GREEN}http://localhost:3007${NC}"
echo -e ""
echo -e "Logs are in: ${YELLOW}$PROJECT_ROOT/logs/${NC}"
echo -e ""
echo -e "To stop all services, run: ${YELLOW}./stop.sh${NC}"

