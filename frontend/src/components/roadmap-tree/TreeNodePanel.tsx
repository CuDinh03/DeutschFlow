'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpLeft, BookOpen, Check, Lock, Play } from 'lucide-react'
import { SKILL_ICONS } from '@/lib/skills'
import { SkillIcon } from '@/components/ui-v2'
import type { TreeMotif } from '@/lib/roadmap-tree/treeLayout'
import {
  isSkillMastered,
  MASTERY_PERCENT,
  SKILL_ORDER,
  type NodePracticeStats,
} from '@/lib/roadmap-tree/practiceStats'
import { nodeDisplayTitle } from '@/lib/roadmap-tree/types'

/**
 * Bảng bên phải của cây: chạm một node thì đây là chỗ nói node đó có gì và đi tiếp bằng cách nào.
 *
 * Bốn kỹ năng nằm TRONG node — đúng như backend chia bài — nên mỗi kỹ năng là một lối vào runner
 * chấm điểm sẵn có (`/v2/student/practice/[nodeId]/[skill]`). Bảng này không tự chấm gì cả, nó chỉ
 * dẫn đường.
 */

export interface TreeNodeSummary {
  id: number
  title: string
  subtitle: string
  emoji: string
  description: string
  xpReward: number
  cefrLevel: string
  dayNumber: number | null
  weekNumber: number | null
  motif: TreeMotif
  skillCounts: Record<string, number>
  lessonsCompleted: number
  lessonsTotal: number
  /** Node đang chặn node khoá này (N7) — null khi không tra được từ `prerequisiteCode`. */
  prerequisite?: { id: number; label: string } | null
}

export interface TreeNodePanelProps {
  node: TreeNodeSummary | null
  /** Điểm luyện tập per-kỹ-năng của node đang chọn (N2) — null khi chưa tải xong. */
  stats?: NodePracticeStats | null
  /** Nhảy sang node khác trong cây — dùng cho link "tới bài đang chặn" của node khoá. */
  onJumpToNode?: (id: number) => void
}

export function TreeNodePanel({ node, stats, onJumpToNode }: TreeNodePanelProps) {
  const t = useTranslations('v2.student.roadmap')
  const locale = useLocale()

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
  const title = nodeDisplayTitle(node, locale)
  const masteredCount = SKILL_ORDER.filter((skill) => isSkillMastered(stats?.[skill])).length

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dashed border-ga-line px-4 py-3">
        <p className="break-words font-ga-display text-[17px] font-medium text-ga-ink">
          {node.emoji && (
            <span className="mr-1.5" aria-hidden>
              {node.emoji}
            </span>
          )}
          {node.dayNumber ? t('tree.dayTitle', { day: node.dayNumber, title }) : title}
        </p>
        <p className="ga-ui mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-ga-subtle">
          {node.weekNumber ? <span>{t('tree.weekShort', { week: node.weekNumber })} ·</span> : null}
          <span>{t(`tree.status.${node.motif}`)}</span>
          {node.cefrLevel && (
            <span className="rounded-ga-pill bg-ga-accent-soft px-1.5 py-px text-[10.5px] font-bold text-ga-accent">
              {node.cefrLevel}
            </span>
          )}
          {node.xpReward > 0 && <span>+{node.xpReward} XP</span>}
        </p>
        {node.description && !locked && (
          <p className="ga-ui mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-ga-muted">
            {node.description}
          </p>
        )}
        {/* CTA CHÍNH — một và chỉ một (B-04, contract S-03). Nằm trong header để không trôi
            khi cuộn danh sách kỹ năng; luyện từng kỹ năng là hành động PHỤ ở dưới. */}
        {!locked && (
          <Link
            href={`/v2/student/learn/${node.id}`}
            prefetch={false}
            className="ga-ui mt-2.5 flex min-h-11 items-center justify-center gap-1.5 rounded-ga bg-ga-accent px-3 py-2 text-[13.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus lg:min-h-10"
          >
            <BookOpen size={15} aria-hidden />
            {done ? t('tree.review') : t('tree.study')}
          </Link>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {locked ? (
          <div className="ga-ui flex items-start gap-2 text-[13px] leading-relaxed text-ga-muted">
            <Lock size={15} className="mt-0.5 shrink-0 text-ga-subtle" aria-hidden />
            {node.prerequisite ? (
              <span>
                {t('tree.unlockCondition', { target: node.prerequisite.label })}{' '}
                <button
                  type="button"
                  onClick={() => onJumpToNode?.(node.prerequisite!.id)}
                  className="inline-flex items-center gap-0.5 font-semibold text-ga-accent underline-offset-2 hover:underline"
                >
                  <ArrowUpLeft size={12} aria-hidden />
                  {t('tree.goPrereq')}
                </button>
              </span>
            ) : (
              <span>{t('tree.lockedHint')}</span>
            )}
          </div>
        ) : (
          <>
            <p className="ga-ui mb-2.5 text-[11.5px] uppercase tracking-wide text-ga-subtle">
              {t('tree.skillsCap')}
            </p>
            <ul className="space-y-2">
              {SKILL_ORDER.map((skill) => {
                const count = node.skillCounts[skill.toUpperCase()] ?? 0
                const stat = stats?.[skill]
                const mastered = isSkillMastered(stat)
                return (
                  <li key={skill}>
                    {/* Hành động phụ (B-04): cả HÀNG là một link vào runner của kỹ năng đó —
                        surface trung tính, không màu-theo-kỹ-năng (UI-06); màu chỉ còn nghĩa
                        ngữ nghĩa: xanh = đã đạt chuẩn. */}
                    <Link
                      href={`/v2/student/practice/${node.id}/${skill}`}
                      className="group flex min-h-11 items-center gap-2.5 rounded-ga border border-ga-line bg-ga-card px-3 py-2 transition-colors hover:border-ga-subtle hover:bg-ga-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus lg:min-h-0"
                    >
                      <SkillIcon
                        paths={SKILL_ICONS[skill]}
                        size={16}
                        color={mastered ? 'var(--ga-green)' : 'var(--ga-subtle)'}
                      />
                      <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ga-ink">
                        {t(`tree.skillNames.${skill}`)}
                        {count > 0 && (
                          <span className="ga-ui ml-1.5 text-[11.5px] font-normal text-ga-subtle">
                            {t('tree.exerciseCount', { count })}
                          </span>
                        )}
                        {stat?.bestScorePercent != null && (
                          <span
                            className={`ga-ui ml-1.5 inline-flex items-center gap-0.5 text-[11.5px] font-semibold ${
                              mastered ? 'text-ga-green' : 'text-ga-subtle'
                            }`}
                          >
                            {mastered && <Check size={11} aria-hidden />}
                            {t('tree.bestScore', { percent: stat.bestScorePercent })}
                          </span>
                        )}
                      </span>
                      <span className="ga-ui inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ga-subtle transition-colors group-hover:text-ga-ink">
                        <Play size={12} aria-hidden />
                        {t('tree.practiceSkill')}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {stats != null && masteredCount > 0 && (
              <p className="ga-ui mt-2 text-[12px] text-ga-subtle">
                {t('tree.skillsMastered', { done: masteredCount, threshold: MASTERY_PERCENT })}
              </p>
            )}

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

      {/* CTA Học cũ ở đáy đã dời lên header thành CTA chính (B-04) — đáy chỉ còn chú giải. */}
      <div className="border-t border-dashed border-ga-line px-4 py-3">
        <Legend />
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
