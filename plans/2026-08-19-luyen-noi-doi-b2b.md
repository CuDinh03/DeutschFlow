# Tính năng B2B: "Luyện nói đôi" (Partnerübung) — học viên cùng lớp luyện với nhau

- **Ngày:** 2026-08-19 · **Trạng thái:** THIẾT KẾ — chưa code
- **Loại:** tính năng **RIÊNG dành cho B2B** (trung tâm/lớp học). Chỉ dùng chung **khu Speaking** trên UI với mảng luyện thi; module, bảng, API, quyền, lộ trình, KPI đều tách (xem §A).
- **Phụ thuộc (một chiều):** engine luyện thi nói (`plans/2026-08-19-ke-hoach-luyen-thi-noi.md`) qua 3 contract ở §A — không dùng chung bảng. Xây song song được ngay khi Đợt 0 của engine công bố 3 interface (stub đủ); **kết quả chấm thật** của P0 chỉ có khi engine qua gate hiệu chuẩn golden set cho cấp tương ứng (Đợt 1 cho A1). Engine không phụ thuộc ngược vào tính năng này.
- **Phạm vi đợt đầu:** chỉ ghép học viên **trong cùng một lớp**; **AI chỉ đóng vai giám khảo (Prüfer)** — dẫn bài, bấm giờ, hỏi thêm, chấm — **không bao giờ đóng vai partner**; partner luôn là học viên; sau buổi luyện **chấm độc lập cho cả 2** theo kiểu Goethe hoặc kiểu telc (mục 2.4 của kế hoạch chính).
- **Giáo viên:** giao **bài về nhà theo cặp** (xếp cặp tay hoặc tự động, đặt hạn), theo dõi trạng thái từng cặp, **xem kết quả + transcript + nghe lại ghi âm** của cả hai.

---

## A. Định vị & ranh giới — tính năng B2B riêng (chốt 19/08)

- **Là gì:** công cụ cho **trung tâm/lớp học**: học viên cùng lớp luyện nói với nhau như trong phòng thi; **AI chỉ là giám khảo** (Prüfer + chấm), không bao giờ là partner; **giáo viên giao bài về nhà theo cặp và xem kết quả/ghi âm**. **Không phải** một chế độ của mảng luyện thi cá nhân.
- **Chung gì:** chỉ chung **khu Speaking** (card/lối vào riêng "Luyện nói đôi — lớp của bạn", route `/v2/student/speaking/pair`) và hạ tầng nền (auth, SSE ticket, Redis, S3, STT/TTS, quota).
- **Tách gì:** module backend riêng `com.deutschflow.pairspeaking`; bảng riêng `pair_speaking_*`; API riêng `/api/v2/pair-speaking/**`; feature flag + quyền riêng; lộ trình P0–P3 riêng (§14); KPI riêng; doc riêng (file này).
- **Ai thấy:** học viên có ghế org (`org_members`) **và** là thành viên lớp; giáo viên của lớp; org admin (thống kê). Tài khoản cá nhân FREE/PRO không thấy (hoặc chỉ thấy teaser "dành cho lớp học").
- **Tiêu token kênh nào:** kênh **trung tâm** (org pool) theo mô hình 2 kênh hiện có — hội thoại 0 token, chỉ STT + chấm.
- **3 contract với engine luyện thi** (read/call, không share bảng, engine phải giữ public & ổn định từ Đợt 0):
  1. `ExamBlueprintCatalog.get(provider, level, teil?)` — định nghĩa Teil (archetype, timing, stimulus, vai) — read-only.
  2. `ExamGradingService.grade(participantBundle, rubricRef)` — pipeline chấm 2.4 cho **một** người (kiểu Goethe/telc), nhận ngữ cảnh partner → Ergebnisbogen.
  3. `PrueferScriptService` — lời dẫn/câu hỏi giám khảo + TTS cho một Teil.
  Mọi thứ còn lại (lobby, phòng, media, ghi âm, state machine, bài tập giáo viên, kết quả 2 người) thuộc module này.
- **Mở rộng sau:** vì là công cụ lớp học, có thể chạy cả "Partnerarbeit" do giáo viên soạn (không theo đề thi) — ngoài phạm vi đợt đầu.
- **KPI B2B:** % lớp kích hoạt, phiên đôi/lớp/tuần, % giáo viên dùng sổ điểm luyện đôi, tỉ lệ hoàn thành phiên, NPS giáo viên.

---

## 0. Kết luận kỹ thuật ngắn

1. **Chấm 2 người**: pipeline chấm 2.4 đã chấm *theo từng thí sinh trên phần đóng góp của chính họ* — điều kiện cứng duy nhất là **audio tách riêng từng người** (Whisper không tách người nói).
2. **Nối 2 người từ xa** là hạ tầng mới (repo chỉ có SSE một chiều) → tách 3 mặt phẳng: **Control** (REST + SSE, backend là nguồn sự thật), **Media** (dịch vụ WebRTC quản lý, khuyến nghị LiveKit), **Recording/grading** (audio từng người → S3 → STT → chấm). Backend **không bao giờ relay audio real-time**.
3. **AI chỉ là giám khảo**: dẫn bài, bấm giờ, hỏi thêm, chấm. Partner rớt mạng → tạm dừng để nối lại hoặc hủy có chấm phần đã xong — **không thay người bằng máy**.
4. **Giáo viên là người điều phối**: giao bài về nhà theo cặp, theo dõi trạng thái, xem kết quả + nghe lại ghi âm cả hai. Đây là luồng P0; tự ghép và chế độ 2-người-1-máy trong giờ học là P1.
5. **Web ↔ mobile tương tác chéo từ ngày đầu** (§11): một API + một state machine + một event schema; client chỉ khác lớp adapter (media, ghi âm, push, transport sự kiện). Học viên web ghép được với học viên mobile; giáo viên dùng web.
6. **Same-class là bất biến bảo mật** kiểm ở mọi cửa (giao bài, mời, tạo phiên, cấp token phòng, mở SSE, upload audio, xem kết quả).

---

## 1. Hiện trạng hạ tầng (đã xác minh trong repo 19/08)

| Mảnh | Có? | Ghi chú / file |
|---|---|---|
| SSE server→client có auth | ✅ | `POST /sse/ticket` (one-time ~60s, `SseTicketService` lưu Redis) → `EventSource?ticket=`; mẫu fan-out qua Redis: `notification/sse/NotificationSseBroadcaster`; tiến độ job: `common/async/AsyncJobSseService`, `ai/queue/AiJobSseRegistry` |
| WebSocket | ❌ chưa dùng | `spring-boot-starter-websocket` có trong pom nhưng `SecurityConfig` ghi rõ "No STOMP/WebSocket config… do not expose /ws until handshake auth exists"; `docker/deutschflow.nginx.conf` block backend `location /` **không** có `Upgrade` header |
| WebRTC / media server | ❌ | không có ở web lẫn mobile |
| Redis | ✅ | rate-limiter, SSE ticket, idempotency, `SessionTurnGuard` → dùng cho presence, hàng đợi ghép cặp, cache trạng thái phòng |
| Upload media → S3 | ✅ | `POST /api/v2/media/upload`, `config/AwsS3Config` |
| Thu âm web | ✅ | `MediaRecorder audio/webm` (mẫu `components/speaking/PronunciationFeedback.tsx`); dùng `timeslice` để ghi theo chunk |
| Thu âm mobile | ⚠️ | `expo-audio`; không có `react-native-webrtc`/LiveKit → cần dev build khi làm mobile |
| Thành viên lớp | ✅ | module `organization`/`user` (`OrgClassStudentDto`, `StudentClassroomController`) — dùng làm nguồn kiểm bất biến same-class |
| STT/TTS/chấm | ✅ | `/api/ai-speaking/transcribe` (Whisper verbose), EdgeTts/XTTS, pipeline 2.4, `AiJob` queue |
| Mobile (Expo SDK 54) | ✅/⚠️ | `expo-dev-client` (dev build — cần cho LiveKit RN), `expo-notifications` (push per-device đã vá #238), `expo-updates` (OTA chỉ JS), `expo-router`, `expo-audio`; **chưa có** SSE client, `expo-keep-awake`, route giáo viên (`mobile/app` chỉ có `(auth)`, `(student)`) |
| Contract chung web–mobile | ⚠️ | Không có shared package (frontend/ và mobile/ tách, không workspace); backend có **springdoc OpenAPI** → sinh typed client cho cả hai từ một spec |
| Nợ đã biết | 🪤 | RCA 09/07: OSIV + SSE ghim connection DB → pool cạn ⇒ handler SSE phòng thi **không được** mở transaction; `docker restart` không đọc lại env |

---

## 2. Nguyên tắc kiến trúc

1. **Ba mặt phẳng tách bạch** — control (trạng thái, lệnh, đồng hồ) · media (thoại) · recording/grading (audio → điểm). Mỗi mặt phẳng hỏng độc lập, thay thế độc lập.
2. **Backend là nguồn sự thật** cho trạng thái phiên; client chỉ render. Lệnh đi lên bằng REST; sự kiện đi xuống bằng SSE (không thêm WebSocket — tránh mở `/ws` chưa có handshake auth và sửa nginx).
3. **Vai cố định**: AI = `PRUEFER` duy nhất; partner luôn là người. Orchestrator tái dùng từ engine luyện thi nhưng session của module này **không có** cấu hình partner = AI.
4. **Audio tách người** là bất biến của mặt phẳng ghi âm; không bao giờ chấm từ một mic chung có 2 giọng (trừ chế độ `LOCAL` 2-người-1-máy có gắn nhãn lượt thủ công).
5. **Mất kết nối không giết buổi thi**: grace → tiếp tục; quá grace → **tạm dừng (SUSPENDED) để cả hai nối lại trong hạn bài**; quá hạn → hủy có chấm phần đã xong. Không có AI thay vai.
6. **Same-class invariant** kiểm ở tầng service, không chỉ ở UI.

---

## 3. Lựa chọn mặt phẳng media

| Phương án | Cách làm | Ưu | Nhược | Phù hợp |
|---|---|---|---|---|
| **A. WebRTC P2P tự dựng** | Signaling tự viết (cần WS hoặc SSE+REST), STUN công cộng, TURN tự host (coturn) hoặc TURN thuê | Không phí/phút; 2 người thì P2P là tối ưu độ trễ | Phải tự viết signaling, reconnect, thống kê; mobile cần `react-native-webrtc`; TURN tự host = ops + băng thông | Khi muốn tối ưu chi phí dài hạn |
| **B. SFU quản lý (LiveKit Cloud / Daily / Cloudflare Realtime)** | SDK lo signaling, TURN, reconnect, active-speaker, data channel; backend chỉ **ký token phòng** | Ship nhanh nhất; ổn định; phòng 3–4 người (A1 thi nhóm) miễn phí về công; LiveKit có Expo plugin; server-side egress ghi âm từng track | Phí theo phút tham gia; thêm vendor + key; chọn vùng gần VN | **Khuyến nghị cho P0** |
| **C. LiveKit OSS tự host** | Chạy LiveKit server trên EC2 (UDP + TURN tích hợp) | Phần mềm miễn phí; cùng SDK với B → **đường lùi từ B không đổi code client** | Ops UDP/port/TLS, scale, giám sát — đội 1 người | Khi phí B thành đáng kể |

**Khuyến nghị:** **B với LiveKit Cloud** (lý do: cùng SDK với C nên không khóa vendor; token phòng là JWT HS256 ký được bằng jjwt sẵn có trong backend — không bắt buộc server SDK; Expo plugin chính thức; egress từng track → S3 giải quyết ghi âm mobile). **Cần owner xác nhận**: vùng gần Việt Nam, bảng giá hiện hành (ước lượng thô: 1.000 phiên/tháng × 15′ × 2 người ≈ 30.000 phút-tham-gia), hạn mức free tier.

---

## 4. Sơ đồ tổng

```text
            ┌────────────────────────── CONTROL PLANE ──────────────────────────┐
            │  REST (lệnh: mời/nhận, ready, advance, upload, leave)              │
 Học viên A │  SSE  (sự kiện phòng: state, pruefer.say, timer.sync, stimulus)    │ Học viên B
 (web/mobile)◄─────────────┐                                    ┌──────────────►(web/mobile)
     │                     │     Spring Boot (EC2, nginx)       │                     │
     │             ┌───────▼──────────────────────────────────▼───────┐             │
     │             │ PairAssignmentService · PairSessionOrchestrator   │             │
     │             │ PairRoomEventBroadcaster (Redis pub/sub → SSE)    │             │
     │             │ RoomTokenService (ký JWT LiveKit) · Quota/Guard   │             │
     │             └───────┬──────────────────────────────────┬───────┘             │
     │                     │ Postgres (nguồn sự thật)  Redis (presence, queue, cache)│
     │                                                                              │
     │   ┌──────────────────────────── MEDIA PLANE ────────────────────────────┐    │
     └──►│  LiveKit room = sessionId · audio 2 chiều · active-speaker · data   │◄───┘
         │  (backend KHÔNG relay audio; chỉ ký token + nhận webhook)           │
         └──────────────────────────────────────────────────────────────────────┘
     │                                                                              │
     │   ┌──────────────────────── RECORDING / GRADING PLANE ──────────────────┐    │
     └──►│ audio RIÊNG từng người → S3 (LiveKit track egress; web: chunk fallback)│◄───┘
         │ → STT verbose từng người → merge theo mốc giờ server → AiJob chấm   │
         │   ×2 (mỗi người 1 Ergebnisbogen, kiểu Goethe hoặc telc)            │
         └──────────────────────────────────────────────────────────────────────┘
```

AI Prüfer: backend sinh lời (LLM) + TTS (EdgeTts) → lưu clip → phát sự kiện `pruefer.say {text, audioUrl, playAt}`; **mỗi client tự phát** cùng lúc (lệch vài trăm ms chấp nhận được). Không cần đưa AI vào phòng LiveKit như một participant ở đợt đầu.

---

## 5. Vòng đời phiên luyện đôi (state machine)

AI **chỉ** ở vai PRUEFER trong mọi trạng thái; không tồn tại trạng thái "AI thay partner".

```text
ASSIGNED / INVITED ──cả hai nhận──► CREATED ──cả hai vào media──► DEVICE_CHECK ──cả hai ready──► PREP (nếu blueprint có)
   │ từ chối / quá hạn                                                                            │ hết giờ / cả hai "Xong"
   ▼                                                                                              ▼
CANCELLED                                 ┌──────────────────── PART_k ────────────────────┐
                                          │ PRUEFER_INSTRUCTION                              │
                                          │ → MONOLOGUE(A) rồi MONOLOGUE(B)   (độc thoại: lần lượt, người kia nghe)
                                          │   hoặc DIALOGUE(A↔B)                (hội thoại: cùng lúc, 2 mic mở)
                                          │ → PRUEFER_FOLLOWUP                  (giám khảo hỏi từng người: B1 T3, B2 T1…)
                                          └────────────────────┬─────────────────────────────┘
                 partner rớt ≥ grace (60–90s)                   │ hết Teil
 PAUSED_PARTNER_DROPPED ◄───────────────────────────────────────┤
   ├─ reconnect trong grace ──► tiếp tục PART_k (Prüfer nhắc lại chỉ dẫn)
   ├─ quá grace ──► SUSPENDED: giữ phần đã làm; cả hai nối lại trong hạn bài tập, tiếp từ đầu Teil dở
   └─ hủy / quá hạn ──► INCOMPLETE: chấm các Teil đã hoàn tất (partial); giáo viên thấy trạng thái
                                                             DONE ──► GRADING (2 AiJob) ──► RESULTS
                                                             (học viên: của mình · giáo viên: cả hai + ghi âm)
```

**Luật chuyển Teil:** mode mock = đến `deadline_at` (server) + grace 10s **hoặc** cả hai bấm "Xong"; mode drill = cả hai bấm. Đồng hồ luôn tính từ timestamp server (`part_started_at`, `deadline_at`); client chỉ hiển thị theo offset đo từ `timer.sync`.

**Phần độc thoại với 2 thí sinh** (A1 T1, A2 T2, B1 T2, B2 T1): chạy **lần lượt** A rồi B như thi nhóm thật — người kia nghe và, nếu đề yêu cầu, đặt câu hỏi/Rückmeldung ở bước kế (B1 T3, B2 T1). **Phần hội thoại** (A1 T2/T3, A2 T3, B1 T1, B2 T2, telc B1 T1–T3…): hai mic mở, ghi liên tục, không ép lượt; active-speaker chỉ để hiển thị.

**Stimulus riêng tư:** nhiều bài đôi phát đề **khác nhau** cho A và B (A2/telc A2 T3 lịch tuần A≠B; telc B1 T2 Vorlage A/B) → SSE chỉ báo `stimulus.ready`, mỗi client tự `GET …/sessions/{id}/me/stimulus` (auth theo participant) — không bao giờ gửi đề của B cho A.

---

## 6. Ghép cặp trong lớp

| Cơ chế | Mô tả | Pha |
|---|---|---|
| **Giáo viên giao bài về nhà theo cặp** (chính) | Chọn lớp → Teil/mock + hệ chấm (Goethe/telc) + hạn nộp → **xếp cặp tay** (kéo-thả trên roster) hoặc **tự động** (cùng cấp mục tiêu, điểm gần nhau, tránh lặp cặp cũ); học viên nhận push + mục "Bài tập của tôi"; phiên mở khi cả hai vào | P0 |
| **Giáo viên xem** | Bảng cặp × trạng thái (chưa bắt đầu / đang / xong / dở / quá hạn); kết quả cả hai cạnh nhau; transcript có đánh dấu lượt; nghe lại audio từng người; nhắc hạn 1 chạm; gia hạn / đổi cặp | P0 |
| **Học viên tự mời bạn cùng lớp** | Lobby lớp + presence → mời → chấp nhận → phiên (ngoài bài tập) | P1 |
| **Hàng đợi "sẵn sàng"** | Khóa `(classId, blueprint, teil)` trong Redis (TTL) → ghép FIFO | add-on |
| **Đặt lịch + nhắc** | Hai bên chọn khung giờ cho bài về nhà → nhắc trước 10′ (notification + job có sẵn) | P2 |

### 6.1 Luồng bài về nhà theo cặp

1. **Giáo viên tạo bài**: lớp → Teil/mock + hệ → hạn → xếp cặp. **Lớp lẻ người**: học viên lẻ vào **bộ ba** (khi có phòng 3 ghế ở P3) hoặc tạm thời làm **bài thứ hai** với một bạn đã có cặp (đánh dấu rõ trong bảng); **không bao giờ ghép với AI**.
2. **Học viên**: push "Luyện đôi với Minh — hạn thứ Sáu" → "Bài tập của tôi" → bấm "Sẵn sàng" (presence) hoặc đề xuất giờ → khi cả hai sẵn sàng: push "bạn ghép đang chờ" → vào phòng → DEVICE_CHECK + đồng ý ghi âm → làm bài với AI Prüfer.
3. **Sau bài**: chấm 2 người chạy nền; mỗi học viên nhận Ergebnisbogen **của mình**; giáo viên thấy cả hai + ghi âm; trạng thái cặp → DONE.
4. **Dở dang / quá hạn**: SUSPENDED cho nối lại trong hạn; quá hạn → INCOMPLETE/LATE hiện cho giáo viên; giáo viên gia hạn hoặc đổi cặp; phần đã làm vẫn được chấm partial.
5. **Nhắc**: tự động trước hạn 24h cho cặp chưa xong; giáo viên nhắc tay 1 chạm.

**Presence:** kết nối SSE lobby = online; heartbeat 30s → Redis `presence:class:{classId}` (ZSET user→ts, TTL 45s). Single instance hiện tại vẫn nên qua Redis để sống sót restart/blue-green.

**Bất biến same-class:** `PairAuthorizationService.assertSameClass(classId, userA, userB)` tra bảng thành viên lớp; gọi ở: tạo bài/cặp, mời, chấp nhận, tạo session, cấp room-token, mở SSE phiên, upload audio, xem kết quả (học viên chỉ thấy **của mình**; giáo viên của lớp thấy cả hai; org admin thấy thống kê).

---

## 7. Ghi âm tách người (Recording plane)

`RecordingSource` cắm được; **đường chuẩn cho mọi nền tảng là `EGRESS`** để web và mobile ghi cùng một cách, cùng một đồng hồ:

| Nguồn | Cách làm | Ưu | Nhược | Dùng |
|---|---|---|---|---|
| `EGRESS` (chuẩn) | LiveKit **Track Egress** ghi **từng audio track** (mỗi participant một file OGG) → S3 `pair/{sessionId}/{participantId}/{part}.ogg`; webhook `egress_ended` → ghi `pair_speaking_recordings`; mốc thời gian lấy từ egress (server) | Đồng nhất web/mobile; không tin client; không tranh mic với `expo-audio`; một đồng hồ cho merge | Phí egress/phút (xác nhận giá); phụ thuộc webhook | **Mọi nền tảng, P0** |
| `CLIENT_CHUNKS` (fallback web) | `MediaRecorder(timeslice=10s)` mic của mình → `POST …/audio-chunks {part, seq, clientOffsetMs}` → S3 | Không phí egress; độc lập provider | Chỉ web; mất ≤10s khi tab chết; phụ thuộc mạng client; đồng hồ client | Bật bằng flag khi cần tiết kiệm hoặc egress lỗi |

**Trừu tượng cho tầng chấm:** mọi nguồn quy về `ParticipantAudioTimeline = [{s3Key, startOffsetMs, durationMs, source}]` theo **giờ server**; cặp hỗn hợp (một bên EGRESS, một bên CLIENT_CHUNKS) vẫn merge được vì cả hai offset đều quy về `part.started.serverNow`.

**Crosstalk:** khuyến nghị tai nghe ở DEVICE_CHECK (đo echo nhanh); `echoCancellation` + `noiseSuppression` bật ở cả web và LiveKit RN; giọng partner lọt mic ở mức thấp chấp nhận được vì transcript tách theo nguồn track.

---

## 8. Chấm 2 người

1. `DONE` → tạo **2 AiJob** `PAIR_EXAM_GRADING` (mỗi người một job) dùng chung artifact **merged transcript** (build một lần, cache theo session).
2. Mỗi job chạy pipeline 2.4 nguyên xi cho participant đó: metric extractor trên **audio/transcript của chính họ** (Flüssigkeit, lexical profile, lỗi) + band từng tiêu chí theo hệ (Goethe A–E / telc A–D) + 2 pass giám khảo.
3. **Tiêu chí tương tác dùng được số liệu thật** (không có ở mock AI): latency phản hồi sau khi partner dứt lời, tỉ lệ thời lượng nói (mục tiêu 35–65%), số lần chen/đè, backchannel ("ja, genau", "stimmt") — nuôi Goethe Interaktion / telc Aufgabenbewältigung.
4. Grader nhận ngữ cảnh "partner là học viên cùng cấp; chấm đóng góp của thí sinh này; không trừ điểm vì partner yếu; ghi nhận hành vi giúp partner" (đúng tinh thần telc B1).
5. Mỗi người nhận **Ergebnisbogen riêng** + transcript hội thoại có đánh dấu lượt của mình; phần partner chỉ hiện text (không hiện điểm của bạn).
6. Chế độ `LOCAL` (P1): audio chung một mic được cắt theo khoảng bấm nút A/B → chất lượng Aussprache/Flüssigkeit ghi nhãn tin cậy thấp hơn một bậc.
7. **Giáo viên xem**: hai Ergebnisbogen cạnh nhau, transcript hội thoại có đánh dấu lượt, nghe audio từng người (presigned URL ngắn hạn, chỉ giáo viên của lớp), tổng hợp lớp theo tiêu chí; tùy chọn chỉnh band (`teacher_override_json`) → mẫu hiệu chuẩn cho engine (P2).

---

## 9. Mô hình dữ liệu & API (module riêng `pairspeaking`)

**Bảng riêng (tiền tố `pair_speaking_`, không dùng chung bảng với engine luyện thi):**
- `pair_speaking_assignments` (class_id, org_id, teacher_id, blueprint_ref, teil_no?, rubric_kind ∈ {GOETHE, TELC}, mode, instructions, due_at, created_at) — bài về nhà
- `pair_speaking_assignment_pairs` (assignment_id, user_a, user_b, user_c?, status ∈ {PENDING, SCHEDULED, IN_PROGRESS, SUSPENDED, DONE, INCOMPLETE, LATE}, session_id?, scheduled_at?, extended_due_at?)
- `pair_speaking_sessions` (class_id, org_id, assignment_pair_id?, blueprint_ref, teil_no?, mode ∈ {REMOTE, LOCAL}, rubric_kind, state, current_part, room_provider, room_name, recording_source, timestamps server)
- `pair_speaking_participants` (session_id, user_id, seat A/B/C, join_state, media_connected_at, last_seen_at, consent_recording_at)
- `pair_speaking_audio_chunks` (participant_id, part_no, seq, s3_key, duration_ms, client_offset_ms, uploaded_at) / `pair_speaking_recordings` (EGRESS)
- `pair_speaking_invites` (class_id, from_user, to_user, blueprint_ref, teil_no?, status, expires_at) — P1
- `pair_speaking_results` (session_id, participant_id, criteria_json, total, band_summary, partial, teacher_override_json?, reviewed_by?)
- Hàng đợi & presence: Redis (không DB).

**REST (`/api/v2/pair-speaking/**` — gate: feature flag org + ghế org + thành viên lớp):**
```text
# Học viên
GET  /api/v2/pair-speaking/me/assignments                              bài về nhà của tôi + bạn ghép + trạng thái
POST /api/v2/pair-speaking/assignment-pairs/{id}/ready                 "Sẵn sàng" (presence) → khi cả hai ready: tạo session
GET  /api/v2/pair-speaking/classes/{classId}/lobby                     (P1) bạn học + presence + lời mời
POST /api/v2/pair-speaking/invites · POST …/invites/{id}/accept|decline (P1)
GET  /api/v2/pair-speaking/sessions/{id}                               snapshot đầy đủ (state, part, serverNow, deadlineAt, participants, seq cuối)
GET  /api/v2/pair-speaking/sessions/{id}/room-token                    JWT LiveKit: room=sessionId, identity=userId, audio only, TTL 10′
POST /api/v2/pair-speaking/sessions/{id}/device-ready                  qua DEVICE_CHECK + consent + **capabilities** {platform, appVersion, sse, recordingSources[], codecs[]}
                                                                       → server chọn recordingSource cho participant; thiếu minVersion → 426 UPGRADE_REQUIRED
GET  /api/v2/pair-speaking/sessions/{id}/me/stimulus                   đề riêng của tôi cho Teil hiện tại
POST /api/v2/pair-speaking/sessions/{id}/audio-chunks                  multipart {part, seq, clientOffsetMs}
POST /api/v2/pair-speaking/sessions/{id}/advance · /leave · /resume
GET  /api/v2/pair-speaking/sessions/{id}/events?ticket=…&since={seq}   SSE (ticket one-time) — replay backlog từ `since`, rồi stream; mọi event có `seq` + `v`
GET  /api/v2/pair-speaking/sessions/{id}/results/me
# Giáo viên
POST /api/v2/teacher/classes/{classId}/pair-speaking/assignments       {blueprintRef, teil?, rubricKind, dueAt, pairs[] | autoPair}
GET  /api/v2/teacher/classes/{classId}/pair-speaking/assignments       danh sách
GET  /api/v2/teacher/pair-speaking/assignments/{id}                    bảng cặp × trạng thái + tổng hợp
PATCH /api/v2/teacher/pair-speaking/assignments/{id}/pairs             đổi cặp / gia hạn
POST /api/v2/teacher/pair-speaking/assignments/{id}/remind             nhắc 1 chạm
GET  /api/v2/teacher/pair-speaking/sessions/{id}                       kết quả cả hai + transcript
GET  /api/v2/teacher/pair-speaking/sessions/{id}/participants/{pid}/audio-url   presigned ngắn hạn
PATCH /api/v2/teacher/pair-speaking/results/{id}/override              (P2) chỉnh band
# Webhook
POST /api/webhooks/livekit                                             participant joined/left, egress done (ký HMAC)
```

**Sự kiện SSE:** `room.participant{userId,state}` · `room.state{state,part,serverNow,deadlineAt}` · `timer.sync` · `pruefer.say{text,audioUrl,playAt}` · `stimulus.ready{part}` · `part.started/ended` · `upload.ack{part,seq}` · `partner.dropped{graceUntil}` · `session.suspended` · `session.resumed` · `grading.progress` · `results.ready` · `assignment.updated` (lobby/bài tập).

**Fan-out:** `PairRoomEventBroadcaster` theo mẫu `NotificationSseBroadcaster` (Redis channel `pair-room:{sessionId}`), handler SSE **không transaction** (nợ OSIV).

---

## 10. Bảo mật · riêng tư · kiểm duyệt

- **Quyền truy cập tính năng:** feature flag theo org (gói B2B) + ghế `org_members` + thành viên lớp; kiểm ở filter/service trước mọi endpoint `/api/v2/pair-speaking/**`; tài khoản cá nhân → 403 (UI không hiện lối vào).
- Token phòng do backend ký, gắn `sessionId` + `userId`, TTL ngắn, chỉ cấp khi user là participant của phiên **và** cả hai cùng lớp; không có grant publish video/data tùy ý.
- Webhook LiveKit xác thực chữ ký; chỉ cập nhật trạng thái, không tin payload để cấp quyền.
- **Đồng ý ghi âm** bắt buộc trước DEVICE_CHECK (cả hai); không đồng ý → chế độ "luyện không chấm" (không ghi, không STT).
- Lưu audio 30 ngày (S3 lifecycle), phục vụ khiếu nại/chấm lại/giáo viên nghe; nút **Báo cáo** trong phòng → gắn cờ phiên, giáo viên/admin nghe qua module `moderation`.
- Giới hạn: số lời mời/phút, số phiên đôi/ngày theo gói; quota token chỉ tính STT + chấm (hội thoại 0 token).
- Vị thành niên: same-class (roster giáo viên quản) chính là hàng rào đợt đầu; không mở ghép ngoài lớp khi chưa có moderation đầy đủ.

---

## 11. Đa nền tảng web ↔ mobile — thiết kế tương tác chéo

### 11.1 Mục tiêu

| Cặp | Hỗ trợ | Ghi chú |
|---|---|---|
| web ↔ web | ✅ P0 | Chrome/Edge/Firefox/Safari (desktop + mobile web) |
| web ↔ mobile app | ✅ P0 | bài về nhà: một bạn ở laptop, một bạn ở điện thoại là tình huống **phổ biến nhất** |
| mobile ↔ mobile | ✅ P0 | iOS ↔ Android |
| giáo viên | web P0 · mobile xem-kết-quả P2 | mobile hiện chưa có route giáo viên |

### 11.2 Nguyên tắc

1. **Một API, một state machine, một event schema** cho mọi client. Client chỉ khác ở **4 adapter**: media (LiveKit web SDK / LiveKit RN), ghi âm (EGRESS chung; CLIENT_CHUNKS chỉ web), transport sự kiện (SSE native / SSE polyfill / polling), thông báo (notification SSE web / push Expo).
2. **Server là đồng hồ duy nhất**: mọi deadline/offset từ `serverNow`; client đo offset qua `timer.sync` bằng cùng một thuật toán.
3. **Trạng thái khôi phục được từ snapshot**: `GET /sessions/{id}` trả snapshot đầy đủ + `seq`; event stream replay từ `since` → client nào (web hay mobile) mất kết nối đều resync giống nhau, không phụ thuộc nền tảng.
4. **Capabilities handshake** ở `device-ready`: server chọn recordingSource/chính sách theo từng participant; cặp hỗn hợp là bình thường.
5. **Contract sinh từ OpenAPI** (springdoc đã có): typed client cho web và mobile từ cùng spec; event schema versioned (`v`), thêm field = tương thích ngược, đổi nghĩa = tăng `v`.
6. **Logic thuần dùng chung**: reducer trạng thái phòng, tính offset đồng hồ, lịch `playAt`, quy tắc DEVICE_CHECK → một gói TypeScript thuần `pair-speaking-core` (copy/sync vào `frontend/src/lib` và `mobile/lib` vì repo chưa có workspace; cân nhắc bật npm workspaces ở root khi gói ổn định).

### 11.3 Control plane trên mobile

- **SSE**: React Native không có `EventSource` → dùng `react-native-sse` (XHR streaming, chạy trong Expo dev build) với cùng ticket one-time; header/ticket/replay y hệt web.
- **Fallback polling**: khi SSE không mở được hoặc app vào nền: `GET /sessions/{id}` mỗi 2s (snapshot + `seq`) — cùng reducer nên UI không phân biệt nguồn.
- **Push** (expo-notifications, token per-device): sự kiện **ngoài phiên** — `PAIR_ASSIGNED`, `PAIR_PARTNER_READY`, `PAIR_SESSION_SUSPENDED`, `PAIR_RESULTS_READY`, `PAIR_DEADLINE_REMINDER`; web nhận cùng loại qua notification SSE/inbox hiện có. Mỗi thông báo mang `deepLink` **một định dạng** cho cả hai: `/pair-speaking/assignments/{id}` → web `/v2/student/speaking/pair/assignments/{id}`, mobile `deutschflow://pair-speaking/assignments/{id}` (xác nhận `scheme` trong `mobile/app.json`).
- **Nền/khoá màn hình**: `expo-keep-awake` trong phòng; iOS `UIBackgroundModes: audio` để WebRTC sống khi màn hình tắt; cuộc gọi đến / audio interruption → client gửi `leave(reason=INTERRUPTED)` → server xử như partner rớt (grace) → khi quay lại, `resume`.

### 11.4 Media plane

- Web: LiveKit JS SDK. Mobile: `@livekit/react-native` + `@livekit/react-native-expo-plugin` (**native build qua EAS**, không OTA được lần đầu; đã có `expo-dev-client`).
- Codec Opus chung; iOS audio session do LiveKit RN cấu hình (`playAndRecord`, loa ngoài/tai nghe), Android audio focus; `echoCancellation`/`noiseSuppression` bật cả hai.
- Token phòng giống nhau mọi nền tảng (backend ký); identity = userId; TTL 10′ + refresh khi còn trong phòng.

### 11.5 Lời giám khảo (Prüfer TTS) trên cả hai nền tảng

- **P0 — phát cục bộ**: backend sinh clip (EdgeTts) → `pruefer.say{text, audioUrl, playAt}`; web cần **unlock audio bằng cử chỉ** ở DEVICE_CHECK (Safari autoplay); mobile phát bằng `expo-audio` với audio mode `playsInSilentMode` + mix với WebRTC. Luôn hiển thị **text** của Prüfer (ngoài việc nghe) để không lệ thuộc audio. **Spike đầu P0**: xác nhận `expo-audio` và LiveKit RN chung audio session ổn trên iOS/Android.
- **Dự phòng**: nếu phát cục bộ trục trặc trên mobile → Prüfer thành **participant bot** phát TTS vào phòng (LiveKit Agents/server publish) — khi đó cả hai nền tảng nghe qua cùng pipeline WebRTC và egress ghi luôn lời giám khảo.

### 11.6 Màn hình & UX ngang nhau

Cùng danh sách màn hình trên web và mobile, hiện thực riêng theo ngôn ngữ thiết kế mỗi nền (web `ui-v2`, mobile `design/v2/native`): *Bài tập của tôi* → *Chờ bạn ghép* (presence, nút Sẵn sàng) → *DEVICE_CHECK + consent* → *PREP* (đề + notepad + đồng hồ) → *Phòng thi* (stepper Teil, avatar Prüfer đang nói, stimulus riêng, đồng hồ, chỉ báo ai đang nói, nút Xong) → *Kết quả*. Mobile web (Safari/Chrome trên điện thoại) dùng bản web responsive — không chặn, nhưng khuyến nghị app vì nền/khóa màn hình.

### 11.7 Lệch phiên bản & phát hành

- API tương thích ngược; server kiểm `minAppVersion` tại `device-ready` → `426 UPGRADE_REQUIRED` kèm link cập nhật; web luôn mới nhất.
- Thứ tự phát hành P0: backend → web → **native build mobile** (LiveKit RN) qua EAS/store → các đợt sau JS-only đi OTA (`expo-updates`).
- Flag theo org bật dần lớp; cặp hỗn hợp được kiểm thử trước khi mở rộng.

### 11.8 Ma trận kiểm thử tương tác chéo

| | web Chrome | web Safari | iOS app | Android app |
|---|---|---|---|---|
| web Chrome | e2e tự động (Playwright 2 context) | QA tay | QA tay | QA tay |
| web Safari | | QA tay | QA tay | QA tay |
| iOS app | | | QA tay | QA tay |
| Android app | | | | QA tay |

Thêm **"participant giả" headless** (LiveKit client chạy trong CI phát file audio) để e2e web và smoke mobile (Maestro) chạy không cần người thứ hai; kịch bản bắt buộc: rớt mạng một bên, app vào nền, cuộc gọi đến, đổi tai nghe, SSE → polling → SSE.

---

## 12. Chi phí mỗi phiên & vận hành

| Khoản | Mock AI-partner (tham chiếu) | Luyện đôi từ xa |
|---|---|---|
| Token LLM hội thoại | lớn nhất | **0** |
| Token chấm | 1 người | 2 người (≈ 2 × 15–25k) |
| STT | 1 người | 2 người (~6′ nói mỗi người/phiên B1) |
| TTS Prüfer | có | có (EdgeTts, ít clip hơn vì không có lời partner) |
| Media | 0 | ≈ 2 × 20 phút-tham-gia/phiên (LiveKit) |
| Tổng | 50–80k token | ≈ 30–50k token + phí media (xác nhận giá) |

**Tính phí:** toàn bộ STT + chấm trừ vào **kênh token trung tâm** (org pool) theo mô hình 2 kênh hiện có; hội thoại 0 token; phí media (LiveKit) là chi phí nền tảng → cân vào giá gói org.

**Vận hành:** số kết nối SSE tăng (lobby + phòng) — nginx đã phục vụ SSE prod, giữ `proxy_buffering off` cho route events; Redis key TTL cho presence/queue; metric cần có từ ngày đầu: tỉ lệ mời→nhận, thời gian kết nối media, tỉ lệ đi qua TURN, tỉ lệ rớt, số phiên SUSPENDED/INCOMPLETE, tỉ lệ cặp nộp đúng hạn, lỗi upload, độ trễ chấm.

---

## 13. Chế độ hỏng & cách xử lý

| Tình huống | Xử lý |
|---|---|
| Partner rớt mạng | Grace 60–90s (SSE `partner.dropped`); reconnect giữ chỗ, Prüfer nhắc lại chỉ dẫn; quá grace → SUSPENDED, cả hai nối lại trong hạn bài (tiếp từ đầu Teil dở); quá hạn → INCOMPLETE chấm partial. **Không có AI thay vai** |
| Từ chối quyền mic | Chặn ở DEVICE_CHECK, hướng dẫn; không vào PREP |
| NAT/firewall chặn P2P | Provider tự fallback TURN; ghi metric |
| Upload chunk lỗi | Retry lũy tiến; thiếu chunk → chấm với cảnh báo "thiếu N giây"; nếu dùng EGRESS thì không gặp |
| STT hỏng cho 1 người | Chấm người còn lại; người lỗi nhận "chấm lại" tự động khi STT hồi |
| Hai phiếu "Xong" lệch nhau | Server chờ cả hai hoặc deadline; hiển thị "đang chờ bạn" |
| Lệch đồng hồ client | Mọi deadline từ server; client chỉ render theo offset |
| Tab nền/khoá màn hình mobile | Background audio mode; mất kết nối → như partner rớt |
| Một người cố tình phá | Nút Báo cáo → gắn cờ + giáo viên nghe lại; giới hạn lời mời; chỉ cùng lớp |

---

## 14. Lộ trình riêng của tính năng (độc lập với các Đợt của mảng luyện thi)

| Pha | Nội dung | Hạ tầng mới | Phụ thuộc |
|---|---|---|---|
| **P0 — Bài về nhà theo cặp (web + mobile, từ xa)** | Giáo viên (web) giao bài + xếp cặp (tay/tự động) + hạn; học viên **web và app mobile** đều: "Bài tập của tôi" + sẵn sàng/presence; phòng LiveKit (web SDK / LiveKit RN); `EGRESS` ghi từng track; AI Prüfer dẫn (độc thoại lần lượt, hội thoại chung, câu hỏi giám khảo); DEVICE_CHECK + consent + capabilities; SSE (web) / SSE polyfill + polling (mobile); push Expo; SUSPENDED/resume; chấm 2 người; **giáo viên xem** kết quả cả hai + transcript + nghe lại; nhắc hạn. **Cặp hỗn hợp web↔mobile là kịch bản nghiệm thu bắt buộc** | LiveKit Cloud + webhook; native build mobile (EAS) | Engine luyện thi: 3 interface từ Đợt 0; kết quả thật cần gate hiệu chuẩn cấp tương ứng; owner chốt vendor/giá/vùng + consent; spike audio session iOS |
| **P1 — Tự ghép & lớp học tại chỗ** | Học viên tự mời bạn cùng lớp (lobby); chế độ `LOCAL` 2 người 1 máy cho giờ học (2 nút push-to-talk, bạn xác nhận qua push); hàng đợi add-on | — | P0 |
| **P2 — Giáo viên nâng cao & org** | Chỉnh band (override → golden set cho engine), đặt lịch + nhắc, thống kê org/lớp theo tiêu chí, giáo viên nghe trực tiếp phiên đang diễn ra (token subscribe-only) | — | P0 |
| **P3 — Nhóm & giáo viên trên mobile** | Phòng 3 ghế (lớp lẻ người, A1 thi nhóm); giáo viên xem kết quả/nghe lại trên app (thêm route giáo viên mobile) | — | P0 |
| Sau | Partnerarbeit do giáo viên soạn (ngoài đề thi); ghép ngoài lớp có moderation đầy đủ | — | P2 |

**DoD P0:** e2e 2 trình duyệt (Playwright 2 context) chạy trọn một bài về nhà từ lúc giáo viên giao đến khi giáo viên thấy kết quả cả hai; **QA tay cặp hỗn hợp web↔iOS và web↔Android** theo ma trận §11.8 (rớt mạng, app nền, cuộc gọi đến); rớt một bên → SUSPENDED rồi resume đúng Teil trên cả hai nền tảng; 2 Ergebnisbogen đúng hệ; IT `PairAuthorizationService` (khác lớp / không ghế org / thiếu feature flag → 403 ở mọi cửa; học viên không xem được kết quả của bạn); `426` khi app cũ; metric kết nối xuất Prometheus.

**Owner cần chốt trước P0:** (1) vendor media (LiveKit Cloud khuyến nghị) + vùng + bảng giá; (2) nội dung đồng ý ghi âm + privacy (gộp nợ X.4) — **giáo viên nghe lại** phải được ghi rõ trong consent; (3) gói org nào có tính năng, hạn mức phiên đôi/tháng; (4) lớp lẻ người xử lý thế nào trước khi có phòng 3 ghế.

---

## 15. Điểm mở / chưa chắc

- Giá và vùng LiveKit Cloud / Daily / Cloudflare Realtime (chưa tra trong phiên này — cần xác nhận trước khi ước tính chi phí thật).
- Độ tin cậy `CLIENT_CHUNKS` trên mạng di động Việt Nam → có thể chuyển hẳn EGRESS từ ngày đầu nếu phí chấp nhận được.
- Tên bảng thành viên lớp chính xác (module organization/user) — xác định khi code `PairAuthorizationService`.
- Việc đưa AI Prüfer vào phòng như một participant (phát TTS qua track thay vì mỗi client tự phát) — là **phương án dự phòng** nếu spike §11.5 cho thấy `expo-audio` + LiveKit RN xung đột audio session.
- `react-native-sse` trên Expo SDK 54 (độ ổn định, reconnect) — cần spike; polling là lưới an toàn.
- Giá Track Egress theo phút (đường chuẩn mọi nền tảng) — nếu quá cao, web chuyển `CLIENT_CHUNKS`, mobile giữ egress (pipeline đã trừu tượng hoá timeline).
- `scheme` deep link hiện tại trong `mobile/app.json` — xác nhận trước khi chốt định dạng link thông báo.
