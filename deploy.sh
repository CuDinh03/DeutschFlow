#!/bin/bash
# ============================================================
# deploy.sh — DeutschFlow Deployment Script
# Chạy script này trên AWS EC2 để deploy/update ứng dụng
#
# Lần đầu: chmod +x deploy.sh && ./deploy.sh
# Update:  ./deploy.sh
# ============================================================

set -e  # Dừng ngay nếu có lỗi

echo "🚀 DeutschFlow Deployment Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Kiểm tra .env.production tồn tại ─────────────────────────
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: File .env.production không tồn tại!"
    echo "   Hãy copy .env.production.example → .env.production và điền đủ thông tin."
    exit 1
fi

echo "✅ .env.production found"

# ── Pull code mới nhất ───────────────────────────────────────
echo "📥 Pulling latest code..."
git pull origin main

# ── Build Docker images ──────────────────────────────────────
echo "🔨 Building Backend image..."
docker build -t deutschflow-backend:latest ./backend

echo "🔨 Building Frontend image..."
docker build -t deutschflow-frontend:latest ./frontend

# ── Rolling restart (zero downtime) ─────────────────────────
echo "🔄 Restarting services..."
docker compose -f docker-compose.prod.yml up -d --no-deps backend
echo "⏳ Waiting for backend health check (60s)..."
sleep 65

docker compose -f docker-compose.prod.yml up -d --no-deps frontend

# ── Cleanup cũ ───────────────────────────────────────────────
echo "🧹 Cleaning up old images..."
docker image prune -f

# ── Status ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete!"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "📋 Logs: docker compose -f docker-compose.prod.yml logs -f"
