/**
 * Tests for the Onboarding page wizard (/src/app/(auth)/onboarding/page.tsx).
 *
 * The page is a multi-step wizard (steps 1–4) rendered as a single client
 * component. We mock Next.js navigation and all API calls so tests run
 * entirely in jsdom.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

// Value-first Phase C: mock authSession so tests run as an authenticated user
// (isGuest=false), preserving the original authed wizard behaviour in tests.
vi.mock("@/lib/authSession", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

// Draft store: no pending guest draft in any test by default.
// readOnboardingDraft is SYNCHRONOUS on web (uses localStorage), so use mockReturnValue not
// mockResolvedValue. A Promise return value is truthy → would trigger resumeFromDraft spuriously.
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

import OnboardingPage from "@/app/(auth)/onboarding/page";
import api from "@/lib/api";
import { getOnboardingRoute } from "@/lib/profileApi";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OnboardingPage — step 1 (current level)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("renders step 1 with the level selection heading", () => {
    render(<OnboardingPage />);

    expect(screen.getByText("Bạn đang ở trình độ nào?")).toBeInTheDocument();
  });

  it("renders all 5 level options (A0 through B2)", () => {
    render(<OnboardingPage />);

    const levels = ["Chưa biết gì", "Cơ bản (A1)", "Sơ cấp (A2)", "Trung cấp (B1)", "Cao cấp (B2)"];
    levels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("shows progress bar with dots, first dot highlighted", () => {
    render(<OnboardingPage />);

    // Step 1: first dot is yellow (bg-[#FFCD00]), rest are gray.
    const yellowDots = document.querySelectorAll(".bg-\\[\\#FFCD00\\]");
    expect(yellowDots.length).toBeGreaterThanOrEqual(1);
  });
});

describe("OnboardingPage — navigation between steps", () => {
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
    render(<OnboardingPage />);

    const continueBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    await user.click(continueBtn);

    // Step 2 now asks "why are you learning?" (motivation question).
    expect(screen.getByText("Vì sao bạn học tiếng Đức?")).toBeInTheDocument();
  });

  it("goes back to step 1 after navigating to step 2", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    expect(screen.getByText("Vì sao bạn học tiếng Đức?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Quay lại/i }));
    expect(screen.getByText("Bạn đang ở trình độ nào?")).toBeInTheDocument();
  });

  it("advances to step 3 (weekly target) from step 2", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    // Step 1 → 2
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    // Step 2 → 3
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByText("Bạn muốn học bao nhiêu?")).toBeInTheDocument();
  });
});

describe("OnboardingPage — level selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it("selecting a level option marks it as selected (CheckCircle visible)", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    // A0 is selected by default. Click A1 to change.
    const a1Button = screen.getByRole("button", { name: /Cơ bản \(A1\)/i });
    await user.click(a1Button);

    // After clicking A1, the A1 row should be selected (yellow-border class).
    expect(a1Button.className).toMatch(/border-\[#FFCD00\]/);
  });
});

describe("OnboardingPage — A0 level shortcut (skip placement test)", () => {
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
    render(<OnboardingPage />);

    // A0 is the default. Navigate to step 3.
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByRole("button", { name: /Bắt đầu lộ trình/i })).toBeInTheDocument();
  });

  it("redirects to /student/roadmap on 'Bắt đầu lộ trình' click", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    // Navigate to step 3 (A0 selected by default)
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    const startBtn = screen.getByRole("button", { name: /Bắt đầu lộ trình/i });
    await user.click(startBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/student/roadmap");
    });
  });
});

describe("OnboardingPage — non-A0 level triggers placement test flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // saveProfile call returns {} (success); placement-test POST returns testId + questions.
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
    // Route matrix: force mandatory placement for these tests.
    vi.mocked(getOnboardingRoute).mockResolvedValue({
      onboardingType: "PLACEMENT_VALIDATED",
      placementRequired: true,
      placementOptional: false,
      assessmentHookAfter: true,
      paywallAllowed: true,
      postAction: "ROADMAP_NODE",
    });
  });

  it("'Tiếp tục' on step 3 triggers placement test start for A1", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    // Select A1
    await user.click(screen.getByRole("button", { name: /Cơ bản \(A1\)/i }));

    // Navigate to step 3
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step 3 button is "Tiếp tục" for A1 (not "Bắt đầu lộ trình" which is A0-only).
    // Clicking it triggers the placement test flow (forced=true from mock).
    const step3Btn = screen.getByRole("button", { name: /Tiếp tục/i });
    expect(step3Btn).toBeInTheDocument();
    await user.click(step3Btn);

    await waitFor(() => {
      expect(screen.getByText("Was ist ein Tisch?")).toBeInTheDocument();
    });
  });

  it("advances to placement test (step 4) and renders first question", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    // Select A1
    await user.click(screen.getByRole("button", { name: /Cơ bản \(A1\)/i }));

    // Navigate to step 3 and trigger placement test
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));
    await user.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    await waitFor(() => {
      expect(screen.getByText("Was ist ein Tisch?")).toBeInTheDocument();
    });
  });
});
