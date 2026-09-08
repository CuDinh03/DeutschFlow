import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * V-12b — hai màn billing/finance phải dùng CHUNG một định nghĩa "quá hạn".
 *
 * Ca hành vi nằm ở src/lib/orgInvoice.test.ts; ca này khoá lại việc cả hai màn thật sự gọi helper
 * đó, để không ai lặng lẽ dựng lại luật riêng bằng `periodEnd`.
 */
const FE_ROOT = resolve(__dirname, '../../../../..')
const src = (rel: string) => readFileSync(resolve(FE_ROOT, rel), 'utf8')

describe('quá hạn — một định nghĩa (V-12b)', () => {
  for (const page of ['src/app/v2/org/billing/page.tsx', 'src/app/v2/admin/organizations/page.tsx']) {
    it(`${page} dùng isInvoiceOverdue, không tự dựng luật`, () => {
      const s = src(page)
      expect(s).toContain("from '@/lib/orgInvoice'")
      expect(s).toContain('isInvoiceOverdue(inv)')
      // `periodEnd` chỉ còn được dùng để HIỂN THỊ kỳ dịch vụ, không để phán quá hạn.
      expect(s).not.toMatch(/periodEnd[^\n]*(overdue|hasOverdue)/i)
      expect(s).not.toMatch(/(overdue|hasOverdue)[^\n]*periodEnd/i)
    })
  }
})
