#!/usr/bin/env node
// PreToolUse Bash guard — defense-in-depth beyond permissions.deny.
// Reads hook input JSON from stdin, exits 2 (blocks the tool call) if the
// command matches any dangerous pattern below. Patterns intentionally
// conservative so legitimate dev workflows are not blocked.

let data = "";
process.stdin.on("data", (chunk) => {
  data += chunk;
});
process.stdin.on("end", () => {
  let cmd = "";
  try {
    const input = JSON.parse(data);
    cmd = (input && input.tool_input && input.tool_input.command) || "";
  } catch {
    // Malformed input — let the call through; the harness will surface its own error.
    return;
  }

  const dangerousPatterns = [
    /\brm\s+-rf\s+(\/|~|\$HOME)/,
    /\bsudo\b/,
    /\bgit\s+push\s+(--force|-f)\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\b(curl|wget)\b.*\|\s*(sh|bash|zsh)\b/,
    /\bmkfs\./,
    /\bdd\s+if=/,
    />\s*\/dev\/(sd[a-z]|nvme|disk)/,
    /\bchmod\s+-?R?\s*777\b/,
    /\bssh\s+/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) {
      console.error(
        `[PreToolUse] BLOCKED dangerous pattern: ${pattern.source}`
      );
      process.exit(2);
    }
  }
});
