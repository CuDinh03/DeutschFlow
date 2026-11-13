import { buildLlmsTxt } from '@/lib/llmsTxt'

/** `/llms.txt` — nội dung dựng ở `@/lib/llmsTxt` (đợt 1, 14/11/2026). */
export const dynamic = 'force-static'

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
