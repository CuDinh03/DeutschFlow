/**
 * useSpeakingRecorderMic × 403 MINOR_AUDIO_BLOCKED (DEC-22, D8 10/09).
 *
 * Đường mic thật của /v2/student/speaking/live: startRecorder → onStop(blob) → transcribe →
 * evaluatePhoneme. Khi backend chặn vì chưa có đồng ý của người giám hộ, hook phải đưa lỗi ra
 * `minorAudioBlocked` (màn giải thích + lối liên hệ trung tâm) chứ KHÔNG rơi vào `micError`
 * "transcriptionFailed"/"errorQuota"; lỗi khác giữ nguyên luồng cũ.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/aiSpeakingApi", () => ({
  aiSpeakingApi: { transcribe: vi.fn() },
}));

vi.mock("@/lib/phonemeApi", () => ({
  evaluatePhoneme: vi.fn(),
}));

vi.mock("@/lib/voiceRecorder", () => ({
  startRecorder: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  httpStatus: (e: unknown) => (e as { response?: { status?: number } } | null)?.response?.status ?? 0,
}));

import { useSpeakingRecorderMic } from "@/hooks/useSpeakingRecorderMic";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { evaluatePhoneme } from "@/lib/phonemeApi";
import { startRecorder, type RecorderHandle, type RecorderResult } from "@/lib/voiceRecorder";

type OnStop = (blob: Blob, result: RecorderResult) => void | Promise<void>;

let onStop: OnStop | null = null;
const t = (k: string) => k;

const minor403 = (reason: string) => ({
  response: {
    status: 403,
    data: { detail: "Server nói.", extensions: { code: "MINOR_AUDIO_BLOCKED", reason } },
  },
});

beforeEach(() => {
  onStop = null;
  vi.mocked(aiSpeakingApi.transcribe).mockReset();
  vi.mocked(evaluatePhoneme).mockReset();
  vi.mocked(startRecorder).mockReset().mockImplementation(async (cb) => {
    onStop = cb as OnStop;
    return {
      stop: vi.fn(),
      cancel: vi.fn(),
      analyser: {} as AnalyserNode,
      stream: {} as MediaStream,
      mimeType: "audio/webm",
      maxDurationMs: 0,
    } as RecorderHandle;
  });
});

async function recordOnce(onTranscript: (text: string) => void = () => {}) {
  const hook = renderHook(() => useSpeakingRecorderMic(t));
  await act(async () => {
    hook.result.current.toggleMic(onTranscript);
  });
  await waitFor(() => expect(onStop).not.toBeNull());
  await act(async () => {
    await onStop!(new Blob(["x"], { type: "audio/webm" }), { reason: "manual", durationMs: 1200 });
  });
  return hook;
}

describe("useSpeakingRecorderMic — 403 MINOR_AUDIO_BLOCKED", () => {
  it("transcribe bị chặn → minorAudioBlocked đúng reason + detail, micError null, không chấm phát âm", async () => {
    vi.mocked(aiSpeakingApi.transcribe).mockRejectedValueOnce(minor403("GUARDIAN_CONSENT_REQUIRED"));
    const onTranscript = vi.fn();

    const { result } = await recordOnce(onTranscript);

    expect(result.current.minorAudioBlocked).toEqual({ reason: "GUARDIAN_CONSENT_REQUIRED", detail: "Server nói." });
    expect(result.current.micError).toBeNull();
    expect(result.current.micErrorKind).toBeNull();
    expect(result.current.isTranscribing).toBe(false);
    expect(onTranscript).not.toHaveBeenCalled();
    expect(evaluatePhoneme).not.toHaveBeenCalled();
  });

  it("chấm phát âm bị chặn (transcript đã về) → vẫn giao transcript, minorAudioBlocked thay vì phonemeEvalFailed", async () => {
    vi.mocked(aiSpeakingApi.transcribe).mockResolvedValueOnce({ data: { transcript: "Hallo" } } as never);
    vi.mocked(evaluatePhoneme).mockRejectedValueOnce(minor403("GUARDIAN_CONSENT_REVOKED"));
    const onTranscript = vi.fn();

    const { result } = await recordOnce(onTranscript);

    expect(onTranscript).toHaveBeenCalledWith("Hallo");
    expect(result.current.minorAudioBlocked?.reason).toBe("GUARDIAN_CONSENT_REVOKED");
    expect(result.current.micError).toBeNull();
    expect(result.current.isEvaluatingPhoneme).toBe(false);
  });

  it("lỗi khác (500) → micError transcriptionFailed, minorAudioBlocked null (luồng cũ giữ nguyên)", async () => {
    vi.mocked(aiSpeakingApi.transcribe).mockRejectedValueOnce({ response: { status: 500, data: {} } });

    const { result } = await recordOnce();

    expect(result.current.minorAudioBlocked).toBeNull();
    expect(result.current.micError).toBe("transcriptionFailed");
  });

  it("429 → errorQuota, không bị nhận nhầm thành chặn tuổi", async () => {
    vi.mocked(aiSpeakingApi.transcribe).mockRejectedValueOnce({
      response: { status: 429, data: { extensions: { code: "QUOTA_EXCEEDED" } } },
    });

    const { result } = await recordOnce();

    expect(result.current.minorAudioBlocked).toBeNull();
    expect(result.current.micError).toBe("errorQuota");
  });

  it("clearMinorAudioBlocked xoá thông báo; lượt thu mới cũng xoá trước khi gọi mạng", async () => {
    vi.mocked(aiSpeakingApi.transcribe).mockRejectedValueOnce(minor403("BIRTH_DATE_REQUIRED"));
    const { result } = await recordOnce();
    expect(result.current.minorAudioBlocked?.reason).toBe("BIRTH_DATE_REQUIRED");

    act(() => result.current.clearMinorAudioBlocked());
    expect(result.current.minorAudioBlocked).toBeNull();
  });
});
