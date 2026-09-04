/**
 * Gate 0 review — FOCUS CONTRACT static scan.
 *
 * Contract: focus indicator dùng semantic token `--ga-focus` (navy #27406B, ≥3:1 trên warm paper),
 * KHÔNG dùng role accent (`--ga-accent` — student = #FFCD00 chỉ ~1.4:1, fail WCAG 3:1) và
 * KHÔNG được override theo role. Kiểm cho đủ 4 role bằng cách chứng minh token role-independent:
 * `--ga-focus` khai đúng 1 lần trong `.ga-scope` base và không xuất hiện trong bất kỳ block
 * `[data-role=…]` nào của galerie.css.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const UI_V2 = join(__dirname, '../components/ui-v2')
const GALERIE = join(__dirname, '../styles/galerie.css')

const uiFiles = readdirSync(UI_V2).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
const readUi = (f: string) => readFileSync(join(UI_V2, f), 'utf8')

describe('focus contract — token', () => {
  it('galerie.css khai --ga-focus đúng MỘT lần (role-independent, không override per-role)', () => {
    const css = readFileSync(GALERIE, 'utf8')
    // Định nghĩa = `--ga-focus:` theo sau là GIÁ TRỊ (phân biệt với usage `var(--ga-focus)`).
    const defs = css.match(/--ga-focus\s*:\s*[^;]+;/g) ?? []
    expect(defs).toHaveLength(1)
    // Không có ĐỊNH NGHĨA nào trong vùng role blocks (usage var(--ga-focus) ở rule khác thì hợp lệ).
    const roleBlocks = css.slice(css.indexOf('[data-role="teacher"]'))
    expect(roleBlocks.match(/--ga-focus\s*:\s*[^;)]+;/g) ?? []).toHaveLength(0)
  })

  it('lt-node focus ring dùng --ga-focus, không dùng --ga-accent', () => {
    const css = readFileSync(GALERIE, 'utf8')
    const line = css.split('\n').find((l) => l.includes('.lt-node:focus-visible')) ?? ''
    expect(line).toContain('var(--ga-focus)')
    expect(line).not.toContain('var(--ga-accent)')
  })
})

describe('focus contract — ui-v2 source', () => {
  it('KHÔNG còn ring-ga-accent trong bất kỳ file ui-v2 nào', () => {
    const offenders = uiFiles.filter((f) => readUi(f).includes('ring-ga-accent'))
    expect(offenders).toEqual([])
  })

  it('mọi focus-visible ring dùng ga-focus hoặc ga-red (invalid state)', () => {
    for (const f of uiFiles) {
      const src = readUi(f)
      for (const m of Array.from(src.matchAll(/focus-visible:ring-ga-([a-z-]+)/g))) {
        expect(['focus', 'red'], `${f}: focus-visible:ring-ga-${m[1]}`).toContain(m[1])
      }
      for (const m of Array.from(src.matchAll(/focus-within:ring-ga-([a-z-]+)/g))) {
        expect(['focus'], `${f}: focus-within:ring-ga-${m[1]}`).toContain(m[1])
      }
    }
  })

  it('các file có interactive element đều khai focus indicator', () => {
    // Danh sách file ui-v2 chứa phần tử tương tác do chính component render
    // (không tính file chỉ render <span>/<div> tĩnh hoặc chỉ forward props).
    const interactive = [
      'GaBtn.tsx',
      'GaShellNav.tsx',
      'GaSidebar.tsx',
      'GaTopBar.tsx',
      'LanguageToggle.tsx',
      'NotificationBell.tsx',
      'TkModal.tsx',
      'TkSeg.tsx',
      'TkTabs.tsx',
      'TkSearch.tsx',
      'DataTable.tsx',
      'GaInput.tsx',
      'GaSelect.tsx',
      'GaPopover.tsx',
      'GaTooltip.tsx',
      'TeacherPendingPill.tsx',
    ]
    for (const f of interactive) {
      const src = readUi(f)
      // Chấp nhận dùng trực tiếp `ring-ga-focus` HOẶC qua bộ class chung của trigger contract
      // (GA_TRIGGER_DEFAULT_CLASSES trong gaScope.tsx — bản thân nó chứa ring-ga-focus).
      const ok = src.includes('ring-ga-focus') || src.includes('GA_TRIGGER_DEFAULT_CLASSES')
      expect(ok, `${f} thiếu focus indicator ring-ga-focus`).toBe(true)
    }
  })

  it('static component KHÔNG tự thêm tabindex/focus ring để đạt count (W0-C3)', () => {
    for (const f of ['GaCard.tsx', 'GaCap.tsx', 'GaPageHdr.tsx', 'GaStatStrip.tsx']) {
      const src = readUi(f)
      expect(src.includes('tabIndex'), `${f} không được thêm tabIndex`).toBe(false)
      expect(src.includes('ring-ga-focus'), `${f} không cần focus ring`).toBe(false)
    }
  })
})
