import api from '@/lib/api'

/**
 * Open an authenticated EventSource using a one-time SSE ticket (S15) instead of putting the access
 * token in the URL (which leaks into access/proxy logs, history, and Referer).
 *
 * Fetches a single-use, ~60s ticket via the Bearer-authenticated API client, then connects with
 * `?ticket=`. The ticket is consumed by the backend on connect, so it grants nothing if later logged.
 */
export async function createTicketedEventSource(streamUrl: string): Promise<EventSource> {
  const { data } = await api.post<{ ticket: string }>('/sse/ticket')
  const sep = streamUrl.includes('?') ? '&' : '?'
  return new EventSource(`${streamUrl}${sep}ticket=${encodeURIComponent(data.ticket)}`)
}
