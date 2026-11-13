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
