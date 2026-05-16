# Thiết kế Hệ thống Gói Người dùng — DeutschFlow v2 ✅

> **Đã xác nhận giá:** PRO = 299,000đ | ULTRA = 699,000đ | ULTRA = 5x PRO tokens

## Tổng quan 5 gói

| Code | Tên | Giá/tháng | Thời hạn | Token/ngày | Token hết → |
|---|---|---|---|---|---|
| **DEFAULT** | Mặc định | 0đ | Vĩnh viễn | 0 | — |
| **FREE** | Dùng thử | 0đ | **7 ngày** | 9,000 | → DEFAULT |
| **PRO** | Trả phí chuẩn | **299,000đ** | **30 ngày** | 400,000 | → DEFAULT* |
| **ULTRA** | Cao cấp nhất | **699,000đ** | **30 ngày** | 2,000,000 | → DEFAULT* |
| **INTERNAL** | Nội bộ/Dev | — | **Vĩnh viễn** | ∞ | — |

> [!NOTE]
> **\*PRO/ULTRA sau 30 ngày:** Nếu vẫn còn token trong ví → vẫn dùng được token còn lại nhưng **mất label PRO/ULTRA** (hiện thị DEFAULT). Khi hết token → chuyển DEFAULT hoàn toàn.

---

## 1. 🔒 DEFAULT — Hết hạn gói / Chưa có gói

**Triết lý:** Trạng thái "vệ sinh" — giữ lại tính năng cốt lõi **không tốn AI**, giữ chân user chờ gia hạn.

| Tính năng | Trạng thái | Chi tiết |
|---|---|---|
| **Hạn mức AI** | **0 token** | Không có quyền truy cập AI |
| Từ vựng & Ngữ pháp | ✅ Mở | Tra cứu cơ bản, xem định nghĩa |
| Phát âm | ✅ Mở | Web Speech API (fallback miễn phí) |
| Swipe Cards | ✅ Mở | Vuốt flashcard ôn từ vựng |
| Lego Game | ✅ Mở | Trò chơi xếp câu |
| Leaderboard | ✅ Mở | Xem bảng xếp hạng |
| **AI Speaking** | 🔒 **Khoá** | — |
| **Quick AI Toolbar** | 🔒 **Khoá** | — |
| **VocabAI Insights** | 🔒 **Khoá** | — |
| **Interview Mode** | 🔒 **Khoá** | — |
| **Vocab Analytics** | 🔒 **Khoá** | — |

---

## 2. 🆓 FREE — Gói dùng thử (7 ngày)

**Triết lý:** Đủ dùng để thấy giá trị nền tảng, giới hạn rõ ràng tránh lạm dụng.

| Tính năng | Trạng thái | Chi tiết |
|---|---|---|
| **Hạn mức AI** | **~9,000 token/ngày** | ≈ 3 phút chat AI hoặc 3 câu dài 200 từ |
| **Thời hạn** | **7 ngày** | Hết hạn → DEFAULT |
| Wallet rollover | ❌ | Không tích lũy |
| AI Speaking | ✅ **Chỉ COMMUNICATION** | Hội thoại thông thường |
| Persona | ✅ **Chỉ Emma + Anna** | 2/4 persona |
| VocabAI Panel | ✅ **2 tab** | Chỉ "Ví dụ" + "Cách nhớ (Mnemonic)" |
| Review Queue (SM-2) | ✅ **Tối đa 20 thẻ/ngày** | Giới hạn lượt ôn |
| Leaderboard | ✅ Mở | Cày XP, tạo động lực |
| Swipe Cards + Lego | ✅ Mở | Không giới hạn |
| **Interview Mode** | 🔒 **Khoá** | — |
| **Quick AI Toolbar** | 🔒 **Khoá** | — |
| **Vocab Analytics** | 🔒 **Khoá** | — |
| **4 Personas** | 🔒 **Khoá** | Chỉ 2/4 |

---

## 3. ⭐ PRO — Gói trả phí tiêu chuẩn (30 ngày)

**Triết lý:** Trải nghiệm học liền mạch, cá nhân hoá sâu, phân tích chi tiết. **Doanh thu chính**.

| Tính năng | Trạng thái | Chi tiết |
|---|---|---|
| **Hạn mức AI** | **400,000 token/ngày** | ≈ 60 phút speaking/ngày (~200 lượt chat) |
| **Giá** | **299,000đ/tháng** | ≈ 9,967đ/ngày |
| **Thời hạn** | **30 ngày** | Hết 30 ngày + hết token → DEFAULT |
| **Wallet rollover** | ✅ **30 ngày** | Token không dùng hết sẽ tích luỹ |
| AI Speaking | ✅ **Đầy đủ** | COMMUNICATION + **INTERVIEW** |
| Persona | ✅ **Toàn bộ 4 Personas** | Lukas, Anna, Emma, Klaus |
| Interview Report | ✅ Mở | Đánh giá 5 phases, chấm điểm |
| VocabAI Panel | ✅ **Toàn bộ 6 tabs** | + Từ tương tự, Câu chuyện, Nguồn gốc, Mini Quiz |
| Quick AI Toolbar | ✅ **Mở khoá** | Sửa lỗi + giải thích ngữ pháp (Ctrl+Enter) |
| Review Queue | ✅ **Không giới hạn** | Ôn thoải mái |
| Vocab Analytics | ✅ **Mở khoá** | Biểu đồ Coverage, tiến độ CEFR |
| Streaming response | ✅ | AI trả lời real-time |
| **Mock Exam Goethe** | 🔒 **Khoá** | Chỉ ULTRA |
| **Custom Persona** | 🔒 **Khoá** | Chỉ ULTRA |
| **Advanced Analytics** | 🔒 **Khoá** | Chỉ ULTRA |

---

## 4. 💎 ULTRA — Gói cao cấp nhất (30 ngày)

**Triết lý:** Power user cày thi chứng chỉ, phỏng vấn xin việc. Mọi tính năng + đặc quyền.

### Kế thừa toàn bộ PRO +

| Tính năng | Chi tiết |
|---|---|
| **Hạn mức AI** | **2,000,000 token/ngày (5x PRO)** — đủ cày 4+ tiếng/ngày giai đoạn nước rút |
| **Giá** | **699,000đ/tháng** | ≈ 23,300đ/ngày |
| **Wallet rollover** | **Tối đa 90 ngày** tích luỹ |
| **Thời hạn** | **30 ngày** — hết 30 ngày + hết token → DEFAULT |

### Đặc quyền ULTRA:

#### 🎓 Mock Exam Mode (Thi thử Goethe/Telc)
- AI đóng vai **Prüfer** (giám khảo)
- Đi qua đúng 3 phần: **Teil 1** (Lên kế hoạch) → **Teil 2** (Trình bày chủ đề) → **Teil 3** (Thảo luận)
- Chấm điểm theo **Rubric chính thức** của Viện Goethe

#### 🧑‍🎨 Custom Persona Builder
- Nhập System Prompt tuỳ chỉnh
- Ví dụ: *"Tôi muốn bạn đóng vai bệnh nhân khó tính tại bệnh viện Berlin để tôi luyện Điều dưỡng"*
- Tạo persona riêng với ngữ cảnh, ngành nghề, tính cách

#### ⚙️ Evaluator Strictness (Tuỳ chỉnh độ gắt AI)
- **Gắt tối đa:** Sai der/die/das cũng báo lỗi
- **Chỉ lỗi nặng:** Bỏ qua lỗi nhỏ, không ngắt mạch cảm xúc khi nói
- Can thiệp vào `TurnEvaluator` settings

#### 📊 Advanced Analytics + Phân tích chuyên sâu
- **Lịch sử lỗi trọn đời:** Xem toàn bộ dữ liệu từ lúc tạo tài khoản (không giới hạn `?days=30`)
- **Trendline:** Biểu đồ xu hướng lỗi (VD: lỗi trật tự từ giảm, lỗi chia đuôi tính từ vẫn cao)
- **Gợi ý lộ trình phát triển tiếng Đức:** AI phân tích điểm yếu → đề xuất roadmap cá nhân
- **Gợi ý nghề nghiệp:** Dựa trên industry + level → gợi ý vị trí công việc phù hợp tại Đức

#### 🚀 Crash Course Roadmap
- Tạo Skill Tree ép tiến độ
- VD: *"Hoàn thành Phase 2 trong 10 ngày thay vì 14 ngày"*
- Tự động gom nhóm bài + tăng cường độ Review Queue

#### 🏅 Huy hiệu Độc quyền Leaderboard
- Viền avatar **Vàng Gold** hoặc **Tím Ultra** phát sáng
- Hiển thị trên `/student/leaderboard`

#### 📚 Custom Vocab Decks
- Tạo **bộ Swipe Card riêng** từ các từ đã tra cứu
- Không bị giới hạn bởi filter hệ thống

#### ⚡ Priority Queue
- Ưu tiên truy cập model AI nhanh hơn khi hệ thống quá tải

---

## 5. 🛡️ INTERNAL — Nội bộ / Admin / Dev

| Tính năng | Chi tiết |
|---|---|
| **Hạn mức AI** | **Bypass quota** — vô hạn hiệu dụng |
| **Thời hạn** | **Vĩnh viễn** — không hết hạn |
| **Tính năng** | Mở khoá **toàn bộ** (bao gồm batch jobs, auto-tagging, trigger experiments) |

---

## 6. Logic chuyển gói

### Sơ đồ trạng thái

```mermaid
stateDiagram-v2
    [*] --> FREE: Đăng ký mới
    FREE --> DEFAULT: Hết 7 ngày
    FREE --> PRO: Mua PRO
    FREE --> ULTRA: Mua ULTRA
    
    DEFAULT --> FREE: Kích hoạt trial (1 lần)
    DEFAULT --> PRO: Mua PRO
    DEFAULT --> ULTRA: Mua ULTRA
    
    PRO --> DEFAULT: Hết 30 ngày + hết token
    PRO --> ULTRA: Nâng cấp
    
    ULTRA --> DEFAULT: Hết 30 ngày + hết token
    
    note right of PRO
        Sau 30 ngày nếu còn token:
        Vẫn dùng token nhưng mất label PRO
        UI hiển thị DEFAULT
        Khi hết token → DEFAULT thật
    end note
```

### Quy tắc chi tiết

| Sự kiện | Kết quả |
|---|---|
| Đăng ký mới | → FREE (7 ngày) |
| FREE hết 7 ngày | → DEFAULT (0 token) |
| Mua PRO/ULTRA | → Kích hoạt ngay, 30 ngày |
| PRO hết 30 ngày, **còn token** | → Mất label PRO, **vẫn dùng token ví** → hết token → DEFAULT |
| PRO hết 30 ngày, **hết token** | → DEFAULT ngay |
| ULTRA hết 30 ngày, **còn token** | → Mất label ULTRA, **vẫn dùng token ví** → hết token → DEFAULT |
| PRO → mua ULTRA | → Nâng cấp ngay, token ví PRO cộng dồn |
| INTERNAL | → Không bao giờ hết hạn, bypass quota |

---

## 7. Bảng Token & Quota — ĐÃ XÁC NHẬN ✅

| Gói | Token/ngày | Wallet cap | ≈ Phút nói/ngày | Hạn gói | **Giá/tháng** |
|---|---|---|---|---|---|
| **DEFAULT** | 0 | — | 0 | Vĩnh viễn | 0đ |
| **FREE** | 9,000 | — | ~3 phút | 7 ngày | 0đ |
| **PRO** | 400,000 | 30 ngày | ~60 phút | 30 ngày | **249,000đ** |
| **ULTRA** | 2,000,000 | 90 ngày | ~4+ tiếng | 30 ngày | **499,000đ** |
| **INTERNAL** | 999,999,999 | ∞ | ∞ | Vĩnh viễn | — |

### Margin analysis (50 active users)

| Gói | Giá bán | Cost AI/tháng | Cost hạ tầng/tháng | **Lãi gộp** | **Margin** |
|---|---|---|---|---|---|
| **FREE** | 0đ | 315đ | 43,500đ | -43,815đ | Marketing |
| **PRO** | 299,000đ | 60,750đ | 43,500đ | **194,750đ** | **66%** |
| **ULTRA** | 699,000đ | 303,000đ | 43,500đ | **352,500đ** | **51%** |

> [!TIP]
> Khi scale lên **200 users**, hạ tầng/user giảm 4x → PRO margin **78%**, ULTRA margin **62%**.

---

## 8. Ma trận tính năng tổng hợp

| Tính năng | DEFAULT | FREE | PRO | ULTRA | INTERNAL |
|---|---|---|---|---|---|
| **Token AI** | 0 | 9K/ngày | 400K/ngày | **2M/ngày** | ∞ |
| **Giá** | 0đ | 0đ | **299K/tháng** | **699K/tháng** | — |
| **Wallet rollover** | — | — | 30 ngày | 90 ngày | — |
| **Thời hạn** | ∞ | 7 ngày | 30 ngày | 30 ngày | ∞ |
| Tra cứu từ vựng | ✅ | ✅ | ✅ | ✅ | ✅ |
| Phát âm (Web Speech) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Swipe Cards | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lego Game | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leaderboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI Speaking** | 🔒 | ✅ COMM only | ✅ COMM + INTERVIEW | ✅ + Mock Exam | ✅ |
| **Personas** | 🔒 | 2 (Emma, Anna) | 4 (All) | 4 + Custom | ✅ |
| **VocabAI Panel** | 🔒 | 2 tabs | 6 tabs | 6 tabs | ✅ |
| **Quick AI Toolbar** | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| **Review Queue** | ✅ | 20 thẻ/ngày | ∞ | ∞ | ✅ |
| **Vocab Analytics** | 🔒 | 🔒 | ✅ | ✅ + Trendline | ✅ |
| **Interview Mode** | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| **Streaming** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Mock Exam Goethe** | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| **Custom Persona** | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| **Evaluator Strictness** | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| **Advanced Analytics** | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| **Crash Course** | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| **Huy hiệu Leaderboard** | — | — | — | ✅ Gold/Tím | ✅ |
| **Custom Vocab Decks** | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| **Priority Queue AI** | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 9. features_json Schema (Database)

```json
// DEFAULT
{
  "streaming": false,
  "interview": false,
  "mockExam": false,
  "voiceClone": false,
  "quickAiToolbar": false,
  "vocabAiTabs": 0,
  "maxPersonas": 0,
  "maxReviewCards": -1,
  "vocabAnalytics": false,
  "customPersona": false,
  "evaluatorStrictness": false,
  "advancedAnalytics": false,
  "crashCourse": false,
  "customVocabDecks": false,
  "priorityQueue": false,
  "leaderboardBadge": null
}

// FREE
{
  "streaming": false,
  "interview": false,
  "mockExam": false,
  "voiceClone": false,
  "quickAiToolbar": false,
  "vocabAiTabs": 2,
  "maxPersonas": 2,
  "maxReviewCards": 20,
  "vocabAnalytics": false,
  "customPersona": false,
  "evaluatorStrictness": false,
  "advancedAnalytics": false,
  "crashCourse": false,
  "customVocabDecks": false,
  "priorityQueue": false,
  "leaderboardBadge": null
}

// PRO
{
  "streaming": true,
  "interview": true,
  "mockExam": false,
  "voiceClone": true,
  "quickAiToolbar": true,
  "vocabAiTabs": 6,
  "maxPersonas": 4,
  "maxReviewCards": -1,
  "vocabAnalytics": true,
  "customPersona": false,
  "evaluatorStrictness": false,
  "advancedAnalytics": false,
  "crashCourse": false,
  "customVocabDecks": false,
  "priorityQueue": false,
  "leaderboardBadge": null
}

// ULTRA
{
  "streaming": true,
  "interview": true,
  "mockExam": true,
  "voiceClone": true,
  "quickAiToolbar": true,
  "vocabAiTabs": 6,
  "maxPersonas": -1,
  "maxReviewCards": -1,
  "vocabAnalytics": true,
  "customPersona": true,
  "evaluatorStrictness": true,
  "advancedAnalytics": true,
  "crashCourse": true,
  "customVocabDecks": true,
  "priorityQueue": true,
  "leaderboardBadge": "ULTRA_GOLD"
}
```

---

## 10. Tổng kết — Đã xác nhận ✅

| Hạng mục | Giá trị |
|---|---|
| FREE token | 9,000/ngày ✅ |
| FREE persona | Emma + Anna ✅ |
| PRO token | 400,000/ngày ✅ |
| PRO giá | **299,000đ/tháng** ✅ |
| ULTRA token | **2,000,000/ngày (5x PRO)** ✅ |
| ULTRA giá | **699,000đ/tháng** ✅ |
| ULTRA đặc quyền | Mock Exam + Custom Persona + Career Analytics ✅ |
| Logic hết hạn | Mất label → dùng ví → hết token → DEFAULT ✅ |

> [!IMPORTANT]
> **Bạn approve bản thiết kế này để tôi bắt đầu implement?**
> (Migration SQL + Backend QuotaService + features_json update)
