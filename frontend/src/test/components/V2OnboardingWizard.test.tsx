/**
 * Tests for the Galerie 2.0 onboarding wizard (/src/app/v2/onboarding/page.tsx).
 *
 * Đợt 4 (18/09/2026): wizard đổi thứ tự khớp mobile — mục tiêu → trình độ → nhịp (phút/ngày) →
 * lĩnh vực/kỳ thi + mentor (W-18), lựa chọn là `role=radio` trong `radiogroup` (W-12), progressbar
 * đếm theo nhánh (W-13). Các ca Đợt 0/1/2/5 giữ nguyên ý nghĩa, chỉ đổi đường bấm.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();

// `refresh` is required too: GaAuthShell renders LanguageToggle, which calls router.refresh().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

// Trả về chính KEY cho cả t() lẫn t.rich(); t.has trả true. Mọi truy vấn tìm theo KEY.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  const t = Object.assign(translate, { rich: translate, has: () => true });
  return { useTranslations: () => t, useLocale: () => "vi" };
});

const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }));
vi.mock("@/hooks/useTracking", () => ({
  useTracking: () => ({
    trackOnboardingStep: vi.fn(),
    trackEvent: trackEventMock,
  }),
}));

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: { hasPlan: true } }),
  },
  apiMessage: vi.fn(() => "Error"),
  httpStatus: vi.fn(() => 0),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

// framer-motion: strip animations so motion divs render as plain divs
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", rest, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Authenticated user (isGuest=false) → the authed wizard path.
vi.mock("@/lib/authSession", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

// readOnboardingDraft là ĐỒNG BỘ (localStorage): trả null, không phải Promise.
vi.mock("@/lib/onboardingDraft", () => ({
  readOnboardingDraft: vi.fn().mockReturnValue(null),
  clearOnboardingDraft: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

const { claimMock, ensureMock, syncMock, readCacheMock } = vi.hoisted(() => ({
  claimMock: vi.fn(),
  ensureMock: vi.fn(),
  syncMock: vi.fn(),
  readCacheMock: vi.fn(),
}));
vi.mock("@/features/onboarding/guestSession", () => ({
  claimGuestSession: claimMock,
  ensureGuestSession: ensureMock,
  syncGuestSession: syncMock,
}));
vi.mock("@/lib/guestSessionStore", () => ({
  readGuestSessionCache: readCacheMock,
}));

vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/profileApi", () => ({
  getOnboardingRoute: vi.fn().mockResolvedValue({
    onboardingType: "ZERO_START",
    placementRequired: false,
    placementOptional: false,
    assessmentHookAfter: false,
    paywallAllowed: true,
    postAction: "ROADMAP_ALPHABET",
  }),
  getOnboardingMentor: vi.fn().mockResolvedValue({
    code: "ANNA", displayName: "Anna", difficulty: "BEGINNER", upsellCode: null, upsellDisplayName: null,
  }),
  getOnboardingMentorPreview: vi.fn().mockResolvedValue({
    code: "ANNA", displayName: "Anna", difficulty: "BEGINNER", upsellCode: null, upsellDisplayName: null,
  }),
}));

// ─── Import component after mocks ────────────────────────────────────────────

import V2OnboardingPage from "@/app/v2/onboarding/page";
import api from "@/lib/api";
import { getOnboardingRoute } from "@/lib/profileApi";
import { readOnboardingDraft, clearOnboardingDraft, saveOnboardingDraft } from "@/lib/onboardingDraft";
import { toast } from "sonner";

const ZERO_ROUTE = {
  onboardingType: "ZERO_START",
  placementRequired: false,
  placementOptional: false,
  assessmentHookAfter: false,
  paywallAllowed: true,
  postAction: "ROADMAP_ALPHABET",
};

/** Bấm "Tiếp tục" qua n bước wizard. */
async function advance(user: ReturnType<typeof userEvent.setup>, times: number) {
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  claimMock.mockResolvedValue({ status: "none" });
  ensureMock.mockResolvedValue(null);
  syncMock.mockResolvedValue(true);
  readCacheMock.mockReturnValue(null);
});

describe("V2OnboardingPage — bước 1 (vì sao bạn học)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("bước 1 là mục tiêu (goal.heading), không còn là trình độ", () => {
    render(<V2OnboardingPage />);
    expect(screen.getByText("goal.heading")).toBeInTheDocument();
    expect(screen.queryByText("level.heading")).not.toBeInTheDocument();
  });

  it("6 lựa chọn là radio trong radiogroup; JOB chọn sẵn", () => {
    render(<V2OnboardingPage />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(6);
    ["JOB", "AUSBILDUNG", "STUDY", "IMMIGRATION", "EXAM", "HOBBY"].forEach((code) => {
      expect(screen.getByText(`goal.${code}`)).toBeInTheDocument();
    });
    expect(screen.getByRole("radio", { name: /goal\.JOB/i })).toHaveAttribute("aria-checked", "true");
  });

  it("progressbar: đã đăng nhập 4 bước, đang ở bước 1", () => {
    render(<V2OnboardingPage />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "4");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
  });
});

describe("V2OnboardingPage — điều hướng giữa các bước (thứ tự mobile)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(getOnboardingRoute).mockResolvedValue(ZERO_ROUTE);
  });

  it("mục tiêu → trình độ → nhịp → lĩnh vực; Quay lại trả về bước trước", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await advance(user, 1);
    expect(screen.getByText("level.heading")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /nav\.back/i }));
    expect(screen.getByText("goal.heading")).toBeInTheDocument();

    await advance(user, 2);
    expect(screen.getByText("rhythm.heading")).toBeInTheDocument();
    await advance(user, 1);
    expect(screen.getByText("focus.industryHeading")).toBeInTheDocument();
  });

  it("W-12: đổi bước thì focus về h1 của bước mới", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 1);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "level.heading" }));
    });
  });

  it("chọn EXAM → bước 4 hỏi kỳ thi thay vì lĩnh vực", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await user.click(screen.getByRole("radio", { name: /goal\.EXAM/i }));
    await advance(user, 3);
    expect(screen.getByText("focus.examHeading")).toBeInTheDocument();
    expect(screen.getByText("focus.exam.TELC.label")).toBeInTheDocument();
  });
});

describe("V2OnboardingPage — bước trình độ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("5 mức A0..B2, A0 chọn sẵn; chọn A1 đánh dấu viền gold + aria-checked", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 1);

    ["A0", "A1", "A2", "B1", "B2"].forEach((code) => {
      expect(screen.getByText(`level.${code}.label`)).toBeInTheDocument();
    });
    expect(screen.getByRole("radio", { name: /level\.A0\.label/i })).toHaveAttribute("aria-checked", "true");

    const a1 = screen.getByRole("radio", { name: /level\.A1\.label/i });
    await user.click(a1);
    expect(a1).toHaveAttribute("aria-checked", "true");
    expect(a1.className).toMatch(/border-ga-gold/);
  });

  it("thẻ hành trình: A0→B1 có số thật, cặp khác câu chung; đổi mục tiêu sang B2", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 1);
    expect(screen.getByText("level.journey")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "B2" }));
    expect(screen.getByRole("radio", { name: "B2" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("level.journeyGeneric")).toBeInTheDocument();
  });
});

describe("V2OnboardingPage — A0 lối tắt (không placement)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(getOnboardingRoute).mockResolvedValue(ZERO_ROUTE);
  });

  it("bước cuối với A0 hiện 'Bắt đầu lộ trình'", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 3);
    expect(screen.getByRole("button", { name: /nav\.startRoadmap/i })).toBeInTheDocument();
  });

  it("redirects to /v2/student/roadmap (NOT the v1 /student/roadmap)", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 3);
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    });
    expect(pushMock).not.toHaveBeenCalledWith("/student/roadmap");
  });

  it("W-18: payload khớp mobile — WORK, A0→B1, 5×15, 15 phút/ngày, NORMAL, không lĩnh vực", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 3);
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", {
        goalType: "WORK", targetLevel: "B1", currentLevel: "A0", motivation: "JOB",
        industry: null, examType: null,
        sessionsPerWeek: 5, minutesPerSession: 15, dailyGoalMinutes: 15, learningSpeed: "NORMAL",
      });
    });
  });

  it("nhịp 20 phút + lĩnh vực Pflege → payload mang đúng, bắn onboarding_daily_goal_set{20}", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await advance(user, 2);
    await user.click(screen.getByRole("radio", { name: /rhythm\.m20/i }));
    await advance(user, 1);
    await user.click(screen.getByRole("radio", { name: /focus\.industry\.Pflege/i }));
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({ dailyGoalMinutes: 20, industry: "Pflege" }));
    });
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_daily_goal_set", { minutes: 20 });
  });

  it("CERT + TELC → examType TELC, industry null", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await user.click(screen.getByRole("radio", { name: /goal\.EXAM/i }));
    await advance(user, 3);
    await user.click(screen.getByRole("radio", { name: /focus\.exam\.TELC/i }));
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({ goalType: "CERT", examType: "TELC", industry: null }));
    });
  });
});

// ─── Đợt 0 onboarding (17/09): 409 khi lưu hồ sơ + mất mạng lúc hỏi ma trận ─────

describe("V2OnboardingPage — Đợt 0: 409 là lỗi, mất mạng /route không ép placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOnboardingDraft).mockReturnValue(null);
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(getOnboardingRoute).mockResolvedValue(ZERO_ROUTE);
  });

  it("saveProfile gặp 409 → chặn chuyển trang, hiện detail, không xoá draft (Q-B)", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 409, data: { detail: "Bản ghi vừa được cập nhật bởi một thao tác khác." } },
    });
    render(<V2OnboardingPage />);
    await advance(user, 3);
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Bản ghi vừa được cập nhật bởi một thao tác khác.");
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /nav\.startRoadmap/i })).not.toBeDisabled();
  });

  it("Đợt 1: mount bắn onboarding_started; lưu hồ sơ bắn onboarding_profile_saved SONG SONG onboarding_completed", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_started", { guest: false });

    await advance(user, 3);
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    });
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_completed", expect.objectContaining({ level: "A0" }));
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_profile_saved", expect.objectContaining({ level: "A0" }));
    const assigned = trackEventMock.mock.calls.find((c) => c[0] === "onboarding_type_assigned");
    expect(assigned?.[1]).not.toHaveProperty("postAction");
  });

  it("A1 + GET /route lỗi mạng → vào lộ trình, KHÔNG tạo placement test (W-1)", async () => {
    const user = userEvent.setup();
    vi.mocked(getOnboardingRoute).mockRejectedValue(new Error("network"));
    render(<V2OnboardingPage />);

    await advance(user, 1);
    await user.click(screen.getByRole("radio", { name: /level\.A1\.label/i }));
    await advance(user, 3);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    });
    expect(api.post).not.toHaveBeenCalledWith("/skill-tree/placement-test", expect.anything());
    expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({ currentLevel: "A1" }));
  });
});

// ─── Đợt 2 (17/09): claim phiên khách trước draft ────────────────────────────────

describe("V2OnboardingPage — Đợt 2: claim guest session sau đăng nhập", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOnboardingDraft).mockReturnValue(null);
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.get).mockResolvedValue({ data: { hasPlan: true } });
    vi.mocked(getOnboardingRoute).mockResolvedValue(ZERO_ROUTE);
  });

  it("claimed + hasPlan → KHÔNG POST /profile, bắn onboarding_session_claimed + profile_saved, vào lộ trình", async () => {
    readCacheMock.mockReturnValue({ sessionId: "s", expiresAt: "2099-01-01T00:00:00Z", currentStep: "AUTH_GATE", answers: {}, savedAt: 0 });
    claimMock.mockResolvedValue({
      status: "claimed", alreadyClaimed: false,
      progress: { flowVersion: "onb_v3", lastStep: "CLAIMED", completedActivities: [], activatedAt: null, coreCompletedAt: null },
      answers: { currentLevel: "A0", goalType: "WORK", targetLevel: "B1", industry: "IT" },
    });
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    }, { timeout: 5000 });
    expect(api.post).not.toHaveBeenCalledWith("/onboarding/profile", expect.anything());
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_session_claimed", expect.objectContaining({ hasPlan: true }));
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_profile_saved", expect.objectContaining({ via: "claim", level: "A0" }));
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_completed", expect.objectContaining({ level: "A0" }));
  });

  it("foreign (phiên của người khác, I-7) → wizard trống, KHÔNG replay draft dù draft còn trên máy", async () => {
    readCacheMock.mockReturnValue({ sessionId: "s", expiresAt: "2099-01-01T00:00:00Z", currentStep: "AUTH_GATE", answers: {}, savedAt: 0 });
    claimMock.mockResolvedValue({ status: "foreign" });
    vi.mocked(readOnboardingDraft).mockReturnValue({
      motivation: "JOB", goalType: "WORK", currentLevel: "A0", targetLevel: "B1", industry: "IT", examType: null, dailyGoalMinutes: 15,
    });
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText("goal.heading")).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(api.post).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    vi.mocked(readOnboardingDraft).mockReturnValue(null);
  });

  it("expired → rơi về replay draft như trước", async () => {
    readCacheMock.mockReturnValue({ sessionId: "s", expiresAt: "2099-01-01T00:00:00Z", currentStep: "AUTH_GATE", answers: {}, savedAt: 0 });
    claimMock.mockResolvedValue({ status: "expired" });
    vi.mocked(readOnboardingDraft).mockReturnValue({
      motivation: "JOB", goalType: "WORK", currentLevel: "A0", targetLevel: "B1", industry: "IT", examType: null, dailyGoalMinutes: 15,
    });
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({ targetLevel: "B1" }));
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    }, { timeout: 5000 });
    vi.mocked(readOnboardingDraft).mockReturnValue(null);
  });

  it("khách vào phễu → tạo phiên; rời bước 1 → PATCH PROFILE với bản chụp câu trả lời", async () => {
    const user = userEvent.setup();
    const { getAccessToken } = await import("@/lib/authSession");
    vi.mocked(getAccessToken).mockReturnValue(null as unknown as string);
    render(<V2OnboardingPage />);
    expect(ensureMock).toHaveBeenCalledWith("vi");

    await advance(user, 1);
    expect(syncMock).toHaveBeenCalledWith("PROFILE", expect.objectContaining({ currentLevel: "A0", sessionsPerWeek: 5, minutesPerSession: 15, dailyGoalMinutes: 15 }));
    vi.mocked(getAccessToken).mockReturnValue("test-token");
  });
});

// ─── Khách: 4 bước → quick win → cổng tài khoản ─────────────────────────────────

describe("V2OnboardingPage — khách: quick win rồi cổng tài khoản (W-13 progress theo nhánh)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const { getAccessToken } = await import("@/lib/authSession");
    vi.mocked(getAccessToken).mockReturnValue(null as unknown as string);
  });
  afterEach(async () => {
    const { getAccessToken } = await import("@/lib/authSession");
    vi.mocked(getAccessToken).mockReturnValue("test-token");
  });

  it("progressbar 6 bước; sau bước 4 là quick win; trả lời đúng → cổng tài khoản; bấm CTA → lưu draft phút/ngày + sang /v2/register", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");

    await advance(user, 4);
    expect(screen.getByText("quickWin.heading")).toBeInTheDocument();
    expect(syncMock).toHaveBeenLastCalledWith("TASTE", expect.objectContaining({ currentLevel: "A0" }));

    await user.click(screen.getByRole("button", { name: "Gute Nacht" }));
    expect(trackEventMock).toHaveBeenCalledWith("guest_activity_completed", { kind: "quick_win", correct: false });
    await user.click(screen.getByRole("button", { name: /Guten Morgen/ }));
    expect(trackEventMock).toHaveBeenCalledWith("guest_activity_completed", { kind: "quick_win", correct: true });
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    expect(screen.getByText("signup.heading")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /signup\.cta/i }));
    expect(saveOnboardingDraft).toHaveBeenCalledWith(expect.objectContaining({ dailyGoalMinutes: 15, currentLevel: "A0", targetLevel: "B1" }));
    expect(syncMock).toHaveBeenCalledWith("AUTH_GATE", expect.objectContaining({ goalType: "WORK" }));
    expect(pushMock).toHaveBeenCalledWith("/v2/register");
    expect(api.post).not.toHaveBeenCalledWith("/onboarding/profile", expect.anything());
  });
});

describe("V2OnboardingPage — non-A0 level triggers placement test flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({
      data: {
        testId: "test-123",
        questions: [
          { id: 1, skillSection: "LESEN", type: "MULTIPLE_CHOICE", questionDe: "Was ist ein Tisch?", questionVi: "Cái bàn là gì?", options: ["Ein Möbel", "Eine Pflanze", "Ein Tier", "Ein Getränk"] },
        ],
      },
    });
    vi.mocked(getOnboardingRoute).mockResolvedValue({
      onboardingType: "PLACEMENT_VALIDATED",
      placementRequired: true,
      placementOptional: false,
      assessmentHookAfter: true,
      paywallAllowed: true,
      postAction: "ROADMAP_NODE",
    });
  });

  it("advances to placement test and renders first question", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await advance(user, 1);
    await user.click(screen.getByRole("radio", { name: /level\.A1\.label/i }));
    await advance(user, 3);

    await waitFor(() => {
      expect(screen.getByText("Was ist ein Tisch?")).toBeInTheDocument();
    });
  });
});

// ─── QW-3: draft chỉ được xoá SAU khi hồ sơ đã lên server ─────────────────────

describe("V2OnboardingPage — resume từ draft sau đăng ký", () => {
  const DRAFT = {
    motivation: "JOB", goalType: "WORK", currentLevel: "A0", targetLevel: "B1", industry: "IT", examType: null, dailyGoalMinutes: 15,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOnboardingDraft).mockReturnValue(DRAFT);
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(getOnboardingRoute).mockResolvedValue(ZERO_ROUTE);
  });

  afterEach(() => {
    vi.mocked(readOnboardingDraft).mockReturnValue(null);
  });

  it("POST hồ sơ thành công → xoá draft SAU khi POST, không phải trước", async () => {
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({ currentLevel: "A0", targetLevel: "B1", dailyGoalMinutes: 15 }));
    });
    await waitFor(() => {
      expect(clearOnboardingDraft).toHaveBeenCalled();
    });
    const postOrder = vi.mocked(api.post).mock.invocationCallOrder[0];
    const clearOrder = vi.mocked(clearOnboardingDraft).mock.invocationCallOrder[0];
    expect(clearOrder).toBeGreaterThan(postOrder);
    expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
  });

  it("POST hồ sơ hỏng → GIỮ draft, báo lỗi, và trả người dùng về bước cuối dùng lại được", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } });
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    }, { timeout: 5000 });
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("focus.industryHeading")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("resume hỏng rồi tự hoàn tất lại bằng wizard → draft KHÔNG bị bỏ mồ côi", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } });

    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText("focus.industryHeading")).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(clearOnboardingDraft).not.toHaveBeenCalled();

    vi.mocked(api.post).mockResolvedValue({ data: {} });
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap|nav\.continue/i }));

    await waitFor(() => {
      expect(clearOnboardingDraft).toHaveBeenCalled();
    }, { timeout: 5000 });
    expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
  });

  it("POST trả 409 → GIỮ draft, hiện detail của server, KHÔNG đi tiếp (Q-B)", async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 409, data: { detail: "Bản ghi vừa được cập nhật bởi một thao tác khác." } },
    });

    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Bản ghi vừa được cập nhật bởi một thao tác khác.");
    }, { timeout: 5000 });
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("focus.industryHeading")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("chỉ chạy resume một lần dù StrictMode gọi effect hai lần", async () => {
    render(
      <React.StrictMode>
        <V2OnboardingPage />
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(clearOnboardingDraft).toHaveBeenCalledTimes(1);
    });
    expect(
      vi.mocked(api.post).mock.calls.filter((c) => c[0] === "/onboarding/profile"),
    ).toHaveLength(1);
  });
});

describe("V2OnboardingPage — Đợt 5: học viên trung tâm đi bản rút gọn PROFILE_LITE", () => {
  const orgCtx = {
    accountSource: "ORG_ROSTER",
    hasPlan: false,
    org: { orgId: 7, name: "Trung tâm Sao Việt", classId: 42, className: "B1 tối thứ 3" },
    presetCurrentLevel: "A2",
    trial: { isTrial: true, trialEndsAt: "2026-10-31T00:00:00Z" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === "/onboarding/context" ? { data: orgCtx } : { data: { hasPlan: true } },
    );
  });

  it("ORG_ROSTER chưa có plan → màn lớp/trung tâm, KHÔNG có bước mục tiêu; trình độ đã đặt thì không hỏi lại", async () => {
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByTestId("org-lite-wizard")).toBeInTheDocument();
    });
    expect(screen.getByText("orgLite.heading")).toBeInTheDocument();
    expect(screen.getByText("orgLite.levelPreset")).toBeInTheDocument();
    expect(screen.queryByText("orgLite.levelHeading")).not.toBeInTheDocument();
    expect(screen.queryByText("level.heading")).not.toBeInTheDocument();
    expect(screen.queryByText("goal.heading")).not.toBeInTheDocument();
  });

  it("bấm Bắt đầu học → POST /onboarding/profile với goalType=WORK, không lĩnh vực/kỳ thi, targetLevel mặc định; vào lộ trình, không mời placement", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);
    await waitFor(() => expect(screen.getByTestId("org-lite-wizard")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /orgLite\.cta/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({
        goalType: "WORK", currentLevel: "A2", targetLevel: "B1", industry: null, examType: null,
        sessionsPerWeek: 5, minutesPerSession: 15, dailyGoalMinutes: 15,
      }));
    });
    expect(getOnboardingRoute).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_profile_saved", expect.objectContaining({ lite: true, accountSource: "ORG_ROSTER" }));
    expect(trackEventMock).toHaveBeenCalledWith("onboarding_completed", expect.objectContaining({ lite: true }));
  });

  it("presetCurrentLevel null → hỏi thêm một câu trình độ; chọn B1 thì targetLevel nhắm B2", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === "/onboarding/context" ? { data: { ...orgCtx, presetCurrentLevel: null } } : { data: { hasPlan: true } },
    );
    render(<V2OnboardingPage />);
    await waitFor(() => expect(screen.getByText("orgLite.levelHeading")).toBeInTheDocument());

    await user.click(screen.getByText("level.B1.label"));
    await user.click(screen.getByRole("button", { name: /orgLite\.cta/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({ currentLevel: "B1", targetLevel: "B2" }));
    });
  });

  it("POST hỏng → báo lỗi, ở lại màn rút gọn, KHÔNG đẩy sang lộ trình", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } });
    render(<V2OnboardingPage />);
    await waitFor(() => expect(screen.getByTestId("org-lite-wizard")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /orgLite\.cta/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("org-lite-wizard")).toBeInTheDocument();
  });

  it("SELF (tự đăng ký, kể cả C3 vào lớp bằng mã) → wizard 4 bước như cũ", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === "/onboarding/context" ? { data: { ...orgCtx, accountSource: "SELF", org: null } } : { data: { hasPlan: true } },
    );
    render(<V2OnboardingPage />);

    expect(screen.getByText("goal.heading")).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/onboarding/context"));
    expect(screen.queryByTestId("org-lite-wizard")).not.toBeInTheDocument();
  });

  it("context lỗi (backend cũ 404) → phễu thường, không chặn ai", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/onboarding/context") throw { response: { status: 404 } };
      return { data: { hasPlan: true } };
    });
    render(<V2OnboardingPage />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/onboarding/context"));
    expect(screen.getByText("goal.heading")).toBeInTheDocument();
    expect(screen.queryByTestId("org-lite-wizard")).not.toBeInTheDocument();
  });
});
