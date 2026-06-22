#!/usr/bin/env bash
# ============================================================================
# E2E demo — B2B provisioning top-down (M5). Chạy 1 mạch xuyên suốt mô hình
# đã chốt (plans/2026-06-21-b2b-model.md §2.1) + verify từng bước.
#
# Luồng: ADMIN tạo Owner+org → Owner tạo teacher + CSV import students →
#        promote teacher→manager → teacher leave (account sống) →
#        admin lock account (reversible) → cross-tenant IDOR (org A ≠ org B).
# (Bỏ "gán teacher vào lớp" = P1-4/#145 — CHƯA merge vào branch này.)
#
# Yêu cầu: backend chạy ở :8080 (backend-local) + Docker postgres `deutschflow-postgres`.
# Chạy:    bash scripts/e2e-b2b-provisioning.sh
# ============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
B="http://localhost:8080/api"
DB_USER=$(grep '^DB_USERNAME=' "$ROOT/.env" | cut -d= -f2-)
DB_PASS=$(grep '^DB_PASSWORD=' "$ROOT/.env" | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' "$ROOT/.env" | cut -d= -f2-)

PASS=0; FAIL=0
check(){ # actual expected message
  if [ "$1" = "$2" ]; then echo "  ✅ $3 [$1]"; PASS=$((PASS+1));
  else echo "  ❌ $3 [got $1, want $2]"; FAIL=$((FAIL+1)); fi
}
psqlx(){ docker exec -e PGPASSWORD="$DB_PASS" deutschflow-postgres psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null | tr -d '[:space:]'; }
login(){ curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}"; }
tok(){ login "$1" "$2" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))' 2>/dev/null; }
orgrole(){ login "$1" "$2" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("orgRole","") or "")' 2>/dev/null; }
loginRC(){ code -X POST "$B/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}"; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }

SFX="m5demo"
DC_SLUG="democorp-$SFX"; OC_SLUG="othercorp-$SFX"
DC_OWNER="owner.dc.$SFX@dflow.test"; OC_OWNER="owner.oc.$SFX@dflow.test"
T1="t1.$SFX@dflow.test"; T2="t2.$SFX@dflow.test"
S1="s1.$SFX@dflow.test"; S2="s2.$SFX@dflow.test"
PW="demo123456"
EMAILS="'$DC_OWNER','$OC_OWNER','$T1','$T2','$S1','$S2'"

cleanup(){
  psqlx "DELETE FROM org_members WHERE org_id IN (SELECT id FROM organizations WHERE slug IN ('$DC_SLUG','$OC_SLUG'));" >/dev/null
  psqlx "DELETE FROM org_members WHERE user_id IN (SELECT id FROM users WHERE email IN ($EMAILS));" >/dev/null
  psqlx "DELETE FROM user_subscriptions WHERE user_id IN (SELECT id FROM users WHERE email IN ($EMAILS));" >/dev/null
  psqlx "DELETE FROM users WHERE email IN ($EMAILS);" >/dev/null
  psqlx "DELETE FROM organizations WHERE slug IN ('$DC_SLUG','$OC_SLUG');" >/dev/null
}
echo "── Cleanup trước (idempotent) ──"; cleanup

ADMIN=$(tok admin@local.test 'Admin12345!')
[ -n "$ADMIN" ] && { echo "  ✅ admin login"; PASS=$((PASS+1)); } || { echo "  ❌ admin login — backend chưa chạy?"; exit 1; }

echo ""; echo "① ADMIN pre-create Owner + 2 org (DemoCorp, OtherCorp)"
code -X POST "$B/admin/organizations" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"DemoCorp\",\"slug\":\"$DC_SLUG\",\"planCode\":\"PRO\",\"seatLimit\":50,\"ownerEmail\":\"$DC_OWNER\",\"ownerName\":\"DC Owner\",\"ownerPassword\":\"$PW\"}" >/dev/null
code -X POST "$B/admin/organizations" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"OtherCorp\",\"slug\":\"$OC_SLUG\",\"planCode\":\"PRO\",\"seatLimit\":50,\"ownerEmail\":\"$OC_OWNER\",\"ownerName\":\"OC Owner\",\"ownerPassword\":\"$PW\"}" >/dev/null
DC_OWNER_TOK=$(tok "$DC_OWNER" "$PW"); OC_OWNER_TOK=$(tok "$OC_OWNER" "$PW")
check "$([ -n "$DC_OWNER_TOK" ] && echo yes)" "yes" "DemoCorp owner đăng nhập được (pre-created)"
check "$([ -n "$OC_OWNER_TOK" ] && echo yes)" "yes" "OtherCorp owner đăng nhập được"

echo ""; echo "② Owner pre-create 2 teacher + CSV import 2 student"
code -X POST "$B/org/teachers" -H "Authorization: Bearer $DC_OWNER_TOK" -H 'Content-Type: application/json' -d "{\"email\":\"$T1\",\"displayName\":\"Teacher One\",\"password\":\"$PW\"}" >/dev/null
code -X POST "$B/org/teachers" -H "Authorization: Bearer $DC_OWNER_TOK" -H 'Content-Type: application/json' -d "{\"email\":\"$T2\",\"displayName\":\"Teacher Two\",\"password\":\"$PW\"}" >/dev/null
check "$([ -n "$(tok "$T1" "$PW")" ] && echo yes)" "yes" "teacher T1 đăng nhập được"
CSV=$(mktemp); printf "email,displayName\n%s,Student One\n%s,Student Two\n" "$S1" "$S2" > "$CSV"
IMP=$(code -X POST "$B/org/students/import" -H "Authorization: Bearer $DC_OWNER_TOK" -F "file=@$CSV;filename=students.csv;type=text/csv"); rm -f "$CSV"
check "$IMP" "200" "CSV import 2 students"

echo ""; echo "③ Owner promote teacher T2 → MANAGER (OWNER-only)"
T2_ID=$(psqlx "SELECT id FROM users WHERE email='$T2'")
check "$(code -X PATCH "$B/org/members/$T2_ID/role" -H "Authorization: Bearer $DC_OWNER_TOK" -H 'Content-Type: application/json' -d '{"role":"MANAGER"}')" "200" "promote T2 → MANAGER"
check "$(orgrole "$T2" "$PW")" "MANAGER" "T2 đăng nhập orgRole=MANAGER"

echo ""; echo "④ PORTABILITY: teacher T1 rời TT → account vẫn sống"
T1_TOK=$(tok "$T1" "$PW")
check "$(code -X POST "$B/org/membership/leave" -H "Authorization: Bearer $T1_TOK")" "204" "T1 self-leave"
check "$(psqlx "SELECT is_active FROM users WHERE email='$T1'")" "t" "T1 account is_active=true sau khi rời"
check "$(loginRC "$T1" "$PW")" "200" "T1 re-login OK (thành giáo viên tự do)"

echo ""; echo "⑤ ADMIN lock account T1 (reversible) — biết mật khẩu nên cô lập tác dụng lock"
T1_ID=$(psqlx "SELECT id FROM users WHERE email='$T1'")
code -X PATCH "$B/admin/users/$T1_ID/active" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"active":false}' >/dev/null
check "$(loginRC "$T1" "$PW")" "401" "locked → ĐÚNG mật khẩu vẫn bị chặn (401)"
code -X PATCH "$B/admin/users/$T1_ID/active" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"active":true}' >/dev/null
check "$(loginRC "$T1" "$PW")" "200" "unlock → login lại được (reversible)"

echo ""; echo "⑥ CROSS-TENANT IDOR: OtherCorp owner KHÔNG xem được student DemoCorp"
S1_ID=$(psqlx "SELECT id FROM users WHERE email='$S1'")
check "$(code -X GET "$B/org/students/$S1_ID" -H "Authorization: Bearer $OC_OWNER_TOK")" "404" "OtherCorp owner GET DemoCorp student → 404"
check "$(code -X GET "$B/org/students/$S1_ID" -H "Authorization: Bearer $DC_OWNER_TOK")" "200" "DemoCorp owner GET student của mình → 200"

echo ""; echo "── Cleanup ──"; cleanup
echo ""; echo "════════════════════════════════════════"
echo "  E2E B2B provisioning: PASS=$PASS  FAIL=$FAIL"
echo "════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
