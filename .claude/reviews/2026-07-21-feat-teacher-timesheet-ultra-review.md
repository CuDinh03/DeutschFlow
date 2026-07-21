# Ultra Code Review — luồng chấm công giáo viên (PR #242)

**Ngày:** 2026-07-21
**Phương pháp:** multi-agent adversarial review — 3 map + 7 dimension reviewer + 14 verifier đối kháng (mỗi lỗi CRITICAL/HIGH được 2 tác tử độc lập soi bằng lens *reproduce* và *refute*). 24 tác tử, 0 lỗi, ~2.3M token.

## Trạng thái cuối: ✅ ĐÃ VÁ TOÀN BỘ — PR #242 `MERGEABLE / CLEAN`

Mọi phát hiện có thật đã được vá, kiểm chứng trên Postgres 16 thật, và gộp vào PR #242.

---

## ⚠️ Đính chính về phạm vi review (đọc trước khi tin các mục bên dưới)

Review ban đầu soi **`feat/teacher-timesheet` bản LOCAL = `9f74a120`**, nhưng head thật của PR #242 là
**`origin/feat/teacher-timesheet` = `1508d280`** — hai ref này **lệch nhau**: bản local là nhánh cũ còn
đọng commit WIP `9f74a120` ("lưu công việc đang dở"), bản origin đã merge main và sạch.

Hệ quả: nhóm phát hiện **migration/đóng gói** chỉ đúng với bản local stale, **KHÔNG áp dụng cho PR #242**:

| Phát hiện ban đầu | Thực tế với PR #242 |
|---|---|
| 🔴 CRITICAL Flyway checksum collision V259 | ❌ Không áp dụng — origin V259 khớp main (`896ff58`) |
| 🟠 HIGH V259 `CREATE IF NOT EXISTS` no-op | ❌ Không áp dụng — origin dùng bản ALTER của main |
| Thiếu V260/V261 | ❌ Không áp dụng — origin có đủ |
| Lệch version mobile `app.json` 1.0.1 | ❌ Không áp dụng — origin là 1.0.0 |
| Scope-creep (materials/Apple-IAP/docs) | ❌ Không áp dụng — origin sạch |

**PR #242 chưa bao giờ là deploy-blocker.** Bài học: luôn đối chiếu `git rev-parse origin/<branch>` với
ref local trước khi kết luận về một PR — repo này có nhiều nhánh/worktree nên hai ref dễ lệch.

---

## Phát hiện CÓ THẬT (áp dụng cho PR #242) — tất cả đã vá

### 🟠 HIGH — Kỳ công chồng ngày → trả lương gấp đôi + HTTP 500
`teacher/service/TimesheetPeriodService.java` · `openPeriod()`

`openPeriod` nhận `from`/`to` tuỳ ý từ client, và ràng buộc duy nhất là `UNIQUE (teacher_id, period_start)`
— **không có gì chặn hai kỳ khác mốc bắt đầu mà giao ngày nhau**. Giáo viên mở kỳ A = 01/01–31/01 rồi
kỳ B = 15/01–15/02 (chồng 15–31/01):

1. **Trả lương hai lần:** `snapshotTotals()` đếm dòng công theo KHOẢNG NGÀY, không theo `period_id`, nên các
   buổi 15–31/01 được cộng vào tổng của CẢ A lẫn B; `orgSummary()`/`exportOrgCsv()` cộng dồn mọi kỳ.
   Ví dụ 8 buổi × 90′ bị xuất thành 16 buổi / 1440′ thay vì 8 / 720.
2. **HTTP 500:** `assertRecordEditable()` tra kỳ phủ một ngày bằng finder trả `Optional`; hai kỳ cùng phủ
   → khớp 2 dòng → `IncorrectResultSizeDataAccessException` trên mọi thao tác thêm/sửa/xoá dòng công.

Giáo viên **tự gây được** và chính họ là người hưởng lợi khi trả thừa.

**Đã vá:** `openPeriod` kiểm tra idempotent theo `period_start` trước, rồi `assertNoOverlap` (409 rõ nghĩa);
**V267** `EXCLUDE USING gist (teacher_id WITH =, daterange(period_start, period_end, '[]') WITH &&)` +
`btree_gist` làm chốt cứng phía DB; finder đổi `Optional` → `List` và `assertRecordEditable` dùng stream để
khử 500 kể cả nếu lọt chồng.

### 🟡 MEDIUM — Rò payroll xuyên tổ chức
`TimesheetPeriodService.snapshotTotals()` cộng mọi dòng công của giáo viên trong khoảng ngày, không lọc theo
`orgId` mà kỳ đã snapshot. Giáo viên dạy lớp thuộc org khác (dòng công snapshot org của LỚP) làm tổng của
org nhà bị thổi phồng — manager org A thấy và trả cho cả buổi thuộc org B.

**Đã vá:** thêm `belongsToPeriodOrg()` — chỉ loại khi **cả hai org đều biết và khác nhau**, giữ nguyên hành
vi ca đơn-tổ-chức và dòng công `org = null`.

### 🟡 MEDIUM — Modal từ chối kỳ làm mất input của manager
`app/v2/org/timesheets/page.tsx` · `confirmReject()` gọi `setRejecting(null)` + `setRejectReason('')`
**trước** khi `await`. Khi `rejectPeriod` thất bại (timeout, hoặc 409 vì manager khác vừa đổi trạng thái),
modal đã đóng và lý do đã mất → phải gõ lại từ đầu.

**Đã vá:** `runAction` trả `boolean`; chỉ đóng modal + xoá lý do khi thành công.

### 🟡 MEDIUM — Guard khoá kỳ của `updateRecord` / `deleteRecord` không có test
`updateRecord` gọi `assertRecordEditable` hai lần (kỳ NGUỒN và kỳ ĐÍCH khi dời buổi) — vế kỳ đích chính là
chốt chặn "tuồn công vào kỳ đã duyệt". `deleteRecord` (xoá cứng dòng lương) không có test nào.
Guard hiện tại đúng, nhưng một hồi quy sẽ đi lọt hoàn toàn.

**Đã vá:** thêm 4 test — `updateRecord` chặn kỳ nguồn đã chốt, chặn dời sang kỳ đích đã chốt;
`deleteRecord` chặn dòng công của giáo viên khác (IDOR) và chặn khi kỳ đã chốt.

### 🔵 LOW (4) — đã vá
| Lỗi | Cách vá |
|---|---|
| `openPeriod` get-or-create không atomic → 2 request đồng thời cùng mốc bắt đầu ném 500 | Repo native upsert `insertIfAbsent` (`INSERT … ON CONFLICT (teacher_id, period_start) DO NOTHING`) rồi tra lại → idempotent |
| `teacher_session_record.period_id` + FK + index là schema chết (entity không map, không dòng nào ghi) | **V268** gỡ cả ba |
| Export CSV dùng ô nhập `from`/`to` hiện tại trong khi bảng hiển thị range đã tải | Track `loadedRange`; export bám theo nó, disable nút khi ô nhập lệch |
| Client `updateRecord` trong `timesheetApi.ts` là dead code | Xoá (endpoint backend `PUT /records/{id}` vẫn giữ) |

> 🔑 **`openPeriod` atomic — vì sao dùng upsert chứ không `try/catch`:** bắt `DataIntegrityViolationException`
> trong cùng `@Transactional` rồi tra lại **không chạy được** — Postgres abort cả transaction khi vi phạm
> ràng buộc, nên câu truy vấn sau đó cũng lỗi. `INSERT … ON CONFLICT DO NOTHING` là một câu lệnh thành công
> nên không abort transaction.

---

## Kiểm chứng

### Test tự động
| Hạng mục | Kết quả |
|---|---|
| Unit test backend (2 lớp timesheet) | ✅ 37/37 |
| `tsc --noEmit` frontend | ✅ 0 lỗi |
| CI PR #242 | ✅ Compile · Unit Tests · build-and-lint · Semgrep · gitleaks · npm audit — tất cả pass |

### Postgres 16 THẬT (Docker `pgvector/pgvector:pg16`)
Vì unit test mock repository nên **không phủ SQL**, và CI **skip Integration Tests** — phải chạy tay:

- **Flyway:** `Successfully applied 266 migrations to schema "public", now at version v268` — toàn bộ
  V1→V268 replay sạch từ DB trống, không checksum/exception. `ClassScheduleIT` **5/5 xanh**.
- **`btree_gist` có sẵn** trong image (rủi ro extension của V267 đã loại).

| Kiểm hành vi SQL | Kết quả |
|---|---|
| V267 `excl_ttp_no_overlap` tồn tại | ✅ `contype = x` |
| V268 gỡ `period_id` + `fk_tsr_period` + `idx_tsr_period` | ✅ 0 dòng cả ba |
| `insertIfAbsent` idempotent | ✅ `INSERT 0 1` rồi `INSERT 0 0`, giữ kỳ đầu |
| EXCLUDE chặn kỳ chồng khác mốc bắt đầu | ✅ `conflicting key value violates exclusion constraint` |
| Kỳ không chồng vẫn chèn được | ✅ |
| Biên kề chung đúng 1 ngày (30/04) | ✅ **bị chặn** — đúng, vì `[]` inclusive normalize thành `[start, end+1)` |
| Kỳ liền kề không chung ngày (30/06 → 01/07) | ✅ chèn được cả hai |

Script: `scratchpad/verify_timesheet_sql.sql` (dùng `SET session_replication_role='replica'` để bỏ FK
`teacher_id → users` mà vẫn giữ nguyên hiệu lực của unique + EXCLUDE, vì hai loại này là index-based).

---

## Kết quả bàn giao

- Toàn bộ bản vá đã **fast-forward vào head của PR #242** (`1508d280 → 122b8064`), không dùng force.
- PR #242: base `main`, **MERGEABLE / CLEAN**, 56 file.
- Hai commit vá: `6c6da5b8` (HIGH-3 + 2 MEDIUM) và `122b8064` (4 LOW).
- **Việc còn lại duy nhất:** owner quyết định merge PR #242 — merge nghĩa là đưa cả tính năng chấm công lên
  `main` (hiện `main` chưa có V262–V268). Mọi rào cản kỹ thuật đã dọn.
