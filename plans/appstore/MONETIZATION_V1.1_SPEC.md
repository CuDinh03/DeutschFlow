# DeutschFlow v1.1 — Monetization Spec

> **Status: PLAN — not built. v1.0 ships FREE-ONLY first (~6–7 July 2026); v1.1 (~2 weeks later) adds monetization.**

v1.1 turns on the money layer without touching v1.0's free experience. It introduces **three consumer tiers** — a 7-day PRO-LITE trial, an ad-gated post-trial free tier, and paid PRO — funded by two mechanisms: **AdMob non-personalized rewarded ads** (free tier earns metered AI Speaking) and **Apple IAP** (paid PRO, backend already built). The dominant variable cost is Whisper STT, so the whole ad economy is **gated by audio-seconds (a 15-second mic cap), not sentences or tokens.** No ATT prompt, no IDFA, `NSPrivacyTracking` stays `false`. All native additions ride in **one** new production build (not OTA).

## Table of contents

1. [Tier model & user experience](#1-tier-model--user-experience)
2. [Rewarded-ad mechanics](#2-rewarded-ad-mechanics)
3. [Economics & margin](#3-economics--margin)
4. [Backend implementation](#4-backend-implementation)
5. [Mobile implementation (ads)](#5-mobile-implementation-ads)
6. [Paid PRO (Apple IAP)](#6-paid-pro-apple-iap)
7. [Legal & App Privacy (re-add for v1.1)](#7-legal--app-privacy-re-add-for-v11)
8. [Build & submission sequencing](#8-build--submission-sequencing-v11)
9. [Open questions / calibration](#9-open-questions--calibration)

---

## 1. Tier model & user experience

DeutschFlow v1.1 has exactly **three consumer-facing states**, all driven by the existing `subscription_plans` / `user_subscriptions` ledger. No new plan codes are introduced — the states map onto plan codes that already exist and are seeded by migration `V73__subscription_plans_v2.sql`.

| State | Plan code (DB) | AI daily budget | Personas | How AI is unlocked | Ads | Sold via |
|---|---|---|---|---|---|---|
| **Trial (PRO-LITE taste)** | `FREE` | **9 000 tokens/day** (`daily_token_grant`, V73:32) | Emma + Anna only (`allowedPersonas`, V73:42; `maxPersonas: 2`) | Automatic for first **7 days** of every new DEFAULT account | **None** | — (auto-granted) |
| **Post-trial free (ad-gated)** | `DEFAULT` | **0 base tokens/day** (V73:8) | Emma + Anna (speaking only, via reward credits) | Watch a **rewarded ad → 2 speaking turns**, mic hard-capped at 15 s each; ~5 ads/day | **Rewarded only** (non-personalized) | — (earned, consumable) |
| **Paid PRO** | `PRO` | **400 000 tokens/day**, 30-day rollover wallet (V73:57, `wallet_cap_days: 30`) | All 4 personas, streaming, interview, voice clone (V73:59-78) | Automatic while subscription is `ACTIVE` | **None** | **Apple IAP** (`expo-iap`) |

> `ULTRA` (V73:80) stays **inactive** in v1.1 per the 2026-07-03 lock (v1.0 PRO-only). `INTERNAL` is staff-only. `publicTier()` (`QuotaService.java:646`) already collapses `FREE`→`DEFAULT` and `ULTRA/INTERNAL`→`ULTRA`, so no client label changes are needed.

### 1.1 Trial: a deliberately imperfect PRO taste

The 7-day trial is **unchanged from today**. A new account is provisioned `FREE`, and `reconcileSubscriptions()` stamps `ends_at = starts_at + 7 days` (`QuotaService.java:410-418`). While active, the user gets the 9 000-token/day `FREE` budget and the two-persona roster — enough to feel AI Speaking work end-to-end, but **not** the full-quality PRO experience (no streaming, no interview mode, no voice clone, only 2 personas). This gap is intentional: it seeds desire without giving the product away.

Trial expiry is enforced on the hot path **before** the DB reconcile job runs, via the 7-day virtual check in `assertAllowed()` (`QuotaService.java:71-76`) — so a user whose trial lapsed cannot keep calling AI just because the async reconcile hasn't fired yet. On expiry the account falls to `DEFAULT` (0 tokens) and enters the ad-gated free state.

### 1.2 Post-trial free: AI is earned, one ad at a time

`DEFAULT` grants **0 tokens/day**, so `assertAllowed()` throws `QuotaExceededException` (`QuotaService.java:77`) on any AI call by default. The only way a free user reaches AI Speaking is to spend **rewarded-ad credits** (see §2). Everything non-AI stays free (swipe cards, Lego builder, vocab lookup, SRS review) exactly as V73 defines for `DEFAULT`.

### 1.3 Paid PRO: the real premium

PRO is the honest upgrade target: a large 400k/day wallet, all personas, streaming, interview mode, **and no ads**. Purchased through Apple IAP using the already-built backend (`AppleIapController` at `/api/payments/apple/*`, migration V189). The mobile client flips the current PRO gate: the voice-recording path in `speaking.tsx:340-344` currently blocks non-PRO users outright (`if (!isPro) { Alert.alert('Tính năng PRO'…) }`) — in v1.1 that branch is replaced by "PRO → unlimited within budget; free → consume an ad credit; no credit → show rewarded-ad offer."

---

## 2. Rewarded-ad mechanics

The free tier's speaking loop is: **watch one rewarded ad → receive 2 speaking turns → each turn's mic recording is hard-capped at 15 seconds (timer starts at mic-tap, client auto-stops) → credits are consumable and expire.** Cap ~5 ads/day. This is the only monetization path for free users besides upgrading.

### 2.1 The exact flow

| Step | Actor | Behaviour |
|---|---|---|
| 1. Offer | Client | Free user taps the mic with **0 credits** → present the AdMob rewarded ad (react-native-google-mobile-ads, **non-personalized**, `requestNonPersonalizedAdsOnly: true`). |
| 2. Reward | AdMob → backend | On a genuine completed impression, **Google's SSV callback** credits **2 consumable speaking turns** (30 audio-seconds) to the user. Server-authoritative — never trust a client counter (see §4.2). |
| 3. Turn start | Client | On mic-tap, if `turnsRemaining > 0`, decrement by 1 and begin recording. Mic uses the existing `recorder.record()` path (`speaking.tsx:367`). |
| 4. **15 s hard cap** | Client | A timer starts **at mic-tap** and **auto-stops** the recording at 15 000 ms by calling the existing `stopRecordingAndTranscribe()` (`speaking.tsx:380`). The user cannot exceed 15 s; the cap is what bounds STT cost (§3). |
| 5. Transcribe & reply | Backend | Unchanged: `POST /ai-speaking/transcribe` runs Whisper, `recordStt(...)` logs real `durationSeconds` (`AiSessionController.java:118`), then chat + TTS reply. |
| 6. Exhausted | Client | After 2 turns the credits hit 0 → next mic-tap re-offers an ad, up to **~5 ads/day** (server-enforced daily cap → max ~10 turns/day for free). |

### 2.2 The 15-second cap (client implementation)

The current recorder has **no time limit** — a user can hold the mic indefinitely and `stopRecordingAndTranscribe()` only fires on the second tap (`speaking.tsx:699`). v1.1 must add an auto-stop timer set at `record()`:

- Start a `setTimeout(15_000)` immediately after `recorder.record()` (`speaking.tsx:367`) that calls `stopRecordingAndTranscribe()`. `MAX_FREE_RECORDING_MS = 15_000` is a named constant in `lib/constants.ts`.
- Clear the timer in `stopRecordingAndTranscribe()` (if the user stopped early) and on unmount, alongside the existing timer cleanup at `speaking.tsx:120-128`.
- Surface a visible countdown (e.g. the pulse ring already animated at `speaking.tsx:372` can carry a 15→0 label) so the cap feels like a rule, not a bug.

Timer starts **at mic-tap**, not at first speech, so silence and dead air count against the 15 s — this is deliberate: cost is a function of wall-clock audio sent to Whisper, not words spoken.

### 2.3 Apple Guideline 3.1.1 framing (must hold)

The reward is a **consumable credit**, not a tier unlock, and this framing is what keeps us compliant:

- **No permanent unlock.** Watching an ad grants 2 transient turns that expire; it never sets `isPro`, never writes to `user_subscriptions`, and never converts the account to a paid state. It is functionally a small consumable.
- **No buy-button replacement.** The rewarded ad is an *additional* path to a *metered* amount of AI. The real, unlimited experience (PRO) is still sold **only** through Apple IAP. Ads never substitute for, discount, or steer around the IAP purchase.
- **No external steering.** Because `PAYWALL_ENABLED` gates web-purchase steering on iOS (`mobile/lib/paywall.ts` — currently `Platform.OS !== 'ios'`), and v1.1 wires native IAP, the in-app upgrade path is StoreKit only. Ads do not link out.
- **Privacy stays clean.** Non-personalized ads with **no ATT prompt** → `NSPrivacyTracking` stays `false` and no `NSPrivacyTrackingDomains` entry is needed. This is a **native** change (AdMob SDK), so it requires a **new production build**, not an OTA update.

---

## 3. Economics & margin

### 3.1 Cost is dominated by STT audio-seconds

Verified against `AiCostEstimator.java`, the per-turn variable cost of AI Speaking breaks down as:

| Component | Model | Marginal cost | Source |
|---|---|---|---|
| Chat / LLM | `deutschflow_model` (local fine-tune) | **~0đ** (Groq Llama-4-Scout fallback = $0.11 in / $0.34 out per 1M) | `rateFor()` → `FREE` for `deutschflow`/`local`, `AiCostEstimator.java:80-84`; `LLAMA_4_SCOUT`, line 35 |
| Persona TTS | Self-hosted Edge TTS | **0đ** (free MS voices) | `uncoveredCostNotes().edgeTts`, `AiCostEstimator.java:117` |
| **STT (Whisper)** | `whisper-large-v3` | **$0.006/min = $0.0001/s ≈ 2.54đ per audio-second** | `WHISPER_USD_PER_SEC`, `AiCostEstimator.java:33`; `costSttUsd()`, line 106; usd-vnd 25 400, line 45 |

So STT is effectively the **only** variable cost of a speaking turn, and it is billed **per audio-second**, not per token or per sentence:
`2.54đ/s = 0.006/60 × 25 400`.

### 3.2 Cost per ad (2 turns × 15 s cap)

| Scenario | Audio/turn | Audio/ad (2 turns) | STT cost/ad |
|---|---|---|---|
| **Worst case** (both turns hit the 15 s cap) | 15 s | 30 s | **~76đ** (30 × 2.54) |
| **Realistic** (~10 s of speech per turn) | 10 s | 20 s | **~51đ** (20 × 2.54) |
| **Light** (~6 s per turn) | 6 s | 12 s | ~30đ |

The 15 s cap is the guarantee: **no single ad can ever cost more than ~76đ in STT**, regardless of user behaviour.

### 3.3 Margin vs. rewarded eCPM

VN rewarded eCPM runs ~$2–5, i.e. **~50–125đ per completed view** (at usd-vnd 25 400). Net margin per ad:

| eCPM | Revenue/view | Worst-case (76đ) | Realistic (51đ) |
|---|---|---|---|
| $2.0 | ~50đ | **−26đ** (loss) | −1đ (breakeven) |
| $2.5 | ~64đ | −12đ | **+13đ** |
| $3.0 | ~76đ | ~0đ (breakeven) | **+25đ** |
| $4.0 | ~102đ | +26đ | **+51đ** |
| $5.0 | ~125đ | +49đ | **+74đ** |

Conclusion: at typical VN rewarded eCPM (~$3+), the loop is **profitable even in the worst case**, and comfortably profitable at realistic ~10 s turns. The thin zone is eCPM < ~$2.5 combined with users who consistently max the 15 s cap.

### 3.4 Gate by audio-seconds, not sentence count

The reward and all cost accounting **must be denominated in audio-seconds** (the 15 s cap), never in sentences or messages, because:

1. **Cost is linear in audio-seconds only.** `costSttUsd(durationSeconds)` is the entire variable cost; a "sentence" has no fixed cost — a rambling 30 s sentence costs 5× a crisp 6 s one. Sentence-gating would leave worst-case cost unbounded.
2. **The infra already measures it.** The backend logs real `durationSeconds` per transcribe on every call (`AiSessionController.java:118` → `ledgerService.recordStt(...)`, and `GroqWhisperClient` parses Whisper's `duration` field at `GroqWhisperClient.java:116/215`). Audio-second accounting reuses existing, verified plumbing (`stt_usage_events`); sentence accounting would need new, less-meaningful counters.
3. **The cap is enforceable client-side.** A 15 s mic auto-stop is a hard, deterministic bound the client owns; "N sentences" is fuzzy and un-cappable.

### 3.5 eCPM calibration rule

Monitor live rewarded eCPM (from AdMob) against realized STT cost/ad (from `stt_usage_events`) weekly:

| Live eCPM | Action |
|---|---|
| **≥ $2.5** | Keep the default: **2 turns/ad, 15 s cap, ~5 ads/day.** |
| **< $2.5** | Tighten to **1 turn/ad, 10 s cap** (worst case drops to ~25đ/ad; breakeven at any eCPM ≥ ~$1). |
| **< $1.0 sustained** | Reconsider the ad tier entirely — the loop cannot clear cost; push harder to PRO IAP instead. |

The two knobs (turns-per-ad and seconds-per-turn) are both cost-linear, so either can be dialed down to restore margin without changing the UX shape. Parameterize them as remote-readable config so calibration doesn't force a resubmit (§9).

---

## 4. Backend implementation

This section specs the v1.1 backend work. It reuses the existing token-wallet quota engine (`QuotaService`, `user_ai_token_wallets`, `ai_token_usage_events`, `stt_usage_events`) and the already-shipped provider-agnostic Apple IAP layer. Two net-new surfaces: **(A)** an AdMob **Server-Side Verification (SSV)** reward-credit endpoint, and **(B)** the credit → wallet mapping. The paid-PRO path (**C**) is already built — only config remains.

### 4.1 Design constraint: gate by audio-seconds, not tokens

The existing quota engine is **token-denominated**: `assertAllowed()` checks `remainingSpendable` (tokens), and `AiSessionController.transcribe()` reserves a flat `STT_ESTIMATED_TOKENS = 200L` per call (`AiSessionController.java:48,104`). But the dominant variable cost of AI Speaking is **Whisper STT billed per audio-second** (`$0.006/min ≈ 2.54đ/s`), which the token ledger is blind to — that is exactly why `stt_usage_events` exists as a *separate* table (`V210__stt_usage_events.sql:1-3`).

For the post-trial free tier the reward must therefore be denominated the same way the cost is: **audio-seconds**, hard-bounded by the client's 15 s auto-stop. We introduce a **second, parallel budget** — a per-ad grant of STT audio-seconds — layered on top of the existing token wallet. The token wallet stays the mechanism for trial + paid PRO; the new ad-credit budget is what post-trial free users spend on the `transcribe` path.

| Denomination | Used by | Enforced in | Backing store |
|---|---|---|---|
| Tokens (`remainingSpendable`) | 7-day trial, paid PRO, ULTRA | `QuotaService.assertAllowed()` (`QuotaService.java:64`) | `user_ai_token_wallets.balance` |
| **Audio-seconds (new)** | Post-trial free (rewarded-ad) | new `AdCreditService.assertSpeakingCredit()` | new `user_ad_speaking_credits` |

Rationale: reusing only tokens would force a fragile token↔second conversion at every call site and would not bound worst-case STT loss. A dedicated seconds budget makes the 15 s cap and the "2 turns/ad" grant *directly* the units the ledger stores, and keeps the `[Quota][P-9/P-11]` soft-cap semantics untouched.

### 4.2 (A) Rewarded-ad credit endpoint — AdMob SSV callback (NOT a client POST)

**Never trust a client "I watched an ad" POST.** A naive `POST /reward` from the app is trivially replayable/forgeable and would let anyone mint unlimited speaking credits. AdMob's **Server-Side Verification (SSV)** is the anti-fraud primitive: after a *genuine* completed rewarded impression, **Google's servers** call *our* server directly with a signed `GET` callback. We verify the RSA/ECDSA signature against Google's rotating public keys before crediting.

#### Endpoint shape

```
GET /api/ads/admob/ssv
   ?ad_network=...&ad_unit=...&reward_amount=2&reward_item=speaking_turn
   &timestamp=1720000000000&transaction_id=<admob-unique>
   &user_id=<our-signed-opaque-id>&custom_data=<base64>
   &key_id=<google-key-id>&signature=<base64url-ecdsa>
```

- **Unauthenticated** (no app JWT) — the caller is Google, not the user. Whitelisted from the auth filter exactly like `POST /api/payments/apple/notifications` already is (`AppleIapController.java:72-73`, which takes no `@AuthenticationPrincipal` and is signature-verified instead).
- Returns **`200 OK`** on success/duplicate, **`400`** on signature failure. Mirror the `/notifications` contract: return `200` even for already-processed callbacks so AdMob does not retry-storm; return `4xx` **only** for a genuinely bad signature.
- We pass **our own user id** into the rewarded ad's SSV `userId`/`customData` options on the client. To stop a user pasting another user's id, sign it: put a short HMAC-signed token (`userId + issuedAt`, HS256 over a server secret) in `custom_data`; the callback handler verifies the HMAC before resolving the user. This is the same defense-in-depth idea as Apple's `appAccountToken` binding (`AppleIapService.java:96-104`).

#### SSV signature verification (the security core)

Follow Google's documented SSV scheme (new `AdMobSsvVerifier`, mirroring `AppleJwsVerifier`'s "verify locally, no shared secret" shape — `AppleJwsVerifier.java:22-24`):

1. **Fetch & cache Google's public keys** from `https://www.gstatic.com/admob/reward/verifier-keys.json` (list of `{keyId, pem, base64}`). Cache in-memory with a TTL; refresh on an unknown `key_id` (same cache-miss-refresh pattern as `AppleProductCatalog.find()` at `AppleProductCatalog.java:35-47`). Keys rotate — never pin one.
2. **Reconstruct the signed content**: it is the raw query string **up to but excluding** `&signature=...&key_id=...` (order preserved, exactly as received). Do not re-encode.
3. **Verify** the `signature` (ECDSA over SHA-256) against the PEM for the matching `key_id`. Reject if no key matches or verification fails → `400`.
4. Only after signature success do we resolve the user and credit.

> Config: `ads.admob.ssv.verifier-keys-url` (default the gstatic URL), `ads.admob.ssv.enabled` (default `false`, degrade gracefully with a warning like `AppleJwsVerifier.init()` at `AppleJwsVerifier.java:61-68`), `ads.admob.ssv.hmac-secret` (env, for the `custom_data` user-binding token).

### 4.3 (B) Mapping the credit onto QuotaService / the wallet

The SSV handler delegates to a new `AdCreditService.grantSpeakingReward(userId, transactionId, now)` (transactional, `REQUIRES_NEW` like the quota writes). It grants a **bounded per-ad credit sized to 2 turns × 15 s of STT**, with a **server-enforced daily ad cap**.

```java
// Constants (server-authoritative; do NOT trust client-sent reward_amount for sizing).
// seconds-per-turn / turns-per-ad are also exposed as ads.admob.reward.* config so the
// eCPM kill-switch (§3.5) can drop to 1 turn or 10s without a redeploy.
static final int  AD_REWARD_TURNS        = 2;     // turns per ad
static final int  MAX_SECONDS_PER_TURN   = 15;    // MUST equal the client mic auto-stop cap
static final int  AD_REWARD_SECONDS      = AD_REWARD_TURNS * MAX_SECONDS_PER_TURN; // 30
static final int  MAX_ADS_PER_DAY        = 5;     // VN-calendar day
static final int  MAX_CREDIT_SECONDS_CAP = 150;   // hard ceiling = 5 ads × 30s (anti-accumulation)
```

**Grant logic (per verified SSV callback):**

1. **Idempotency** — `INSERT` `transaction_id` into `ad_reward_events` with a `UNIQUE` constraint; `ON CONFLICT DO NOTHING`. If the insert affected 0 rows, this callback was already processed → return `200`, credit nothing. (Same exactly-once shape as `apple_processed_notifications`, `V189__apple_iap.sql:58-63`.)
2. **Daily ad cap** — count today's rows in `ad_reward_events` for this user within the VN-calendar day window (reuse `QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now)`, as `QuotaService.java:160` does). If `>= MAX_ADS_PER_DAY`, record the event for auditing but grant **0** seconds.
3. **Credit** — upsert `user_ad_speaking_credits`, adding `AD_REWARD_SECONDS` but clamping `balance_seconds` to `MAX_CREDIT_SECONDS_CAP` (`balance = LEAST(cap, balance + 30)`), matching the wallet's `GREATEST(0, …)`/cap idiom at `QuotaService.java:140,287`.

**Spend logic (at the `transcribe` call site).** In `AiSessionController.transcribe()` (`AiSessionController.java:100-120`), branch on tier:

- **Trial / paid** (`remainingSpendable > 0` or `unlimitedInternal`): unchanged — `quotaService.assertAllowed(...)` as today (`AiSessionController.java:104`).
- **Post-trial free** (DEFAULT plan, 0 tokens): call `adCreditService.assertSpeakingCredit(userId, MAX_SECONDS_PER_TURN)` — throws `QuotaExceededException` ("Xem quảng cáo để nhận lượt nói") if `balance_seconds <= 0`. After Whisper returns, **debit the actual `stt.durationSeconds()`** (server-truth, not the 15 s estimate) from `balance_seconds`, right where `recordStt(...)` already runs (`AiSessionController.java:118`). Debit `LEAST(balance_seconds, ceil(durationSeconds))`.

This makes the 15 s client cap the *reservation* and the Whisper-reported duration the *settlement* — worst case one turn ≈ 15 s ≈ 38đ, one ad (2×15 s) ≈ 76đ, matching the cost model. Keep `recordStt()` firing for **every** tier so admin AI-COGS stays accurate (`AiUsageLedgerService.recordStt`).

#### New tables (new migration, e.g. `V244__ad_rewarded_credits.sql`)

```sql
-- Per-user rewarded-ad STT budget (audio-seconds), parallel to user_ai_token_wallets.
CREATE TABLE user_ad_speaking_credits (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_seconds INTEGER   NOT NULL DEFAULT 0 CHECK (balance_seconds >= 0),
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Exactly-once + daily-cap audit for verified SSV callbacks.
CREATE TABLE ad_reward_events (
    transaction_id   VARCHAR(128) PRIMARY KEY,      -- AdMob SSV transaction_id (idempotency key)
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_unit          VARCHAR(128),
    granted_seconds  INTEGER NOT NULL DEFAULT 0,    -- 0 when daily cap already hit
    remote_ip        VARCHAR(64),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ad_reward_user_day ON ad_reward_events (user_id, created_at);
```

`ON DELETE CASCADE` matches `user_ai_token_wallets` (`V42:7`) so account-deletion cleanup is automatic (relevant given the open delete-account FK issues — see §9.2).

> **Migration numbering:** `V242` is reserved for the Apple product-ID alignment (§4.4 / §6.3). The ad-credit tables take the next free slot (shown here as `V244`); confirm against `backend/src/main/resources/db/migration/` before committing.

### 4.4 (C) Paid PRO via Apple IAP — already built; only config remains

The entire IAP verify/activate/notify path is shipped and reused as-is. **No new backend code for PRO.**

| Concern | Status | Reference |
|---|---|---|
| StoreKit2 JWS signature verify (local, Apple Root CA, no shared secret) | ✅ Done | `AppleJwsVerifier.verifyTransaction()` `:79,93` |
| `bundleId` + environment enforced inside verifier | ✅ Done | `AppleJwsVerifier.java:79`; `AppleIapService.java:76` |
| Cross-account replay guard (`appAccountToken`) | ✅ Done | `AppleIapService.java:96-104` |
| Idempotency (`transactionId` UNIQUE) | ✅ Done | `AppleIapService.java:106-119` |
| Entitlement → provider-agnostic ledger + wallet seed | ✅ Done | `SubscriptionActivationService.extendOrActivateApple` `:84`, `seedWalletIfNeeded` `:131-151` |
| App Store Server Notifications V2 (renew/refund/expire) | ✅ Done, at-least-once guarded | `AppleIapController.java:72-87`; `apple_processed_notifications` `V189:58` |
| `/verify /sync /account-token /products` | ✅ Done | `AppleIapController.java:51-105` |

**Two config blockers (must fix for v1.1, no code change to the IAP classes):**

1. **`APPLE_BUNDLE_ID` defaults to the wrong value.** `AppleJwsVerifier` reads `payment.apple.bundle-id` defaulting to `com.deutschflow.app` (`AppleJwsVerifier.java:41`), but the real App Store bundle id is **`com.cudinh.mydeutschflow`** (`app.json:26`). Every production JWS verify will fail (`VerificationException` → `IllegalArgumentException` "Invalid Apple transaction", `AppleIapService.java:78-80`) until `payment.apple.bundle-id` is set correctly in the prod env. Also set `payment.apple.app-apple-id`, `payment.apple.environment=Production`, and `payment.apple.root-cert-dir` — otherwise the verifier initializes disabled (`AppleJwsVerifier.java:61-76`).
2. **`apple_products.product_id` must match the real ASC product IDs.** The seeded ids (`com.deutschflow.app.pro.monthly`, …, `V189:44-48`) are placeholders. A new migration (reserved **V242**) must align `apple_products.product_id` to the actual App Store Connect product IDs (`com.cudinh.mydeutschflow.pro.{monthly,yearly}`), or `productCatalog.find()` returns empty → "Unrecognized product" (`AppleIapService.java:83-87`). v1.1 ships PRO-only + ULTRA inactive, so V242 should also `UPDATE apple_products SET is_active = FALSE WHERE plan_code = 'ULTRA'`.

> Also flip the mobile paywall gate: `mobile/lib/paywall.ts` `PAYWALL_ENABLED = Platform.OS !== 'ios'` must enable iOS in v1.1 (client-side; noted here only as the trigger that starts exercising `/verify`). See §6.2.

### 4.5 Fraud / abuse guards (summary)

| Guard | Where | Mechanism |
|---|---|---|
| No client-minted credits | SSV endpoint | Google→server signed callback only; app POST path does not exist |
| Signature forgery | `AdMobSsvVerifier` | ECDSA verify vs Google's rotating public keys; unknown `key_id` → refetch, else `400` |
| Cross-user credit theft | `custom_data` | HMAC-signed `userId` token; verify before resolving user (mirrors `appAccountToken` binding) |
| Replay / at-least-once delivery | `ad_reward_events.transaction_id` UNIQUE | `ON CONFLICT DO NOTHING`; 0 rows ⇒ credit nothing, return `200` |
| Farming credits | `MAX_ADS_PER_DAY = 5` + `MAX_CREDIT_SECONDS_CAP = 150` | VN-day count gate + hard balance ceiling |
| Runaway STT spend | Existing per-user rate limiter | `AiRateLimiterService` `Bucket.TRANSCRIBE` still applies on top (`AiSessionController.java:106-109`) |
| Over-reward vs actual cost | Settle on real duration | Debit `stt.durationSeconds()` (server truth), not the 15 s reservation (`AiSessionController.java:118`) |
| Economics kill-switch | Config | `ads.admob.reward.seconds-per-turn` / `.turns-per-ad` overridable → drop to 1 turn or 10 s if live eCPM < ~$2.5 without a redeploy |

**Files to add:** `com/deutschflow/ads/AdMobSsvController.java`, `AdMobSsvVerifier.java`, `AdCreditService.java`, `dto/` records, `db/migration/V244__ad_rewarded_credits.sql`.
**Files to touch:** `AiSessionController.transcribe()` (tier branch), `db/migration/V242__*.sql` (Apple product IDs + ULTRA inactive), prod env (`payment.apple.*`, `ads.admob.ssv.*`). **IAP Java classes: unchanged.**

Key source references: `QuotaService.java:64,113,140,160,287`; `QuotaSnapshot.java:6-24`; `AiUsageLedgerService.java` (`recordStt`); `AiSessionController.java:48,100-120`; `AppleIapController.java:51-105`; `AppleIapService.java:76-130`; `AppleJwsVerifier.java:41,79,93`; `AppleProductCatalog.java:35-47`; `SubscriptionActivationService.java:84,131-151`; migrations `V42`, `V73`, `V189`, `V210`.

---

## 5. Mobile implementation (ads)

This is the v1.1 rewarded-ad system for **post-trial DEFAULT (free) accounts only**. It funds AI Speaking on a per-audio-second budget: watch one rewarded ad → earn **2 speaking turns**, each with the mic hard-capped at **15 seconds**. It is a **consumable-credit reward flow** (Guideline 3.1.1-safe), never a purchase-replacement button. Backend gate is unchanged — this is net-new mobile plus the one small quota surface in §4.3.

### 5.1 Library & build constraints

| Item | Decision | Source / rationale |
|---|---|---|
| Ad SDK | `react-native-google-mobile-ads` (AdMob), **rewarded** format | `MONETIZATION_TECH_PLAN.md:161` (16.x New-Arch compatible) |
| ATT | **Do NOT install** `expo-tracking-transparency` | non-personalized only; keeps `NSPrivacyTracking:false` |
| Privacy manifest | **Unchanged** — `app.json:34-84`, `NSPrivacyTracking:false` stays | GMA SDK ≥ 11.2.0 ships its own `PrivacyInfo.xcprivacy`; Xcode auto-merges (`MONETIZATION_TECH_PLAN.md:171`) |
| Delivery | **NEW production build, NOT OTA** | native dep → fingerprint change; `runtimeVersion.policy = "fingerprint"` (`app.json:6`) forces all-native, no OTA (`MONETIZATION_TECH_PLAN.md:220`) |
| App-level cap | ~5 ads/day (≈ 10 speaking turns/day free) | drop to 1 turn/ad or 10 s cap if live eCPM < ~$2.5 |

**Critical: this is not an OTA-able change.** Because `app.json:6` pins `runtimeVersion.policy = "fingerprint"`, adding the AdMob native module changes the fingerprint. The current TestFlight build cannot receive this via `eas update`; it requires `eas build -p ios --profile production` → `eas submit`. Bundle all v1.1 native deps (AdMob + `expo-iap`) into **one** prebuild so the fingerprint changes only once (`MONETIZATION_TECH_PLAN.md:220`, PHASE 1).

### 5.2 Non-personalized request configuration (no ATT)

Add the plugin to `app.json` `plugins` (`app.json:99-130`), providing the `~`-style **App ID** (distinct from `/`-style ad-unit IDs) and the SKAdNetwork list:

```jsonc
["react-native-google-mobile-ads", {
  "iosAppId": "[[ca-app-pub-XXXX~YYYY]]",        // App ID, NOT ad-unit ID
  "skAdNetworkItems": ["cstr6suwn9.skadnetwork", "[[…Google SKAdNetwork list…]]"]
}]
```

New module `mobile/lib/ads.ts` (mirror the guarded-bootstrap pattern of `lib/observability.ts`):

- **Ad-unit ID** = `TestIds.REWARDED` when `__DEV__`; real rewarded unit ID baked into `lib/constants.ts` on release (baked into binary, not EAS env — `MONETIZATION_TECH_PLAN.md:172`).
- `initAds()` — idempotent; on first call:
  ```ts
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.T,
    tagForUnderAgeOfConsent: true,
  })
  await mobileAds().initialize()
  ```
- **Every rewarded request** (this is the only place NPA is enforced — a miss = a privacy violation) passes:
  ```ts
  RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true })
  ```
- Wrap in try/catch → no-op on failure (an ad failing to load must never block the speaking flow).

**Bootstrap timing:** call `initAds()` from `app/_layout.tsx` in a `useEffect([appReady, isPro])`, `if (appReady && !isPro) initAds()` — only for free accounts, and only after UI is active (`MONETIZATION_TECH_PLAN.md:175`).

### 5.3 Gating: who sees rewarded ads

Gate on `usePlanStore().isPro` + trial state. `isPro` already resolves from `GET /auth/me/plan` (`isPro = tier === 'PRO' || 'ULTRA'`, `usePlanStore.ts`), which returns PRO during the 7-day trial (trial is a PRO-tier subscription — `StudentTrialSubscriptionProvisioner`, `STUDENT_PLANS_REVIEW.md:26`).

| Account state | `isPro` | Rewarded ads? | AI Speaking behavior |
|---|---|---|---|
| **7-day trial** (new DEFAULT, days 1–7) | `true` (PRO tier) | **NEVER** | PRO-LITE taste; AI within trial budget (9000 tok/day, Emma+Anna). No ads. |
| **Post-trial DEFAULT** (free, lapsed) | `false` | **YES** — the only cohort | 0 base AI/day → watch ad → 2 turns @ 15 s cap |
| **Paid PRO** (v1.1 IAP) | `true` | **NEVER** | Full AI budget, no ads |

Because the trial IS PRO-tier, the existing `isPro` check transparently excludes trial users from ads — no separate trial flag needed. The one edge case (`MONETIZATION_TECH_PLAN.md:194`): `isPro` defaults `false` until `fetchPlan()` resolves at cold-start, so a paid/trial user could momentarily be ad-eligible. Mitigation: **do not offer the "watch ad" CTA until `usePlanStore` has resolved the plan** (render a spinner in the speaking gate until then).

> **Do NOT** place banner or interstitial ads on `speaking.tsx` (`MONETIZATION_TECH_PLAN.md:177` bans ads while recording). The only ad on the speaking screen is the **explicit user-initiated rewarded ad** described below — a reward flow, not passive inventory.

### 5.4 The 15-second recording cap (client-side, hard)

The cap replaces today's PRO-only hard block. In `speaking.tsx`, `startRecording()` (**speaking.tsx:340-376**) currently does:

```ts
async function startRecording() {
  if (!isPro) {
    Alert.alert('Tính năng PRO', 'Trả lời bằng giọng nói cần PRO...')  // speaking.tsx:341-343
    return
  }
  ...
  recorder.record()               // speaking.tsx:367 — mic-tap starts here
```

v1.1 rewrite of the free-path branch:

1. **`isPro` → unchanged path.** PRO/trial keep uncapped recording (their `recorder.record()` at speaking.tsx:367 stays as-is).
2. **Free + has speaking credits (`turnsRemaining > 0`)** → allow recording, but **arm a 15 s auto-stop timer at mic-tap**:
   ```ts
   // right after recorder.record() (speaking.tsx:367)
   autoStopRef.current = setTimeout(() => {
     void stopRecordingAndTranscribe()   // speaking.tsx:380 — same stop path
   }, MAX_FREE_RECORDING_MS)             // 15_000, named constant in lib/constants.ts
   // show a visible 15s countdown next to the pulsing mic
   ```
   The timer **starts at mic-tap** (per the LOCKED spec), and `stopRecordingAndTranscribe()` (**speaking.tsx:380**) is the existing stop→transcribe path — reused verbatim. Clear the timer in `stopRecordingAndTranscribe()` if the user stops early, so it can't fire twice. Decrement `turnsRemaining` after a successful turn.
3. **Free + no credits (`turnsRemaining === 0`)** → replace the old PRO Alert with the **rewarded-ad reward CTA** (§5.5).

The client 15 s auto-stop is the enforcement point; the backend still meters actual STT seconds against quota as the source of truth (§4.3). Cost math lives in §3 — do not duplicate it here.

### 5.5 "Watch ad to continue" — reward/credit UI (not a purchase button)

Placement: **inline in the speaking screen's own composer/gate**, shown only when free + `turnsRemaining === 0`. It replaces the old `Alert` at speaking.tsx:341-343.

Copy & framing (must read as a **reward**, never as a paid unlock — Guideline 3.1.1):
- **"Xem quảng cáo để nhận 2 lượt nói (mỗi lượt tối đa 15 giây)."**
- Secondary, low-emphasis: **"Học không giới hạn với PRO"** → routes to `upgrade.tsx` paywall. This is a *separate* affordance; the ad CTA never says "buy". No buy-button is replaced by the ad, and the ad grants **consumable credits**, not a tier flag.

Flow (`showRewardedForTurns()` in `lib/ads.ts`):
```ts
const ad = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true })
ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
  grantSpeakingTurns(REWARD_TURNS_PER_AD)   // 2 consumable credits; server-authoritative via SSV (§4.2)
})
ad.addAdEventListener(AdEventType.ERROR, /* toast, keep user unblocked */)
await ad.load(); ad.show()
```
- Credits are **consumable** and reset daily; enforce the **~5 ads/day** app-level cap (10 turns/day) with a friendly "Bạn đã dùng hết lượt xem quảng cáo hôm nay" state. The server SSV path (§4.2–4.3) is the source of truth; the client counter is UX only.
- The reward grants *turns*; each turn is still 15 s-capped, so the audio-second budget stays bounded regardless of how the reward is spent.
- Track PostHog `rewarded_ad_shown / earned / failed` and `speaking_turns_granted` (PostHog already wired via `app.json:133`).

### 5.6 Ads testing checklist
- **Real device, `development` profile** for full path — `preview` is simulator-only (`MONETIZATION_TECH_PLAN.md:187`); AdMob shows test ads on simulator but no real fill. **Dev builds must only show TEST ads** (live ads on test traffic = AdMob strike).
- Verify: trial user (day 1–7, PRO tier) sees **no** ad CTA; post-trial free sees CTA at 0 credits; PRO (paid) never sees it.
- Verify 15 s auto-stop fires exactly at mic-tap + 15 s; early manual stop cancels the timer (no double-fire); countdown visible.
- Verify daily cap (5 ads) and per-ad reward (2 turns); reward grants even if the same ad object is reused.
- New-Arch/Fabric render check on device.

---

## 6. Paid PRO (Apple IAP)

The "real" premium. Backend is **already built and mature** (§4.4) — mobile posts a StoreKit 2 JWS to the existing `/api/payments/apple/verify`; the backend remains the single entitlement source of truth. **Client uses `expo-iap`, NOT RevenueCat** (`MONETIZATION_TECH_PLAN.md:12,37-41`). v1.1 sells **PRO only** (monthly + yearly); ULTRA stays deferred/inactive.

### 6.1 Existing infra to reuse (do not rebuild)

| Component | Location | Role |
|---|---|---|
| `AppleIapController` | `/api/payments/apple/*` — `/verify`, `/sync`, `/notifications`, `/account-token`, `/products` (migration V189) | verify JWS → `{planCode, endsAt}`; restore; ASSN V2 |
| `AppleJwsVerifier` | verifies StoreKit 2 JWS, enforces `bundle-id` (`application.yml:529`) | signature + replay protection; dormant until `root-cert-dir` set |
| `user_subscriptions` ledger | provider-agnostic (`source` column) | Apple writes alongside Stripe/MoMo/SePay |
| `QuotaService` + `subscription_plans.daily_token_grant` | token/quota accounting | PRO grant applied on entitlement |
| `usePlanStore.fetchPlan()` | `GET /auth/me/plan` → `isPro` | mobile reads entitlement; **holds no receipt** |

Backend net-new code ≈ **0** — only config + 1 migration.

### 6.2 Enable the paywall on iOS

`mobile/lib/paywall.ts:13` is the switch:

```ts
export const PAYWALL_ENABLED = Platform.OS !== 'ios'   // paywall.ts:13 — currently OFF on iOS
```

The comment at paywall.ts:11 states the exact unblock condition: *"Flip back on … once `react-native-iap` is wired and StoreKit products are live."* v1.1 wires `expo-iap` → change to:

```ts
export const PAYWALL_ENABLED = true
```

This re-enables the upsell/paywall surfaces on iOS (it never removed access for already-PRO users — it only hid steering UI, paywall.ts:8-9).

### 6.3 The 2 config blockers (must fix before any sandbox purchase)

Same two blockers described in §4.4, restated with the mobile-side fix:

| # | Blocker | Fix | Severity |
|---|---|---|---|
| 1 | `APPLE_BUNDLE_ID` defaults to **wrong** value `com.deutschflow.app` (`application.yml:529`), but the iOS bundle is `com.cudinh.mydeutschflow` (`app.json:26`). `AppleJwsVerifier` enforces `bundleId` → every txn rejected `INVALID_APP_IDENTIFIER` once verification is on. | Set env **`APPLE_BUNDLE_ID=com.cudinh.mydeutschflow`** on backend deploy | 🔴 CRITICAL (dormant until verify enabled) |
| 2 | V189 seeds `apple_products.product_id` as `com.deutschflow.app.{pro,ultra}.{monthly,yearly}` (Android-prefix placeholders); `AppleProductCatalog.find()` matches **byte-for-byte** with ASC product IDs. | New migration **V242** aligns IDs to real ASC IDs `com.cudinh.mydeutschflow.pro.{monthly,yearly}` + sets `is_active=FALSE WHERE plan_code='ULTRA'` (`MONETIZATION_TECH_PLAN.md:70-80`) | 🔴 CRITICAL |

```sql
-- V242__align_apple_product_ids_ios_bundle.sql
UPDATE apple_products SET product_id='com.cudinh.mydeutschflow.pro.monthly' WHERE product_id='com.deutschflow.app.pro.monthly';
UPDATE apple_products SET product_id='com.cudinh.mydeutschflow.pro.yearly'  WHERE product_id='com.deutschflow.app.pro.yearly';
UPDATE apple_products SET is_active=FALSE WHERE plan_code='ULTRA';   -- v1.1 sells PRO only
```

Remaining env to enable the provider (env-gated, currently off — `MONETIZATION_TECH_PLAN.md:82-90`): `APPLE_APP_APPLE_ID` (numeric App Store id, required for Production verify), `APPLE_ROOT_CERT_DIR` (turns on verification), `APPLE_IAP_ENVIRONMENT` (Sandbox for TestFlight / Production for release), `APPLE_IAP_ONLINE_CHECKS`. **Also register the ASSN V2 URL** in ASC → `https://[[api-host]]/api/payments/apple/notifications`; without it, renewal/refund/expiry never flow back and a lapsed sub still shows PRO server-side.

### 6.4 Mobile IAP wiring (`expo-iap`)

Install into the **same PHASE 1 prebuild** as AdMob (one fingerprint change): `npx expo install expo-iap`, add `"expo-iap"` to `app.json` `plugins`, `npx expo prebuild --clean`. StoreKit needs no usage-description.

New `mobile/lib/iap.ts`:
- `fetchBackendCatalog()` → `GET /payments/apple/products` (server owns product IDs — never hardcode in client).
- `loadStoreProducts(ids)` → `expo-iap getProducts` (localized `displayPrice`/period from StoreKit — never hardcode price).
- `getAppAccountToken()` → `GET /payments/apple/account-token` (backend binds txn for replay protection + ASSN correlation).
- `verifyJws(jws)` → `POST /payments/apple/verify {jws}` **then** `usePlanStore.getState().fetchPlan()`.

Purchase flow — **verify before finish** (`MONETIZATION_TECH_PLAN.md:107-118`):
```ts
export async function buy(productId: string) {
  const appAccountToken = await getAppAccountToken()
  const purchase = await requestPurchase({ request: { sku: productId, appAccountToken } })
  const jws = purchase?.jwsRepresentationIos ?? purchase?.transactionReceipt  // ⚠️ field name varies by expo-iap version — pin & verify types
  if (!jws) throw new Error('Không lấy được giao dịch từ App Store')
  await verifyJws(jws)                                        // POST /verify → fetchPlan()
  await finishTransaction({ purchase, isConsumable: false })  // finish ONLY after backend granted
}
```
Handle: user-cancel (silent), pending/Ask-to-Buy, **network fail after charge before verify** (do NOT finish → StoreKit re-delivers; register a `purchaseUpdatedListener` at launch to drain unfinished txns through the same verify path), backend 400/503 (friendly error, leave txn to retry). PostHog `purchase_started/succeeded/failed`.

Restore (`getAvailablePurchases()` → `POST /payments/apple/sync {jws:[]}` → `fetchPlan()`) is required by Guideline 3.1.1.

**Rebuild `upgrade.tsx` as a Guideline 3.1.2 / 3.1.1-compliant paywall** — each card must show **price** (`displayPrice`, not hardcoded) + **renewal period** ("mỗi tháng / mỗi năm · tự động gia hạn") + Pro benefits; plus mandatory: **"Khôi phục giao dịch"** button, **Terms (EULA) + Privacy** links, auto-renew disclosure line, and **"Quản lý gói"** → `itms-apps://apps.apple.com/account/subscriptions` (`MONETIZATION_TECH_PLAN.md:119`).

Post-purchase unlock is automatic: `fetchPlan()` flips `isPro` → `exam.tsx`/`weekly-speaking.tsx` (`enabled: isPro`) refetch; imperative `!isPro` screens (`speaking.tsx:341`, `index.tsx`, `profile.tsx`) re-render from the store. Also fix the `usePlanStore` tier union to include `'DEFAULT'` (`STUDENT_PLANS_REVIEW.md:110`).

### 6.5 App Store Connect setup
- **Subscription Group "DeutschFlow PRO"** under bundle `com.cudinh.mydeutschflow`; auto-renewable products **PRO monthly + yearly**, IDs **exactly matching** the V242 catalog. Period ≥ 7 days. Per-country pricing, localized display name/description (vi + en), paywall review screenshot, EULA + Privacy links. **ULTRA deferred.**
- **Sandbox testers** (Users and Access → Sandbox).
- **Paid Applications Agreement + W-8BEN + banking must be Active** — otherwise products stick at "Missing Metadata" and cannot be purchased. *(Per project memory, the Free Apps Agreement is Active; the Paid Apps Agreement is a v1.1 launch blocker to confirm.)*
- Register **ASSN V2 URL** (Production + Sandbox).

### 6.6 Sandbox testing
- **Real device, `development` build.** Sandbox tester signs in via Settings → App Store → Sandbox; purchase → `/verify` returns `{planCode, endsAt}` → `/auth/me/plan` returns PRO → `isPro` flips → gated features open (`MONETIZATION_TECH_PLAN.md:139`). (StoreKit Configuration file works on simulator for early smoke, but device is the full path.)
- **Guard test:** before `APPLE_BUNDLE_ID` is set correctly + verification enabled, sandbox `/verify` must **FAIL** (proves the guard is live) → set correct value → success.
- Restore (delete + reinstall / 2nd device); interrupted purchase (kill after charge before verify → launch listener drains it); ASSN accelerated renewal + EXPIRED; upgrade/downgrade with no double-charge.
- Compliance audit of the paywall (price / period / disclosure / cancel / Terms+Privacy / Restore) **before submit**.
- Jest unit `lib/iap.ts` (mock `expo-iap` + api): buy calls verify **before** finish; restore posts `/sync`; cancel is silent.

**Key risks:** 🔴 wrong `APPLE_BUNDLE_ID` → 100% txn reject; 🔴 product-ID mismatch → empty paywall / "unknown product"; 🔴 ASSN unregistered → expired subs still show PRO server-side; 🔴 paywall missing price/Restore/links → near-certain 3.1.2/3.1.1 reject; ⚠️ JWS field name varies by `expo-iap` version (pin + verify types); ⚠️ New-Arch/Fabric — verify purchase on a device dev-build.

---

## 7. Legal & App Privacy (re-add for v1.1)

v1.0 deliberately **stripped** all advertising and IAP/subscription disclosures from the live `/privacy` and `/terms` pages (see the free-only markers: `PRIVACY_POLICY.md:34,36` "does not show advertising … no in-app purchases", `TERMS_OF_USE.md:23` "no in-app purchases and no subscriptions"). Because the ad + IAP product is materially different, v1.1 **must re-add** those disclosures **before** the production build ships, or it is a Guideline 5.1.1 (privacy) / App Privacy-mismatch rejection risk.

**Editing model — do NOT hand-edit the generated files.** `frontend/src/content/legal/privacy.ts` and `terms.ts` are auto-generated (banner at `privacy.ts:1-4`, `terms.ts:1-4`). The pipeline is:

```
plans/appstore/PRIVACY_POLICY.md + TERMS_OF_USE.md   (edit here — source of truth)
        │  node frontend/scripts/gen-legal.mjs   (fills [[placeholders]] → JSON.stringify)
        ▼
frontend/src/content/legal/{privacy,terms}.ts   (generated; never hand-edit)
        │  frontend build → Amplify deploy
        ▼
https://mydeutschflow.com/{privacy,terms}   (the ASC-registered URLs)
```

All edits below go into the **two `.md` templates**, then re-run `gen-legal.mjs` (`gen-legal.mjs:47-62`), then redeploy the frontend. Also bump `EFFECTIVE_DATE` in `gen-legal.mjs:25` (currently `'2026-07-03'`) so the "Last updated" line reflects the ad/IAP revision.

### 7.1 Privacy Policy — what to RE-ADD

| # | Location in `PRIVACY_POLICY.md` | Free-only text today | v1.1 replacement |
|---|---|---|---|
| **P1. Advertising data row** | "Data we collect" table (EN `PRIVACY_POLICY.md:26-32`, VI `:113-119`) | *(no advertising row)* | Add a row: **Advertising** — "A resettable advertising/session identifier and ad-interaction signals used only to show and frequency-cap ads, and to prevent ad fraud, for free (non-trial) accounts. **Non-personalized** — not used to build a profile or track you across other apps." |
| **P2. Ad-free statement** | EN `:34` / VI `:121` "does not show advertising and does not use your data for advertising" | **Replace** with: "Free (post-trial) accounts see **non-personalized** rewarded and banner ads from Google AdMob. PRO subscribers and trial users see **no ads**. We do not use your data to build an advertising profile and we do not sell your personal data." |
| **P3. Tracking / ATT note** | EN `:36` / VI `:123` "no advertising and no in-app purchases" | **Rewrite (keep ATT=false framing):** "DeutschFlow shows only **non-personalized** ads and does **not** track you across other companies' apps or websites. Because ads are non-personalized, we do **not** request App Tracking Transparency (ATT) permission and do **not** access your device's Advertising Identifier (IDFA). DeutschFlow offers an optional paid **PRO subscription** (in-app purchase)." |
| **P4. AdMob sub-processor** | "Third parties and sub-processors" (EN `:52-60`, VI `:139-147`) | PostHog / Expo / AWS only | Add bullet: **Google AdMob (Google LLC)** — "serves non-personalized ads to free accounts and provides ad-fraud prevention; operates under Google's terms." Add bullet: **Apple** — "processes in-app purchases and subscription billing; we receive only the transaction/entitlement result, never your payment card details." |
| **P5. Apple IAP data** | "Data we collect" table | *(none)* | Add a **Purchases** row: "Subscription status and transaction history (from Apple's StoreKit). Apple processes payment; we store only your entitlement/plan state." Source = "Apple (App Store)". |
| **P6. Legal basis** | "How we use your data" (EN `:48-50`, VI `:135-137`) | contract / consent / legitimate interest | Add: "**Advertising to free accounts** and **frequency capping / fraud prevention** rely on our legitimate interest in funding a free tier; showing ads is a condition of the free tier, not personalized profiling." |

> **Explicit ATT stance (repeat verbatim in the doc and to reviewers):** ads are **non-personalized only**, so `NSPrivacyTracking` stays **`false`** (`mobile/app.json:35`) — **no `expo-tracking-transparency`, no `NSUserTrackingUsageDescription`, no ATT prompt, no IDFA access.** This matches the LOCKED "Hướng A" decision (`MONETIZATION_TECH_PLAN.md:60`, `:182`). ATT is Guideline-optional for non-personalized ads (`MONETIZATION_TECH_PLAN.md:49`); adding it would only be required if the owner later flips to personalized ads (Workstream C, `MONETIZATION_TECH_PLAN.md:200-214`).

### 7.2 Terms of Use (EULA) — what to RE-ADD

| # | Location in `TERMS_OF_USE.md` | Change |
|---|---|---|
| **T1. Header note** | Blockquote `:3` "free with no in-app purchases and no subscriptions" | **Replace** with: "DeutschFlow is free to use with an optional auto-renewable **PRO subscription** (in-app purchase) and shows non-personalized ads to free accounts." |
| **T2. §4 rewrite → "Subscriptions and free access"** | EN `:21-23`, VI `:69-71` (currently "no in-app purchases and no subscriptions") | Replace with a full auto-renewable-subscription disclosure (see block below). This is the Guideline 3.1.2 metadata that Apple requires **inside** the EULA/binder, and it must mirror the paywall copy. |
| **T3. Ads clause** | new §, after §4 | "Free (non-trial) accounts are shown non-personalized advertising to support the free tier. PRO subscribers are not shown ads. Rewarded ads grant temporary in-app **AI speaking credits** (consumable) — they are a bonus, not a purchasable tier, and never replace the PRO subscription." (Mirrors the Guideline 3.1.1-safe consumable-credit design.) |
| **T4. §9 Termination / refunds** | EN `:41-43`, VI `:89-91` | Keep, but add: "Subscriptions are managed by Apple; cancellations and refunds follow Apple's policies and are handled in **iOS Settings → Apple ID → Subscriptions**." |

**Required §4 subscription-disclosure block (Guideline 3.1.2 language — add to both EN and VI):**

> **Subscriptions.** DeutschFlow offers an optional **auto-renewable subscription, "DeutschFlow PRO"** (monthly and yearly), which unlocks the full AI budget and removes ads.
> - Payment is charged to your **Apple ID** at confirmation of purchase.
> - The subscription **automatically renews** at the same price unless auto-renew is turned off **at least 24 hours before** the end of the current period.
> - Your Apple ID is charged for renewal **within 24 hours before** the period ends.
> - **Manage or cancel** anytime in **iOS Settings → Apple ID → Subscriptions**; cancellation takes effect at the end of the current paid period.
> - The **7-day PRO trial** available to new accounts is a limited free preview and involves **no payment**; it is separate from the paid subscription and simply ends after 7 days.
> - Price, currency, and duration for each plan are shown on the in-app upgrade screen before purchase.

> **Cross-platform billing consistency (P0 from `STUDENT_PLANS_REVIEW.md:12,84-86,139`):** the web plan today is a **one-time purchase** (`StripePaymentService.java:90` `Mode.PAYMENT`, expires silently) while Apple is **auto-renewable** (`SubscriptionActivationService.java:84`). Per the LOCKED decision, **web is labeled "gói N ngày" (N-day pack), NOT "subscription"** — so the Terms must **not** call the *web* purchase a subscription. Word §4 so "auto-renewable subscription" describes **only the Apple/iOS PRO purchase**; describe web PRO separately as a fixed-duration pack. This keeps `/terms` truthful on both platforms.

### 7.3 App Store Connect "App Privacy" nutrition labels — deltas from v1.0

`plans/appstore/APP_PRIVACY_LABELS.md` is the v1.0 (free-only) answer set. It **excludes** Advertising Data and Purchases (`APP_PRIVACY_LABELS.md:40` "Advertising Data / IDFA — no ad SDK, no ATT"; `:39` "Purchases / Payment Info — no IAP in v1.0"). For v1.1, **add two data types** and keep **Tracking = No** everywhere.

| ASC data type | Purpose | Linked to user? | Used to Track? | Rationale |
|---|---|---|---|---|
| **Advertising Data** *(add)* | Third-Party Advertising | **No** (not tied to account id — ad SDK runs client-side, free tier) | **No** — non-personalized, no cross-app linking | AdMob non-personalized rewarded (+ any banner); frequency-cap/fraud only |
| **Purchases** *(add)* | App Functionality | **Yes** (entitlement is tied to the account) | **No** | Apple IAP → `user_subscriptions` ledger via `/api/payments/apple/verify` (`AppleIapController.java:51`) |

- **Everything already declared in v1.0 stays** (Contact Info, User Content, Identifiers, Usage Data — all `Tracking:No`, per `APP_PRIVACY_LABELS.md:9-35`).
- **Do NOT add "Device Advertising ID (IDFA)"** and **do NOT** answer "Used to Track You = Yes" for any type — non-personalized ads do not track (this is the whole reason ATT is skipped). Guarding against this exact mismatch is called out in `MONETIZATION_TECH_PLAN.md:182`.
- **Privacy manifest alignment (`mobile/app.json:34-51`):** the app-level manifest keeps `NSPrivacyTracking: false` (`app.json:35`) and `NSPrivacyTrackingDomains: []` (`:36`). The Google Mobile Ads SDK (≥ 11.2.0) ships **its own** `PrivacyInfo.xcprivacy` that Xcode auto-merges, so you do **not** add AdMob domains to the app manifest (`MONETIZATION_TECH_PLAN.md:171`). Optionally add an `AdvertisingData` entry with `Tracking:false` to the app manifest to match the label, but the ASC questionnaire is the enforced disclosure.
- **Consumable-credit note for the reviewer:** rewarded-ad "speaking credits" are a **consumable in-app reward**, not a purchasable product and not a permanent tier unlock — Guideline 3.1.1-safe, no "buy button replacement." Keep this consistent with §7.2-T3.

---

## 8. Build & submission sequencing (v1.1)

Because `runtimeVersion.policy = "fingerprint"` and both additions (IAP + ads) are **native**, neither can ship via OTA — everything rides in **one** new production build (`MONETIZATION_TECH_PLAN.md:220`, `:229`). Legal/ASC-metadata steps are decoupled and can proceed in parallel, but must land **before** "Submit for Review."

### 8.1 Ordered sequence

| Phase | Step | Depends on | Cite |
|---|---|---|---|
| **0 — Config prereqs** (parallel) | (a) Set backend env **`APPLE_BUNDLE_ID=com.cudinh.mydeutschflow`** (default is wrong: `com.deutschflow.app`). (b) Ship **migration V242** aligning `apple_products.product_id` to the real ASC IDs + set `is_active=FALSE` for ULTRA. (c) Ensure **Paid Apps Agreement + W-8BEN + banking = Active**. | — | `MONETIZATION_TECH_PLAN.md:68,70-80,224` |
| **1 — ASC products** | Create **Subscription Group "DeutschFlow PRO"** → PRO **monthly + yearly** auto-renewable, product IDs **byte-for-byte** matching the V242 catalog. Create AdMob app + rewarded unit under bundle `com.cudinh.mydeutschflow`. Add Sandbox testers. | 0(b),0(c) | `MONETIZATION_TECH_PLAN.md:133-136,184` |
| **2 — Native build (one commit)** | `expo install expo-iap react-native-google-mobile-ads`; add plugins + AdMob App ID to `app.json`; enable iOS paywall: **`PAYWALL_ENABLED = true`** (currently `Platform.OS !== 'ios'`, `paywall.ts:13`); `expo prebuild --clean`. Build all JS workstreams (paywall / ads / entitlement gate). Parameterize turns-per-ad + seconds-per-turn as remote config (§9). | 1 | `MONETIZATION_TECH_PLAN.md:225-227`, `paywall.ts:13` |
| **3 — Backend provider ON + ASSN** | Set `APPLE_APP_APPLE_ID`, `APPLE_ROOT_CERT_DIR`, `APPLE_IAP_ENVIRONMENT`, `APPLE_IAP_ONLINE_CHECKS`, `ads.admob.ssv.*`; register **ASSN V2 URL** → `.../api/payments/apple/notifications` (`AppleIapController.java:72`). Verify sandbox `/verify` (`AppleIapController.java:51`) → `/auth/me/plan` returns PRO; verify AdMob SSV callback credits seconds. | 0,2 | `MONETIZATION_TECH_PLAN.md:82-90,228` |
| **4 — Legal redeploy** | Apply §7.1 + §7.2 edits to `PRIVACY_POLICY.md` + `TERMS_OF_USE.md`; bump `EFFECTIVE_DATE`; run `node frontend/scripts/gen-legal.mjs`; build + Amplify deploy; **verify live** `https://mydeutschflow.com/privacy` + `/terms` show ads + subscription. | — (parallel from Phase 0) | `gen-legal.mjs:25,47-62` |
| **5 — Production build** | `eas build -p ios --profile production` (autoIncrement bumps buildNumber; marketing `1.1.0`) → `eas submit -p ios --profile production --latest`. | 2,3 | `MONETIZATION_TECH_PLAN.md:229` |
| **6 — App Privacy update** | In ASC → App Privacy, **add Advertising Data + Purchases** per §7.3 (Tracking=No). Do **not** re-declare Sentry (inactive). | 4,5 | `APP_PRIVACY_LABELS.md:38-40`, `MONETIZATION_TECH_PLAN.md:269` |
| **7 — Submit** | ASC metadata + review notes (demo account, sandbox-purchase steps, "ads appear on free accounts", delete-account path). Submit for Review (Phased Release). | 4,5,6 | `MONETIZATION_TECH_PLAN.md:239-240,269` |

### 8.2 Hard ordering constraints

- **Phase 0 gates every IAP test.** With the wrong `APPLE_BUNDLE_ID`, `AppleJwsVerifier` rejects **every** transaction (`INVALID_APP_IDENTIFIER`) once verification is enabled — dormant until `root-cert-dir` is set, but must be fixed before any sandbox purchase (`MONETIZATION_TECH_PLAN.md:68,146`).
- **ASC products (Phase 1) must exist before the paywall renders anything** — `AppleProductCatalog.find()` matches product IDs byte-for-byte; a mismatch = empty paywall / "unknown product" (`MONETIZATION_TECH_PLAN.md:70,147`).
- **ASSN URL must be registered (Phase 3) before submit** or server-side subscriptions never expire/refund — the app would show PRO after expiry (`MONETIZATION_TECH_PLAN.md:90,148`).
- **Legal (Phase 4) and App Privacy (Phase 6) must be live before Submit (Phase 7).** The `/privacy` + `/terms` URLs are the ASC-registered ones (`privacy.ts:5` publishes to `https://mydeutschflow.com/privacy`); if they still say "no ads / no IAP" at review time, it's a near-certain rejection.
- **One fingerprint only.** Bundle all native deps in a single prebuild so there's exactly one fingerprint change; OTA resumes only for builds sharing the new fingerprint (`MONETIZATION_TECH_PLAN.md:220,229`).

### 8.3 Build-order checklist

- [ ] **0a** `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow` set on prod backend env
- [ ] **0b** Migration `V242` (Apple product IDs → ASC + ULTRA `is_active=FALSE`) shipped
- [ ] **0c** Paid Apps Agreement + W-8BEN + banking = Active in ASC
- [ ] **1** ASC Subscription Group "DeutschFlow PRO" + monthly/yearly products live; AdMob app + rewarded unit created; Sandbox testers added
- [ ] **2** `expo-iap` + `react-native-google-mobile-ads` installed; plugins + AdMob App ID in `app.json`; `PAYWALL_ENABLED = true`; reward knobs parameterized; single `prebuild --clean`
- [ ] **2** Backend: `AdMobSsvController` + `AdMobSsvVerifier` + `AdCreditService` + migration `V244__ad_rewarded_credits.sql`; `transcribe()` tier branch
- [ ] **3** `payment.apple.*` + `ads.admob.ssv.*` env set; ASSN V2 URL registered (Sandbox + Production); sandbox `/verify` and SSV callback green
- [ ] **4** `PRIVACY_POLICY.md` + `TERMS_OF_USE.md` re-add ads + IAP; `EFFECTIVE_DATE` bumped; `gen-legal.mjs` run; Amplify deployed; live `/privacy` + `/terms` verified
- [ ] **5** `eas build -p ios --profile production` → `eas submit`
- [ ] **6** ASC App Privacy: Advertising Data + Purchases added, Tracking=No everywhere
- [ ] **7** Review notes written (sandbox-purchase steps, "ads on free accounts", delete-account path); Submit for Review

---

## 9. Open questions / calibration

### 9.1 Calibrate with live data (post-launch)

The economics were modeled from `AiCostEstimator.java` but the **dominant variable cost is Whisper STT**, and both the cost side (audio-seconds) and the revenue side (eCPM) are estimates until measured.

| # | Question | Current assumption | How to resolve | Decision rule |
|---|---|---|---|---|
| **Q1. Real VN AdMob eCPM** | ~$2–5/view (≈50–125đ) | Estimate | AdMob console after 1–2 wks of live fill under bundle `com.cudinh.mydeutschflow` | If sustained eCPM **< ~$2.5** → drop to **1 turn/ad** or **10 s cap** (LOCKED background rule) |
| **Q2. Measured prod audio-seconds/turn** | worst-case 15 s (the cap); realistic ~10 s | Modeled: STT = `0.006/60` USD/s = ~2.54đ/s at 25400 (`AiCostEstimator.java:33,45,107`) | Aggregate real `whisper` durations from `stt_usage_events` | If p50 turn ≫ 10 s, worst-case per ad rises toward 76đ (2×15 s) — re-check margin vs Q1 |
| **Q3. Final ads/day cap** | ~5 ads/day | Lock says "cap ~5" | A/B on retention + revenue/DAU; watch ad-fatigue on convert-to-PRO | Bounded loss/ad ≈ 76–96đ; cap × loss must stay < eCPM × cap headroom |
| **Q4. Per-ad credit size** | 2 speaking turns/ad, mic hard-capped **15 s** each | Lock (gate by audio-seconds, not sentence count) | Measure turns actually consumed per rewarded view vs eCPM | If unprofitable at live eCPM → **1 turn/ad** first, then **10 s cap** (both are config knobs; parameterize in Phase 2 so it's a JS/config change, not a rebuild) |
| **Q5. PRO price points** | monthly + yearly (VN pricing TBD) | Placeholder in ASC | Set in ASC; StoreKit returns localized `displayPrice` (never hardcode) | Yearly discount tuned to conversion; paywall shows Apple `displayPrice` (`MONETIZATION_TECH_PLAN.md:104,119`) |
| **Q6. Trial→ad-gated cliff** | Post-trial DEFAULT = **0 base AI/day** | Lock | Watch D8–D14 retention after trial ends (the moment AI goes ad-gated) | If churn spikes at day 7, consider a tiny free daily floor **or** stronger PRO upsell at the cliff — a tuning input, not a re-lock |

> **The credit knobs are cheap to change but the ad SDK is not:** turns-per-ad and the 15 s→10 s cap are config constants (calibratable via a JS/OTA update **if** parameterized in the first native build — §4.3/§4.5). Enabling/disabling the AdMob SDK itself is native → requires a new production build. Parameterize Q3/Q4 as remote-readable config in Phase 2 so post-launch calibration doesn't force a resubmit.

### 9.2 Top Apple-review risks for the ad + IAP version

| Risk | Guideline | Mitigation | Cite |
|---|---|---|---|
| **Paywall missing price / renewal period / Restore / Terms+Privacy links** | 3.1.2 / 3.1.1 | Each plan card shows localized `displayPrice` + "auto-renews monthly/yearly" + Restore button + EULA/Privacy links + manage-subscription link | `MONETIZATION_TECH_PLAN.md:119,149,243` |
| **App Privacy labels vs manifest mismatch** (e.g., declaring IDFA/Tracking) | 5.1.1 | Keep `NSPrivacyTracking:false` (`app.json:35`); label Advertising Data as **Tracking=No**; don't add IDFA | `MONETIZATION_TECH_PLAN.md:182`, §7.3 |
| **Live legal pages still say "no ads / no IAP"** at review | 5.1.1 / 2.3 (accurate metadata) | Phase 4 must be deployed + verified before Submit | `privacy.ts:5`, `PRIVACY_POLICY.md:34,36` |
| **Rewarded credits read as a "buy-button replacement"** or alternate purchase path | 3.1.1 | Frame credits as **consumable bonus**, never a tier; PRO is the only paid unlock via Apple IAP | §7.2-T3 |
| **Ads on sensitive/active screens** (recording, exam, auth) | 2.3.1 / UX | Rewarded ad is user-initiated only; never on `exam-attempt`, `(auth)`, `upgrade`; no passive inventory while recording | `MONETIZATION_TECH_PLAN.md:177` |
| **Kids Category + AdMob** | 1.3 | Do **not** enroll in Kids Category (privacy policy already says "not enrolled", `PRIVACY_POLICY.md:78`); age rating = teen | `MONETIZATION_TECH_PLAN.md:184,193` |
| **Delete-account path (review notes)** | 5.1.1(v) | ✅ **RESOLVED 2026-07-03** — the `messages` + `class_channel_messages` FK bug was fixed, deployed to prod (V243), and CI-verified (`AccountDeletionServiceDbTest` 2/2 vs real Postgres). Review notes point to Profile → Delete account | audit 2026-07-03 |
| **ASSN not registered → server shows PRO after expiry** | 3.1.2 (functional subscriptions) | Register ASSN V2 URL in Phase 3 (both Sandbox + Production) | `MONETIZATION_TECH_PLAN.md:90,136` |

---

*Generated 2026-07-03 from locked owner decisions; calibrate ad economics against live eCPM before shipping.*
