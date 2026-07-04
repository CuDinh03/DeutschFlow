/**
 * Build-time feature flags (plain env, not PostHog — see lib/flags.ts for PostHog-gated UI).
 *
 * MARKETPLACE_ENABLED gates the C2C teacher marketplace (public teacher listing + 1:1 session
 * booking). Hidden by default for v1.0: it is outside the agreed B2B GTM and its booking flow shows
 * a "Tổng thanh toán" total with no payment processor wired (offline/manual settlement), so a student
 * reaching it hits a half-built money flow. The backend endpoints and pages stay in code as Plan-C
 * optionality — flip this on with `NEXT_PUBLIC_MARKETPLACE_ENABLED=true` to re-enable, no code change.
 */
export const MARKETPLACE_ENABLED = process.env.NEXT_PUBLIC_MARKETPLACE_ENABLED === 'true'

/**
 * TEACHER_AI_TOOLS_ENABLED gates the teacher "Công cụ AI" sidebar section (Ngữ pháp AI, Tạo Tài
 * liệu AI, Tạo ảnh AI → /v2/teacher/tools/*). Hidden by default: two of these (AI grammar and AI
 * image generation) currently 500 in prod (LLM env not wired), so the whole section is temporarily
 * removed from the teacher UI. The pages/endpoints stay in code — flip this on with
 * `NEXT_PUBLIC_TEACHER_AI_TOOLS_ENABLED=true` to re-enable once the AI backend is healthy, no code change.
 */
export const TEACHER_AI_TOOLS_ENABLED = process.env.NEXT_PUBLIC_TEACHER_AI_TOOLS_ENABLED === 'true'
