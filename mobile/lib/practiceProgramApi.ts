// Cờ "chỉ nói" của học viên — GET /api/practice-program/me (đặc tả luyendeu ORG-65, BR-luyendeu-15).
// Học viên ACTIVE ở lớp có chương trình luyện chưa kết thúc: màn luyện nói không có ô gõ, chữ từ mic
// chỉ đọc, chạm gợi ý không tự gửi. Lỗi mạng ⇒ false (không khoá học viên ngoài lớp pilot).
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export async function fetchSpeakOnly(): Promise<boolean> {
  const res = await api.get<{ speakOnly: boolean }>('/practice-program/me')
  return !!res.data?.speakOnly
}

export function useSpeakOnly(): boolean {
  const { data } = useQuery({
    queryKey: ['practice-program-me'],
    queryFn: () => fetchSpeakOnly().catch(() => false),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? false
}
