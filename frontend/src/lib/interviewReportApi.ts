import api from "@/lib/api";
import { getAccessToken } from "@/lib/authSession";

// Use same baseURL derivation as api.ts — SSE fetch must go directly to Spring Boot,
// not to the Next.js server (EventSource/fetch with relative /api would hit Next.js → 404).
const _backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
const _backendOrigin = _backendUrl.replace(/\/api$/, '');
const SSE_API_BASE = `${_backendOrigin}/api`;

export interface InterviewJobStatus {
  jobId: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Submit a job to generate an AI interview report for a completed session.
 * Returns jobId for SSE streaming.
 */
export async function submitInterviewReport(sessionId: number): Promise<number> {
  const { data } = await api.post<{ jobId: number; status: string }>(
    "/jobs/interview-report",
    { sessionId }
  );
  return data.jobId;
}

/**
 * Stream job result via SSE using fetch (supports Authorization header, unlike EventSource).
 * Calls onResult when completed, onError on failure.
 * Returns an AbortController to cancel the stream.
 */
export function streamJobResult(
  jobId: number,
  onResult: (resultJson: string) => void,
  onError: (msg: string) => void,
  onTimeout?: () => void
): AbortController {
  const ac = new AbortController();
  const url = `${SSE_API_BASE}/jobs/${jobId}/sse`;

  const timeoutId = setTimeout(() => {
    ac.abort();
    onTimeout?.();
  }, 60_000); // 60 second max wait

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
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        clearTimeout(timeoutId);
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
              data += rest.startsWith(' ') ? rest.slice(1) : rest;
            }
          }

          if (eventName === 'result' && data) {
            clearTimeout(timeoutId);
            onResult(data);
            return;
          } else if (eventName === 'error' && data) {
            clearTimeout(timeoutId);
            onError(data);
            return;
          }
        }
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name !== 'AbortError') {
        onError(e.message || 'Mất kết nối khi tải báo cáo');
      }
    }
  })();

  return ac;
}

/**
 * Fallback polling — check job status without SSE.
 */
export async function pollJobStatus(jobId: number): Promise<InterviewJobStatus> {
  const { data } = await api.get<InterviewJobStatus>(`/jobs/${jobId}/status`);
  return data;
}
