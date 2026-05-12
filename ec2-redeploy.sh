#!/bin/bash
# ============================================================
# ec2-redeploy.sh — Chạy TRỰC TIẾP trên EC2 (qua AWS Console > Connect)
# Hoặc paste vào EC2 Instance Connect / Session Manager
# ============================================================

set -e
echo "📥 Pulling latest code from main..."
cd /home/ubuntu/DeutschFlow
git fetch origin main
git reset --hard origin/main
echo "✔ Code: $(git log --oneline -1)"

echo ""
echo "🎙️ Restarting Edge TTS sidecar..."
pkill -f "edge-tts-sidecar/server.py" 2>/dev/null || true
sleep 1
VENV_DIR="/home/ubuntu/edge-tts-venv"
nohup "$VENV_DIR/bin/python" backend/edge-tts-sidecar/server.py > /home/ubuntu/edge-tts.log 2>&1 &
sleep 3
echo "  Edge TTS: $(curl -s http://localhost:5050/health 2>/dev/null || echo 'starting...')"

echo ""
echo "🔨 Building Docker image..."
sudo docker build -t deutschflow-backend:latest ./backend -q

echo ""
echo "♻️ Replacing container..."
sudo docker rm -f deutschflow-backend 2>/dev/null || true
sudo docker run -d \
  --name deutschflow-backend \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -e EDGE_TTS_URL=http://172.17.0.1:5050 \
  -p 8080:8080 \
  --memory="1500m" \
  --restart unless-stopped \
  deutschflow-backend:latest

echo ""
echo "⏳ Waiting 50s for Spring Boot startup..."
sleep 50

echo ""
HEALTH=$(curl -s http://localhost:8080/actuator/health || echo "FAILED")
echo "Health: $HEALTH"

if echo "$HEALTH" | grep -q '"UP"'; then
  echo ""
  echo "✅ DEPLOY THÀNH CÔNG!"
  echo "   API: http://3.82.43.113:8080"
else
  echo "❌ FAILED — Logs:"
  sudo docker logs deutschflow-backend --tail 30
  exit 1
fi
