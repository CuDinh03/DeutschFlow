#!/usr/bin/env bash
set -euo pipefail

BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://localhost:8080}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://localhost:3000}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

declare -a FAILURES=()
TOTAL_CHECKS=0

pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  printf 'PASS  %s\n' "$1"
}

fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  printf 'FAIL  %s\n' "$1"
  FAILURES+=("$1")
}

http_status() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local data="${4:-}"
  local extra=()
  if [[ -n "$token" ]]; then
    extra+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$data" ]]; then
    extra+=(-H "Content-Type: application/json" -d "$data")
  fi
  local code
  if ! code="$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" "${extra[@]}")"; then
    echo "000"
    return 0
  fi
  echo "$code"
}

login_token() {
  local email="$1"
  local response
  response="$(curl -sS -X POST "$BACKEND_BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")"
  python3 - "$response" <<'PY'
import json
import sys
try:
    payload = json.loads(sys.argv[1])
except Exception:
    print("")
    raise SystemExit(0)
print(payload.get("accessToken", ""))
PY
}

expect_status() {
  local label="$1"
  local method="$2"
  local url="$3"
  local expected="$4"
  local token="${5:-}"
  local data="${6:-}"
  local code
  code="$(http_status "$method" "$url" "$token" "$data")"
  if [[ "$code" == "$expected" ]]; then
    pass "$label ($code)"
  else
    fail "$label (expected $expected, got $code)"
  fi
}

printf '== DeutschFlow smoke E2E ==\n'
printf 'Backend:  %s\n' "$BACKEND_BASE_URL"
printf 'Frontend: %s\n' "$FRONTEND_BASE_URL"

student_token="$(login_token "student@deutschflow.com")"
teacher_token="$(login_token "teacher@deutschflow.com")"
admin_token="$(login_token "admin@deutschflow.com")"

if [[ -z "$student_token" ]]; then fail "login student"; else pass "login student"; fi
if [[ -z "$teacher_token" ]]; then fail "login teacher"; else pass "login teacher"; fi
if [[ -z "$admin_token" ]]; then fail "login admin"; else pass "login admin"; fi

if [[ -n "$student_token" ]]; then
  expect_status "student auth/me" GET "$BACKEND_BASE_URL/api/auth/me" 200 "$student_token"
  expect_status "student plan/me" GET "$BACKEND_BASE_URL/api/plan/me" 200 "$student_token"
  expect_status "student plan/sessions/1/3" GET "$BACKEND_BASE_URL/api/plan/sessions/1/3" 200 "$student_token"
fi

if [[ -n "$teacher_token" ]]; then
  expect_status "teacher forbidden admin overview" GET "$BACKEND_BASE_URL/api/admin/reports/overview" 403 "$teacher_token"
fi

if [[ -n "$admin_token" ]]; then
  expect_status "admin reports overview" GET "$BACKEND_BASE_URL/api/admin/reports/overview" 200 "$admin_token"
  expect_status "admin reports gate-checklist" GET "$BACKEND_BASE_URL/api/admin/reports/gate-checklist?days=14" 200 "$admin_token"
  expect_status "frontend proxy admin overview" GET "$FRONTEND_BASE_URL/api/admin/reports/overview" 200 "$admin_token"
  expect_status "frontend proxy student session" GET "$FRONTEND_BASE_URL/api/plan/sessions/1/3" 200 "$student_token"
fi

if [[ ${#FAILURES[@]} -eq 0 ]]; then
  printf '\nRESULT: PASS (%s checks)\n' "$TOTAL_CHECKS"
  exit 0
fi

printf '\nRESULT: FAIL (%s issue(s))\n' "${#FAILURES[@]}"
for item in "${FAILURES[@]}"; do
  printf -- '- %s\n' "$item"
done
exit 1
