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
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();

// `refresh` is required too: GaAuthShell renders LanguageToggle, which calls router.refresh().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

// GaAuthShell resolves its chrome copy through next-intl ('v2.auth.…').
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
}));

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("V2OnboardingPage — step 1 (current level)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("renders step 1 with the level selection heading", () => {
    render(<V2OnboardingPage />);

    expect(screen.getByText("Bạn đang ở trình độ nào?")).toBeInTheDocument();
  });

  it("renders all 5 level options (A0 through B2)", () => {
    render(<V2OnboardingPage />);

    const levels = ["Chưa biết gì", "Cơ bản (A1)", "Sơ cấp (A2)", "Trung cấp (B1)", "Cao cấp (B2)"];
    levels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByText("Vì sao bạn học tiếng Đức?")).toBeInTheDocument();
  });

  it("goes back to step 1 after navigating to step 2", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    expect(screen.getByText("Vì sao bạn học tiếng Đức?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Quay lại/i }));
    expect(screen.getByText("Bạn đang ở trình độ nào?")).toBeInTheDocument();
  });

  it("advances to step 3 (weekly target) from step 2", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByText("Bạn muốn học bao nhiêu?")).toBeInTheDocument();
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

    const a1Button = screen.getByRole("button", { name: /Cơ bản \(A1\)/i });
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

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByRole("button", { name: /Bắt đầu lộ trình/i })).toBeInTheDocument();
  });

  it("redirects to /v2/student/roadmap (NOT the v1 /student/roadmap) on 'Bắt đầu lộ trình'", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Bắt đầu lộ trình/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/v2/student/roadmap");
    });
    expect(pushMock).not.toHaveBeenCalledWith("/student/roadmap");
  });

  it("persists the profile before redirecting (POST /onboarding/profile)", async () => {
    const user = userEvent.setup();
    render(<V2OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Bắt đầu lộ trình/i }));

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

    await user.click(screen.getByRole("button", { name: /Cơ bản \(A1\)/i }));

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(screen.getByText("Was ist ein Tisch?")).toBeInTheDocument();
    });
  });
});
