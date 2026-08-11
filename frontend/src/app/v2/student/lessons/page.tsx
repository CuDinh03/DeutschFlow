import { redirect } from 'next/navigation'

// "Bài học" (thư viện video mediaApi) đã gỡ khỏi trải nghiệm học viên: GET /v2/media chỉ cấp cho
// TEACHER/ADMIN và bảng media không tách theo tổ chức, nên trang này luôn 403 với mọi học viên
// (QA F-11). Giữ route để bookmark/deep-link cũ không rơi 404 — chuyển hướng về Lộ trình. Khi có
// thư viện nội dung học riêng cho học viên thì khôi phục trang này.
export default function V2StudentLessonsPage() {
  redirect('/v2/student/roadmap')
}
