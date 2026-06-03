# S18 — JWT HS256 → RS256 migration plan (design only)

> **Status:** PLAN (no code changed). Needs your sign-off on the open decisions (§9) before implementation.
> **Goal:** stop sharing the JWT *signing* secret with the frontend. Today both the backend and the
> Next.js/Amplify edge hold the same symmetric `JWT_SECRET` (HS256) — if **either** leaks, an attacker
> can forge tokens. With RS256, the backend signs with a **private** key that never leaves it, and every
> verifier holds only the **public** key (safe to distribute).

## 1. Current state (grounded in code)

| Piece | File | Today |
|---|---|---|
| Signer + verifier (backend) | [JwtService.java](../../backend/src/main/java/com/deutschflow/common/security/JwtService.java) | HS256 via `Keys.hmacShaKeyFor`; `signWith(signingKey)`; multi-key verify list (primary + `secret-previous`); enforces secret ≥32 bytes; sets `iss`/`aud`; optional `require-iss-aud` |
| Request auth (backend) | [JwtAuthFilter.java](../../backend/src/main/java/com/deutschflow/common/security/JwtAuthFilter.java) | `jwtService.isTokenValid` / `extractClaims` |
| Verifier (web edge) | [middleware.ts](../../frontend/middleware.ts) | `jose.jwtVerify(token, TextEncoder().encode(JWT_SECRET))` — **same secret** as backend |
| Secret distribution | [amplify.yml](../../amplify.yml) | build aborts unless `JWT_SECRET` is set (must equal backend's) |
| Config | [application.yml](../../backend/src/main/resources/application.yml) | `app.jwt.secret`, `secret-previous`, `access-token-expiry-ms=900000` (15m), `refresh-token-expiry-ms=604800000` (7d), `issuer`, `audience`, `require-iss-aud` |

**Scope — what RS256 touches:** only the **JWT access token** and the **guest/quiz token** (both signature-verified by the middleware + filter). The **refresh token is validated against the DB** (`refreshTokenRepository.findByToken` in [AuthService.java](../../backend/src/main/java/com/deutschflow/user/service/AuthService.java)) — it is **not** signature-verified, so it is unaffected. Mobile (Expo) verifies nothing locally (it just sends the bearer token) → no mobile change.

The codebase already practises zero-downtime key rotation (`secret-previous` + a multi-key verify list) — we reuse exactly that muscle.

## 2. Target state

- Backend **signs** access/guest tokens with an **RSA private key** (RS256); private key only in backend env.
- Backend + web edge **verify** with the **RSA public key** only.
- `JWT_SECRET` (the shared symmetric secret) is **removed from Amplify** at the end.

## 3. Key management (decision A vs B)

**Generate a keypair (one-time)** — easiest: `./backend/scripts/generate-jwt-keypair.sh` prints both
keys already `\n`-escaped for env. Or by hand (note: `genpkey` outputs PKCS#8 by default — no `-pkcs8` flag):
```bash
openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
```

- **Option A — static public key via env (recommended for the cutover).** Private PEM → backend `JWT_RSA_PRIVATE_KEY`; public PEM → backend + Amplify `JWT_RSA_PUBLIC_KEY`. Simplest; mirrors today's env model. Rotation = redeploy with a new key (using the dual-key verify list, same as `secret-previous`).
- **Option B — JWKS endpoint (recommended for ongoing rotation).** Backend serves the public key(s) at `GET /api/auth/jwks` (or `/.well-known/jwks.json`), `permitAll`. Web edge verifies via `jose.createRemoteJWKSet(url)` (cached). Rotation needs **no frontend redeploy** — publish the new key in JWKS, sign with it, retire the old after the access-token TTL.

> **Env/PEM gotcha:** PEM has newlines. Store as single-line with `\n` escapes (and un-escape on load) or base64-encode the DER. Document whichever you pick; it's the #1 source of "invalid key" bugs.

## 4. Backend changes (`JwtService`)

- Add config: `app.jwt.algorithm` (`HS256`|`RS256`, default `HS256`), `app.jwt.rsa-private-key`, `app.jwt.rsa-public-key` (+ `rsa-public-key-previous` for rotation).
- **Signing key** = symmetric secret (HS256) *or* RSA private key (RS256), chosen by `algorithm`.
- **Verify list** becomes `List<Key>` holding *both* the HS256 `SecretKey`(s) **and** the RSA `PublicKey`(s), so it accepts either during transition. jjwt's `parser().verifyWith(key)` accepts a `SecretKey` or a `PublicKey`; the existing per-key try-loop in `extractClaims` stays.
- Sign sketch (jjwt 0.12):
  ```java
  // HS256: .signWith(secretKey)      RS256: .signWith(rsaPrivateKey, Jwts.SIG.RS256)
  ```
- Load RSA keys from PEM via `KeyFactory.getInstance("RSA")` (`PKCS8EncodedKeySpec` for private, `X509EncodedKeySpec` for public).
- (Option B) add a small `JwksController` (`permitAll` in [SecurityConfig.java](../../backend/src/main/java/com/deutschflow/common/config/SecurityConfig.java)) emitting `{kty,n,e,kid,alg:"RS256",use:"sig"}`.

## 5. Frontend changes (`middleware.ts`)

- Read the token's `alg` (`jose.decodeProtectedHeader`) and verify with the matching key:
  - RS256 → `await importSPKI(process.env.JWT_RSA_PUBLIC_KEY, 'RS256')` (Option A) or `createRemoteJWKSet(new URL(jwksUrl))` (Option B).
  - HS256 → existing `TextEncoder().encode(JWT_SECRET)` (kept only during transition).
- jose fully supports RS256 in the Edge runtime.

## 6. Zero-downtime rollout (the critical part)

**Golden rule: every verifier must accept RS256 *before* the issuer signs with it.**

1. **Prep** — generate keypair; set `JWT_RSA_PRIVATE_KEY` + `JWT_RSA_PUBLIC_KEY` on backend, `JWT_RSA_PUBLIC_KEY` on Amplify (keep `JWT_SECRET` everywhere).
2. **Deploy verifiers (accept both), still sign HS256** — backend `algorithm=HS256` but verify list includes the RSA public key; frontend middleware verifies HS256 **and** RS256. Issued tokens unchanged.
3. **Flip issuer → RS256** — backend `app.jwt.algorithm=RS256`; new access/guest tokens are RS256. Old HS256 tokens (≤15 min) still verify on both sides.
4. **Wait out old tokens** — ≥15 min (access TTL) so all HS256 access tokens expire.
5. **Drop HS256** — remove the HS256 secret from the backend verify list; remove `JWT_SECRET` from **backend and Amplify**; frontend verifies RS256 only. ✅ shared signing secret is gone.

**Rollback (any time before step 5):** set `app.jwt.algorithm=HS256` and redeploy — old + new clients still verify because HS256 is still accepted. No user impact.

## 7. Testing
- Unit (backend): sign RS256 → verify; verify a token signed by the *other* alg (transition); reject tampered/`alg=none`; iss/aud still enforced when `require-iss-aud=true`.
- Integration: hit a protected endpoint with an RS256 token + a (transition) HS256 token.
- Frontend: middleware accepts RS256 + HS256 during transition, RS256-only after.
- Guest/quiz flow: confirm guest tokens (RS256) still authorize quiz submit.

## 8. Effort & risk
- **Effort:** ~1–1.5 days (backend multi-alg + PEM loading + optional JWKS + tests ≈ 1d; frontend dual-verify ≈ ½d; rollout coordination across the EC2 + Amplify deploys).
- **Risk:** medium — PEM/env parsing bugs, deploy-ordering mistakes. Both mitigated by the "verify-both" phase + the `algorithm` rollback flag. Backend CI + the security CI gate each PR.
- **Note (`alg=none`):** jjwt rejects unsigned tokens by default; keep it that way. Never make the verifier "pick alg from the token header" without restricting it to the expected algorithm.

## 9. Decisions for you ✅
1. **Key distribution:** Option A (static env key) for the cutover, or jump straight to Option B (JWKS) for rotation-free key changes? *(Recommend: A now, B as a follow-up.)*
2. **Key size:** 2048 (fine) or 4096?
3. **Rollout timing:** steps 2→5 can be same-day (15-min TTL). Confirm a low-traffic window for step 3.
4. **PEM-in-env encoding:** `\n`-escaped PEM vs base64-DER — pick one convention.

Once you pick, I can implement it as 2 PRs: **(PR-1)** verify-both (backend + frontend, non-breaking), **(PR-2)** flip to RS256 + remove HS256 — sequenced per §6.
