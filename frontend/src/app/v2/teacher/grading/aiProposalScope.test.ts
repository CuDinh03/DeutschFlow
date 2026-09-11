/**
 * Điểm AI đề xuất (`ai_score` / `ai_feedback`, R3 V323) chỉ được sống ở bề mặt GIÁO VIÊN.
 *
 * Kiểu lỗi mà test này chặn không phải lỗi logic — nó là lỗi COPY. Một PR sau cần "hiện điểm sớm cho
 * học viên" rất dễ chép nguyên khối hiển thị từ màn chấm bài sang màn học viên; lúc đó điểm nháp của
 * máy thành điểm của em ấy, và không có test hành vi nào đỏ vì màn vẫn render bình thường. Backend
 * cũng không cứu được: `StudentAssignmentDto.forStudent` không mang hai trường này, nên phía web chỉ
 * cần một lần `any` là lọt.
 *
 * Quét TĨNH, không render: mọi tệp nguồn dưới khu học viên và dưới component dùng chung của phiếu đều
 * không được nhắc tên hai trường đó. `AI_GRADED` (trạng thái bài nộp) KHÔNG bị chặn — màn học viên
 * đang dùng nó đúng cách, để đọc là "đã nộp" chứ không phải "đã có điểm".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** Khu vực KHÔNG được biết tới điểm AI đề xuất của bài tập. */
const FORBIDDEN_SCOPES = ['app/v2/student', 'components/report']

const FIELD_RE = /\bai(?:Score|Feedback|GradedAt)\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

describe('phạm vi của điểm AI đề xuất', () => {
  it('không bề mặt học viên nào (và không tờ phiếu nào) đọc ai_score / ai_feedback', () => {
    const offenders: string[] = []
    for (const scope of FORBIDDEN_SCOPES) {
      for (const file of walk(join(SRC, scope))) {
        const text = readFileSync(file, 'utf8')
        // Bỏ qua chính các dòng nói VỀ lệnh cấm (test/comment nhắc tên trường để giải thích).
        const hit = text
          .split('\n')
          .some((line) => FIELD_RE.test(line) && !/^\s*(\*|\/\/)/.test(line))
        if (hit) offenders.push(relative(SRC, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('màn chấm bài của giáo viên thì CÓ — đó là nơi duy nhất được hiện', () => {
    const text = readFileSync(join(SRC, 'app/v2/teacher/grading/page.tsx'), 'utf8')
    expect(FIELD_RE.test(text)).toBe(true)
    // Và nó phải được gắn nhãn "đề xuất", không phải trình bày như điểm cuối.
    expect(text).toContain("t('aiProposalCap')")
    expect(text).toContain("t('aiProposalHint')")
  })
})
