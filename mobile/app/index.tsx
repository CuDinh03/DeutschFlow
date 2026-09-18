import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { entryHrefFor } from '@/lib/entryRoute'

// Entry route for `/`: a declarative auth gate.
//
// Auth routing used to be an imperative `router.replace()` in the root layout's
// effect, keyed off `useRootNavigationState()`. That subscribed the root layout to
// the navigation state it was rendering, so each redirect re-rendered the layout →
// re-rendered the navigator → re-synced its state — an infinite loop that, under
// React 19 + the New Architecture, crashed the app at launch ("Maximum update depth
// exceeded" in @react-navigation/core's useSyncState).
//
// `<Redirect>` is the framework-idiomatic, loop-safe way to do this: render `null`
// (under the splash) until auth resolves, then redirect exactly once.
export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  if (isLoading) return null
  // M0 (Đợt 3, 17/09): chưa đăng nhập → Chào mừng (phễu value-first), không còn vào thẳng Đăng nhập.
  return <Redirect href={entryHrefFor({ isLoggedIn })} />
}
