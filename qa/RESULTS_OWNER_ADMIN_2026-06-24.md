# KẾT QUẢ TEST — OWNER / ADMIN HAPPY-PATH + LÕI MONETIZATION — 2026-06-24

> Live · OWNER deflow / ADMIN admin · org 7. Mọi thay đổi đã **revert**. test01 đã về DEFAULT.
> Điểm nhấn: **xác nhận lõi ledger AI hoạt động (1 lượt chat = 2433 token ghi sổ)** + **xác nhận chính xác bug TF-1** (admin báo unlimited nhưng enforcement org-pool chặn 429).

---

## 1. OWNER happy-path (PASS)
| Bước | Endpoint | KQ |
|---|---|:--:|
| Đổi role MANAGER→TEACHER (member 61) | `PATCH /api/org/members/61/role {role:"TEACHER"}` | ✅ 200 → role = TEACHER |
| Revert TEACHER→MANAGER | `... {role:"MANAGER"}` | ✅ 200 → role = MANAGER |
| Tạo lớp tổ chức | `POST /api/org/classes {name,teacherId:62}` | ✅ 200 → class id 9 |

## 2. ADMIN happy-path (PASS)
| Bước | Endpoint | KQ |
|---|---|:--:|
| Tạo invoice | `POST /api/admin/organizations/7/invoices` | ✅ 200 — invoice id 1 (seats 5, 1.5M₫) |
| Liệt kê | `GET .../invoices` | ✅ 1 |
| Đổi trạng thái → PAID | `PATCH .../invoices/1/status {status:"PAID"}` | ✅ 200 → PAID |
| Activate entitlements | `POST .../activate-entitlements` | ✅ 200 (granted 0) |
| Đổi gói user (test01→PRO) | `PATCH /api/admin/users/58/plan {planCode:"PRO",monthlyTokenLimitOverride:200000}` | ✅ 200 — runtime honored (PRO/200000) |
| Revert → DEFAULT | `... {planCode:"DEFAULT"}` | ✅ 200 → DEFAULT/NONE |

## 3. LÕI MONETIZATION — verified bằng cách cấp quota tạm cho test01

### 3.1 AI Speaking + ledger decrement (PASS — lần đầu test được)
- Sau khi cấp PRO, `POST /api/ai-speaking/sessions` → **200** (trước đó 429). Session có persona/initialAiMessage.
- `POST /sessions/{id}/chat {userMessage,streamAudio:false}` → **200**, AI trả `aiSpeechDe` + `feedback` + `similarityScore` + `suggestions`.
- **Ledger ghi đúng:** usage entry `SPEAKING_CHAT`, **usedThisMonth/usedToday = 2433 token** cho 1 lượt. → vòng **tiêu → ghi sổ → trừ** hoạt động.

### 3.2 BUG TF-1 — xác nhận chính xác (🟠 Cao)
Hai đường resolve gói **không khớp** cho cùng user:
| Nguồn | testgv03 (uid 62) |
|---|---|
| **Admin** `GET /api/admin/users/62/quota` | planCode **INTERNAL**, quotaKind **INTERNAL_UNLIMITED**, remaining **999,999,999** |
| **Enforcement AI** (khi hành động) | **429** "Tổ chức đã dùng hết ngân sách token AI tháng này" |

→ Gói **INTERNAL/"không giới hạn"** (và org `poolUnlimited`) **không được honor** ở chốt AI tính theo **org-pool** (ai-grade, mock-exam, speaking org). Ngược lại, gói **PRO cá nhân (có override)** thì **được honor** (test01 chạy được). Vậy lỗi nằm ở **đường resolve INTERNAL/org-pool**, không phải toàn bộ quota. Cần soi `common/quota` (OrgPoolGuard vs personal QuotaService) — admin-panel/org-dashboard hiển thị "unlimited" trong khi enforcement chặn.

### 3.3 Quan sát phụ (⚪)
- Admin set plan với `startsAtUtc = đúng thời điểm hiện tại` có thể không kích hoạt bền (sau 1 thao tác rớt về DEFAULT). Đặt `startsAtUtc` lùi vài giây thì giữ ổn định (đã verify PRO/WALLET giữ qua 3s). Nên chuẩn hoá: server tự lùi/at-or-before now.

---

## 4. Dữ liệu test thêm (cần cleanup)
- Lớp org **id 9** (ZZ_ORG_CLASS); invoice **id 1** (org 7, PAID); test01 đã ghi **2433 token** usage (không revert được — usage ledger).
- test01 plan đã trả về **DEFAULT**. Role member 61 đã trả về **MANAGER**.
