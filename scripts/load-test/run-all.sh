#!/bin/bash
# ============================================================
# run-all.sh — DeutschFlow Load Test Runner
# Chạy tất cả scenarios theo thứ tự
# Usage: ./scripts/load-test/run-all.sh
# Thời gian: ban đêm, sau 23:00 GMT+7
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results/$(date '+%Y%m%d_%H%M%S')"
mkdir -p "$RESULTS_DIR"

echo "════════════════════════════════════════════"
echo "  DeutschFlow Load Test — 5 Concurrent Users"
echo "  Thời gian: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "  Results: $RESULTS_DIR"
echo "════════════════════════════════════════════"
echo ""

# ── Pre-check ──
echo "⚡ Pre-check: Testing API connectivity..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://api.mydeutschflow.com/actuator/health 2>/dev/null || echo "000")
if [ "$HEALTH" != "200" ]; then
  echo "❌ API not reachable (HTTP $HEALTH). Abort."
  exit 1
fi
echo "✅ API healthy (HTTP 200)"
echo ""

# ── Scenario 1: Warm-up (2 minutes) ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Scenario 1: Auth + Dashboard (warm-up)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
k6 run \
  --out json="$RESULTS_DIR/scenario1.json" \
  --summary-export="$RESULTS_DIR/scenario1-summary.json" \
  "$SCRIPT_DIR/scenario1-warmup.js" 2>&1 | tee "$RESULTS_DIR/scenario1.log"
echo ""
echo "⏸  Nghỉ 10 giây trước scenario tiếp theo..."
sleep 10

# ── Scenario 2: AI Chat (30 minutes) ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Scenario 2: 5 Users AI Chat (30 phút)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
k6 run \
  --out json="$RESULTS_DIR/scenario2.json" \
  --summary-export="$RESULTS_DIR/scenario2-summary.json" \
  "$SCRIPT_DIR/scenario2-ai-chat.js" 2>&1 | tee "$RESULTS_DIR/scenario2.log"
echo ""
echo "⏸  Nghỉ 30 giây để server cool down..."
sleep 30

# ── Scenario 3: Mixed Workload (30 minutes) ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Scenario 3: Mixed Workload (30 phút)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
k6 run \
  --out json="$RESULTS_DIR/scenario3.json" \
  --summary-export="$RESULTS_DIR/scenario3-summary.json" \
  "$SCRIPT_DIR/scenario3-mixed.js" 2>&1 | tee "$RESULTS_DIR/scenario3.log"

# ── Summary ──
echo ""
echo "════════════════════════════════════════════"
echo "  ✅ LOAD TEST COMPLETE"
echo "  Results saved: $RESULTS_DIR"
echo "  Thời gian kết thúc: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "════════════════════════════════════════════"
echo ""
echo "📊 Xem kết quả:"
echo "  cat $RESULTS_DIR/scenario1-summary.json | jq ."
echo "  cat $RESULTS_DIR/scenario2-summary.json | jq ."
echo "  cat $RESULTS_DIR/scenario3-summary.json | jq ."
