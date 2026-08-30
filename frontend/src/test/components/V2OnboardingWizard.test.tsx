/**
 * Tests for the Galerie 2.0 onboarding wizard (/src/app/v2/onboarding/page.tsx).
 *
 * Mirrors src/test/components/OnboardingWizard.test.tsx (the v1 funnel) case for case.
 * That is the POINT: the v2 page is a PORT, so the same interactions must produce the same
 * behaviour — only the outbound routes change (/student/roadmap → /v2/student/roadmap).
 * Without this file the v2 funnel would ship with ZERO coverage while the only wizard test
 * in the repo still pinned the page that is about to be deleted.
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

// GaAuthShell resolves its chrome copy through next-intl ('v2.auth.…').
// Trả về chính KEY cho cả t() lẫn t.rich(): page dùng t.rich cho các chuỗi có <b>,
// và một mock chỉ có t() sẽ ném "t.rich is not a function" thay vì fail có nghĩa.
// Vì thế mọi truy vấn bên dưới tìm theo KEY, không phải theo tiếng Việt — copy nay
// nằm ở messages/v2/onboarding.<locale>.json (GĐ 4).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  const t = Object.assign(translate, { rich: translate });
  return { useTranslations: () => t, useLocale: () => "vi" };
});

vi.mock("@/hooks/useTracking", () => ({
  useTracking: () => ({
    trackOnboardingStep: vi.fn(),
    trackEvent: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
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

// Authenticated user (isGuest=false) → the authed wizard path, same as the v1 suite.
vi.mock("@/lib/authSession", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

// readOnboardingDraft is SYNCHRONOUS (localStorage): a Promise would be truthy and would
// spuriously kick off resumeFromDraft. Return null, not a resolved promise.
vi.mock("@/lib/onboardingDraft", () => ({
  readOnboardingDraft: vi.fn().mockReturnValue(null),
  clearOnboardingDraft: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

// PostHog: flag off by default (control path).
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: vi.fn(() => false),
}));

// Profile API: default route = A0 path (no placement required or optional).
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
    code: "ANNA",
    displayName: "Anna",
    difficulty: "BEGINNER",
    upsellCode: null,
    upsellDisplayName: null,
  }),
  getOnboardingMentorPreview: vi.fn().mockResolvedValue({
    code: "ANNA",
    displayName: "Anna",
    difficulty: "BEGINNER",
    upsellCode: null,
    upsellDisplayName: null,
  }),
}));

// ─── Import component after mocks ────────────────────────────────────────────

import V2OnboardingPage from "@/app/v2/onboarding/page";
import api from "@/lib/api";
import { getOnboardingRoute } from "@/lib/profileApi";
import { readOnboardingDraft, clearOnboardingDraft } from "@/lib/onboardingDraft";
import { toast } from "sonner";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("V2OnboardingPage — step 1 (current level)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("renders step 1 with the level selection heading", () => {
    render(<V2OnboardingPage />);

    expect(screen.getByText("level.heading")).toBeInTheDocument();
  });

  it("renders all 5 level options (A0 through B2)", () => {
    render(<V2OnboardingPage />);

    // Khoá theo MÃ trình độ, không theo nhãn: nhãn nay sống ở catalog i18n và đổi
    // được mà không đụng luồng — còn việc đủ 5 lựa chọn A0..B2 mới là hành vi.
    ["A0", "A1", "A2", "B1", "B2"].forEach((code) => {
      expect(screen.getByText(`level.${code}.label`)).toBeInTheDocument();
      expect(screen.getByText(`level.${code}.desc`)).toBeInTheDocument();
    });
  });
});

describe("V2OnboardingPage — navigation between steps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(getOnboardingRoute).mockResolvedValue({
      onboardingType: "ZERO_START",
      placementRequired: false,
      placementOptional: false,
      assessmentHookAfter: false,
      paywallAllowed: true,
      postAction: "ROADMAP_ALPHABET",
    });
  });

  it("advances to step 2 when 'Tiếp tục' is clicked", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));

    expect(screen.getByText("goal.heading")).toBeInTheDocument();
  });

  it("goes back to step 1 after navigating to step 2", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    expect(screen.getByText("goal.heading")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /nav\.back/i }));
    expect(screen.getByText("level.heading")).toBeInTheDocument();
  });

  it("advances to step 3 (weekly target) from step 2", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));

    expect(screen.getByText("pace.heading")).toBeInTheDocument();
  });
});

describe("V2OnboardingPage — level selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("selecting a level option marks it as selected (Galerie gold border)", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    const a1Button = screen.getByRole("button", { name: /level\.A1\.label/i });
    await user.click(a1Button);

    // v2 token equivalent of v1's border-[#FFCD00].
    expect(a1Button.className).toMatch(/border-ga-gold/);
  });
});

describe("V2OnboardingPage — A0 level shortcut (skip placement test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(getOnboardingRoute).mockResolvedValue({
      onboardingType: "ZERO_START",
      placementRequired: false,
      placementOptional: false,
      assessmentHookAfter: false,
      paywallAllowed: true,
      postAction: "ROADMAP_ALPHABET",
    });
  });

  it("shows 'Bắt đầu lộ trình' button on step 3 when level is A0", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));

    expect(screen.getByRole("button", { name: /nav\.startRoadmap/i })).toBeInTheDocument();
  });

  it("redirects to /v2/student/roadmap (NOT the v1 /student/roadmap) on 'Bắt đầu lộ trình'", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    });
    expect(pushMock).not.toHaveBeenCalledWith("/student/roadmap");
  });

  it("persists the profile before redirecting (POST /onboarding/profile)", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/onboarding/profile",
        expect.objectContaining({ goalType: "WORK", currentLevel: "A0", sessionsPerWeek: 5 }),
      );
    });
  });
});

describe("V2OnboardingPage — non-A0 level triggers placement test flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({
      data: {
        testId: "test-123",
        questions: [
          {
            id: 1,
            skillSection: "LESEN",
            type: "MULTIPLE_CHOICE",
            questionDe: "Was ist ein Tisch?",
            questionVi: "Cái bàn là gì?",
            options: ["Ein Möbel", "Eine Pflanze", "Ein Tier", "Ein Getränk"],
          },
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

  it("advances to placement test (step 4) and renders first question", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /level\.A1\.label/i }));

    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));
    await user.click(screen.getByRole("button", { name: /nav\.continue/i }));

    await waitFor(() => {
      expect(screen.getByText("Was ist ein Tisch?")).toBeInTheDocument();
    });
  });
});

// ─── QW-3: draft chỉ được xoá SAU khi hồ sơ đã lên server ─────────────────────
//
// Bản cũ xoá draft ngay lúc đọc (trước POST), nên POST hỏng là mất trắng câu trả
// lời của người dùng. Nhánh resume này trước đây coverage 0 — không test nào chạm.

describe("V2OnboardingPage — resume từ draft sau đăng ký", () => {
  const DRAFT = {
    motivation: "JOB",
    goalType: "WORK",
    currentLevel: "A0",
    targetLevel: "B1",
    industry: "IT",
    examType: "GOETHE",
    weeklyTarget: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOnboardingDraft).mockReturnValue(DRAFT);
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    // vi.clearAllMocks() chỉ xoá lịch sử gọi, KHÔNG xoá implementation: describe
    // "non-A0 … placement test" ở trên đã đặt getOnboardingRoute thành
    // placementRequired=true và giá trị đó rò sang đây. Đặt lại tường minh.
    vi.mocked(getOnboardingRoute).mockResolvedValue({
      onboardingType: "ZERO_START",
      placementRequired: false,
      placementOptional: false,
      assessmentHookAfter: false,
      paywallAllowed: true,
      postAction: "ROADMAP_ALPHABET",
    });
  });

  afterEach(() => {
    // Trả mock về null, nếu không mọi describe chạy sau sẽ vô tình đi vào nhánh
    // resume và render loader thay vì bước 1 → hàng loạt fail giả.
    vi.mocked(readOnboardingDraft).mockReturnValue(null);
  });

  it("POST hồ sơ thành công → xoá draft SAU khi POST, không phải trước", async () => {
    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/onboarding/profile", expect.objectContaining({
        targetLevel: "B1",
        goalType: "WORK",
      }));
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(clearOnboardingDraft).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });
    // Chỉ đếm số lần gọi thì bản cũ (xoá TRƯỚC khi POST) cũng xanh — phải soi
    // đúng THỨ TỰ mới khoá được hành vi mà QW-3 đang sửa.
    expect(vi.mocked(clearOnboardingDraft).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(api.post).mock.invocationCallOrder[0],
    );
    expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
  });

  it("POST hồ sơ hỏng → GIỮ draft, báo lỗi, và trả người dùng về bước dùng lại được", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } });

    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    }, { timeout: 5000 });
    // Đây là điểm mấu chốt của QW-3.
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    // Giữ được dữ liệu mà kẹt ở màn loader thì cũng như mất: phải khoá cả vế
    // "có lối đi tiếp". Không có hai assert này thì việc bỏ setResuming(false)
    // vẫn khiến ca test xanh.
    await waitFor(() => {
      expect(screen.getByText("pace.heading")).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.queryByText("loader.title")).not.toBeInTheDocument();
  });

  it("resume hỏng rồi tự hoàn tất lại bằng wizard → draft KHÔNG bị bỏ mồ côi", async () => {
    // Hồi quy do chính QW-3 đẻ ra: giữ draft ở nhánh lỗi mở ra một đường mà
    // trước đó không tồn tại — người dùng lưu hồ sơ thành công qua saveProfile()
    // trong khi draft cũ vẫn nằm đó, rồi bị replay đè lên hồ sơ vừa lưu.
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } });

    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText("pace.heading")).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(clearOnboardingDraft).not.toHaveBeenCalled();

    vi.mocked(api.post).mockResolvedValue({ data: {} });
    await user.click(screen.getByRole("button", { name: /nav\.startRoadmap|nav\.continue/i }));

    await waitFor(() => {
      expect(clearOnboardingDraft).toHaveBeenCalled();
    }, { timeout: 5000 });
    expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
  });

  it("POST trả 409 → GIỮ draft, vì 409 nghĩa là giao dịch đã rollback", async () => {
    // Endpoint UPSERT và trả 201; 409 duy nhất có thể tới là optimistic-lock /
    // data-integrity nổ lúc commit ⇒ hồ sơ KHÔNG được ghi. Xoá draft ở đây là
    // vứt bản sao cuối cùng đúng lúc server không lưu được gì.
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409 } });

    render(<V2OnboardingPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    }, { timeout: 5000 });
    expect(clearOnboardingDraft).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("chỉ chạy resume một lần dù StrictMode gọi effect hai lần", async () => {
    // Lệnh xoá draft đồng bộ của bản cũ kiêm luôn vai chống chạy hai lần. Bỏ nó
    // mà không có cờ riêng thì StrictMode bắn hai POST + hai `onboarding_completed`.
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
