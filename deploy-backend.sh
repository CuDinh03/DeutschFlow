#!/bin/bash
# ============================================================
# deploy-backend.sh — DeutschFlow Backend Deploy Script
# Chạy từ máy local: ./deploy-backend.sh
# ============================================================

set -e

PEM_KEY="/Users/dinhcu/Desktop/DeutschFlow/deutschflow-key.pem"
EC2_HOST="ubuntu@3.82.43.113"
CONTAINER_NAME="deutschflow-backend"
ENV_FILE="/home/ubuntu/DeutschFlow/.env.production"
IMAGE_NAME="deutschflow-backend:latest"
HEALTH_URL="http://localhost:8080/actuator/health"

echo "========================================"
echo "  DeutschFlow Backend Deploy"
echo "  Target: $EC2_HOST"
echo "========================================"
echo ""

# Kiểm tra file key tồn tại
if [ ! -f "$PEM_KEY" ]; then
  echo "❌ Không tìm thấy file PEM: $PEM_KEY"
  exit 1
fi

chmod 400 "$PEM_KEY"

ssh -i "$PEM_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" << 'ENDSSH'
set -e

echo "📥 [1/5] Pulling latest code from GitHub..."
cd /home/ubuntu/DeutschFlow
git pull origin main

echo ""
echo "🔨 [2/5] Building Docker image (skip tests)..."
sudo docker build -t deutschflow-backend:latest ./backend

echo ""
echo "♻️  [3/5] Stopping old container..."
sudo docker rm -f deutschflow-backend 2>/dev/null && echo "Old container removed" || echo "No old container found"

echo ""
echo "🚀 [4/5] Starting new container..."
sudo docker run -d \
  --name deutschflow-backend \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -p 8080:8080 \
  --restart unless-stopped \
  deutschflow-backend:latest

echo ""
echo "⏳ [5/5] Waiting 45s for Spring Boot to start..."
sleep 45

echo ""
echo "🔍 Health check..."
HEALTH=$(curl -s http://localhost:8080/actuator/health)
echo "Response: $HEALTH"

if echo "$HEALTH" | grep -q '"UP"'; then
  echo ""
  echo "✅ Deploy thành công! Backend đang chạy."
  echo "🌐 API: https://api.mydeutschflow.com/actuator/health"
else
  echo ""
  echo "❌ Health check FAILED. Xem logs:"
  sudo docker logs deutschflow-backend --tail 30
  exit 1
fi
ENDSSH

echo ""
echo "========================================"
echo "  ✅ Deploy hoàn tất!"
echo "========================================"
