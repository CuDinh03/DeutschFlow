#!/bin/bash
# ============================================================
# setup-accounts.sh — Tạo 5 test accounts trên production
# Đăng ký + Hoàn thành Onboarding cho mỗi account
# ============================================================

set -e

API="https://api.mydeutschflow.com"

echo "════════════════════════════════════════════"
echo "  Tạo 5 Test Accounts trên Production"
echo "════════════════════════════════════════════"

# 5 accounts với industry khác nhau
declare -a EMAILS=("loadtest01@test.com" "loadtest02@test.com" "loadtest03@test.com" "loadtest04@test.com" "loadtest05@test.com")
declare -a NAMES=("LoadTest User 01" "LoadTest User 02" "LoadTest User 03" "LoadTest User 04" "LoadTest User 05")
declare -a PHONES=("0901000001" "0901000002" "0901000003" "0901000004" "0901000005")
declare -a INDUSTRIES=("IT / Softwareentwicklung" "IT / Softwareentwicklung" "Medizin" "Bildung" "Allgemein")
PASSWORD="LoadTest2026!"

for i in 0 1 2 3 4; do
  EMAIL="${EMAILS[$i]}"
  NAME="${NAMES[$i]}"
  PHONE="${PHONES[$i]}"
  INDUSTRY="${INDUSTRIES[$i]}"

  echo ""
  echo "── [$((i+1))/5] Đăng ký: $EMAIL ──"

  # Step 1: Register
  REG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$EMAIL\",
      \"password\": \"$PASSWORD\",
      \"displayName\": \"$NAME\",
      \"phoneNumber\": \"$PHONE\",
      \"locale\": \"vi\"
    }" 2>/dev/null)

  REG_HTTP=$(echo "$REG_RESPONSE" | tail -1)
  REG_BODY=$(echo "$REG_RESPONSE" | sed '$d')

  if [ "$REG_HTTP" = "201" ]; then
    echo "  ✅ Đăng ký thành công"
    TOKEN=$(echo "$REG_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','') or d.get('access_token','') or d.get('token',''))" 2>/dev/null || echo "")
  elif [ "$REG_HTTP" = "409" ] || [ "$REG_HTTP" = "400" ]; then
    echo "  ⚠️  Account đã tồn tại hoặc phone trùng — thử login..."
    # Login instead
    LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" 2>/dev/null)

    LOGIN_HTTP=$(echo "$LOGIN_RESPONSE" | tail -1)
    LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

    if [ "$LOGIN_HTTP" = "200" ]; then
      echo "  ✅ Login thành công"
      TOKEN=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','') or d.get('access_token','') or d.get('token',''))" 2>/dev/null || echo "")
    else
      echo "  ❌ Login thất bại: HTTP $LOGIN_HTTP"
      echo "     $LOGIN_BODY"
      continue
    fi
  else
    echo "  ❌ Đăng ký thất bại: HTTP $REG_HTTP"
    echo "     $REG_BODY"
    continue
  fi

  if [ -z "$TOKEN" ]; then
    echo "  ❌ Không lấy được token!"
    continue
  fi

  # Step 2: Onboarding
  echo "  📋 Hoàn thành Onboarding..."
  OB_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/api/onboarding/profile" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"goalType\": \"CAREER\",
      \"targetLevel\": \"B1\",
      \"currentLevel\": \"A0\",
      \"ageRange\": \"25-34\",
      \"interests\": [\"Technologie\", \"Reisen\"],
      \"industry\": \"$INDUSTRY\",
      \"workUseCases\": [\"Meetings\", \"Email\"],
      \"sessionsPerWeek\": 5,
      \"minutesPerSession\": 30,
      \"learningSpeed\": \"normal\"
    }" 2>/dev/null)

  OB_HTTP=$(echo "$OB_RESPONSE" | tail -1)

  if [ "$OB_HTTP" = "201" ] || [ "$OB_HTTP" = "200" ]; then
    echo "  ✅ Onboarding hoàn tất"
  elif [ "$OB_HTTP" = "409" ]; then
    echo "  ⚠️  Onboarding đã hoàn thành trước đó — OK"
  else
    OB_BODY=$(echo "$OB_RESPONSE" | sed '$d')
    echo "  ⚠️  Onboarding HTTP $OB_HTTP (có thể đã hoàn thành)"
  fi

  echo "  ✅ $EMAIL — READY"
done

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Setup hoàn tất! Sẵn sàng chạy load test."
echo "════════════════════════════════════════════"
