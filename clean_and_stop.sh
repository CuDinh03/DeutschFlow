#!/bin/bash
set -e

echo "================================================"
echo "  DeutschFlow — Full Clean & Reset"
echo "================================================"

echo ""
echo ">>> [1/4] Stopping all running processes (ports 3000 & 8080)..."
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  ✓ Port 3000 cleared" || echo "  - Port 3000 was already free"
lsof -ti:8080 | xargs kill -9 2>/dev/null && echo "  ✓ Port 8080 cleared" || echo "  - Port 8080 was already free"
sleep 1

echo ""
echo ">>> [2/4] Cleaning Frontend cache..."
rm -rf frontend/.next
rm -rf frontend/node_modules/.cache
echo "  ✓ frontend/.next removed"
echo "  ✓ frontend/node_modules/.cache removed"

echo ""
echo ">>> [3/4] Cleaning Backend build..."
rm -rf backend/target
echo "  ✓ backend/target removed"

echo ""
echo ">>> [4/4] Done! Project is clean."
echo ""
echo "Now start services manually:"
echo "  Terminal 1 → cd backend  && ./mvnw spring-boot:run"
echo "  Terminal 2 → cd frontend && npm run dev"
echo "================================================"
