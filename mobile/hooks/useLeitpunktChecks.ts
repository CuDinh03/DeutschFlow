// Ô "đã viết ý này" của bài Viết (Đợt 4c, 19/11/2026): chỉ lưu trên máy (SecureStore), không gọi API.
// Đọc một lần khi mở Teil; ghi lại mỗi lần bật/tắt. Lỗi đọc/ghi thì coi như chưa đánh dấu — không chặn
// học viên viết bài.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { leitpunktStoreKey, parseChecked, toggleChecked } from '@/lib/leitpunktChecks'

export function useLeitpunktChecks(examId: number, teilKey: string, points: readonly string[] | undefined) {
  const [checked, setChecked] = useState<string[]>([])
  const key = leitpunktStoreKey(examId, teilKey)
  const pointsKey = (points ?? []).join('\u0000')
  const latest = useRef<string[]>([])

  useEffect(() => {
    let alive = true
    if (!points?.length) return
    SecureStore.getItemAsync(key)
      .then((raw) => {
        if (!alive) return
        const list = parseChecked(raw, points)
        latest.current = list
        setChecked(list)
      })
      .catch(() => {
        /* chưa đọc được: coi như chưa đánh dấu */
      })
    return () => {
      alive = false
    }
    // `pointsKey` thay cho mảng `points` (mảng mới mỗi lần dựng nhưng cùng nội dung).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pointsKey])

  const persist = useCallback(
    (list: string[]) => {
      latest.current = list
      setChecked(list)
      const write = list.length ? SecureStore.setItemAsync(key, JSON.stringify(list)) : SecureStore.deleteItemAsync(key)
      write.catch(() => {
        /* ghi lỗi: lần mở sau thiếu dấu, không ảnh hưởng bài viết */
      })
    },
    [key],
  )

  const toggle = useCallback((point: string) => persist(toggleChecked(latest.current, point)), [persist])
  const clear = useCallback(() => persist([]), [persist])

  return { checked, toggle, clear }
}
