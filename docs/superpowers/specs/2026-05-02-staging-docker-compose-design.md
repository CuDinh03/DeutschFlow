# Staging Docker Compose (milestone A) — design spec

**Date:** 2026-05-02  
**Goal:** Repeatable staging stack for internal/demo: **Postgres + Spring Boot backend + Next.js frontend** in Docker Compose (`compose kiểu 2`).  
**Non-goals (pha sau):** production hosting, full CI/CD, Grafana, automated backups, load testing, password reset, pronunciation scoring, guided prompts.

## Context

- Backend: Spring Boot 3.2, Flyway, PostgreSQL, Actuator `/actuator/health`.
- Frontend: Next.js 14 (`frontend/`), proxies `/api/*` via `next.config.mjs` using:

  ```text
  destination = `${backendUrl}/api/:path*`
  where backendUrl =
    NEXT_PUBLIC_BACKEND_URL || BACKEND_URL || 'http://localhost:8080'
  ```

  Rewrite runs **inside the Next server**. In Compose, `BACKEND_URL` must point at the **backend service name**, not `localhost`.

## Architecture

Three services on one Compose network (`deutschflow`):

| Service     | Role | Notes |
|------------|------|--------|
| `db`       | PostgreSQL | Persistent volume for data; Flyway owns schema. |
| `backend`  | JVM app | Waits for DB healthy; JDBC URL hostname `db`. |
| `frontend` | Next.js | **Build arg** internal API base `http://backend:8080` so rewrites resolve from inside the frontend container. |

Browser → `http://localhost:3000` (published frontend port) → Next rewrites `/api/*` → `http://backend:8080/api/*` over the Compose network.

**SSE:** Client uses same-origin `/api/...`; Next forwards to backend; no extra CORS for API if all traffic goes through the rewrite.

## Configuration

- **Root file:** `docker-compose.yml` (and optionally `docker-compose.override.example.yml` for local secrets).
- **Env:** Reuse semantics of `.env.example` (`DB_*`, `JWT_*`, etc.). Compose passes these into `backend`; do not bake secrets into images.
- **Frontend build-time:** Set `BACKEND_URL=http://backend:8080` (and optionally `NEXT_PUBLIC_BACKEND_URL` only if truly needed client-side — today most traffic uses relative `/api`).

## Dockerfiles

1. **`backend/Dockerfile` (staging)**  
   - Multi-stage: build JAR with `./mvnw -DskipTests package` (or equivalent), run with slim JRE image.  
   - Default CMD runs the fat JAR.  
   - Document required env vars (`DB_HOST=db`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS` pointing at published frontend URL e.g. `http://localhost:3000`).

2. **`frontend/Dockerfile` (staging)**  
   - Build: `npm ci` + `next build` with `ARG BACKEND_URL=http://backend:8080` → `ENV BACKEND_URL=...` so `next.config.mjs` picks it at build time.  
   - Run: `next start`; expose `3000`.  
   - If later you need wholly runtime-configurable backend URL without rebuild, that is a separate change (middleware or external reverse proxy); **out of scope for this spec**.

## Compose behaviour

- `depends_on` with **healthcheck** on `db` before `backend` starts.
- Named volume for Postgres data (e.g. `deutschflow_pgdata`).
- Published ports: `3000` (frontend), `8080` (backend optional — expose only if you want direct API access for debugging; otherwise can omit public `8080` and force `/api` via Next only).
- **CORS:** `CORS_ALLOWED_ORIGINS` must include the URL users type in the browser (e.g. `http://localhost:3000`).

## Operational smoke tests

1. `docker compose up --build`
2. Backend health: Compose **healthcheck** should call `GET http://backend:8080/actuator/health` internally. From the host, use `curl` only if backend port `8080` is published. Do **not** use `http://localhost:3000/api/actuator/...` — Next rewrites `/api/*` → `backendUrl/api/*`, while Actuator lives at **`/actuator/*`** on the JVM (not under `/api`).
3. Open `http://localhost:3000`; smoke login / main flow once.

## Risks / follow-ups

- **JWT_SECRET** must be ≥ 32 chars; invalid config fails startup (fail-fast is good).
- **First-time Flyway:** same rules as local; migrations in `classpath:db/migration`.
- **Mac ARM / build time:** multi-stage Maven in Docker can be slow; acceptable for staging A.

## Self-review checklist

| Check | Status |
|--------|--------|
| Placeholders removed | OK |
| Consistent with `next.config.mjs` | OK |
| Scope = staging A only | OK |

---

**Approval:** Aligns with milestone **A** and compose choice **2** (backend + Postgres + frontend).

Next step after you approve this file: implementation (Dockerfiles, `docker-compose.yml`, README snippet) via a short implementation plan.
