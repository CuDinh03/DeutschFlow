#!/bin/bash
# QA luồng chấm công đầu-cuối: ghi công → nộp → duyệt → khoá → xuất CSV
set -u
API=http://localhost:8080/api
PSQL="docker exec df-it-pg psql -U postgres -d df_qa2 -tA"
ok=0; fail=0
chk() { # chk "mô tả" "kỳ vọng" "thực tế"
  if [ "$2" = "$3" ]; then echo "  ✓ $1"; ok=$((ok+1));
  else echo "  ✗ $1 — kỳ vọng [$2] nhận [$3]"; fail=$((fail+1)); fi
}

echo "═══ 0. Dựng dữ liệu ═══"
# Đăng ký qua API thật để có mật khẩu biết trước
curl -s -o /dev/null -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"gv.qa@df.test","password":"QaPass12345!","displayName":"GV Quốc Anh"}'
curl -s -o /dev/null -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ql.qa@df.test","password":"QaPass12345!","displayName":"QL Bích Hằng"}'
TID=$($PSQL -c "select id from users where email='gv.qa@df.test';")
MID=$($PSQL -c "select id from users where email='ql.qa@df.test';")
echo "  teacher_id=$TID manager_id=$MID"

$PSQL -c "insert into organizations(name,slug,seat_limit,status) values('QA Center','qa-center',50,'ACTIVE') on conflict do nothing;" >/dev/null
OID=$($PSQL -c "select id from organizations where slug='qa-center';")
$PSQL -c "update users set role='TEACHER', org_id=$OID where id=$TID;" >/dev/null
$PSQL -c "update users set role='MANAGER', org_id=$OID where id=$MID;" >/dev/null
$PSQL -c "insert into org_members(org_id,user_id,role,status) values($OID,$TID,'TEACHER','ACTIVE'),($OID,$MID,'MANAGER','ACTIVE') on conflict do nothing;" >/dev/null
echo "  org_id=$OID, org_members đã tạo"

# Lớp + gán giáo viên PRIMARY + 1 buổi ĐÃ QUA (để sinh gợi ý)
$PSQL -c "insert into teacher_classes(teacher_id,name,invite_code,org_id,created_at) values($TID,'K-QA B1','QAINV001',$OID,now());" >/dev/null
CID=$($PSQL -c "select id from teacher_classes where invite_code='QAINV001';")
$PSQL -c "insert into class_teachers(class_id,teacher_id,role) values($CID,$TID,'PRIMARY') on conflict do nothing;" >/dev/null
PAST="$(date -u -v-2d '+%Y-%m-%d') 18:00:00"
$PSQL -c "insert into class_sessions(class_id,start_at,duration_minutes,mode,status,is_overridden,original_date) values($CID,'$PAST',90,'OFFLINE','SCHEDULED',false,'$(date -u -v-2d '+%Y-%m-%d')');" >/dev/null
SID=$($PSQL -c "select id from class_sessions where class_id=$CID;")
echo "  class_id=$CID session_id=$SID (buổi $PAST)"
[ -n "$CID" ] && [ -n "$SID" ] || { echo "  ✗ SEED THẤT BẠI — dừng"; exit 1; }

echo "═══ 1. Đăng nhập ═══"
TTOK=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"gv.qa@df.test","password":"QaPass12345!"}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))")
MTOK=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ql.qa@df.test","password":"QaPass12345!"}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))")
[ -n "$TTOK" ] && echo "  ✓ token giáo viên" || { echo "  ✗ login giáo viên THẤT BẠI"; exit 1; }
[ -n "$MTOK" ] && echo "  ✓ token quản lý" || { echo "  ✗ login quản lý THẤT BẠI"; exit 1; }
TA="Authorization: Bearer $TTOK"; MA="Authorization: Bearer $MTOK"

FROM=$(date -u -v-10d '+%Y-%m-%d'); TO=$(date -u '+%Y-%m-%d')

echo "═══ 2. Giáo viên xem bảng công — buổi đã qua phải xuất hiện ở gợi ý ═══"
SHEET=$(curl -s -H "$TA" "$API/v2/teacher/timesheet?from=${FROM}T00:00:00&to=${TO}T23:59:59")
NSUG=$(echo "$SHEET" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['suggestions']))")
chk "có 1 buổi gợi ý ghi công" "1" "$NSUG"

echo "═══ 3. Ghi công buổi đó ═══"
REC=$(curl -s -w '\n%{http_code}' -X POST $API/v2/teacher/timesheet/records -H "$TA" \
  -H 'Content-Type: application/json' -d "{\"sessionId\":$SID}")
RCODE=$(echo "$REC" | tail -1); RBODY=$(echo "$REC" | head -1)
chk "POST records → 201" "201" "$RCODE"
RID=$(echo "$RBODY" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])" 2>/dev/null)
RMIN=$(echo "$RBODY" | python3 -c "import sys,json;print(json.load(sys.stdin)['durationMinutes'])" 2>/dev/null)
chk "thời lượng snapshot từ lịch = 90" "90" "$RMIN"

echo "  → chống trả thừa công: ghi lại đúng buổi đó"
DUP=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/v2/teacher/timesheet/records -H "$TA" \
  -H 'Content-Type: application/json' -d "{\"sessionId\":$SID}")
chk "ghi trùng bị chặn → 409" "409" "$DUP"

echo "  → không ghi công buổi chưa dạy"
FUT=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/v2/teacher/timesheet/records -H "$TA" \
  -H 'Content-Type: application/json' \
  -d "{\"classId\":$CID,\"startedAt\":\"$(date -u -v+5d '+%Y-%m-%d')T18:00:00\",\"durationMinutes\":90}")
chk "ghi công tương lai bị chặn → 400" "400" "$FUT"

echo "═══ 4. Mở kỳ và nộp ═══"
PSTART=$(date -u -v-10d '+%Y-%m-%d'); PEND=$(date -u '+%Y-%m-%d')
PER=$(curl -s -X POST "$API/v2/teacher/timesheet/periods?from=$PSTART&to=$PEND" -H "$TA")
PID=$(echo "$PER" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
PST=$(echo "$PER" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
chk "kỳ mới ở trạng thái OPEN" "OPEN" "$PST"

SUB=$(curl -s -X POST "$API/v2/teacher/timesheet/periods/$PID/submit" -H "$TA")
SST=$(echo "$SUB" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
SSES=$(echo "$SUB" | python3 -c "import sys,json;print(json.load(sys.stdin)['totalSessions'])")
SMIN=$(echo "$SUB" | python3 -c "import sys,json;print(json.load(sys.stdin)['totalMinutes'])")
chk "nộp → SUBMITTED" "SUBMITTED" "$SST"
chk "snapshot số buổi = 1" "1" "$SSES"
chk "snapshot số phút = 90" "90" "$SMIN"

echo "═══ 5. ĐÃ NỘP thì dòng công phải bị đóng băng ═══"
LOCKED=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API/v2/teacher/timesheet/records/$RID" -H "$TA")
chk "xoá dòng công trong kỳ đã nộp bị chặn → 409" "409" "$LOCKED"

echo "═══ 6. Quản lý tổng hợp và duyệt ═══"
ORG=$(curl -s -H "$MA" "$API/org/timesheet?from=$PSTART&to=$PEND")
ONP=$(echo "$ORG" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['periods']))")
OTS=$(echo "$ORG" | python3 -c "import sys,json;print(json.load(sys.stdin)['totalSessions'])")
chk "quản lý thấy 1 kỳ" "1" "$ONP"
chk "tổng hợp số buổi = 1" "1" "$OTS"

echo "  → giáo viên KHÔNG được duyệt kỳ của chính mình"
SELF=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/org/timesheet/periods/$PID/approve" -H "$TA")
chk "giáo viên gọi duyệt bị chặn (403)" "403" "$SELF"

APP=$(curl -s -X POST "$API/org/timesheet/periods/$PID/approve" -H "$MA")
AST=$(echo "$APP" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])" 2>/dev/null)
chk "quản lý duyệt → APPROVED" "APPROVED" "$AST"

echo "═══ 7. Khoá kỳ ═══"
LCK=$(curl -s -X POST "$API/org/timesheet/periods/$PID/lock" -H "$MA")
LST=$(echo "$LCK" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])" 2>/dev/null)
chk "khoá → LOCKED" "LOCKED" "$LST"
RELOCK=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/org/timesheet/periods/$PID/lock" -H "$MA")
chk "khoá lại lần nữa bị chặn → 409" "409" "$RELOCK"

echo "═══ 8. Xuất CSV ═══"
curl -s -H "$MA" "$API/org/timesheet/export.csv?from=$PSTART&to=$PEND" -o /tmp/qa_export.csv \
  -w 'http=%{http_code} type=%{content_type}\n'
HASBOM=$(head -c 3 /tmp/qa_export.csv | xxd -p)
chk "CSV có BOM UTF-8" "efbbbf" "$HASBOM"
ROWS=$(tail -n +2 /tmp/qa_export.csv | grep -c . )
chk "CSV có 1 dòng dữ liệu" "1" "$ROWS"
grep -q "LOCKED" /tmp/qa_export.csv && { echo "  ✓ CSV chứa trạng thái LOCKED"; ok=$((ok+1)); } || { echo "  ✗ CSV thiếu LOCKED"; fail=$((fail+1)); }
grep -q "GV Quốc Anh" /tmp/qa_export.csv && { echo "  ✓ CSV giữ đúng tiếng Việt"; ok=$((ok+1)); } || { echo "  ✗ CSV hỏng tiếng Việt"; fail=$((fail+1)); }
echo "  --- nội dung CSV ---"; cat /tmp/qa_export.csv; echo

echo "═══ KẾT QUẢ: $ok đạt / $fail hỏng ═══"
[ $fail -eq 0 ] || exit 1
