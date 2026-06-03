# Phase 1 — Mobile hardening (activation guide)

> Scaffolds are committed as **guarded no-ops** so the app keeps building with no new native deps.
> Each item below lists the exact steps to activate. None require code rewrites — only install +
> config + (for cert pinning) on-device verification.

## S14 — Crash/error reporting (Sentry)

Scaffold: `mobile/lib/observability.ts` (wired in `app/_layout.tsx` via `initObservability()`), DSN
read from `app.json` → `extra.sentryDsn` (currently `""` → disabled).

Activate:
1. `cd mobile && npx expo install @sentry/react-native`
2. Add the config plugin to `app.json` `plugins`:
   ```json
   ["@sentry/react-native/expo", { "organization": "<org>", "project": "<project>" }]
   ```
3. Set the DSN: `app.json` → `extra.sentryDsn`, or inject `SENTRY_DSN` via EAS env (preferred).
4. In `lib/observability.ts`: add `import * as Sentry from '@sentry/react-native'` and uncomment the
   `Sentry.init({...})` block (already scrubs the `Authorization` header in `beforeSend`).
5. Optional: `export default Sentry.wrap(RootLayout)` in `app/_layout.tsx`.

## EAS init (prereq for builds + push + Sentry source maps)

`app.json` → `extra.eas.projectId` is still the placeholder `YOUR_EAS_PROJECT_ID`.
Run `cd mobile && eas init` (needs your Expo account). This also unblocks push tokens
(`hooks/usePushNotifications.ts` already gates on a real projectId).

## S12 — TLS certificate (SPKI) pinning

Scaffold: `mobile/lib/certPinning.ts` (wired via `initCertPinning()`), `CERT_PINNING_ENABLED = false`.

> ⚠️ **Let's Encrypt rotation footgun.** `api.mydeutschflow.com` is served by Let's Encrypt; the
> LEAF cert rotates every ~60-90 days. Pinning the leaf alone bricks the app at renewal. Pin the
> **stable ISRG Root X1** SPKI as primary, plus a backup, and ship pin updates *ahead* of changes.

Activate:
1. `cd mobile && npx expo install react-native-ssl-public-key-pinning`
2. Add its Expo config plugin to `app.json` `plugins`.
3. `./mobile/scripts/compute-spki-pins.sh` → copy ≥2 pins into `PUBLIC_KEY_HASHES`
   (recommended: ISRG Root X1 + one backup; avoid relying on the leaf).
4. In `lib/certPinning.ts`: add `import { initializeSslPinning } from 'react-native-ssl-public-key-pinning'`,
   uncomment the call, set `CERT_PINNING_ENABLED = true`.
5. **Verify on a physical device** (a wrong pin blocks all traffic) before any release.

Reference pins computed 2026-06-03 (do NOT enable as-is — leaf/intermediate rotate):
- leaf `qUi/Vy2PN0FAFuJSJ+wqKk4w7UceGYcq4ayxcP3S4LU=` (CN=api.mydeutschflow.com)
- intermediate `iFvwVyJSxnQdyaUvUERIf+8qk7gRze3612JMwoO3zdU=` (Let's Encrypt E8)

## S13 — Jailbreak/root detection + screen-capture protection (SCAFFOLDED)

Scaffolds committed as guarded no-ops; `useAppBackgrounded` already works (RN AppState, no dep).

**Jailbreak/root** — `mobile/lib/deviceIntegrity.ts` (wired in `_layout` via `initDeviceIntegrity()`):
1. `cd mobile && npx expo install jail-monkey`
2. Add `import JailMonkey from 'jail-monkey'`; uncomment the block in `checkDeviceIntegrity()`.
3. Use the result as a SOFT signal — warn / disable high-risk actions / raise a server risk flag.
   **Never hard-block** (false positives on legit modified devices + CI).

**Screen capture** — `mobile/lib/screenProtection.ts`:
- `usePreventScreenCapture()`: 1) `npx expo install expo-screen-capture`, 2) add
  `import * as ScreenCapture from 'expo-screen-capture'`, 3) uncomment the body, 4) call the hook in
  sensitive screens (`(student)/profile.tsx`, `settings/profile.tsx`, `upgrade.tsx`, `exam-attempt.tsx`).
- `useAppBackgrounded(onChange)`: **works now.** In `app/_layout.tsx`, track a `hidden` state and
  render an opaque overlay while hidden so app content isn't exposed in the OS app-switcher snapshot:
  ```tsx
  const [hidden, setHidden] = useState(false)
  useAppBackgrounded(setHidden)
  // …then render {hidden && <View style={StyleSheet.absoluteFill} className="bg-bg" />}
  ```

## S20b — Full Capacitor/Swift removal (MOSTLY DONE)

S20 removed the plaintext-token path; S20b finished the retirement:
- **Done:** refactored all 5 remaining web files off `@capacitor` (web-safe behavior —
  `statusBar` no-op, `haptics` → Web Vibration API, `NetworkBanner` → `navigator.onLine`,
  `usePushNotifications` → no-op stub, `NativeAuthProvider` → crash-reporting + offline banner only).
  Deleted native projects: `frontend/ios`, `frontend/android`, `capacitor.config.json`, `ios-native/`
  (74 tracked files). `next build` verified.
- **Remaining (deferred):** remove the 10 `@capacitor/*` lines from `frontend/package.json` +
  lockfile. Deferred because package.json had uncommitted WIP at the time — entangling would sweep
  that WIP into the security PR. After the WIP is committed, run:
  `cd frontend && npm uninstall @capacitor/android @capacitor/cli @capacitor/core @capacitor/haptics @capacitor/ios @capacitor/keyboard @capacitor/network @capacitor/preferences @capacitor/push-notifications @capacitor/status-bar`
  (the deps are currently unused — nothing imports them — so this is safe cleanup, not a code change).
- **Dead CSS** (`html.native` rules, `--kb-height`) left in `globals.css` — harmless (selectors no
  longer match; `var(--kb-height)` defaults to 0). Optional cleanup.
