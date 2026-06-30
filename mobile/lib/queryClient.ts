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
