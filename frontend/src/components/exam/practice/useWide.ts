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

/**
 * `true` khi thiết bị chính là cảm ứng (`pointer: coarse` — điện thoại, máy tính bảng). Bút đánh dấu
 * (đợt 2b) neo thanh công cụ ở đáy màn thay vì nổi cạnh vùng chọn, để không đè menu chọn chữ của hệ thống.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(false)
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return // môi trường không có media query (test)
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return coarse
}
