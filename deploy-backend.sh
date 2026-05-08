#!/bin/bash
# ============================================================
# deploy-backend.sh — DeutschFlow Full Deploy Script
# Tự động: commit → push → SSH → setup Edge TTS → deploy
# Chạy từ máy local: ./deploy-backend.sh
# ============================================================

set -e

PEM_KEY="/Users/dinhcu/Desktop/DeutschFlow/deutschflow-key.pem"
EC2_HOST="ubuntu@3.82.43.113"
BRANCH="feat/FE_V2"

echo "========================================"
echo "  DeutschFlow Full Deploy Pipeline"
echo "  Branch: $BRANCH"
echo "  Target: $EC2_HOST"
echo "========================================"
echo ""

# Kiểm tra file key tồn tại
if [ ! -f "$PEM_KEY" ]; then
  echo "❌ Không tìm thấy file PEM: $PEM_KEY"
  exit 1
fi
chmod 400 "$PEM_KEY"

# ══════════════════════════════════════════════════════════════
# PHASE 1: LOCAL — Git Add + Commit + Push
# ══════════════════════════════════════════════════════════════
echo "📦 [LOCAL] Checking for uncommitted changes..."
cd /Users/dinhcu/Desktop/DeutschFlow

if [ -n "$(git status --porcelain)" ]; then
  echo "  → Found changes, committing..."
  git add -A
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  git commit -m "deploy: auto-commit $TIMESTAMP" --no-verify
  echo "  ✅ Committed"
else
  echo "  → Working tree clean, nothing to commit"
fi

echo ""
echo "📤 [LOCAL] Pushing to GitHub ($BRANCH)..."
git push origin "$BRANCH" 2>&1 | tail -3
echo "  ✅ Pushed"

# ══════════════════════════════════════════════════════════════
# PHASE 2: EC2 — Pull + Edge TTS + Docker Deploy
# ══════════════════════════════════════════════════════════════
echo ""
echo "🚀 [EC2] Connecting to server..."

ssh -i "$PEM_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" << 'ENDSSH'
set -e

echo ""
echo "📥 [1/7] Pulling latest code..."
cd /home/ubuntu/DeutschFlow
git fetch origin feat/FE_V2
git checkout feat/FE_V2 2>/dev/null || true
git reset --hard origin/feat/FE_V2

echo ""
echo "🎙️ [2/7] Setting up Edge TTS sidecar..."

# Đảm bảo Python3 + venv đã cài
echo "  → Checking Python dependencies..."
PY_VER=$(python3 --version 2>/dev/null | grep -oP '\d+\.\d+' || echo "3")
sudo apt-get update -qq
sudo apt-get install -y -qq python3-venv python3-pip "python${PY_VER}-venv" 2>/dev/null || \
  sudo apt-get install -y -qq python3-venv python3-pip 2>/dev/null || true

# Tạo/dùng virtual environment
VENV_DIR="/home/ubuntu/edge-tts-venv"
if [ ! -d "$VENV_DIR/bin/python" ]; then
  echo "  → Creating Python venv..."
  rm -rf "$VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

echo "  → Installing edge-tts + flask..."
"$VENV_DIR/bin/pip" install -q -r backend/edge-tts-sidecar/requirements.txt

# Stop old sidecar
pkill -f "edge-tts-sidecar/server.py" 2>/dev/null || true
sleep 1

# Start Edge TTS sidecar
echo "  → Starting Edge TTS sidecar..."
nohup "$VENV_DIR/bin/python" backend/edge-tts-sidecar/server.py > /home/ubuntu/edge-tts.log 2>&1 &
sleep 3

EDGE_HEALTH=$(curl -s http://localhost:5050/health 2>/dev/null || echo "")
if echo "$EDGE_HEALTH" | grep -q '"ok"'; then
  echo "  ✅ Edge TTS ready (18 personas)"
else
  echo "  ⚠️ Edge TTS starting up... (backend will retry)"
fi

echo ""
echo "📝 [3/7] Updating .env.production..."
# Đảm bảo Whisper Turbo + Edge TTS URL có trong .env.production
ENV_FILE="/home/ubuntu/DeutschFlow/.env.production"

# Update Whisper model nếu còn cũ
if grep -q "whisper-large-v3$" "$ENV_FILE" 2>/dev/null; then
  sed -i 's/GROQ_WHISPER_MODEL=whisper-large-v3$/GROQ_WHISPER_MODEL=whisper-large-v3-turbo/' "$ENV_FILE"
  echo "  → Updated Whisper model to v3-turbo"
fi

# Thêm EDGE_TTS_URL nếu chưa có
if ! grep -q "EDGE_TTS_URL" "$ENV_FILE" 2>/dev/null; then
  echo "" >> "$ENV_FILE"
  echo "# Edge TTS sidecar (free Microsoft Neural voices)" >> "$ENV_FILE"
  echo "EDGE_TTS_URL=http://172.17.0.1:5050" >> "$ENV_FILE"
  echo "  → Added EDGE_TTS_URL to .env.production"
else
  echo "  → EDGE_TTS_URL already configured"
fi

echo ""
echo "🔨 [4/7] Building Docker image..."
sudo docker build -t deutschflow-backend:latest ./backend

echo ""
echo "♻️  [5/7] Stopping old container..."
sudo docker rm -f deutschflow-backend 2>/dev/null && echo "  Old container removed" || echo "  No old container"

echo ""
echo "🚀 [6/7] Starting new container..."
sudo docker run -d \
  --name deutschflow-backend \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -e EDGE_TTS_URL=http://172.17.0.1:5050 \
  -p 8080:8080 \
  --memory="1500m" \
  --restart unless-stopped \
  deutschflow-backend:latest

echo ""
echo "⏳ [7/7] Waiting 45s for Spring Boot..."
sleep 45

echo ""
echo "═══════════════════════════════════════"
echo "  Health Checks"
echo "═══════════════════════════════════════"
HEALTH=$(curl -s http://localhost:8080/actuator/health || true)
echo "  Backend:  $HEALTH"

EDGE_HEALTH2=$(curl -s http://localhost:5050/health || true)
echo "  Edge TTS: $EDGE_HEALTH2"

if echo "$HEALTH" | grep -q '"UP"'; then
  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✅ DEPLOY THÀNH CÔNG!"
  echo "═══════════════════════════════════════"
  echo "  🌐 API:  http://3.82.43.113:8080"
  echo "  🎙️ TTS:  Edge TTS (18 giọng, $0/tháng)"
  echo "  🎤 STT:  Whisper Turbo ($0.04/hr)"
else
  echo ""
  echo "  ❌ Backend FAILED! Logs:"
  sudo docker logs deutschflow-backend --tail 30
  exit 1
fi
ENDSSH

echo ""
echo "========================================"
echo "  ✅ Deploy pipeline hoàn tất!"
echo "========================================"
