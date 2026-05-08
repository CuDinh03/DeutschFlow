#!/bin/bash
# ============================================================
# restart-backend.sh — DeutschFlow Backend Quick Restart
# Dùng khi: pool chết, OOM, container hang — KHÔNG rebuild image
# Chạy từ máy local: ./restart-backend.sh
# ⏱ Thời gian: ~30-45 giây (so với deploy-backend.sh ~5 phút)
# ============================================================

PEM_KEY="/Users/dinhcu/Desktop/DeutschFlow/deutschflow-key.pem"
EC2_HOST="ubuntu@3.82.43.113"
CONTAINER_NAME="deutschflow-backend"
HEALTH_URL="http://localhost:8080/actuator/health"

echo "========================================"
echo "  DeutschFlow — Quick Restart Backend"
echo "  Target: $EC2_HOST"
echo "========================================"
echo ""

# Kiểm tra file PEM tồn tại
if [ ! -f "$PEM_KEY" ]; then
  echo "❌ Không tìm thấy file PEM: $PEM_KEY"
  exit 1
fi

chmod 400 "$PEM_KEY"

# Kiểm tra SSH kết nối được không trước khi làm gì
echo "🔌 Đang kết nối EC2..."
if ! ssh -i "$PEM_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$EC2_HOST" "echo connected" &>/dev/null; then
  echo ""
  echo "❌ Không SSH được vào EC2 ($EC2_HOST)!"
  echo ""
  echo "  Kiểm tra:"
  echo "  1. EC2 instance đang chạy chưa? → AWS Console → EC2 → Instances"
  echo "  2. Security Group có mở port 22 không?"
  echo "     EC2 → Security Groups → Inbound rules → SSH port 22"
  echo "  3. Nếu EC2 stopped → Start lại từ AWS Console"
  echo ""
  exit 1
fi

echo "✅ Kết nối thành công!"
echo ""

ssh -i "$PEM_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" << 'ENDSSH'
set -e

CONTAINER_NAME="deutschflow-backend"

echo "📊 [1/4] Trạng thái container hiện tại..."
STATUS=$(sudo docker inspect --format='{{.State.Status}}' $CONTAINER_NAME 2>/dev/null || echo "not_found")
echo "  Status: $STATUS"

# Hiển thị 10 dòng log cuối trước khi restart (để biết nguyên nhân)
if [ "$STATUS" != "not_found" ]; then
  echo ""
  echo "📋 [2/4] 15 dòng log cuối (trước khi restart):"
  sudo docker logs $CONTAINER_NAME --tail 15 2>&1 | grep -E "ERROR|WARN|HikariPool|pool|Exception|heap" || true
fi

echo ""
echo "♻️  [3/4] Restarting container..."
if [ "$STATUS" = "not_found" ]; then
  echo "  ⚠️  Container không tồn tại! Cần chạy deploy-backend.sh thay thế."
  exit 1
fi

sudo docker restart $CONTAINER_NAME
echo "  Container đã được restart!"

echo ""
echo "⏳ [4/4] Chờ 35s cho Spring Boot khởi động lại..."
sleep 35

# Health check với retry
MAX_RETRY=3
ATTEMPT=0
SUCCESS=false

while [ $ATTEMPT -lt $MAX_RETRY ]; do
  ATTEMPT=$((ATTEMPT + 1))
  HEALTH=$(curl -s --max-time 5 http://localhost:8080/actuator/health 2>/dev/null || echo "")
  
  if echo "$HEALTH" | grep -q '"UP"'; then
    SUCCESS=true
    break
  fi
  
  if [ $ATTEMPT -lt $MAX_RETRY ]; then
    echo "  ⏳ Chưa UP, thử lại lần $ATTEMPT/$MAX_RETRY sau 10s..."
    sleep 10
  fi
done

echo ""
if [ "$SUCCESS" = true ]; then
  echo "✅ Backend đang UP!"
  echo "   Response: $HEALTH"
  echo ""
  echo "🌐 Public: https://api.mydeutschflow.com/actuator/health"
else
  echo "❌ Health check FAILED sau $MAX_RETRY lần thử!"
  echo ""
  echo "📋 Xem full logs:"
  sudo docker logs $CONTAINER_NAME --tail 40 2>&1
  echo ""
  echo "💡 Gợi ý: Nếu vẫn fail, chạy ./deploy-backend.sh để rebuild hoàn toàn."
  exit 1
fi
ENDSSH

echo ""
echo "========================================"
echo "  ✅ Restart hoàn tất!"
echo "========================================"
