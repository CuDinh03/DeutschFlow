# Contributing to DeutschFlow

## Commit Convention (Conventional Commits)

Use the format: `<type>(<scope>): <subject>`

**Types**:
- `feat` – new feature
- `fix` – bug fix
- `refactor` – code change that neither fixes a bug nor adds a feature
- `chore` – maintenance, deps, config (no production code change)
- `docs` – documentation only
- `test` – adding or fixing tests
- `perf` – performance improvement
- `style` – formatting, missing semicolons, etc. (no code change)
- `ci` – CI/CD config changes
- `security` – security-related changes

**Examples**:
```
feat(speaking): add interview mode resume after disconnect
fix(payment): correct MoMo IPN signature verification
refactor(grammar): extract lego validator into module
chore(deps): bump spring-boot to 3.2.6
docs(api): document /api/auth/refresh response
```

**Avoid**:
- `deploy: auto-commit YYYY-MM-DD HH:MM` — use git tags (`git tag v1.2.3 && git push --tags`) for deploy markers, not commits
- `fix build` / `update` / `wip` — be specific
- Lowercase subject after type colon (use sentence case if needed)

## Branching

- `main` — production-ready
- `feat/<short-name>` — new feature
- `fix/<short-name>` — bug fix
- `chore/<short-name>` — maintenance
- `docs/<short-name>` — docs only

Create a PR for any non-trivial change. Branch protection on `main` requires CI green + 1 review.

## Repository Hygiene

**Never commit**:
- `.env`, `.env.local`, `.env.production` (gitignored)
- `*.pem`, `*.key`, `*.crt` (gitignored)
- Build artifacts: `dist/`, `.next/`, `target/`, `node_modules/`
- Logs: `*.log`, `prompt_log.txt`, `start_log.txt`, `build_log.txt`
- Test artifacts: `playwright-report/`, `test-results/`, `*.tsbuildinfo`
- Real credentials in test/example files

**Where things go**:
- Ad-hoc deploy/debug scripts → `scripts/deploy/`
- Smoke tests → `scripts/smoke-test/`
- Backend dev scripts → `backend/scripts/`
- Load tests → `scripts/load-test/`
- Internal docs → `docs/` (gitignored by default; coordinate with team if pushing)

## Local Development

See `docs/CLAUDE.md` for full local setup.

Quick start:
```bash
# Backend
cd backend && ./mvnw spring-boot:run

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Mobile (Expo — separate terminal)
cd mobile && npm install && npm start
```

**Mobile app** (Expo React Native in `mobile/`): see **`mobile/DEVELOPMENT.md`** for the full dev/version/build/submit + OTA (EAS Update) guide.
