'use client'

import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/** Biên độ đồng tử, tính theo đơn vị viewBox 280×500 của nhân vật. */
const MAX_X = 4
const MAX_Y = 2.5
/** Con trỏ cách nhân vật từ khoảng này trở ra thì mắt đã nhìn hết cỡ. */
const REACH_PX = 220

function clearLook(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-ga-look]').forEach((el) => {
    el.style.removeProperty('--ga-look-x')
    el.style.removeProperty('--ga-look-y')
  })
}

/**
 * Các nhân vật trong vùng `ref` nhìn theo con trỏ chuột. Mỗi nhân vật đánh dấu `data-ga-look`; hook
 * chỉ đặt hai biến CSS, còn `.ga-pupil` trong galerie.css lo phần dịch đồng tử, nên React không phải
 * render lại SVG theo từng lần chuột di chuyển. Cảm ứng và "giảm chuyển động" thì đứng yên.
 */
export function useLookAtPointer<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const calm = usePrefersReducedMotion()

  useEffect(() => {
    const root = ref.current
    if (!root || calm) return
    let frame = 0
    let x = 0
    let y = 0

    const apply = () => {
      frame = 0
      root.querySelectorAll<HTMLElement>('[data-ga-look]').forEach((el) => {
        const box = el.getBoundingClientRect()
        const dx = x - (box.left + box.width / 2)
        const dy = y - (box.top + box.height / 2)
        const distance = Math.hypot(dx, dy) || 1
        const pull = Math.min(1, distance / REACH_PX)
        el.style.setProperty('--ga-look-x', `${((dx / distance) * MAX_X * pull).toFixed(1)}px`)
        el.style.setProperty('--ga-look-y', `${((dy / distance) * MAX_Y * pull).toFixed(1)}px`)
      })
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      cancelAnimationFrame(frame)
      frame = 0
      clearLook(root)
    }

    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      clearLook(root)
    }
  }, [calm])

  return ref
}
