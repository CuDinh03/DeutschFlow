# Interview Flow Optimization Review

## Mục tiêu
Tối ưu flow `Interview` cho giai đoạn fluency của lộ trình 12 tuần, đảm bảo người học có thể chuyển từ production có kiểm soát sang hội thoại dài hơn mà vẫn giữ trải nghiệm mượt.

## Tóm tắt thay đổi
- Ưu tiên AI Speaking sớm từ ngày 1 thay vì đợi đến giai đoạn muộn.
- Đặt speaking as the bridge giữa input, production và interview-style practice.
- Giữ flow hội thoại ổn định để hỗ trợ chuẩn bị B1 ở Phase 3.
- Tập trung vào latency, turn-taking và trải nghiệm nói liên tục khi người học đã tích lũy đủ input và retrieval practice.

## Thứ tự ưu tiên endpoint
1. `/sessions/{id}/chat/stream`
2. `/sessions/{id}/chat`
3. `/sessions`
4. `/transcribe`

## Ý nghĩa thực tế
- Người học không bị đứt mạch khi chuyển sang hội thoại dài.
- Speaking sớm giúp tăng độ quen với output ngay từ nền tảng.
- Stream ổn định hơn và phù hợp với mục tiêu fluency ở Phase 3.

## Ghi chú
- Whisper vẫn có thể giữ cấu hình nhẹ nếu chưa là bottleneck chính.
- Nếu cần mở rộng sau này, ưu tiên làm mượt interview flow theo hướng hỗ trợ B1 confirmation thay vì kéo dài theo mô hình tuần tự cũ.
