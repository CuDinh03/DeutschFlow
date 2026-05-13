import { getAccessToken } from './authSession';

const API_BASE = '/api';

/**
 * Lắng nghe kết quả từ Job Queue qua SSE (Server-Sent Events).
 * Trả về AbortController để huỷ lắng nghe khi cần (component unmount).
 */
export function subscribeToJobSse<T>(
  jobId: number,
  onResult: (data: T) => void,
  onError: (errorMsg: string) => void
): AbortController {
  const ctrl = new AbortController();
  const url = `${API_BASE}/jobs/${jobId}/sse`;

  void (async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';

        for (const frame of frames) {
          if (!frame.trim()) continue;
          
          let eventName = '';
          let data = '';

          for (const rawLine of frame.split('\n')) {
            const line = rawLine.replace(/\r$/, '');
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const rest = line.slice(5);
              data += (rest.startsWith(' ') ? rest.slice(1) : rest);
            }
          }

          if (eventName === 'result' && data) {
            try {
              onResult(JSON.parse(data) as T);
            } catch {
              onResult(data as unknown as T);
            }
          } else if (eventName === 'error' && data) {
            onError(data);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        onError(e.message || 'Mất kết nối với máy chủ');
      }
    }
  })();

  return ctrl;
}
