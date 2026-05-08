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

echo "📥 [1/7] Pulling latest code from GitHub..."
cd /home/ubuntu/DeutschFlow
git fetch origin feat/FE_V2
git checkout feat/FE_V2
git reset --hard origin/feat/FE_V2

echo ""
echo "🎙️ [2/7] Setting up Edge TTS sidecar (free AI voices)..."
# Install Python dependencies if not already installed
pip3 install -q -r backend/edge-tts-sidecar/requirements.txt 2>/dev/null || \
  sudo pip3 install -q -r backend/edge-tts-sidecar/requirements.txt

# Stop old sidecar if running
pkill -f "edge-tts-sidecar/server.py" 2>/dev/null || true
sleep 1

# Start Edge TTS sidecar in background
nohup python3 backend/edge-tts-sidecar/server.py > /home/ubuntu/edge-tts.log 2>&1 &
EDGE_TTS_PID=$!
echo "Edge TTS sidecar started (PID: $EDGE_TTS_PID)"

# Wait for sidecar to be ready
sleep 3
EDGE_HEALTH=$(curl -s http://localhost:5050/health 2>/dev/null || echo "")
if echo "$EDGE_HEALTH" | grep -q '"ok"'; then
  echo "✅ Edge TTS sidecar ready (18 personas)"
else
  echo "⚠️ Edge TTS sidecar not responding yet — backend will retry on first TTS request"
fi

echo ""
echo "🔨 [3/7] Building Docker image (skip tests)..."
sudo docker build -t deutschflow-backend:latest ./backend

echo ""
echo "♻️  [4/7] Stopping old container..."
sudo docker rm -f deutschflow-backend 2>/dev/null && echo "Old container removed" || echo "No old container found"

echo ""
echo "🚀 [5/7] Starting new container..."
sudo docker run -d \
  --name deutschflow-backend \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -e EDGE_TTS_URL=http://172.17.0.1:5050 \
  -p 8080:8080 \
  --memory="1500m" \
  --restart unless-stopped \
  deutschflow-backend:latest

echo ""
echo "⏳ [6/7] Waiting 45s for Spring Boot to start..."
sleep 45

echo ""
echo "🔍 [7/7] Health checks..."
HEALTH=$(curl -s http://localhost:8080/actuator/health || true)
echo "Backend: $HEALTH"

EDGE_HEALTH2=$(curl -s http://localhost:5050/health || true)
echo "Edge TTS: $EDGE_HEALTH2"

if echo "$HEALTH" | grep -q '"UP"'; then
  echo ""
  echo "✅ Deploy thành công!"
  echo "🌐 API: https://api.mydeutschflow.com/actuator/health"
  echo "🎙️ TTS: Edge TTS sidecar (18 giọng miễn phí)"
  echo "🎤 STT: Groq Whisper Large v3 Turbo ($0.04/hr)"
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
