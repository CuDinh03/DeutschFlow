'use client'

import * as React from 'react'

/** `true` từ 1024px (lg): hai khung cạnh nhau. Lần vẽ đầu trên server coi như hẹp. */
export function useWide(): boolean {
  const [wide, setWide] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return wide
}
