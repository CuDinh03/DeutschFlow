'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, RotateCcw, Shield,
} from 'lucide-react'
import api from '@/lib/api'
import { reviewApi, type ErrorReviewTaskDto } from '@/lib/reviewApi'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import ErrorRepairDrill from '@/components/errors/ErrorRepairDrill'
import {
  EmptyState, ErrorBanner, GaBtn, GaCap, GaPageHdr, LoadingState, TkSearch,
} from '@/components/ui-v2'

/**
 * /v2/student/errors — sổ lỗi ngữ pháp ("vết sẹo") + luyện sửa (vỏ Galerie).
 *
 * Port của /student/errors: GIỮ NGUYÊN endpoint và tham số:
 *   · GET /error-skills/me?days=30   → lỗi CHƯA sửa
 *   · GET /error-skills/me/resolved  → lỗi ĐÃ sửa (mục thu gọn)
 *   · reviewApi.getTodayTasks()      → nhiệm vụ ôn ĐẾN HẠN + lockedCount (gate PRO)
 *   · reviewApi.completeTask(id)     → tự đánh dấu xong khi drill mở từ một task và PASS
 * Drill dùng lại <ErrorRepairDrill> (components/errors) — chính component mà
 * SpeakingChatExperience đang dùng, import chứ không sao chép.
 *
 * KHÁC /v2/student/review: trang kia là hàng đợi SRS (flashcard từ vựng) + danh sách task ngữ pháp
 * đến hạn với nút "Xong" thủ công (review/page.tsx:186-208) — KHÔNG có toàn bộ sổ lỗi, không có
 * tìm kiếm, không có drill. Trang này mới là sổ lỗi đầy đủ + luyện sửa.
 *
 * Deep-link: `?focus=<errorCode>` (gợi ý GRAMMAR_DRILL từ /v2/student/stats) → lọc sẵn ô tìm kiếm.
 *
 * ⚠️ Gate PRO: v1 dùng <PremiumGate> (components/ui/PremiumGate) — component đó điều hướng sang
 * `/student/pricing` (route v1 sắp xoá) và không nằm trong danh sách giữ lại. Thay bằng thẻ nâng cấp
 * thuần v2 trỏ `/v2/payment`; số liệu `lockedCount` giữ nguyên.
 */

interface ErrorSkillDto {
  errorCode: string
  count: number
  lastSeenAt: string
  priorityScore: number
  sampleWrong?: string
  sampleCorrected?: string
  ruleViShort?: string
  resolved?: boolean
}

// Màu theo nhóm lỗi (prefix trước dấu chấm), dùng bảng màu Galerie. Nhãn giữ thuật ngữ ngữ pháp Đức.
const CAT_COLORS: Record<string, { color: string; label: string }> = {
  WORD_ORDER: { color: '#7C56C8', label: 'Wortstellung' },
  CASE:       { color: '#DA291C', label: 'Kasus' },
  ARTICLE:    { color: '#2F6FC9', label: 'Artikel' },
  VERB:       { color: '#11888A', label: 'Verb' },
  AGREEMENT:  { color: '#E07B39', label: 'Kongruenz' },
  DECLENSION: { color: '#1E9E61', label: 'Adjektiv' },
  LEXICAL:    { color: '#C79A00', label: 'Wortschatz' },
}

function catStyle(code: string) {
  const prefix = code.split('.')[0]?.toUpperCase() ?? ''
  return CAT_COLORS[prefix] ?? { color: 'var(--ga-muted)', label: 'other' }
}

function ErrorBook() {
  const t = useTranslations('v2.student.errors')
  const locale = useLocale()
  const searchParams = useSearchParams()

  const [errors, setErrors] = useState<ErrorSkillDto[]>([])
  const [resolvedErrors, setResolvedErrors] = useState<ErrorSkillDto[]>([])
  const [tasks, setTasks] = useState<ErrorReviewTaskDto[]>([])
  const [lockedCount, setLockedCount] = useState(0)
  const [search, setSearch] = useState(searchParams.get('focus') ?? '')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [repairedCodes, setRepairedCodes] = useState<Set<string>>(new Set())
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set())
  const [activeDrillError, setActiveDrillError] = useState<ErrorSkillDto | null>(null)
  const [activeDrillTaskId, setActiveDrillTaskId] = useState<number | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [skillsRes, resolvedRes, tasksRes] = await Promise.allSettled([
        api.get<ErrorSkillDto[]>('/error-skills/me', { params: { days: 30 } }),
        api.get<ErrorSkillDto[]>('/error-skills/me/resolved'),
        reviewApi.getTodayTasks(),
      ])
      if (skillsRes.status === 'fulfilled') setErrors(skillsRes.value.data)
      if (resolvedRes.status === 'fulfilled') setResolvedErrors(resolvedRes.value.data)
      if (tasksRes.status === 'fulfilled') {
        setTasks(tasksRes.value.tasks)
        setLockedCount(tasksRes.value.lockedCount)
      }
      if (skillsRes.status === 'rejected') setLoadError(t('loadError'))
    } catch {
      setLoadError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchData() }, [fetchData])

  // Drill mở từ một task ôn → khi PASS sẽ tự completeTask (giữ nguyên hành vi v1).
  const handleTaskDrill = (task: ErrorReviewTaskDto) => {
    const matching = errors.find((e) => e.errorCode === task.errorCode)
    setActiveDrillError(matching ?? { errorCode: task.errorCode, count: 0, lastSeenAt: '', priorityScore: 0 })
    setActiveDrillTaskId(task.id)
  }

  const handleRepair = (err: ErrorSkillDto) => {
    setActiveDrillError(err)
    setActiveDrillTaskId(null)
  }

  const handleDrillClose = async (passed: boolean) => {
    if (activeDrillError && passed) {
      setRepairedCodes((prev) => new Set(Array.from(prev).concat(activeDrillError.errorCode)))
      if (activeDrillTaskId) {
        try {
          await reviewApi.completeTask(activeDrillTaskId, true)
          setCompletedTasks((prev) => new Set(Array.from(prev).concat(activeDrillTaskId)))
        } catch {
          // non-fatal — giống v1
        }
      }
    }
    setActiveDrillError(null)
    setActiveDrillTaskId(null)
  }

  // Khớp tiêu đề thân thiện HOẶC mã lỗi gốc (mã bị ẩn khỏi UI nhưng vẫn tìm được) — logic v1.
  const matchesSearch = (code: string) => {
    if (!search) return true
    const q = search.toLowerCase()
    return code.toLowerCase().includes(q) || getErrorSnippet(code, locale).title.toLowerCase().includes(q)
  }

  const filtered = errors.filter((e) => matchesSearch(e.errorCode))
  const filteredResolved = resolvedErrors.filter((e) => matchesSearch(e.errorCode))
  const pendingTasks = tasks.filter((tk) => !completedTasks.has(tk.id))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          errors.length > 0 ? (
            <span className="ga-ui text-[13px] font-semibold text-ga-muted">
              {t('openCount', { count: errors.length })}
            </span>
          ) : null
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="mx-auto max-w-2xl space-y-[22px]">
          {/* ── Nhiệm vụ ôn hôm nay ─────────────────────────────────────────── */}
          {(pendingTasks.length > 0 || lockedCount > 0) && (
            <section className="border border-ga-line bg-ga-yellow-soft p-5">
              <div className="mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-ga-gold" aria-hidden />
                <GaCap className="text-ga-gold">{t('reviewToday', { count: pendingTasks.length })}</GaCap>
              </div>

              {pendingTasks.length > 0 && (
                <div className="border border-ga-line bg-ga-card">
                  {pendingTasks.map((task, i) => (
                    <div key={task.id} className={`flex items-center gap-3 px-5 py-3.5 ${i ? 'border-t border-ga-border' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ga-ink" title={task.errorCode}>
                          {getErrorSnippet(task.errorCode, locale).title}
                        </p>
                        <p className="ga-ui mt-0.5 flex items-center gap-1 text-[12px] text-ga-muted">
                          <Clock size={11} aria-hidden /> {t('reviewAfter', { days: task.intervalDays })}
                        </p>
                      </div>
                      <GaBtn variant="primary" size="sm" onClick={() => handleTaskDrill(task)}>
                        <RotateCcw size={13} aria-hidden /> {t('practiceFix')}
                      </GaBtn>
                    </div>
                  ))}
                </div>
              )}

              {/* Gate PRO — v1 dùng <PremiumGate> (đẩy sang /student/pricing); v2 trỏ /v2/payment. */}
              {lockedCount > 0 && (
                <div className="mt-3 flex items-center gap-3 border border-ga-line bg-ga-card px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ga-ink">{t('lockedTitle', { count: lockedCount })}</p>
                    <p className="ga-ui mt-0.5 text-[12.5px] text-ga-muted">{t('lockedDesc')}</p>
                  </div>
                  <Link href="/v2/payment" className="shrink-0">
                    <GaBtn variant="yellow" size="sm">{t('lockedCta')}</GaBtn>
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* ── Tìm kiếm ────────────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <TkSearch
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <GaBtn variant="ghost" size="sm" onClick={fetchData}>
              <RotateCcw size={14} aria-hidden /> {t('reload')}
            </GaBtn>
          </div>

          {loadError && <ErrorBanner message={loadError} onRetry={fetchData} />}

          {loading ? (
            <LoadingState label={t('loading')} />
          ) : (
            <>
              {/* ── Trống hoàn toàn ───────────────────────────────────────────── */}
              {filtered.length === 0 && resolvedErrors.length === 0 && !loadError && (
                <EmptyState variant="invite" icon="check_circle" title={t('emptyTitle')} description={t('emptyDesc')} />
              )}

              {/* ── Lỗi chưa sửa ─────────────────────────────────────────────── */}
              {filtered.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-ga-gold" aria-hidden />
                    <GaCap>{t('unfixedCap', { count: filtered.length })}</GaCap>
                  </div>

                  <div className="space-y-3">
                    {filtered.map((err) => {
                      const style = catStyle(err.errorCode)
                      const snippet = getErrorSnippet(err.errorCode, locale)
                      const repaired = repairedCodes.has(err.errorCode)
                      return (
                        <article
                          key={err.errorCode}
                          className="relative border border-ga-line bg-ga-card p-5 pl-6"
                          style={repaired ? { borderColor: 'var(--ga-green)' } : undefined}
                        >
                          <span
                            className="absolute inset-y-0 left-0 w-[3px]"
                            style={{ background: repaired ? 'var(--ga-green)' : style.color }}
                            aria-hidden
                          />

                          <header className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="ga-ui rounded-ga-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                                style={{ background: `${style.color}18`, color: style.color }}
                              >
                                {style.label === 'other' ? t('other') : style.label}
                              </span>
                              {repaired && (
                                <span className="ga-ui rounded-ga-pill bg-ga-green-soft px-2 py-0.5 text-[10px] font-bold text-ga-green">
                                  ✓ {t('fixed')}
                                </span>
                              )}
                            </div>
                            <span className="ga-ui shrink-0 rounded-ga-pill bg-ga-side-active px-2 py-0.5 text-[10px] font-bold text-ga-muted">
                              {t('seenCount', { count: err.count })}
                            </span>
                          </header>

                          <p className="text-[16px] font-semibold text-ga-ink" title={err.errorCode}>{snippet.title}</p>
                          {snippet.rule && <p className="ga-ui mt-1 text-[12.5px] leading-snug text-ga-muted">{snippet.rule}</p>}
                          {err.lastSeenAt && (
                            <p className="ga-ui mt-1.5 flex items-center gap-1 text-[12px] text-ga-subtle">
                              <Clock size={11} aria-hidden /> {t('lastSeen')} {new Date(err.lastSeenAt).toLocaleDateString(locale)}
                            </p>
                          )}

                          <footer className="mt-4 flex items-center gap-2">
                            <span className="ga-ui flex flex-1 items-center gap-1.5 text-[12px] font-semibold text-ga-muted">
                              <Shield size={13} className="text-ga-accent" aria-hidden /> {t('recordedGrammarError')}
                            </span>
                            <GaBtn
                              variant={repaired ? 'ghost' : 'primary'}
                              size="sm"
                              disabled={repaired}
                              onClick={() => handleRepair(err)}
                            >
                              {repaired
                                ? <><CheckCircle2 size={13} aria-hidden /> {t('fixed')}</>
                                : <><RotateCcw size={13} aria-hidden /> {t('practiceFix')}</>}
                            </GaBtn>
                          </footer>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Đã xong hết task hôm nay ──────────────────────────────────── */}
              {pendingTasks.length === 0 && tasks.length > 0 && (
                <p className="border border-ga-line bg-ga-green-soft px-5 py-3.5 text-center text-[13.5px] font-semibold text-ga-green">
                  🎉 {t('allDone')}
                </p>
              )}

              {/* ── Lỗi đã sửa (thu gọn) ──────────────────────────────────────── */}
              {resolvedErrors.length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowResolved((v) => !v)}
                    aria-expanded={showResolved}
                    className="flex w-full items-center justify-between border border-ga-line bg-ga-green-soft px-5 py-3 transition-colors hover:bg-ga-surface"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-ga-green" aria-hidden />
                      <GaCap className="text-ga-green">{t('completedCap', { count: filteredResolved.length })}</GaCap>
                    </span>
                    {showResolved
                      ? <ChevronUp size={15} className="text-ga-green" aria-hidden />
                      : <ChevronDown size={15} className="text-ga-green" aria-hidden />}
                  </button>

                  {showResolved && (
                    <div className="mt-3 border border-ga-line bg-ga-card">
                      {filteredResolved.map((err, i) => {
                        const style = catStyle(err.errorCode)
                        const snippet = getErrorSnippet(err.errorCode, locale)
                        return (
                          <div key={err.errorCode} className={`flex items-center gap-3 px-5 py-3 ${i ? 'border-t border-ga-border' : ''}`}>
                            <span
                              className="ga-ui shrink-0 rounded-ga-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                              style={{ background: `${style.color}18`, color: style.color }}
                            >
                              {style.label === 'other' ? t('other') : style.label}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ga-ink" title={err.errorCode}>
                              {snippet.title}
                            </span>
                            <span className="ga-ui shrink-0 text-[11px] text-ga-subtle">
                              {t('times', { count: err.count })}
                            </span>
                            <span className="ga-ui flex shrink-0 items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2 py-0.5 text-[10px] font-bold text-ga-green">
                              <CheckCircle2 size={10} aria-hidden /> {t('fixed')}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <ErrorRepairDrill
        open={!!activeDrillError}
        onClose={handleDrillClose}
        errorCode={activeDrillError?.errorCode ?? ''}
        exampleCorrectDe={activeDrillError?.sampleCorrected}
        ruleViShort={activeDrillError?.ruleViShort}
      />
    </div>
  )
}

// useSearchParams() đẩy nhánh này sang client-side bailout — thiếu <Suspense> thì bản build
// production GÃY ở bước prerender.
export default function V2StudentErrorsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ErrorBook />
    </Suspense>
  )
}
