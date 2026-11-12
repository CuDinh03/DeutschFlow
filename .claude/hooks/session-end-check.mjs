#!/usr/bin/env node
// Stop hook — chạy mỗi khi agent định kết thúc lượt. Hai việc:
//
// 1. Quét secret trong diff đã stage (chỉ cảnh báo, không chặn).
// 2. Chặn "báo xong khi chưa kiểm": nếu TRONG LƯỢT NÀY (từ tin nhắn gần nhất của người dùng) agent đã sửa code giao diện (web/mobile)
//    mà không có dấu vết chạy thử thật (browser pane, Chrome, Playwright, simulator, computer use),
//    hoặc sửa code backend mà chưa chạy test — chặn MỘT lần, yêu cầu kiểm thử hoặc nói rõ trong
//    tin nhắn cuối là chưa kiểm được. Lần dừng thứ hai (stop_hook_active) luôn cho qua: không lặp.
//
// Lỗi bất kỳ (không đọc được transcript, không có git…) ⇒ cho qua. Hook không bao giờ làm kẹt phiên.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bghp_[A-Za-z0-9]{30,}/,
  /\bxox[bpars]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}/,
];

// File giao diện: web (frontend/src) và mobile (trừ test, story, tài liệu).
const UI_FILE = /(^|[\\/])(frontend[\\/]src|mobile[\\/](app|src|components))[\\/].*\.(tsx|ts|jsx|js|css|scss)$/i;
const BACKEND_FILE = /(^|[\\/])backend[\\/]src[\\/]main[\\/].*\.(java|kt|sql|ya?ml|properties)$/i;
const TEST_FILE = /(\.test\.|\.spec\.|__tests__|[\\/]test[\\/]|\.stories\.)/i;

// Dấu vết đã chạy thử giao diện thật.
const UI_EVIDENCE_TOOL = /^mcp__(Claude_Browser|claude-in-chrome|computer-use|remote-devices)__/;
const UI_EVIDENCE_CMD = /\b(playwright|xcrun\s+simctl|maestro|detox|adb\s+shell|expo\s+start)\b/i;
// Dấu vết đã chạy test backend.
const BACKEND_EVIDENCE_CMD = /\b(gradlew?(\.bat)?\s+[^\n]*\b(test|check|build)\b|mvnw?(\.cmd)?\s+[^\n]*\b(test|verify|package)\b)/i;

function secretScan() {
  try {
    const diff = execSync("git diff --cached --no-color", { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] });
    const hits = SECRET_PATTERNS.filter((p) => p.test(diff));
    if (hits.length > 0) {
      console.error(`[Stop] WARN: ${hits.length} mẫu giống secret trong diff đã stage — xem lại trước khi commit.`);
    }
  } catch {
    // Không có git / không có gì stage.
  }
}

function toolUses(transcriptPath) {
  const uses = [];
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = entry?.message?.content;
    // Chỉ xét lượt hiện tại: tin nhắn thật của người dùng (không phải tool_result) ⇒ bắt đầu lại.
    if (entry?.type === "user" && isHumanMessage(content)) { uses.length = 0; continue; }
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "tool_use") uses.push({ name: String(part.name ?? ""), input: part.input ?? {} });
    }
  }
  return uses;
}

function isHumanMessage(content) {
  if (typeof content === "string") return true;
  return Array.isArray(content) && content.some((p) => p?.type === "text") && !content.some((p) => p?.type === "tool_result");
}

function verificationGap(uses) {
  const edited = new Set();
  let uiEvidence = false;
  let backendEvidence = false;
  for (const { name, input } of uses) {
    if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(name)) {
      const p = String(input.file_path ?? input.notebook_path ?? "");
      if (p) edited.add(p);
    }
    if (UI_EVIDENCE_TOOL.test(name)) uiEvidence = true;
    if (name === "Bash" || name === "PowerShell") {
      const cmd = String(input.command ?? "");
      if (UI_EVIDENCE_CMD.test(cmd)) uiEvidence = true;
      if (BACKEND_EVIDENCE_CMD.test(cmd)) backendEvidence = true;
    }
  }
  const files = [...edited].filter((p) => !TEST_FILE.test(p));
  const ui = files.filter((p) => UI_FILE.test(p));
  const backend = files.filter((p) => BACKEND_FILE.test(p));
  const gaps = [];
  if (ui.length && !uiEvidence) {
    gaps.push(`đã sửa ${ui.length} file giao diện (vd. ${short(ui[0])}) nhưng chưa thấy chạy thử thật trên trình duyệt / Playwright / simulator`);
  }
  if (backend.length && !backendEvidence) {
    gaps.push(`đã sửa ${backend.length} file backend (vd. ${short(backend[0])}) nhưng chưa thấy chạy test (gradlew/mvn)`);
  }
  return gaps;
}

function short(p) {
  const parts = p.split(/[\\/]/);
  return parts.slice(-3).join("/");
}

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* không có stdin */ }

secretScan();

try {
  if (!input.stop_hook_active && input.transcript_path) {
    const gaps = verificationGap(toolUses(input.transcript_path));
    if (gaps.length) {
      process.stdout.write(JSON.stringify({
        decision: "block",
        reason:
          "Kiểm tra cuối phiên: " + gaps.join("; ") + ". " +
          "Hãy chạy kiểm thử phù hợp ngay bây giờ (hoặc giao cho subagent). Nếu thật sự không kiểm được " +
          "(thiếu môi trường, cần thiết bị thật…), nói rõ trong tin nhắn cuối là PHẦN NÀO CHƯA ĐƯỢC KIỂM và vì sao — " +
          "không được báo là đã xong/đã chạy được.",
      }));
    }
  }
} catch {
  // Không đọc được transcript ⇒ cho qua.
}
