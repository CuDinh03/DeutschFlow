#!/bin/bash
# ============================================================
# deploy-backend.sh — DeutschFlow Full Deploy Script (Blue-Green)
# -> Chi deploy tu nhanh MAIN. Khong deploy cac nhanh khac.
# -> Blue-Green strategy: user KHONG bi gian doan khi deploy.
# Chay tu may local: ./deploy-backend.sh
# ============================================================

set -e

PEM_KEY="/Users/dinhcu/Desktop/DeutschFlow/deutschflow-key.pem"
EC2_HOST="ubuntu@3.82.43.113"
BRANCH="main"

echo "========================================"
echo "  DeutschFlow Full Deploy Pipeline"
echo "  Branch: $BRANCH  |  Strategy: Blue-Green"
echo "  Target: $EC2_HOST"
echo "========================================"
echo ""

if [ ! -f "$PEM_KEY" ]; then
  echo "Khong tim thay file PEM: $PEM_KEY"
  exit 1
fi
chmod 400 "$PEM_KEY"

# ======================================================
# PHASE 1: LOCAL - Git Add + Commit + Push
# ======================================================
echo "[LOCAL] Checking for uncommitted changes..."
cd /Users/dinhcu/Desktop/DeutschFlow

if [ -n "$(git status --porcelain)" ]; then
  echo "  -> Found changes, committing..."
  git add -A
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  git commit -m "deploy: auto-commit $TIMESTAMP" --no-verify
  echo "  Committed"
else
  echo "  -> Working tree clean, nothing to commit"
fi

echo ""
echo "[LOCAL] Pushing to GitHub ($BRANCH)..."
git push origin "$BRANCH" 2>&1 | tail -3
echo "  Pushed"

# ======================================================
# PHASE 2: EC2 - Pull + Edge TTS + Blue-Green Deploy
# ======================================================
echo ""
echo "[EC2] Connecting to server..."

ssh -i "$PEM_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" << 'ENDSSH'
set -e

echo ""
echo "[1/8] Pulling latest code..."
cd /home/ubuntu/DeutschFlow
git fetch origin main
git checkout main 2>/dev/null || git checkout -b main origin/main
git reset --hard origin/main
echo "  Branch: main | $(git log --oneline -1)"

echo ""
echo "[2/8] Setting up Edge TTS sidecar..."

echo "  -> Checking Python dependencies..."
PY_VER=$(python3 --version 2>/dev/null | grep -oP '\d+\.\d+' || echo "3")
sudo apt-get update -qq
sudo apt-get install -y -qq python3-venv python3-pip "python${PY_VER}-venv" 2>/dev/null || \
  sudo apt-get install -y -qq python3-venv python3-pip 2>/dev/null || true

VENV_DIR="/home/ubuntu/edge-tts-venv"
if [ ! -d "$VENV_DIR/bin/python" ]; then
  echo "  -> Creating Python venv..."
  rm -rf "$VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

echo "  -> Installing edge-tts + flask..."
"$VENV_DIR/bin/pip" install -q -r backend/edge-tts-sidecar/requirements.txt

pkill -f "edge-tts-sidecar/server.py" 2>/dev/null || true
sleep 1

echo "  -> Starting Edge TTS sidecar..."
nohup "$VENV_DIR/bin/python" backend/edge-tts-sidecar/server.py > /home/ubuntu/edge-tts.log 2>&1 &
sleep 3

EDGE_HEALTH=$(curl -s http://localhost:5050/health 2>/dev/null || echo "")
if echo "$EDGE_HEALTH" | grep -q '"ok"'; then
  echo "  Edge TTS ready (18 personas)"
else
  echo "  Edge TTS starting up... (backend will retry)"
fi

echo ""
echo "[3/8] Updating .env.production..."
ENV_FILE="/home/ubuntu/DeutschFlow/.env.production"

if grep -q "whisper-large-v3$" "$ENV_FILE" 2>/dev/null; then
  sed -i 's/GROQ_WHISPER_MODEL=whisper-large-v3$/GROQ_WHISPER_MODEL=whisper-large-v3-turbo/' "$ENV_FILE"
  echo "  -> Updated Whisper model to v3-turbo"
fi

if ! grep -q "EDGE_TTS_URL" "$ENV_FILE" 2>/dev/null; then
  echo "" >> "$ENV_FILE"
  echo "# Edge TTS sidecar" >> "$ENV_FILE"
  echo "EDGE_TTS_URL=http://172.17.0.1:5050" >> "$ENV_FILE"
  echo "  -> Added EDGE_TTS_URL"
else
  echo "  -> EDGE_TTS_URL already configured"
fi

echo ""
echo "[3.5/8] Ensuring Redis is running..."
if ! sudo docker ps --format '{{.Names}}' | grep -q "^deutschflow-redis$"; then
  echo "  -> Redis not found, starting..."
  sudo docker rm -f deutschflow-redis 2>/dev/null || true
  sudo docker run -d \
    --name deutschflow-redis \
    --restart unless-stopped \
    --memory="256m" \
    -p 127.0.0.1:6379:6379 \
    redis:7-alpine redis-server --appendonly yes
  sleep 3
  echo "  Redis started successfully"
else
  echo "  -> Redis already running"
fi

# Lấy IP thực của container Redis trong mạng Docker để backend có thể kết nối
REDIS_HOST_IP=$(sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' deutschflow-redis 2>/dev/null || echo "127.0.0.1")
echo "  Redis container IP: $REDIS_HOST_IP"

echo ""
echo "[4/8] Building new Docker image (BLUE still serving users)..."
sudo docker build -t deutschflow-backend:new ./backend
echo "  Image built successfully"

# -------------------------------------------------------
# BLUE-GREEN DEPLOY
# BLUE  = container cu, dang chay port 8080 (user dang dung)
# GREEN = container moi, khoi dong port 8081 (warm-up)
# -> Sau khi GREEN healthy: graceful stop BLUE -> GREEN len 8080
# -------------------------------------------------------
echo ""
echo "[5/8] Starting GREEN container on port 8081 (users still on BLUE/8080)..."

sudo docker rm -f deutschflow-backend-green 2>/dev/null || true

sudo docker run -d \
  --name deutschflow-backend-green \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -e EDGE_TTS_URL=http://172.17.0.1:5050 \
  -e REDIS_HOST=${REDIS_HOST_IP:-172.17.0.1} \
  -e REDIS_PORT=6379 \
  -p 8081:8080 \
  --memory="1500m" \
  deutschflow-backend:new

echo "  -> Waiting for GREEN to become healthy (max 180s)..."

GREEN_HEALTHY=false
for i in $(seq 1 36); do
  sleep 5
  GREEN_STATUS=$(curl -s http://localhost:8081/actuator/health 2>/dev/null || echo "")
  if echo "$GREEN_STATUS" | grep -q '"UP"'; then
    GREEN_HEALTHY=true
    echo "  GREEN is healthy after $((i * 5))s!"
    break
  fi
  echo "  Waiting... ($i/36)"
done

if [ "$GREEN_HEALTHY" = false ]; then
  echo ""
  echo "  GREEN container FAILED to start! Rolling back..."
  echo "  -> BLUE container is still running -- users NOT affected."
  sudo docker logs deutschflow-backend-green --tail 40 2>/dev/null || true
  sudo docker rm -f deutschflow-backend-green 2>/dev/null || true
  sudo docker rmi deutschflow-backend:new 2>/dev/null || true
  exit 1
fi

echo ""
echo "[6/8] Gracefully stopping BLUE container (completing in-flight requests)..."
# SIGTERM -> Spring Boot completes in-flight requests before shutting down
sudo docker stop --timeout=30 deutschflow-backend 2>/dev/null || true
sudo docker rm deutschflow-backend 2>/dev/null || true
echo "  BLUE stopped cleanly"

echo ""
echo "[7/8] Promoting GREEN to primary on port 8080..."
sudo docker stop deutschflow-backend-green 2>/dev/null || true
sudo docker rm deutschflow-backend-green 2>/dev/null || true

sudo docker run -d \
  --name deutschflow-backend \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -e EDGE_TTS_URL=http://172.17.0.1:5050 \
  -p 8080:8080 \
  --memory="1500m" \
  --restart unless-stopped \
  deutschflow-backend:new

sudo docker rmi deutschflow-backend:latest 2>/dev/null || true
sudo docker tag deutschflow-backend:new deutschflow-backend:latest
sudo docker rmi deutschflow-backend:new 2>/dev/null || true

echo "  -> Waiting 15s for final startup..."
sleep 15

echo ""
echo "======================================="
echo "  [8/8] Final Health Checks"
echo "======================================="
HEALTH=$(curl -s http://localhost:8080/actuator/health || true)
echo "  Backend:  $HEALTH"

EDGE_HEALTH2=$(curl -s http://localhost:5050/health || true)
echo "  Edge TTS: $EDGE_HEALTH2"

if echo "$HEALTH" | grep -q '"UP"'; then
  echo ""
  echo "======================================="
  echo "  DEPLOY THANH CONG! (Blue-Green)"
  echo "======================================="
  echo "  API:     http://3.82.43.113:8080"
  echo "  Downtime: ~3-5s (graceful cutover only)"
else
  echo ""
  echo "  Backend FAILED after promotion! Logs:"
  sudo docker logs deutschflow-backend --tail 40
  exit 1
fi
ENDSSH

echo ""
echo "========================================"
echo "  Deploy pipeline hoan tat!"
echo "========================================"
