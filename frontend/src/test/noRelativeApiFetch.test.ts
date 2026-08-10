import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard: cấm gọi fetch() với đường dẫn tương đối "/api/..." trong src.
 *
 * Frontend được host tách khỏi backend (Amplify ↔ EC2), nên fetch tương đối
 * đánh vào host frontend → 404 ÂM THẦM (fetch không throw theo status).
 * Mọi lời gọi backend phải đi qua axios client `@/lib/api` (baseURL
 * NEXT_PUBLIC_BACKEND_URL, kèm token + refresh). Bằng chứng thực tế:
 * nút "Lưu Flashcard" (ReadingView) và TTS giọng persona (useSpeech) từng
 * 404 lặng lẽ trên prod vì pattern này.
 */

// Các file CÒN vi phạm, đã có kế hoạch khắc phục riêng. KHÔNG thêm mục mới.
const ALLOWLIST = new Set<string>([
  // TTS giọng persona — QA prod 2026-08-09, sửa trong plan khắc phục Speaking.
  "src/hooks/useSpeech.ts",
]);

// fetch( + quote + /api/  — chỉ bắt đường dẫn tương đối, không bắt URL tuyệt đối.
const RELATIVE_API_FETCH = /fetch\(\s*[`'"]\/api\//;

/** true nếu file chứa fetch tương đối /api trên dòng code (bỏ qua dòng comment). */
function hasRelativeApiFetch(file: string): boolean {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .some((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return false;
      return RELATIVE_API_FETCH.test(line);
    });
}

const SRC_DIR = path.resolve(__dirname, "..");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelative(file: string): string {
  return "src/" + path.relative(SRC_DIR, file).split(path.sep).join("/");
}

describe("không fetch() đường dẫn tương đối /api", () => {
  const files = collectSourceFiles(SRC_DIR);

  it("mọi file ngoài allowlist không được gọi fetch tương đối /api", () => {
    const offenders = files
      .filter((f) => !ALLOWLIST.has(toRepoRelative(f)))
      .filter(hasRelativeApiFetch)
      .map(toRepoRelative);

    expect(offenders, "Dùng api client @/lib/api thay vì fetch tương đối").toEqual([]);
  });

  it("allowlist chỉ chứa file còn thật sự vi phạm (đã sửa thì gỡ khỏi allowlist)", () => {
    const stale = Array.from(ALLOWLIST).filter((rel) => {
      const full = path.join(SRC_DIR, rel.replace(/^src\//, ""));
      return !fs.existsSync(full) || !hasRelativeApiFetch(full);
    });

    expect(stale, "Các mục allowlist này đã sạch — hãy gỡ chúng").toEqual([]);
  });
});
