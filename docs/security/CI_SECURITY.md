# CI security scanning (S21)

Workflow: `.github/workflows/security-ci.yml`. Runs on every PR + push to `main`, weekly, and on demand.

## What runs

| Job | Tool | Scope | Mode |
|---|---|---|---|
| Secret scan | **gitleaks** | whole repo + history | **Blocking** (repo is clean today) |
| SAST | **Semgrep** (`p/security-audit`, `p/owasp-top-ten`, `p/secrets`) | JS/TS + Java | Report-only → SARIF artifact + logs |
| Dependency audit (JS) | **npm audit** `--audit-level=high` | `frontend/`, `mobile/` | Report-only |
| Dependency audit (Java) | **OWASP Dependency-Check** `--failOnCVSS 8` | `backend/` | Weekly + manual → HTML artifact |

## Why not CodeQL (yet)

This repo is **private without GitHub Advanced Security**, so Code-scanning / SARIF upload to the
Security tab is unavailable (it 403s). CodeQL's value comes from that upload, so we use **Semgrep**
(works on private repos, no GHAS) for SAST instead. Findings are in the job log + the `semgrep-sarif`
artifact.

**Enable CodeQL** when GHAS / Code scanning is turned on (Settings → Code security): replace the
`sast` job with:
```yaml
  codeql:
    runs-on: ubuntu-latest
    permissions: { security-events: write, actions: read, contents: read }
    strategy:
      fail-fast: false
      matrix:
        include:
          - { language: javascript-typescript, build-mode: none }
          - { language: java-kotlin, build-mode: autobuild }
    steps:
      - uses: actions/checkout@v4
      - if: matrix.language == 'java-kotlin'
        uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17', cache: maven }
      - uses: github/codeql-action/init@v3
        with: { languages: '${{ matrix.language }}', build-mode: '${{ matrix.build-mode }}', queries: security-extended }
      - uses: github/codeql-action/analyze@v3
        with: { category: '/language:${{ matrix.language }}' }
```

## Tuning

- **Make scans blocking:** drop the trailing `|| true` from the Semgrep / npm-audit steps after
  triaging the current baseline. gitleaks already blocks.
- **De-flake OWASP DC:** add an `NVD_API_KEY` repo secret (free from nvd.nist.gov) — without it the
  NVD download is slow/rate-limited (which is why it's off the PR path).
- **Promote to required checks:** Settings → Branches → protect `main` → require `secret-scan`
  (and any others once blocking).
