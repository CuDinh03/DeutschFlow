# KẾT QUẢ TEST — LUỒNG HỌC CỦA HỌC VIÊN (test01) — 2026-06-24

> Live `api.mydeutschflow.com` · STUDENT test01 · (bỏ qua payment theo yêu cầu).
> Tổng quan: **các luồng học không-AI PASS hết.** Các tính năng **chấm bằng AI vẫn bị gate 429** (DEFAULT/0) — không hoàn tất được nếu chưa có quota.

---

## 1. Onboarding (PASS)
| Bước | Endpoint | KQ |
|---|---|:--:|
| Tạo hồ sơ học + sinh lộ trình | `POST /api/onboarding/profile` | ✅ 201 — trả plan {weeklyMinutes, weeksTotal, sessionsPerWeek...} |
| Trạng thái | `GET /api/onboarding/status` | ✅ {hasPlan:true} |
| Hồ sơ học | `GET /api/profile/me/learning` | ✅ 200 (trước onboarding là 404) |
| Lộ trình | `GET /api/roadmap/me` | ✅ 46 node |

## 2. SRS — spaced repetition (PASS)
| Bước | Endpoint | KQ |
|---|---|:--:|
| Lên lịch thẻ | `POST /api/srs/schedule {vocabId,german,meaning}` | ✅ 200 → totalCards 1 |
| **Ôn** (quality 4) | `POST /api/srs/review {vocabId,quality:4}` | ✅ 200 → **nextReviewAt dời +3 ngày (FSRS)**, repetitions cập nhật |
| Quality sai (9) | `POST /api/srs/review {quality:9}` | ✅ 400 (chặn 0–5) |
| Stats | `GET /api/srs/stats` | ✅ totalCards 1 |

## 3. Mock exam (một phần — finish bị gate AI)
| Bước | Endpoint | KQ |
|---|---|:--:|
| Gợi ý đề | `GET /api/mock-exams/recommend` | ✅ recommendedExamId 1 (Goethe A1) |
| **Bắt đầu** | `POST /api/mock-exams/1/start` | ✅ 200 — attempt 5, sections_json |
| **Nộp/chấm** | `POST /api/mock-exams/attempts/5/finish` | ⚠ **429 "AI token quota exceeded"** (chấm dùng AI) |
| Kết quả | `GET /api/mock-exams/attempts/5/result` | ✅ 200 nhưng status IN_PROGRESS (do finish chưa xong) |

→ Khởi tạo + lưu attempt OK; **không chấm xong được vì thiếu quota AI**.

## 4. Assessment B1 (PASS)
| `GET /api/assessment/b1/readiness` | ✅ 200 |
| `POST /api/assessment/b1/evaluate` | ✅ 200 (không gate AI) |

## 5. Notifications (PASS)
| `GET /api/notifications/unread-count` | ✅ 9 |
| `POST /api/notifications/read-all` | ✅ 200 → unread 0 |

## 6. Gamification / Progress (reads — PASS)
| `GET /api/xp/me` ✅ (totalXp, level) · `/api/xp/leaderboard` ✅ array[15] |
| `GET /api/achievements/me` ✅ array[26] |
| `GET /api/practice/exercises` ✅ (paginated) |
| `GET /api/phase/current` ✅ (FOUNDATION + metrics) · `/phase/next-action` ✅ |
| `GET /api/skill-tree/me` ✅ array[55] |
| `GET /api/interviews/personas` ✅ array[15] |

---

## 7. Nhận định
- **Mảng học không-AI hoạt động tốt** (onboarding, SRS/FSRS, assessment, notifications, XP/achievement/phase/skill-tree).
- **Gate token nhất quán & lan rộng**: speaking, **mock-exam finish**, ai-grade — đều 429 khi DEFAULT/0. Củng cố **TF-1/U-3**: enforcement có thật và phủ nhiều đường; điều bất thường là **dashboard/admin hiển thị "không giới hạn"**. Muốn test trọn (mock-exam chấm, speaking, interview) cần 1 account có quota.

## 8. Dữ liệu test thêm vào test01
- 1 thẻ SRS `ZZTEST_VOCAB_1`; 1 learning profile (onboarding); 1 mock-exam attempt (id 5, IN_PROGRESS); notifications đã đọc hết.
