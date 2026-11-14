import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// `unstable_cache` của Next cần incrementalCache của runtime Next, không có trong vitest → cho đi
// thẳng tới hàm gốc. Test vẫn đọc được tham số đăng ký (vi.fn) để kiểm thời gian giữ cache.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

// `next/font/local` chỉ chạy được qua trình biên dịch của Next (ngoài đó hàm gốc ném lỗi) → trong vitest trả
// về lớp giả. Dùng bởi phông trang trí của áp phích rao vặt (components/exam/poster/posterFonts.ts).
vi.mock("next/font/local", () => ({
  default: (options: { variable?: string }) => ({
    className: "font-local-mock",
    variable: options?.variable ? `font-var${options.variable.replace(/^--/, "-")}` : "",
    style: { fontFamily: "mock" },
  }),
}));
