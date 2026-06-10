#!/usr/bin/env node
// Stop hook — runs at session end. Scans the working tree for accidentally
// committed-style secret patterns in staged/uncommitted changes. Pure audit:
// always exits 0 so it never blocks session end; emits a warning on stderr
// for the operator if anything looks suspicious.

import { execSync } from "node:child_process";

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bghp_[A-Za-z0-9]{30,}/,
  /\bxox[bpars]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}/,
];

try {
  const diff = execSync("git diff --cached --no-color 2>/dev/null", {
    encoding: "utf8",
    timeout: 4000,
  });
  const hits = SECRET_PATTERNS.filter((pattern) => pattern.test(diff));
  if (hits.length > 0) {
    console.error(
      `[Stop] WARN: ${hits.length} suspicious secret pattern(s) detected in staged diff — review before committing.`
    );
  }
} catch {
  // No git, no staged changes, or git not available — nothing to verify.
}
