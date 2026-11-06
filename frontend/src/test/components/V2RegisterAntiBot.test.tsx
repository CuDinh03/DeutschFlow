import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Chống bot ở /v2/register (07/11/2026): honeypot `website`, email tạm, token Cloudflare Turnstile.
// Widget thật cần mạng ⇒ thay bằng bản giả: lộ hàm `emit` để test tự phát token như Cloudflare.

const { pushMock, replaceMock, postMock, getMock, resetMock, widget } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  postMock: vi.fn(),
  getMock: vi.fn(),
  resetMock: vi.fn(),
  widget: { emit: (_t: string) => {} },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  const t = Object.assign(translate, { rich: translate, has: () => true });
  return { useTranslations: () => t, useLocale: () => "vi" };
});
vi.mock("@/hooks/useTracking", () => ({ useTracking: () => ({ trackEvent: vi.fn(), identifyUser: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { post: postMock, get: getMock } }));
vi.mock("@/lib/authSession", () => ({ setTokens: vi.fn(), getAccessToken: vi.fn(() => null) }));
vi.mock("@/lib/guestSessionStore", () => ({ clearGuestSessionCache: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/app/v2/turnstile", async () => {
  const R = await import("react");
  const TurnstileWidget = R.forwardRef<{ reset: () => void }, { onToken: (t: string) => void }>(
    function Fake({ onToken }, ref) {
      R.useImperativeHandle(ref, () => ({ reset: () => { resetMock(); onToken(""); } }));
      widget.emit = onToken;
      return R.createElement("div", { "data-testid": "turnstile" });
    },
  );
  return { TURNSTILE_SITE_KEY: "site-key-test", TurnstileWidget };
});

import RegisterPage from "@/app/v2/register/page";

function fill(container: HTMLElement, email = "an@example.com") {
  const byName = (n: string) => container.querySelector(`input[name="${n}"]`) as HTMLInputElement;
  fireEvent.change(byName("family-name"), { target: { value: "Nguyen" } });
  fireEvent.change(byName("given-name"), { target: { value: "An" } });
  fireEvent.change(byName("email"), { target: { value: email } });
  fireEvent.change(byName("new-password"), { target: { value: "MatKhau123!" } });
}
const submit = (c: HTMLElement) => fireEvent.submit(c.querySelector("form") as HTMLFormElement);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  getMock.mockResolvedValue({ data: { userId: 1, email: "an@example.com", role: "STUDENT" } });
});

describe("/v2/register — chống bot", () => {
  it("chưa có token Turnstile ⇒ không gọi API, báo đang xác minh", async () => {
    const { container } = render(<RegisterPage />);
    fill(container);
    submit(container);
    expect(await screen.findByText("register.humanCheckPending")).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("có token ⇒ gửi header X-Turnstile-Token; honeypot trống đi kèm payload", async () => {
    postMock.mockResolvedValueOnce({ data: { email: "an@example.com", expiresInSeconds: 3600, resendAfterSeconds: 60 } });
    const { container } = render(<RegisterPage />);
    fill(container);
    act(() => widget.emit("tok-1"));
    submit(container);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/v2/verify-email"));
    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe("/auth/register/start");
    expect(body.website).toBe("");
    expect(config.headers["X-Turnstile-Token"]).toBe("tok-1");
  });

  it("501 ⇒ /auth/register cũ dùng LẠI cùng token (backend chưa tiêu nó)", async () => {
    postMock
      .mockRejectedValueOnce({ response: { status: 501, data: {} } })
      .mockResolvedValueOnce({ data: { accessToken: "a", role: "STUDENT" } });
    const { container } = render(<RegisterPage />);
    fill(container);
    act(() => widget.emit("tok-2"));
    submit(container);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/v2/onboarding"));
    expect(postMock.mock.calls[1][0]).toBe("/auth/register");
    expect(postMock.mock.calls[1][2].headers["X-Turnstile-Token"]).toBe("tok-2");
  });

  it("ô honeypot được điền (bot) ⇒ giá trị đi lên server để bị từ chối", async () => {
    postMock.mockRejectedValueOnce({ response: { status: 400, data: { extensions: { reason: "HUMAN_CHECK_FAILED" } } } });
    const { container } = render(<RegisterPage />);
    fill(container);
    fireEvent.change(container.querySelector('input[name="website"]') as HTMLInputElement, { target: { value: "http://spam" } });
    act(() => widget.emit("tok-3"));
    submit(container);

    expect(await screen.findByText("register.humanCheckFailed")).toBeTruthy();
    expect(postMock.mock.calls[0][1].website).toBe("http://spam");
    expect(resetMock).toHaveBeenCalled();
  });

  it("DISPOSABLE_EMAIL ⇒ lỗi hiện ngay dưới ô email, widget lấy token mới", async () => {
    postMock.mockRejectedValueOnce({ response: { status: 400, data: { extensions: { reason: "DISPOSABLE_EMAIL" } } } });
    const { container } = render(<RegisterPage />);
    fill(container, "x@mailinator.com");
    act(() => widget.emit("tok-4"));
    submit(container);

    expect(await screen.findByText("register.emailDisposable")).toBeTruthy();
    expect(resetMock).toHaveBeenCalled();
  });

  it("ô honeypot không nhận Tab và ẩn khỏi trình đọc màn hình", () => {
    const { container } = render(<RegisterPage />);
    const input = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(input.tabIndex).toBe(-1);
    expect(input.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
