/**
 * Icon đợt D (frontend/ICON_WEB.md): chuỗi dịch không tả icon bằng ký tự (— ✓ ! ✗), icon do component chèn qua
 * thẻ rich-text. Test dịch thật bằng next-intl ở cả ba locale để bắt lỗi cú pháp thẻ.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createTranslator } from 'next-intl'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

const LOCALES = ['vi', 'en', 'de'] as const

function load(file: string) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../messages/v2/${file}`), 'utf8'))
}

const html = (node: unknown) => renderToStaticMarkup(<>{node as ReactNode}</>)

describe('Icon đợt D: chú giải và câu đồng thuận dùng icon, không dùng ký tự', () => {
  for (const locale of LOCALES) {
    it(`${locale}: chú giải ma trận mục tiêu chèn ba ô icon`, () => {
      const messages = load(`teacher.${locale}.json`)
      const raw: string = messages.teacher.objectives.legend
      // Câu tả ba trạng thái ô (tới hết thẻ <np>): không còn ký tự — ✓ ! → thay icon.
      expect(raw.slice(0, raw.indexOf('</np>'))).not.toMatch(/[✓✗!→—]/)
      const t = createTranslator({ locale, messages, namespace: 'teacher.objectives' })
      const out = html(
        t.rich('legend', {
          na: (c) => <i data-cell="na">{c}</i>,
          ok: (c) => <i data-cell="ok">{c}</i>,
          np: (c) => <i data-cell="np">{c}</i>,
        }),
      )
      for (const cell of ['na', 'ok', 'np']) expect(out).toContain(`data-cell="${cell}"`)
    })

    it(`${locale}: câu đồng thuận golden set chèn icon khớp/lệch, trình đọc màn hình nghe chữ`, () => {
      const messages = load(`adminOps.${locale}.json`)
      const g = messages.adminOps.examGolden
      expect(g.agreeYes).toBeTruthy()
      expect(g.agreeNo).toBeTruthy()
      expect(`${g.agreeYes}${g.agreeNo}`).not.toMatch(/[✓✗]/)
      const t = createTranslator({ locale, messages, namespace: 'adminOps.examGolden' })
      const out = html(t.rich('savedAgree', { within1: 4, exact: 2, pairs: 5, pass: () => <b data-pass /> }))
      expect(out).toContain('data-pass')
      expect(out).toContain('4/5')
      expect(out).not.toContain('\u0000')
    })
  }
})
