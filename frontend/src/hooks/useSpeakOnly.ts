'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'

/**
 * Lớp có chương trình luyện chưa kết thúc ⇒ học viên chỉ luyện bằng giọng nói (đặc tả luyendeu ORG-65,
 * BR-luyendeu-15): không có ô gõ, chữ từ mic chỉ đọc. Lỗi mạng ⇒ coi như false (không khoá học viên
 * ngoài lớp pilot); backend vẫn chặn lượt chữ của thi Nói.
 */
export function useSpeakOnly(): boolean {
  const [speakOnly, setSpeakOnly] = useState(false)
  useEffect(() => {
    let alive = true
    api
      .get<{ speakOnly: boolean }>('/practice-program/me')
      .then((r) => {
        if (alive) setSpeakOnly(!!r.data?.speakOnly)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return speakOnly
}
