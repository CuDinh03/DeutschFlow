import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * L2 — POST /api/speaking/pronunciation-check phải mang `Authorization: Bearer <access token>`.
 * Backend chỉ xác thực bằng header Bearer (cookie HttpOnly chỉ dùng cho /auth/refresh), nên request
 * chỉ có `credentials: "include"` sẽ luôn nhận 401.
 */

const h = vi.hoisted(() => ({ token: "tok-123" as string | null }));

vi.mock("@/lib/authSession", () => ({
  getAccessToken: () => h.token,
  getRefreshToken: () => null,
  setTokens: (data: { accessToken?: string }) => {
    h.token = data.accessToken ?? null;
  },
  recordTokenRefresh: vi.fn(),
  clearTokens: vi.fn(),
  isNative: () => false,
  getPlatform: () => "web",
  isSupportMode: () => false,
  markSupportSessionEnded: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/stores/useAuthRecoveryStore", () => ({
  useAuthRecoveryStore: { getState: () => ({ setNeedsReauth: vi.fn() }) },
}));
vi.mock("@/stores/useMaintenanceStore", () => ({
  useMaintenanceStore: { getState: () => ({ signal: vi.fn() }) },
}));
vi.mock("@/components/ui-v2/MinorAudioBlockedNotice", () => ({ MinorAudioBlockedNotice: () => null }));

import { PronunciationFeedback } from "./PronunciationFeedback";

/** MediaRecorder giả: stop() phát một mẩu dữ liệu rồi gọi onstop — đủ để component gửi bài. */
class FakeMediaRecorder {
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["abc"], { type: "audio/webm" }) });
    void this.onstop?.();
  }
}

const SCORE = { transcribedText: "Guten Tag", overallScore: 91, avgLogprob: -0.1, words: [] };

async function recordAndSubmit() {
  render(<PronunciationFeedback expectedText="Guten Tag" />);
  fireEvent.click(screen.getByText("startRecording"));
  fireEvent.click(await screen.findByText("stopAndScore"));
}

function pronunciationCalls() {
  return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/api/speaking/pronunciation-check"));
}

describe("PronunciationFeedback — gửi kèm xác thực (L2)", () => {
  beforeEach(() => {
    h.token = "tok-123";
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("request pronunciation-check mang header Authorization: Bearer <token>", async () => {
    vi.mocked(fetch).mockImplementation(
      async () => new Response(JSON.stringify(SCORE), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await recordAndSubmit();
    await waitFor(() => expect(pronunciationCalls()).toHaveLength(1));

    const init = pronunciationCalls()[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok-123");
    // multipart: KHÔNG tự đặt Content-Type — trình duyệt phải tự gắn boundary.
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    expect(await screen.findByText("91")).toBeInTheDocument();
  });

  it("401 vì token hết hạn → làm mới rồi gửi lại đúng bản ghi âm với token mới", async () => {
    const axiosMod = await import("axios");
    let refreshCount = 0;
    axiosMod.default.defaults.adapter = (async (config: { url?: string }) => {
      if (!String(config.url).includes("/auth/refresh")) throw new Error(`unexpected axios call ${config.url}`);
      refreshCount += 1;
      return { status: 200, statusText: "", data: { accessToken: "tok-new" }, headers: {}, config };
    }) as never;
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockImplementation(
        async () => new Response(JSON.stringify(SCORE), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    await recordAndSubmit();
    await waitFor(() => expect(pronunciationCalls()).toHaveLength(2));

    const [first, second] = pronunciationCalls().map((c) => c[1] as RequestInit);
    expect(refreshCount).toBe(1);
    expect(new Headers(first.headers).get("Authorization")).toBe("Bearer tok-123");
    expect(new Headers(second.headers).get("Authorization")).toBe("Bearer tok-new");
    expect(second.body).toBe(first.body);
    expect(await screen.findByText("91")).toBeInTheDocument();
  });
});
