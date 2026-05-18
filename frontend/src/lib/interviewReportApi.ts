import api from "@/lib/api";
import { getAccessToken } from "@/lib/authSession";

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
 * Stream job result via SSE. Calls onResult when completed, onError on failure.
 * Returns an AbortController to cancel the stream.
 */
export function streamJobResult(
  jobId: number,
  onResult: (resultJson: string) => void,
  onError: (msg: string) => void,
  onTimeout?: () => void
): AbortController {
  const ac = new AbortController();
  const token = typeof window !== "undefined"
    ? getAccessToken() ?? ""
    : "";

  const url = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/jobs/${jobId}/sse`;

  const es = new EventSource(
    url + (token ? `?token=${encodeURIComponent(token)}` : "")
  );

  const timeoutId = setTimeout(() => {
    es.close();
    onTimeout?.();
  }, 60_000); // 60 second max wait

  es.addEventListener("result", (e) => {
    clearTimeout(timeoutId);
    es.close();
    onResult(typeof e.data === "string" ? e.data : JSON.stringify(e.data));
  });

  es.addEventListener("error", (e: any) => {
    clearTimeout(timeoutId);
    es.close();
    onError(e?.data ?? "Không thể tải báo cáo phỏng vấn");
  });

  es.onerror = () => {
    clearTimeout(timeoutId);
    es.close();
    onError("Mất kết nối khi tải báo cáo");
  };

  ac.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
    es.close();
  });

  return ac;
}

/**
 * Fallback polling — check job status without SSE.
 */
export async function pollJobStatus(jobId: number): Promise<InterviewJobStatus> {
  const { data } = await api.get<InterviewJobStatus>(`/jobs/${jobId}/status`);
  return data;
}
