'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BookOpen, Lock, Play } from 'lucide-react'
import { SKILL_COLORS, SKILL_ICONS, SKILL_LABELS, type Skill } from '@/lib/skills'
import { SkillIcon } from '@/components/ui-v2'
import type { TreeMotif } from '@/lib/roadmap-tree/treeLayout'

/**
 * Bảng bên phải của cây: chạm một node thì đây là chỗ nói node đó có gì và đi tiếp bằng cách nào.
 *
 * Bốn kỹ năng nằm TRONG node — đúng như backend chia bài — nên mỗi kỹ năng là một lối vào runner
 * chấm điểm sẵn có (`/v2/student/practice/[nodeId]/[skill]`). Bảng này không tự chấm gì cả, nó chỉ
 * dẫn đường.
 */

/** Thứ tự trình bày theo wireframe: Nghe → Đọc → Nói → Viết. */
const SKILL_ORDER: Skill[] = ['hoeren', 'lesen', 'sprechen', 'schreiben']

export interface TreeNodeSummary {
  id: number
  title: string
  subtitle: string
  dayNumber: number | null
  weekNumber: number | null
  motif: TreeMotif
  skillCounts: Record<string, number>
  lessonsCompleted: number
  lessonsTotal: number
}

export interface TreeNodePanelProps {
  node: TreeNodeSummary | null
}

export function TreeNodePanel({ node }: TreeNodePanelProps) {
  const t = useTranslations('v2.student.roadmap')

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="ga-ui text-[13.5px] text-ga-muted">{t('tree.pickNode')}</p>
        <Legend />
      </div>
    )
  }

  const locked = node.motif === 'nub'
  const done = node.motif === 'leaf'
  const percent =
    node.lessonsTotal > 0 ? Math.round((node.lessonsCompleted / node.lessonsTotal) * 100) : 0

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dashed border-ga-line px-4 py-3">
        <p className="break-words font-ga-display text-[17px] font-medium text-ga-ink">
          {node.dayNumber ? t('tree.dayTitle', { day: node.dayNumber, title: node.subtitle || node.title }) : node.subtitle || node.title}
        </p>
        <p className="ga-ui mt-0.5 text-[12px] text-ga-subtle">
          {node.weekNumber ? t('tree.weekShort', { week: node.weekNumber }) : ''}
          {node.weekNumber ? ' · ' : ''}
          {t(`tree.status.${node.motif}`)}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {locked ? (
          <div className="ga-ui flex items-start gap-2 text-[13px] leading-relaxed text-ga-muted">
            <Lock size={15} className="mt-0.5 shrink-0 text-ga-subtle" aria-hidden />
            <span>{t('tree.lockedHint')}</span>
          </div>
        ) : (
          <>
            <p className="ga-ui mb-2.5 text-[11.5px] uppercase tracking-wide text-ga-subtle">
              {t('tree.skillsCap')}
            </p>
            <ul className="space-y-2">
              {SKILL_ORDER.map((skill) => {
                const count = node.skillCounts[skill.toUpperCase()] ?? 0
                return (
                  <li
                    key={skill}
                    className="flex items-center gap-2.5 rounded-ga border border-ga-line bg-ga-card px-3 py-2"
                  >
                    <SkillIcon paths={SKILL_ICONS[skill]} size={16} color={SKILL_COLORS[skill]} />
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ga-ink">
                      {SKILL_LABELS[skill]}
                      {count > 0 && (
                        <span className="ga-ui ml-1.5 text-[11.5px] font-normal text-ga-subtle">
                          {t('tree.exerciseCount', { count })}
                        </span>
                      )}
                    </span>
                    <Link
                      href={`/v2/student/practice/${node.id}/${skill}`}
                      className="ga-ui inline-flex min-h-9 shrink-0 items-center gap-1 rounded-ga px-2.5 py-1.5 text-[12px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
                      style={{ background: SKILL_COLORS[skill] }}
                    >
                      <Play size={12} aria-hidden />
                      {t('tree.practiceSkill')}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-3.5">
              <span className="block h-2 w-full overflow-hidden rounded-ga-pill border border-ga-line bg-ga-card">
                <span
                  className="block h-full rounded-ga-pill transition-[width] duration-500"
                  style={{ width: `${percent}%`, background: done ? 'var(--ga-green)' : 'var(--ga-yellow)' }}
                />
              </span>
              <p className="ga-ui mt-1.5 text-[12px] text-ga-subtle">
                {done ? t('tree.doneHint') : t('tree.progressHint', { percent })}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-dashed border-ga-line px-4 py-3">
        <Legend />
        {!locked && (
          <Link
            href={`/v2/student/learn/${node.id}`}
            className="ga-ui flex min-h-10 items-center justify-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
          >
            <BookOpen size={14} aria-hidden />
            {done ? t('tree.review') : t('tree.study')}
          </Link>
        )}
      </div>
    </div>
  )
}

function Legend() {
  const t = useTranslations('v2.student.roadmap')
  const items: { motif: TreeMotif; color: string; glyph: string }[] = [
    { motif: 'leaf', color: 'var(--ga-green)', glyph: '▲' },
    { motif: 'flower', color: 'var(--ga-gold)', glyph: '✿' },
    { motif: 'bud', color: '#7fae8a', glyph: '◗' },
    { motif: 'nub', color: 'var(--ga-subtle)', glyph: '●' },
  ]
  return (
    <ul className="ga-ui grid grid-cols-2 gap-x-3 gap-y-1 rounded-ga border border-ga-line px-3 py-2 text-[11.5px] text-ga-muted">
      {items.map((item) => (
        <li key={item.motif} className="flex items-center gap-1.5">
          <span style={{ color: item.color }} aria-hidden>
            {item.glyph}
          </span>
          {t(`tree.legend.${item.motif}`)}
        </li>
      ))}
    </ul>
  )
}
