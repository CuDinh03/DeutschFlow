import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Đăng ký có mã PIN (thiết kế 05/11 §7.1): form gọi /auth/register/start; 202 ⇒ trang nhập mã;
// 501 ⇒ công tắc backend tắt ⇒ lùi về /auth/register cũ. Trang nhập mã: dán 6 số là tự gửi, câu lỗi
// chọn theo extensions.reason (không hiện mã máy).

const { pushMock, replaceMock, postMock, getMock, trackEventMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  postMock: vi.fn(),
  getMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

// t() trả KEY; tham số nối vào sau dấu | để khẳng định được.
vi.mock("next-intl", () => {
  const translate = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}|${Object.values(values).join(",")}` : key;
  const t = Object.assign(translate, { rich: translate, has: () => true });
  return { useTranslations: () => t, useLocale: () => "vi" };
});

vi.mock("@/hooks/useTracking", () => ({
  useTracking: () => ({ trackEvent: trackEventMock, identifyUser: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({ default: { post: postMock, get: getMock } }));
vi.mock("@/lib/authSession", () => ({ setTokens: vi.fn(), getAccessToken: vi.fn(() => null) }));
vi.mock("@/lib/guestSessionStore", () => ({ clearGuestSessionCache: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RegisterPage from "@/app/v2/register/page";
import VerifyEmailPage from "@/app/v2/verify-email/page";

const ME = { userId: 7, email: "an@example.com", role: "STUDENT", displayName: "Nguyen An", locale: "vi" };

function fillRegisterForm(container: HTMLElement) {
  const byName = (n: string) => container.querySelector(`input[name="${n}"]`) as HTMLInputElement;
  fireEvent.change(byName("family-name"), { target: { value: "Nguyen" } });
  fireEvent.change(byName("given-name"), { target: { value: "An" } });
  fireEvent.change(byName("email"), { target: { value: "an@example.com" } });
  fireEvent.change(byName("new-password"), { target: { value: "MatKhau123!" } });
  fireEvent.submit(container.querySelector("form") as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  getMock.mockResolvedValue({ data: ME });
});

describe("/v2/register — mã PIN", () => {
  it("202 ⇒ lưu form (không mật khẩu) vào sessionStorage rồi sang /v2/verify-email, chưa cấp phiên", async () => {
    postMock.mockResolvedValueOnce({
      status: 202,
      data: { status: "CODE_SENT", email: "an@example.com", expiresInSeconds: 3600, resendAfterSeconds: 60, codeLength: 6 },
    });
    const { container } = render(<RegisterPage />);
    fillRegisterForm(container);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/v2/verify-email"));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][0]).toBe("/auth/register/start");
    const draft = JSON.parse(sessionStorage.getItem("df.pendingSignup") ?? "{}");
    expect(draft.email).toBe("an@example.com");
    expect(JSON.stringify(draft)).not.toContain("MatKhau123!");
    expect(getMock).not.toHaveBeenCalled();
  });

  it("501 (công tắc tắt) ⇒ lùi về /auth/register cũ và vào onboarding như trước", async () => {
    postMock
      .mockRejectedValueOnce({ response: { status: 501, data: { extensions: { reason: "DISABLED" } } } })
      .mockResolvedValueOnce({ data: { accessToken: "a", role: "STUDENT", orgId: null, orgRole: null } });
    const { container } = render(<RegisterPage />);
    fillRegisterForm(container);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/v2/onboarding"));
    expect(postMock.mock.calls.map((c) => c[0])).toEqual(["/auth/register/start", "/auth/register"]);
  });

  it("503 ⇒ báo chưa gửi được mã, không chuyển trang", async () => {
    postMock.mockRejectedValueOnce({ response: { status: 503, data: { extensions: { reason: "SEND_FAILED" } } } });
    const { container } = render(<RegisterPage />);
    fillRegisterForm(container);

    expect(await screen.findByText("verify.sendFailed")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("/v2/verify-email", () => {
  function seedDraft() {
    sessionStorage.setItem("df.pendingSignup", JSON.stringify({
      first: "Nguyen", last: "An", email: "an@example.com", phone: "", locale: "vi",
      expiresInSeconds: 3600, resendAfterSeconds: 60, sentAt: Date.now(),
    }));
  }

  it("không có dữ liệu đăng ký ⇒ đưa về form đăng ký", async () => {
    render(<VerifyEmailPage />);
    expect(await screen.findByText("verify.missingTitle")).toBeTruthy();
  });

  it("dán đủ 6 số ⇒ tự gửi verify, thành công ⇒ onboarding", async () => {
    seedDraft();
    postMock.mockResolvedValueOnce({ data: { accessToken: "a", role: "STUDENT", orgId: null, orgRole: null } });
    const { container } = render(<VerifyEmailPage />);
    await screen.findByText("verify.title");
    const input = container.querySelector('input[name="code"]') as HTMLInputElement;
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");

    fireEvent.change(input, { target: { value: "12 34 56" } });

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/v2/onboarding"));
    expect(postMock).toHaveBeenCalledWith("/auth/register/verify", { email: "an@example.com", code: "123456" });
    expect(sessionStorage.getItem("df.pendingSignup")).toBeNull();
  });

  it("sai mã ⇒ câu có số lần còn lại; LOCKED ⇒ câu 'gửi mã mới'", async () => {
    seedDraft();
    postMock
      .mockRejectedValueOnce({ response: { status: 400, data: { extensions: { reason: "INVALID_CODE", remainingAttempts: 3 } } } })
      .mockRejectedValueOnce({ response: { status: 400, data: { extensions: { reason: "LOCKED" } } } });
    const { container } = render(<VerifyEmailPage />);
    await screen.findByText("verify.title");
    const input = container.querySelector('input[name="code"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: "000000" } });
    expect(await screen.findByText("verify.wrongWithRemaining|3")).toBeTruthy();

    fireEvent.change(input, { target: { value: "111111" } });
    expect(await screen.findByText("verify.locked")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("nút gửi lại bị khoá trong lúc đếm ngược", async () => {
    seedDraft();
    render(<VerifyEmailPage />);
    const btn = await screen.findByRole("button", { name: /verify\.resendIn/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
