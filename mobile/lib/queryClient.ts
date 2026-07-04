import { QueryClient } from '@tanstack/react-query'

/**
 * Shared app-wide react-query client. Exported as a module singleton (rather than
 * created inline in the root layout) so non-React code — e.g. the push-notification
 * listeners in usePushNotifications, which mount ABOVE QueryClientProvider and so
 * can't call useQueryClient() — can invalidate queries on the same cache.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

/** Query keys that should refresh when a notification arrives or the app refocuses. */
export const NOTIFICATION_QUERY_KEYS = [['unread-count'], ['notifications'], ['dashboard']] as const

/** Invalidate the notification-related queries so the badge + inbox refetch. */
export function invalidateNotificationQueries(): void {
  for (const key of NOTIFICATION_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: key as unknown as string[] })
  }
}

/**
 * Messaging surfaces: DM thread, class channel, conversation list, and the home unread badge.
 * `['message-thread']` / `['class-channel']` are PREFIXES — they match every mounted
 * `['message-thread', userId]` / `['class-channel', classId]`, so the exact chat the user is
 * looking at refreshes without knowing its id here.
 */
export const MESSAGING_QUERY_KEYS = [
  ['conversations'],
  ['message-thread'],
  ['class-channel'],
  ['messages-unread'],
] as const

/**
 * Invalidate the messaging queries so an open chat refreshes the instant a NEW_MESSAGE push
 * arrives — react-query only refetches *active* (mounted) queries, so inactive chats are merely
 * marked stale and cost nothing. This is what turns "message shows up only after leaving and
 * re-entering the thread" into a live update; the per-screen `refetchInterval` is the fallback
 * for when a foreground push is missed (permission denied, simulator, delivery hiccup).
 */
export function invalidateMessagingQueries(): void {
  for (const key of MESSAGING_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: key as unknown as string[] })
  }
}
