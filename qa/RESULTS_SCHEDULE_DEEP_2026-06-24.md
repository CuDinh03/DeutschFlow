# KẾT QUẢ TEST KỸ — KẾ HOẠCH GIẢNG DẠY (class-schedule) — 2026-06-24

> TEACHER testgv03 · lớp test `ZZ_TEST_SCHED` (id 10) · API + verify UI `/v2/teacher/schedule`.
> Tổng quan: **CRUD lịch cố định + buổi lẻ + đổi/huỷ buổi hoạt động đúng.** Tìm ra **gốc của MUT-1: dayOfWeek dùng 0–6 (0=Thứ 2), value 7 bị 400.**

---

## 1. Quy ước dayOfWeek — GỐC của MUT-1 (🟡)
Set pattern với time riêng để nhận diện, đọc thứ buổi sinh ra:
| dayOfWeek gửi | Trạng thái | Buổi sinh ra |
|---|---|---|
| 1 (08:00) | ✅ 200 | (Thứ 3) |
| 3 (10:00) | ✅ 200 | **Thứ 5** 25/06 |
| 5 (14:00) | ✅ 200 | **Thứ 7** 27/06 |
| **7** (16:00) | ❌ **400** | — (ngoài range) |

→ **Quy ước là 0–6 với 0 = Thứ 2** (dow 3→Thu, 5→Sat), **không phải ISO 1–7**. Giá trị **7 bị từ chối 400**.
**Rủi ro:** nếu UI/người dùng nghĩ theo ISO (Thứ 2=1 … CN=7) thì lệch 1 ngày và **chọn Chủ Nhật (=7) sẽ lỗi**. Cần thống nhất convention FE↔BE + validate rõ.

## 2. Multi-pattern + list (PASS)
- 3 pattern (dow 1,3,5) cùng tồn tại trên 1 lớp. `GET /classes/10/patterns` → trả đúng 3 (dayOfWeek + startTime + defaultRoom).
- Upsert theo (classId, dayOfWeek): đặt lại cùng dow thì ghi đè.

## 3. Week view (PASS)
- `GET /class-schedule/week?from&to` (datetime) trả buổi của **mọi lớp** GV dạy (id, classId, className, patternId, mode, room, startAt, durationMinutes, status, overridden, studentCount).

## 4. PATCH buổi — đa trường (PASS)
`PATCH /class-schedule/sessions/{id}` đổi đồng thời:
- giờ 08:00→**09:30** ✅
- thời lượng →**120'** ✅
- trạng thái →**CANCELLED** ✅ (overridden=true)
- **UI**: buổi hiển thị **gạch ngang (đã huỷ)** đúng ô Thứ 3 09:30. ✅

⚠ **SCH-1 (⚪):** đặt `room` kèm `status:CANCELLED` trong cùng PATCH → room trả về **null** (không lưu room khi huỷ). Trước đó PATCH room (không kèm huỷ) thì lưu OK. Cần xác nhận có chủ ý xoá room khi huỷ không.

## 5. Buổi lẻ (standalone) (PASS)
- `POST /classes/10/sessions {startAt,durationMinutes,mode,room:'EXTRA'}` → 200; UI "Buổi lớp sắp tới" hiện **24/06 · 19:00 · EXTRA**. ✅ (buổi tạo tay đánh dấu overridden)

## 6. DELETE pattern (PASS)
- `DELETE /class-schedule/patterns/4` (dow=5) → 200; `GET patterns` còn **[1,3]** (đã gỡ dow 5). ✅

## 7. Quan sát phụ
| ID | Quan sát | Mức |
|---|---|---|
| MUT-1 (gốc) | dayOfWeek 0–6 (0=T2), 7→400; lệch ISO | 🟡 |
| SCH-1 | room không lưu khi PATCH kèm status=CANCELLED | ⚪ |
| SCH-2 | defaultRoom của pattern không xuống room buổi tự sinh (week view room=null), chỉ buổi override mới có room | ⚪ |

---

## 8. Dữ liệu test thêm
- Lớp **id 10** (ZZ_TEST_SCHED) + patterns (dow 1,3) + vài buổi (1 CANCELLED, 1 EXTRA).
