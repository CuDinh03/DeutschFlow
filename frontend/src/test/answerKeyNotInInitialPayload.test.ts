import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A3 — cổng tĩnh: hai runner không còn đọc đáp án từ payload ĐỀ (thứ tải về trước khi trả lời).
 *
 * Đáp án chỉ được đọc từ kết quả chấm SAU khi trả lời/nộp: `result?.correctAnswer` (POST
 * /practice/catalog/{id}/grade) và `review?.correct_*` (GET /skill-tree/practice/{id}/review).
 * Quay về đọc `q.correctAnswer` / `exercise.correct_index` hay gọi lại API cũ là đỏ ngay.
 */

const FE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function source(rel: string): string {
  const raw = readFileSync(resolve(FE_ROOT, rel), 'utf8')
  // Bỏ chú thích: tài liệu trong file được phép nhắc tên trường cũ để giải thích lịch sử.
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const EXERCISE_PAGE = 'src/app/v2/student/exercises/[id]/page.tsx'
const PRACTICE_PAGE = 'src/app/v2/student/practice/[nodeId]/[skill]/page.tsx'
const PRACTICE_API = 'src/lib/practiceApi.ts'

describe('A3: answer key never comes from the initial payload', () => {
  it('exercise runner reads correctAnswer only from the grade result', () => {
    const src = source(EXERCISE_PAGE)
    const uses = src.match(/[\w?.]*correctAnswer/g) ?? []
    expect(uses.length).toBeGreaterThan(0)
    for (const use of uses) expect(use).toBe('result?.correctAnswer')
    expect(src).not.toMatch(/contentJson|parsePracticeContent|gradePractice\(|correct_index/)
    expect(src).not.toMatch(/practiceApi\.(get|submit)\(/)
  })

  it('practice API client no longer calls the answer-bearing endpoints', () => {
    const src = source(PRACTICE_API)
    expect(src).not.toMatch(/\/practice\/exercises/)
    expect(src).not.toMatch(/correctAnswer\s*\?:/) // không còn kiểu đề có đáp án
    expect(src).not.toMatch(/contentJson/)
  })

  it('skill practice runner reads correct_* only from the post-submit review', () => {
    const src = source(PRACTICE_PAGE)
    const uses = src.match(/[\w?.]*\bcorrect_(index|answer)\b/g) ?? []
    for (const use of uses) {
      // Khai báo kiểu ExerciseReview (`correct_index?: number`) hoặc đọc qua `review?.` / `review.`
      expect(use).toMatch(/^(review\??\.)?correct_(index|answer)$/)
    }
    expect(src).not.toMatch(/exercise\.correct_(index|answer)/)
    expect(src).not.toMatch(/exercise\.(accept_also|explanation_\w+|grammar_rule_vi)/)
    // Đề lấy từ /quiz, không phải GET /skill-tree/practice/{id} (bản kèm đáp án).
    expect(src).toMatch(/`\/skill-tree\/practice\/\$\{sessionId\}\/quiz`/)
    expect(src).not.toMatch(/`\/skill-tree\/practice\/\$\{sessionId\}`/)
  })

  it('the Exercise type of the quiz payload declares no answer field', () => {
    const src = source(PRACTICE_PAGE)
    const iface = src.match(/interface Exercise \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(iface).not.toBe('')
    expect(iface).not.toMatch(/correct_|accept_also|explanation|expected_|example_answer|grading_keywords/)
  })
})
