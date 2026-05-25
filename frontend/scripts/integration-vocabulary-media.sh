#!/usr/bin/env bash
# Smoke test: admin upload VOCABULARY image + save word imageUrl
set -euo pipefail

BASE="${BACKEND_URL:-http://localhost:8080}"
API="$BASE/api"
EMAIL="${TEST_ADMIN_EMAIL:-admin@deutschflow.com}"
PASS="${TEST_PASSWORD:-password123}"

echo "== 1. Admin login ($EMAIL) =="
LOGIN_JSON=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
if [ -z "$TOKEN" ]; then
  echo "FAIL: no accessToken"
  echo "$LOGIN_JSON"
  exit 1
fi
echo "OK login"

AUTH="Authorization: Bearer $TOKEN"

echo "== 2. Pick a word =="
WORDS_JSON=$(curl -sf "$API/words?page=0&size=1&locale=vi" -H "$AUTH")
WORD_ID=$(echo "$WORDS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['id'] if d.get('items') else '')")
BASE_FORM=$(echo "$WORDS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0].get('baseForm','') if d.get('items') else '')")
if [ -z "$WORD_ID" ]; then
  echo "FAIL: no words in database"
  exit 1
fi
echo "OK word id=$WORD_ID baseForm=$BASE_FORM"

echo "== 3. Upload VOCABULARY image (1x1 PNG) =="
# Minimal valid PNG (base64 decoded inline)
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
echo "$PNG_B64" | base64 -d > /tmp/vocab-test.png

UPLOAD_JSON=$(curl -sf -X POST "$API/v2/media/upload" \
  -H "$AUTH" \
  -F "file=@/tmp/vocab-test.png;type=image/png" \
  -F "category=VOCABULARY" \
  -F "tag=word-${WORD_ID}" \
  -F "altText=Test vocab image")
IMAGE_URL=$(echo "$UPLOAD_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))")
S3_KEY=$(echo "$UPLOAD_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('s3Key',''))")
if [ -z "$IMAGE_URL" ]; then
  echo "FAIL: upload returned no url"
  echo "$UPLOAD_JSON" | python3 -m json.tool
  exit 1
fi
echo "OK upload url=$IMAGE_URL"
echo "   s3Key=$S3_KEY"

echo "== 4. PATCH word imageUrl =="
PATCH_JSON=$(curl -sf -X PATCH "$API/admin/vocabulary/${WORD_ID}" \
  -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"imageUrl\":\"$IMAGE_URL\"}")
echo "$PATCH_JSON" | python3 -m json.tool | head -15

echo "== 5. Verify word list returns imageUrl =="
VERIFY_JSON=$(curl -sf "$API/words?page=0&size=200&locale=vi" -H "$AUTH")
FOUND=$(echo "$VERIFY_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
wid=$WORD_ID
url='$IMAGE_URL'
for it in d.get('items',[]):
  if it.get('id')==wid:
    print('yes' if it.get('imageUrl')==url else 'mismatch:'+str(it.get('imageUrl')))
    break
else:
  print('not_found')
")
if [ "$FOUND" = "yes" ]; then
  echo "PASS: vocabulary image flow OK (word $WORD_ID has imageUrl)"
else
  echo "FAIL: expected imageUrl on word $WORD_ID, got: $FOUND"
  exit 1
fi

echo "== 6. Teacher cannot upload VOCABULARY =="
T_LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@deutschflow.com","password":"password123"}')
T_TOKEN=$(echo "$T_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
HTTP=$(curl -s -o /tmp/t-upload.json -w "%{http_code}" -X POST "$API/v2/media/upload" \
  -H "Authorization: Bearer $T_TOKEN" \
  -F "file=@/tmp/vocab-test.png;type=image/png" \
  -F "category=VOCABULARY")
if [ "$HTTP" = "403" ] || [ "$HTTP" = "401" ]; then
  echo "OK teacher blocked (HTTP $HTTP)"
else
  echo "WARN: expected 403 for teacher VOCABULARY upload, got HTTP $HTTP"
  cat /tmp/t-upload.json
fi

echo "== 7. Public by-tag (no auth) =="
HTTP_TAG=$(curl -s -o /tmp/by-tag.json -w "%{http_code}" \
  "$API/v2/media/by-tag?category=LANDING&tag=hero")
if [ "$HTTP_TAG" = "401" ]; then
  echo "FAIL: by-tag still requires auth (HTTP 401)"
  exit 1
fi
echo "OK by-tag public (HTTP $HTTP_TAG — 404 is fine if no hero asset)"

rm -f /tmp/vocab-test.png
echo "All checks completed."
