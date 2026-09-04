/**
 * Gate 0 remediation #1 — TkModal PORTAL ROLE cho đủ 4 role.
 *
 * TkModal portal ra document.body (ngoài app subtree) nên phải TỰ mang `.ga-scope` + đúng
 * `data-role` — role đến từ GaRoleProvider mà GaShell render (page không phải truyền tay).
 *
 * Về "--ga-accent resolve đúng theo role": jsdom không cascade custom property từ stylesheet,
 * nên phép chứng minh gồm hai nửa deterministic:
 *   (a) phần tử dialog `matches('.ga-scope[data-role="<role>"]')` — đúng selector compound;
 *   (b) galerie.css có rule cho chính selector đó định nghĩa --ga-accent = giá trị kỳ vọng.
 * (a) + (b) ⇒ trình duyệt áp accent đúng role cho content. Bằng chứng trình duyệt thật cho
 * student có trong docs/wave0-gate/measurements.json (portalScope.accent).
 *
 * Query bằng role="dialog" (semantic, controlled) — không document.activeElement, không lookup brittle.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TkModal } from '@/components/ui-v2/TkModal'
import { GaRoleProvider } from '@/components/ui-v2/gaScope'
import type { RoleId } from '@/components/ui-v2/nav'

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const f = (k: string) => k
    ;(f as unknown as { has: (k: string) => boolean }).has = () => false
    return f
  },
  useLocale: () => 'vi',
}))

const GALERIE = readFileSync(join(__dirname, '../../styles/galerie.css'), 'utf8')

const EXPECTED_ACCENT: Record<RoleId, string> = {
  student: '#FFCD00',
  teacher: '#7C56C8',
  admin: '#27406B',
  org: '#11888A',
}

/** Trích --ga-accent trong rule có selector compound `.ga-scope[data-role="<role>"]`. */
function accentFromCss(role: RoleId): string | null {
  const idx = GALERIE.indexOf(`.ga-scope[data-role="${role}"]`)
  if (idx === -1) return null
  const block = GALERIE.slice(GALERIE.indexOf('{', idx), GALERIE.indexOf('}', idx))
  return block.match(/--ga-accent:\s*(#[0-9A-Fa-f]{6})/)?.[1] ?? null
}

function renderInShell(role: RoleId, extra?: { gaRole?: RoleId }) {
  // GaRoleProvider chính là cơ chế GaShell dùng — mô phỏng đúng cây shell, không sửa page nào.
  return render(
    <GaRoleProvider role={role}>
      <div className="ga-scope" data-role={role} data-testid="app-subtree">
        <TkModal open onOpenChange={() => {}} title="Tiêu đề" gaRole={extra?.gaRole}>
          Nội dung
        </TkModal>
      </div>
    </GaRoleProvider>,
  )
}

describe('TkModal — portal role đủ 4 role (student/teacher/admin/org)', () => {
  for (const role of ['student', 'teacher', 'admin', 'org'] as RoleId[]) {
    it(`role=${role}: content ngoài app subtree, có ga-scope, đúng data-role, accent rule khớp`, () => {
      renderInShell(role)
      const dialog = screen.getByRole('dialog')
      // 1) Nằm NGOÀI app subtree (portal thật).
      expect(screen.getByTestId('app-subtree').contains(dialog)).toBe(false)
      // 2) Tự mang .ga-scope.
      expect(dialog.classList.contains('ga-scope')).toBe(true)
      // 3) Đúng data-role từ shell context.
      expect(dialog.getAttribute('data-role')).toBe(role)
      // 4) --ga-accent resolve đúng theo role: selector compound áp cho chính phần tử này…
      expect(dialog.matches(`.ga-scope[data-role="${role}"]`)).toBe(true)
      // …và rule của selector đó trong galerie.css định nghĩa accent đúng giá trị role.
      expect(accentFromCss(role)).toBe(EXPECTED_ACCENT[role])
      cleanup()
    })
  }

  it('prop gaRole override thắng shell context', () => {
    renderInShell('student', { gaRole: 'teacher' })
    expect(screen.getByRole('dialog').getAttribute('data-role')).toBe('teacher')
  })

  it('ngoài GaShell (không provider, không gaRole): không gán data-role sai — về accent neutral', () => {
    render(
      <TkModal open onOpenChange={() => {}} title="X">
        Nội dung
      </TkModal>,
    )
    expect(screen.getByRole('dialog').getAttribute('data-role')).toBeNull()
  })
})
