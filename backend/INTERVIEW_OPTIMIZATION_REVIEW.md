# Interview Flow Optimization Review

## Mục tiêu
Tối ưu flow `Interview` cho 10–20 concurrent users mà vẫn giữ trải nghiệm mượt: AI hỏi, người dùng trả lời dài vẫn không bị cắt ngang, và backend không nghẽn khi stream.

## Tóm tắt thay đổi
- Chuyển `GroqChatClient` streaming sang `WebClient` để giảm blocking ở luồng SSE.
- Thêm `SessionTurnGuard` để đảm bảo mỗi `sessionId` chỉ xử lý 1 turn AI tại một thời điểm.
- Giữ `createSession` gọn hơn và giảm context nặng cho `INTERVIEW` khi tạo greeting.
- Tinh gọn `SystemPromptBuilder` cho interview, tập trung vào role, phase, directive và persona thay vì prompt/tutor context dài.
- Bổ sung metrics latency/status cho `createSession`, `chat`, và `chatStream` để đo bottleneck thực tế.

## Thứ tự ưu tiên endpoint
1. `/sessions/{id}/chat/stream`
2. `/sessions/{id}/chat`
3. `/sessions`
4. `/transcribe`

## Ý nghĩa thực tế
- Người dùng có thể nói/ghi âm lâu mà không bị rate limit cắt ngang.
- Chỉ chặn khi có request AI chồng nhau thật sự.
- Stream ổn định hơn và giảm nguy cơ nghẽn thread.
- Có số liệu để quyết định bước refactor tiếp theo thay vì tối ưu theo cảm tính.

## Ghi chú
- Whisper (`GroqWhisperClient`) vẫn giữ `HttpClient` hiện tại vì là request/response ngắn và chưa phải bottleneck chính.
- Nếu metrics sau deploy cho thấy vẫn nghẽn, bước tiếp theo nên là tách greeting async rõ hơn hoặc tinh chỉnh prompt/context thêm nữa.
