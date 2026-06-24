# KẾT QUẢ TEST — SWEEP CUỐI (AI suite · public/auth · messaging · admin · owner · misc · cross-cutting)

> 2026-06-24 · Live · (BỎ QUA payment theo yêu cầu). test01 đã trả về DEFAULT; config đã revert.
> Điểm nhấn: chạy được toàn bộ AI suite (nhờ cấp quota tạm) + tìm thêm **MON-1 (🟠): plan admin cấp KHÔNG bền — rớt về DEFAULT sau 1 lần dùng AI**.

---

## A. AI SUITE (cấp PRO tạm cho test01)
| Luồng | KQ |
|---|:--:|
| AI Speaking: session → chat turn (score 0.6) → messages(3) → end → **report** (overallScore/strengths/grammarAccuracy/commonErrors) | ✅ 200 |
| TTS `POST /api/ai-speaking/tts` | ✅ 200 — audio 18,720 bytes (audio/mpeg) |
| Mock-exam **finish** (trước bị 429) | ✅ 202 Accepted (chấm async) |
| Interview: session(INTERVIEW persona) → turn → `/interviews/{id}/report` | ✅ 200 |
| Pronunciation `POST /api/speaking/pronunciation-check` (text-only) | ⚠ 500 (cần audio; nên 400) |

### 🟠 MON-1 — Plan admin cấp KHÔNG bền (cần điều tra)
- `PATCH /api/admin/users/58/plan {PRO, override 500000}` → runtime honor PRO/500000 **ngay**, nhưng **sau lượt chat đầu, plan rớt về DEFAULT/NONE** (`subscriptionEndsAtUtc` = null), lượt 2 → **429**.
- Tái hiện 2 lần (kể cả startsAtUtc lùi 2'). Phải **cấp lại trước mỗi thao tác AI** mới chạy được.
- Nghi ngờ: `reconcileSubscriptions` (chạy mỗi assertAllowed) vô hiệu hoá subscription override do bản ghi không hợp lệ (endsAt không lưu). → Người dùng được cấp gói qua admin có thể **mất gói sau 1 lần dùng**. Soi `common/quota` + đường admin updateUserPlan.
- (Phân biệt với TF-1: TF-1 là INTERNAL/org-pool không honor; MON-1 là override cá nhân không bền.)

---

## B. PUBLIC / AUTH (PASS)
| Luồng | KQ |
|---|:--:|
| Free-grade (ẩn danh) `POST /api/public/free-grade {essay}` | ✅ 200 — **score 60 + feedback** (chấm AI cho khách) |
| Free-grade bài <50 ký tự | ✅ 400 (validate) |
| Register `POST /api/auth/register` | ✅ 201 (STUDENT) |
| Forgot-password `POST /api/auth/forgot-password` | ✅ 200 |
| Public invite token sai | ✅ 404 |

## C. MESSAGING (PASS — 2 chiều)
- Student→Teacher `POST /api/messages {recipientId,body}` → ✅ 200.
- Teacher `GET /conversations` → 1; `GET /with/58` → thread có tin "Xin chào thầy"; teacher reply → ✅ 200.

## D. ADMIN sweep (GET — PASS toàn bộ 200)
`/reports/overview`, `/reports/ai-usage-by-feature`, `/reports/ai-cost-summary`, `/reports/ai-cost-daily`, `/reports/api-telemetry`, `/reports/gate-checklist`, `/audit`, `/users`, `/plans`, `/classes`, `/marketing/stats|leads|teacher-clusters`, `/mock-exam-packs`, `/ai-config` → **đều 200**.
(Bỏ: `/notifications/broadcast` — gửi cho toàn user.)

## E. OWNER còn lại (PASS)
| Luồng | KQ |
|---|:--:|
| `GET /api/org/seats` | ✅ (seatLimit 0) · `GET /invitations` ✅ |
| Pre-create teacher `POST /api/org/teachers {email,displayName,password}` | ✅ 200 (uid 64, role TEACHER, không gửi email) |
| Remove member `DELETE /api/org/members/64` | ✅ 204 |
| **Auto-demote** sau remove | ✅ role 64: TEACHER → **STUDENT** (regression cũ "I" đã fix) |

## F. MISC domains
| Endpoint | KQ |
|---|:--:|
| `/api/vocabulary/words` ✅200 · `/{id}/learn` ✅202 | |
| `/api/video-lessons/vocab` ✅200 · `/news` ✅200 | |
| `/api/video-lessons/listening` | ⚠ 429 (AI-gated) |
| `/api/v2/media` (student) | ⚠ 403 (giới hạn quyền — có vẻ chủ ý) |
| `/api/grammar/validate` | ⚠ 400 (shape body) |

## G. CROSS-CUTTING
| Mục | KQ |
|---|:--:|
| **Rate-limit** login sai 14 lần | ✅ **429 từ lần thứ 6** (sau 5 lần) |
| **Refresh-token reuse** | ⚠ Hoạt động trên thực tế (UI báo "Session compromised" khi reuse) nhưng repro qua API body 400 (refresh dùng **httpOnly cookie**, không nhận body) — chưa repro sạch qua API |
| **S3 presigned-url** | ⚠ 400 (sai tham số; chưa lấy được URL) |
| **SSE** (`/chat/stream`, job SSE) | Endpoint có; chat non-stream đã verify; streaming chưa test sâu |

---

## H. BỎ QUA (theo yêu cầu / an toàn)
- **Toàn bộ payment** (Stripe/MoMo/Apple/SePay) — theo yêu cầu.
- Admin **broadcast** (gửi toàn user), **ai-image generate** (tốn AI), org-charged **ai-grade success** (cần đổi org pool).

---

## I. Dữ liệu test tích luỹ (CẦN CLEANUP)
| Loại | ID/định danh |
|---|---|
| Lớp teacher | 6, 7, 8, 10 |
| Lớp org | 9 |
| Invoice | #1 (org 7, PAID) |
| Account đăng ký | zztest_*@example.com (STUDENT) |
| test01 | onboarding profile, 1 thẻ SRS, vài mock attempt, ~5400 token usage, thread tin nhắn với GV 62 |
| GV tạm | uid 64 (đã remove → STUDENT, membership đóng) |

→ Xoá được: lớp 6,7,8,9,10 (`DELETE`). Không có endpoint xoá: invoice, account đã đăng ký, usage ledger (gắn nhãn "ZZ/TEST").
