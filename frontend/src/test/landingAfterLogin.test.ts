/**
 * `landingAfterLogin` — cổng quay lại onboarding sau đăng nhập (Đợt 0, 17/09).
 * Bản cũ đưa mọi STUDENT về dashboard, kể cả người bỏ dở phễu (hasPlan=false) → dashboard rỗng.
 */
import { describe, it, expect } from "vitest";
import { landingAfterLogin, homeFor } from "@/lib/roleRouting";

describe("landingAfterLogin", () => {
  it.each<[string, string, { orgRole?: string | null; hasPlan?: boolean }, string]>([
    ["STUDENT chưa có lộ trình", "STUDENT", { hasPlan: false }, "/v2/onboarding"],
    ["STUDENT đã có lộ trình", "STUDENT", { hasPlan: true }, "/v2/student/dashboard"],
    ["STUDENT không hỏi được status (lỗi mạng → coi như có plan)", "STUDENT", {}, "/v2/student/dashboard"],
    ["TEACHER không bao giờ vào phễu dù hasPlan=false", "TEACHER", { hasPlan: false }, "/v2/teacher"],
    ["OWNER về console", "OWNER", { hasPlan: false }, "/v2/org"],
    ["ADMIN về danh sách người dùng", "ADMIN", { hasPlan: false }, "/v2/admin/users"],
    ["TEACHER legacy điều hành trung tâm", "TEACHER", { orgRole: "MANAGER", hasPlan: false }, "/v2/org"],
  ])("%s", (_name, role, options, expected) => {
    expect(landingAfterLogin(role, options)).toBe(expected);
  });

  it("khi hasPlan không phải false thì y hệt homeFor (không đổi hành vi cũ)", () => {
    for (const role of ["STUDENT", "TEACHER", "MANAGER", "OWNER", "ADMIN"]) {
      expect(landingAfterLogin(role, { hasPlan: true })).toBe(homeFor(role));
      expect(landingAfterLogin(role)).toBe(homeFor(role));
    }
  });
});
