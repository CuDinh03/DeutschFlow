import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCdnUrl } from "@/lib/utils";

describe("getCdnUrl", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns default avatar when key is undefined", () => {
    expect(getCdnUrl(undefined)).toBe("/default-avatar.png");
  });

  it("returns default avatar when key is null", () => {
    expect(getCdnUrl(null)).toBe("/default-avatar.png");
  });

  it("returns key as-is when NEXT_PUBLIC_CLOUDFRONT_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_CLOUDFRONT_URL;
    expect(getCdnUrl("avatars/user1.jpg")).toBe("avatars/user1.jpg");
  });

  it("constructs CDN URL correctly", () => {
    process.env.NEXT_PUBLIC_CLOUDFRONT_URL = "https://cdn.example.com";
    expect(getCdnUrl("avatars/user1.jpg")).toBe(
      "https://cdn.example.com/avatars/user1.jpg"
    );
  });

  it("strips trailing slash from base URL", () => {
    process.env.NEXT_PUBLIC_CLOUDFRONT_URL = "https://cdn.example.com/";
    expect(getCdnUrl("avatars/user1.jpg")).toBe(
      "https://cdn.example.com/avatars/user1.jpg"
    );
  });

  it("strips leading slash from key", () => {
    process.env.NEXT_PUBLIC_CLOUDFRONT_URL = "https://cdn.example.com";
    expect(getCdnUrl("/avatars/user1.jpg")).toBe(
      "https://cdn.example.com/avatars/user1.jpg"
    );
  });

  it("handles both trailing slash on base and leading slash on key", () => {
    process.env.NEXT_PUBLIC_CLOUDFRONT_URL = "https://cdn.example.com/";
    expect(getCdnUrl("/avatars/user1.jpg")).toBe(
      "https://cdn.example.com/avatars/user1.jpg"
    );
  });
});
