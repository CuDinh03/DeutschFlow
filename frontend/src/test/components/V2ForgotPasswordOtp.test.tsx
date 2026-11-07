import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Quên mật khẩu 3 bước (trang mẫu 08/11/2026) + chống dò email: bước 2 giống hệt với mọi email,
// lỗi mã luôn là MỘT câu chung (RESET_CODE_INVALID), không theo `detail` của backend.

const { replaceMock, postMock } = vi.hoisted(() => ({ replaceMock: vi.fn(), postMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

// t() trả KEY; tham số (trừ hàm của t.rich) nối sau dấu | để khẳng định được.
vi.mock("next-intl", () => {
  const translate = (key: string, values?: Record<string, unknown>) => {
    const plain = values ? Object.values(values).filter((v) => typeof v !== "function") : [];
    return plain.length ? `${key}|${plain.join(",")}` : key;
  };
  const t = Object.assign(translate, { rich: translate, has: () => true });
  return { useTranslations: () => t, useLocale: () => "vi" };
});

vi.mock("@/lib/api", () => ({ default: { post: postMock, get: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ForgotPasswordPage from "@/app/v2/forgot-password/page";

function byName(c: HTMLElement, n: string) {
  return c.querySelector(`input[name="${n}"]`) as HTMLInputElement;
}

async function toCodeStep(c: HTMLElement, email = "lan@example.com") {
  fireEvent.change(byName(c, "email"), { target: { value: email } });
  fireEvent.submit(c.querySelector("form") as HTMLFormElement);
  await screen.findByText("forgot.codeTitle");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/v2/forgot-password", () => {
  it("bước 2 dùng câu trung tính có email, ô mã nhận dán và tự sang bước 3", async () => {
    postMock.mockResolvedValueOnce({ status: 204 });
    const { container } = render(<ForgotPasswordPage />);
    await toCodeStep(container);

    expect(postMock).toHaveBeenCalledWith("/auth/forgot-password", { email: "lan@example.com" });
    expect(screen.getByText("forgot.sentNotice|lan@example.com")).toBeTruthy();
    const code = byName(container, "code");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(container.querySelectorAll('[data-slot="otp-cell"]')).toHaveLength(6);

    fireEvent.change(code, { target: { value: "703 561" } });
    expect(await screen.findByText("forgot.resetTitle")).toBeTruthy();
  });

  it("gửi lại bị khoá trong lúc đếm ngược", async () => {
    postMock.mockResolvedValueOnce({ status: 204 });
    const { container } = render(<ForgotPasswordPage />);
    await toCodeStep(container);
    const btn = screen.getByRole("button", { name: /forgot\.resendIn/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("mã hỏng (RESET_CODE_INVALID) ⇒ một câu chung, KHÔNG hiện detail backend; 'Nhập lại mã' quay về bước 2", async () => {
    postMock
      .mockResolvedValueOnce({ status: 204 })
      .mockRejectedValueOnce({
        response: { status: 400, data: { detail: "Không tìm thấy tài khoản.", extensions: { code: "RESET_CODE_INVALID" } } },
      });
    const { container } = render(<ForgotPasswordPage />);
    await toCodeStep(container);
    fireEvent.change(byName(container, "code"), { target: { value: "123456" } });
    await screen.findByText("forgot.resetTitle");

    fireEvent.change(byName(container, "new-password"), { target: { value: "MatKhauMoi9!" } });
    fireEvent.change(byName(container, "confirm-password"), { target: { value: "MatKhauMoi9!" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText("forgot.codeRejected")).toBeTruthy();
    expect(screen.queryByText(/Không tìm thấy tài khoản/)).toBeNull();
    expect(postMock).toHaveBeenLastCalledWith("/auth/reset-password", {
      email: "lan@example.com", code: "123456", newPassword: "MatKhauMoi9!",
    });

    fireEvent.click(screen.getByRole("button", { name: "forgot.reenterCode" }));
    expect(await screen.findByText("forgot.codeTitle")).toBeTruthy();
    expect(byName(container, "code").value).toBe("");
  });

  it("đặt lại thành công ⇒ về /v2/login", async () => {
    postMock.mockResolvedValueOnce({ status: 204 }).mockResolvedValueOnce({ status: 204 });
    const { container } = render(<ForgotPasswordPage />);
    await toCodeStep(container);
    fireEvent.change(byName(container, "code"), { target: { value: "123456" } });
    await screen.findByText("forgot.resetTitle");
    fireEvent.change(byName(container, "new-password"), { target: { value: "MatKhauMoi9!" } });
    fireEvent.change(byName(container, "confirm-password"), { target: { value: "MatKhauMoi9!" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/v2/login"));
  });

  it("429 khi xin mã ⇒ câu 'thao tác quá nhanh', ở lại bước 1", async () => {
    postMock.mockRejectedValueOnce({ response: { status: 429, data: {} } });
    const { container } = render(<ForgotPasswordPage />);
    fireEvent.change(byName(container, "email"), { target: { value: "lan@example.com" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(await screen.findByText("forgot.tooMany")).toBeTruthy();
    expect(screen.queryByText("forgot.codeTitle")).toBeNull();
  });
});
