'use client'

import * as React from 'react'

/** Bề rộng tối thiểu để khung làm bài chia hai cột (đợt (a) 07/11/2026). */
export const SPLIT_MIN_WIDTH = 760

/**
 * `true` khi màn rộng từ `minWidth` (mặc định 1024px = lg). Khung làm bài dùng `SPLIT_MIN_WIDTH`
 * (760px) để hai cột cạnh nhau từ máy tính bảng dọc. Lần vẽ đầu trên server coi như hẹp.
 */
export function useWide(minWidth = 1024): boolean {
  const [wide, setWide] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [minWidth])
  return wide
}
