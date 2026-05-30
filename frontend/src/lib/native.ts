import { useState, useEffect } from 'react'
import { isNative as _isNative } from '@/lib/authSession'

export { isNative } from '@/lib/authSession'

/**
 * SSR-safe hook — returns false on the server and during hydration,
 * then updates to the real value on the client. Use this in components
 * that branch between native and web UI.
 */
export function useIsNative(): boolean {
  const [native, setNative] = useState(false)
  useEffect(() => {
    setNative(_isNative())
  }, [])
  return native
}
