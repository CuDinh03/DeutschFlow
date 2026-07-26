'use client'

import { SpeakingChatExperience } from '@/components/features/ai-speaking/SpeakingChatExperience'

// Engine hội thoại AI (SSE stream + mic + TTS) — bản v2. KHÔNG viết lại: mount đúng
// <SpeakingChatExperience> mà trang v1 `/speaking/chat` cũng dùng; khác nhau duy nhất là
// route thoát + vỏ (layout="shell" → lấp đầy <main> của GaShell thay vì h-screen).
// Phiên được nạp vào useChatStore trước khi vào đây (từ /v2/student/speaking/setup hoặc từ
// bài tập SPEAKING_SCENARIO của lớp); vào thẳng route này khi store rỗng → tự đá về setup.
//
// R-W10: comment cũ ghi "lịch sử chưa có bản v2" và để `history: null`, nên nút "Xem lịch sử"
// trong màn tổng kết bị ẩn OAN — /v2/student/speaking/history đã tồn tại và i18n đủ từ lâu.
export default function V2StudentSpeakingLivePage() {
  return (
    <SpeakingChatExperience
      layout="shell"
      routes={{
        setup: '/v2/student/speaking/setup',
        review: '/v2/student/review',
        history: '/v2/student/speaking/history',
        home: '/v2/student/dashboard',
        pricing: '/v2/payment',
      }}
    />
  )
}
