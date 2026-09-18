/**
 * Guest session client (Đợt 2). Ba bất biến: cache hết hạn = không có; PATCH không bao giờ chặn UI;
 * claim 400 (phiên của người khác, I-7) phải vứt CẢ draft.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { postMock, patchMock, clearDraftMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  patchMock: vi.fn(),
  clearDraftMock: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ default: { post: postMock, patch: patchMock } }));
vi.mock("@/lib/onboardingDraft", () => ({ clearOnboardingDraft: clearDraftMock }));

import {
  GUEST_SESSION_KEY,
  claimGuestSession,
  clearGuestSessionCache,
  ensureGuestSession,
  readGuestSessionCache,
  syncGuestSession,
} from "./guestSession";

const FUTURE = new Date(Date.now() + 72 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();

function seed(overrides: Partial<{ sessionId: string; expiresAt: string; answers: Record<string, unknown> }> = {}) {
  window.localStorage.setItem(
    GUEST_SESSION_KEY,
    JSON.stringify({ sessionId: "11111111-2222-3333-4444-555555555555", expiresAt: FUTURE, currentStep: "PROFILE", answers: {}, savedAt: Date.now(), ...overrides }),
  );
}

// jsdom trong repo này chỉ dựng localStorage một phần (thiếu cả clear) — lệ chung: mỗi test tự cấp
// bản in-memory (xem src/lib/onboardingDraft.test.ts, memory reference_frontend_vitest_gotchas).
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  });
  postMock.mockReset();
  patchMock.mockReset();
  clearDraftMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readGuestSessionCache", () => {
  it("không có gì → null", () => {
    expect(readGuestSessionCache()).toBeNull();
  });
  it("hết hạn → null và xoá cache", () => {
    seed({ expiresAt: PAST });
    expect(readGuestSessionCache()).toBeNull();
    expect(window.localStorage.getItem(GUEST_SESSION_KEY)).toBeNull();
  });
  it("còn hạn → trả về", () => {
    seed();
    expect(readGuestSessionCache()?.sessionId).toBe("11111111-2222-3333-4444-555555555555");
  });
  it("JSON hỏng → null, không ném", () => {
    window.localStorage.setItem(GUEST_SESSION_KEY, "{oops");
    expect(readGuestSessionCache()).toBeNull();
  });
});

describe("ensureGuestSession", () => {
  it("chưa có → POST tạo với platform WEB + locale, ghi cache", async () => {
    postMock.mockResolvedValue({ data: { sessionId: "s-1", currentStep: "INTRO", flowVersion: "onb_v3", expiresAt: FUTURE } });
    const id = await ensureGuestSession("de");
    expect(id).toBe("s-1");
    expect(postMock).toHaveBeenCalledWith("/onboarding/guest-session", { platform: "WEB", locale: "de" });
    expect(readGuestSessionCache()?.sessionId).toBe("s-1");
  });
  it("đã có cache còn hạn → dùng lại, không gọi server", async () => {
    seed();
    expect(await ensureGuestSession("vi")).toBe("11111111-2222-3333-4444-555555555555");
    expect(postMock).not.toHaveBeenCalled();
  });
  it("locale lạ → vi", async () => {
    postMock.mockResolvedValue({ data: { sessionId: "s-2", currentStep: "INTRO", flowVersion: "onb_v3", expiresAt: FUTURE } });
    await ensureGuestSession("fr");
    expect(postMock).toHaveBeenCalledWith("/onboarding/guest-session", { platform: "WEB", locale: "vi" });
  });
  it("server lỗi (rate-limit) → null, phễu vẫn chạy", async () => {
    postMock.mockRejectedValue({ response: { status: 429 } });
    expect(await ensureGuestSession("vi")).toBeNull();
    expect(readGuestSessionCache()).toBeNull();
  });
});

describe("syncGuestSession", () => {
  it("PATCH gộp answers cũ + mới, ghi cache", async () => {
    seed({ answers: { motivation: "JOB" } });
    patchMock.mockResolvedValue({ data: {} });
    const ok = await syncGuestSession("TASTE", { currentLevel: "A1", targetLevel: "B1" });
    expect(ok).toBe(true);
    expect(patchMock).toHaveBeenCalledWith("/onboarding/guest-session/11111111-2222-3333-4444-555555555555", {
      currentStep: "TASTE",
      answers: { motivation: "JOB", currentLevel: "A1", targetLevel: "B1" },
    });
    expect(readGuestSessionCache()?.answers).toEqual({ motivation: "JOB", currentLevel: "A1", targetLevel: "B1" });
    expect(readGuestSessionCache()?.currentStep).toBe("TASTE");
  });
  it("không có cache → false, không gọi", async () => {
    expect(await syncGuestSession("PROFILE", {})).toBe(false);
    expect(patchMock).not.toHaveBeenCalled();
  });
  it("404 (hết hạn) → vứt cache; 500 → giữ cache", async () => {
    seed();
    patchMock.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await syncGuestSession("PROFILE", {})).toBe(false);
    expect(readGuestSessionCache()).toBeNull();
    seed();
    patchMock.mockRejectedValueOnce({ response: { status: 500 } });
    expect(await syncGuestSession("PROFILE", {})).toBe(false);
    expect(readGuestSessionCache()).not.toBeNull();
  });
  it("activityResult chỉ gửi khi có", async () => {
    seed();
    patchMock.mockResolvedValue({ data: {} });
    await syncGuestSession("TASTE", undefined, { quickWin: { correct: false } });
    expect(patchMock).toHaveBeenCalledWith(expect.any(String), { currentStep: "TASTE", activityResult: { quickWin: { correct: false } } });
  });
});

describe("claimGuestSession", () => {
  it("không cache → none", async () => {
    expect(await claimGuestSession()).toEqual({ status: "none" });
  });
  it("claimed → dọn cache + draft, trả answers chụp", async () => {
    seed({ answers: { currentLevel: "A1", targetLevel: "B1" } });
    postMock.mockResolvedValue({ data: { claimed: true, alreadyClaimed: false, progress: { flowVersion: "onb_v3", lastStep: "CLAIMED", completedActivities: [], activatedAt: null, coreCompletedAt: null } } });
    const r = await claimGuestSession();
    expect(r.status).toBe("claimed");
    if (r.status === "claimed") expect(r.answers.currentLevel).toBe("A1");
    expect(postMock).toHaveBeenCalledWith("/onboarding/claim", { sessionId: "11111111-2222-3333-4444-555555555555" });
    expect(readGuestSessionCache()).toBeNull();
    expect(clearDraftMock).toHaveBeenCalled();
  });
  it("400 (phiên của người khác, I-7) → foreign, vứt CẢ draft", async () => {
    seed();
    postMock.mockRejectedValue({ response: { status: 400 } });
    expect(await claimGuestSession()).toEqual({ status: "foreign" });
    expect(readGuestSessionCache()).toBeNull();
    expect(clearDraftMock).toHaveBeenCalled();
  });
  it("404 → expired, vứt cache nhưng GIỮ draft (cùng người, đường lùi)", async () => {
    seed();
    postMock.mockRejectedValue({ response: { status: 404 } });
    expect(await claimGuestSession()).toEqual({ status: "expired" });
    expect(readGuestSessionCache()).toBeNull();
    expect(clearDraftMock).not.toHaveBeenCalled();
  });
  it("mất mạng → error, giữ cache + draft", async () => {
    seed();
    postMock.mockRejectedValue(new Error("Network Error"));
    expect(await claimGuestSession()).toEqual({ status: "error" });
    expect(readGuestSessionCache()).not.toBeNull();
    expect(clearDraftMock).not.toHaveBeenCalled();
  });
  it("clearGuestSessionCache xoá khoá", () => {
    seed();
    clearGuestSessionCache();
    expect(window.localStorage.getItem(GUEST_SESSION_KEY)).toBeNull();
  });
});
