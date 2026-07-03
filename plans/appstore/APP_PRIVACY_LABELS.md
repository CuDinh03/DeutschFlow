# DeutschFlow — App Store Connect "App Privacy" answers (v1.0 free-only)

> Evidence-backed from the `mobile/` code (2026-07-03). Fill these into **ASC → your app → App Privacy → Edit**.
> Overall answer to *"Do you or your third-party partners collect data from this app?"* → **YES**.
> **Nothing is used for Tracking** (`NSPrivacyTracking:false`, no ATT, PostHog is first-party analytics, no ad SDK). All transport is HTTPS.
>
> ⚠️ This CORRECTS the older runbook note that said "declare only PostHog analytics." The app also collects **Contact Info, User Content, and Identifiers** — under-declaring them is a **Guideline 5.1.1** privacy rejection risk.

## ✅ Data types to SELECT (declare) in ASC

### Contact Info
| ASC data type | Purpose | Linked to user? | Tracking? | Evidence |
|---|---|---|---|---|
| **Email Address** | App Functionality | **Yes** | No | `app/(auth)/register.tsx` → `POST /auth/register {email}`; login |
| **Name** | App Functionality | **Yes** | No | `register.tsx` `displayName` |
| **Phone Number** | App Functionality | **Yes** | No | `register.tsx` `phoneNumber` (VN-pattern validated) |

### User Content
| ASC data type | Purpose | Linked? | Tracking? | Evidence |
|---|---|---|---|---|
| **Audio Data** | App Functionality | **Yes** | No | `lib/speakingApi.ts` → `POST /ai-speaking/transcribe` (m4a) for AI speaking/grading |
| **Photos or Videos** | App Functionality | **Yes** | No | `lib/studentClassesApi.ts` homework upload → presigned S3 |
| **Other User Content** | App Functionality | **Yes** | No | AI chat messages, weekly-submission transcripts, homework text/docs |

### Identifiers
| ASC data type | Purpose | Linked? | Tracking? | Evidence |
|---|---|---|---|---|
| **User ID** | App Functionality, **Analytics** | **Yes** | No | numeric account id; `lib/analytics.ts` `posthog.identify(id,{role})` |
| **Device ID** *(conservative — see note 3)* | App Functionality | **Yes** | No | Expo push token → `POST /profile/me/push-token` |

### Usage Data
| ASC data type | Purpose | Linked? | Tracking? | Evidence |
|---|---|---|---|---|
| **Product Interaction** | Analytics | **Yes** | No | PostHog events (`login_*`, `register_*`, …), linked to account id via `identify()` |
| **Other Usage Data** | Analytics | **Yes** | No | super-properties: `platform`, `app_version`, `subscription_tier` |

## ❌ Do NOT declare (verified NOT collected)
- **Diagnostics / Crash Data / Performance Data** — Sentry is disabled (empty DSN, no-op `lib/observability.ts`).
- **Purchases / Payment Info** — no IAP in v1.0 (free-only).
- **Advertising Data / Device Advertising ID (IDFA)** — no ad SDK, no ATT.
- **Location** (no `expo-location`), **Contacts**, **Calendar**, **Health & Fitness**, **Financial Info**, **Sensitive Info**, **Browsing/Search History**.

## Answers to the ASC prompts (summary)
- *"Is this data used to track you?"* → **No** for every type (there is no tracking anywhere).
- *"Is this data linked to the user's identity?"* → **Yes** for every type above (all tied to the account / numeric user id).
- **Purposes:** *App Functionality* for account + content + push; *Analytics* for PostHog usage + user id. (No "Third-Party Advertising", no "Developer's Advertising or Marketing", no "Product Personalization".)

## Notes / reasoning
1. **Why "Linked = Yes" for analytics:** PostHog `identify(numericUserId,{role})` associates all product-interaction events with the account's user id (`lib/analytics.ts:65`, called from `stores/useAuthStore.ts`). Because that id maps to an account (which has the email), Apple treats the data as *linked to identity*. Email/name are NOT sent as PostHog traits — only the numeric id + role — but that still counts as linked.
2. **No tracking:** "Tracking" (Apple) means linking with third-party data for ads or sharing with data brokers. DeutschFlow does neither. Keep `NSPrivacyTracking:false`, no `NSUserTrackingUsageDescription`, no ATT prompt.
3. **Device ID (push token):** an Expo push token is device-scoped and tied to the account. It isn't IDFV, so declaring it is a conservative choice; declaring it under Identifiers → *App Functionality* is the safe answer and costs nothing.

## ⚠️ Optional (recommended before the production build): align the privacy manifest
`mobile/app.json → ios.privacyManifests.NSPrivacyCollectedDataTypes` currently lists **only** the two analytics types (`ProductInteraction`, `OtherUsageData`) and marks them `Linked:false`. To match the (accurate) nutrition labels above, it ideally also lists **Contact Info / User Content / Identifiers**, and the analytics types should be `Linked:true` (since `identify()` links them to the account id). Apple can cross-check the manifest against the ASC labels. This is a polish item, **not** a submission blocker — the ASC questionnaire above is the enforced disclosure. Ask me to apply the manifest edit if you want it in this build.
