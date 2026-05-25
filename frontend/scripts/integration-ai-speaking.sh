#!/usr/bin/env bash
# Integration smoke: real backend at NEXT_PUBLIC_BACKEND_URL or localhost:8080
set -euo pipefail

BASE="${BACKEND_URL:-http://localhost:8080}"
API="$BASE/api"
EMAIL="${TEST_EMAIL:-student@deutschflow.com}"
PASS="${TEST_PASSWORD:-password123}"

echo "== Login ($EMAIL) =="
LOGIN_JSON=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))")
if [ -z "$TOKEN" ]; then
  echo "FAIL: no accessToken"
  echo "$LOGIN_JSON"
  exit 1
fi
echo "OK login (token ${#TOKEN} chars)"

AUTH="Authorization: Bearer $TOKEN"

echo "== GET /ai-speaking/quota =="
QUOTA=$(curl -sf "$API/ai-speaking/quota" -H "$AUTH")
echo "$QUOTA" | python3 -m json.tool | head -20
CAN=$(echo "$QUOTA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('canStartSession', False))")
if [ "$CAN" != "True" ] && [ "$CAN" != "true" ]; then
  echo "WARN: canStartSession=false — session create may fail"
fi

echo "== POST /ai-speaking/sessions (LUKAS, V2, COMMUNICATION) =="
SESSION_JSON=$(curl -sf -X POST "$API/ai-speaking/sessions" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"topic":"Integration test","cefrLevel":"A2","persona":"LUKAS","responseSchema":"V2","sessionMode":"COMMUNICATION"}')
SID=$(echo "$SESSION_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "OK session id=$SID"
echo "$SESSION_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  persona=', d.get('persona'), 'schema=', d.get('responseSchema'), 'initialAi=', bool(d.get('initialAiMessage')))"

echo "== POST /ai-speaking/sessions/$SID/chat (sync) =="
CHAT_JSON=$(curl -sf -X POST "$API/ai-speaking/sessions/$SID/chat" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"userMessage":"Hallo Lukas! Ich heiße Minh und komme aus Vietnam."}')
echo "$CHAT_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  contentDe:', (d.get('contentDe') or '')[:120])
print('  errors:', len(d.get('errors') or []))
print('  adaptive:', bool(d.get('adaptive')))
print('  correction:', bool(d.get('correction')))
"

echo "== POST /ai-speaking/sessions/$SID/chat/stream (SSE, 90s max) =="
STREAM_FILE=$(mktemp)
HTTP=$(curl -s -o "$STREAM_FILE" -w "%{http_code}" -N --max-time 90 \
  -X POST "$API/ai-speaking/sessions/$SID/chat/stream" \
  -H "$AUTH" -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
  -d '{"userMessage":"Was machst du am Wochenende?"}')
echo "  HTTP $HTTP"
if [ "$HTTP" != "200" ]; then
  echo "FAIL stream status"
  head -c 800 "$STREAM_FILE"
  exit 1
fi
EVENTS=$(grep -c '^event:' "$STREAM_FILE" || true)
DATA_LINES=$(grep -c '^data:' "$STREAM_FILE" || true)
echo "  SSE events=$EVENTS data_lines=$DATA_LINES"
if [ "${EVENTS:-0}" -lt 1 ]; then
  echo "FAIL: no SSE events"
  head -c 800 "$STREAM_FILE"
  exit 1
fi
grep -E '^(event:|data:)' "$STREAM_FILE" | tail -8

echo "== GET /ai-speaking/sessions/$SID/messages =="
MSGS=$(curl -sf "$API/ai-speaking/sessions/$SID/messages" -H "$AUTH")
echo "$MSGS" | python3 -c "import sys,json; m=json.load(sys.stdin); print('  message_count=', len(m))"

echo "== PATCH /ai-speaking/sessions/$SID/end =="
END_JSON=$(curl -sf -X PATCH "$API/ai-speaking/sessions/$SID/end" -H "$AUTH")
echo "$END_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  status=', d.get('status'))"

echo "== ALL INTEGRATION CHECKS PASSED =="
