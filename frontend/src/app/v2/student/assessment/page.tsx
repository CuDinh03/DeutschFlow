'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Brain,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Mic,
  PenTool,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { assessmentApi, type B1ReadinessResponse } from '@/lib/assessmentApi'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useTracking } from '@/hooks/useTracking'
import { GaBtn, GaCap, GaPageHdr, ErrorBanner, LoadingState } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// /v2/student/assessment — B1 readiness (Galerie shell).
//
// Port of /student/assessment: same endpoints via assessmentApi —
//   GET  /assessment/b1/readiness
//   POST /assessment/b1/evaluate
//   POST /assessment/b1/mock-exam?passed=<bool>
// Same 5 criteria, same score ring, same PostHog events (feature_b1_assessment_started /
// _completed with the per-criterion metadata). Only the shell changed; the mock-exam pointer now
// links to the v2 runner catalogue (/v2/student/mock-exam) instead of the v1 path.
// ─────────────────────────────────────────────────────────────────────────────

const CRITERIA = [
  { key: 'vocabularyCheckPassed', labelKey: 'criteria.vocabulary', descKey: 'criteria.vocabularyDesc', icon: BookOpen, color: '#C79A00' },
  { key: 'speakingCheckPassed', labelKey: 'criteria.speaking', descKey: 'criteria.speakingDesc', icon: Mic, color: '#2F6FC9' },
  { key: 'grammarCheckPassed', labelKey: 'criteria.grammar', descKey: 'criteria.grammarDesc', icon: PenTool, color: '#1E9E61' },
  { key: 'confidenceCheckPassed', labelKey: 'criteria.confidence', descKey: 'criteria.confidenceDesc', icon: Brain, color: '#E07B39' },
  { key: 'mockExamPassed', labelKey: 'criteria.mockExam', descKey: 'criteria.mockExamDesc', icon: ClipboardCheck, color: '#7C56C8' },
] as const satisfies ReadonlyArray<{
  key: keyof B1ReadinessResponse
  labelKey: string
  descKey: string
  icon: typeof BookOpen
  color: string
}>

export default function V2StudentAssessmentPage() {
  usePageTimeTracker('b1_assessment')
  const t = useTranslations('v2.student.assessment')
  const { trackFeatureAction } = useTracking()

  const [readiness, setReadiness] = useState<B1ReadinessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [mockLoading, setMockLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    assessmentApi
      .getReadiness()
      .then((res) => setReadiness(res.data))
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEvaluate() {
    setEvaluating(true)
    setError(null)
    trackFeatureAction('b1_assessment', 'started')
    try {
      const res = await assessmentApi.evaluate()
      setReadiness(res.data)
      const r = res.data
      const passedCount = CRITERIA.filter((c) => r[c.key]).length
      trackFeatureAction('b1_assessment', 'completed', {
        passed_criteria: passedCount,
        total_criteria: CRITERIA.length,
        all_passed: passedCount === CRITERIA.length,
        vocabulary_ok: r.vocabularyCheckPassed,
        speaking_ok: r.speakingCheckPassed,
        grammar_ok: r.grammarCheckPassed,
        confidence_ok: r.confidenceCheckPassed,
        mock_exam_ok: r.mockExamPassed,
      })
    } catch {
      setError(t('evaluateError'))
    } finally {
      setEvaluating(false)
    }
  }

  async function handleMockExam(passed: boolean) {
    setMockLoading(true)
    setError(null)
    try {
      const res = await assessmentApi.recordMockExam(passed)
      setReadiness(res.data)
    } catch {
      setError(t('mockExamError'))
    } finally {
      setMockLoading(false)
    }
  }

  const score = readiness?.readinessScore ?? 0
  const isGraduated = !!(readiness?.fullyReady && readiness.graduationConfirmedAt)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            {error && <ErrorBanner message={error} onRetry={load} />}

            {/* Hero — dark, or green once graduation is confirmed */}
            <div
              className="p-5 text-ga-bg lg:p-7"
              style={{ background: isGraduated ? 'var(--ga-green)' : 'var(--ga-ink)' }}
            >
              <GaCap className="mb-2 block" style={{ color: isGraduated ? 'rgba(255,255,255,0.72)' : '#A39E94' }}>
                {t('heroCap')}
              </GaCap>
              <p className="font-ga-display text-[22px] font-medium sm:text-[24px] lg:text-[28px]">
                {isGraduated ? t('heroTitleGraduated') : t('heroTitle')}
              </p>
              <p
                className="ga-ui mt-2 max-w-xl text-[14.5px]"
                style={{ color: isGraduated ? 'rgba(255,255,255,0.78)' : '#A39E94' }}
              >
                {isGraduated ? t('heroDescGraduated') : t('heroDesc')}
              </p>

              <div className="mt-6 flex items-center gap-4 lg:gap-5">
                <ScoreRing score={score} />
                <div className="min-w-0">
                  <p className="font-ga-display text-[24px] font-medium leading-none sm:text-[28px] lg:text-[36px]">
                    {score}
                    <span className="ml-1 text-[14px] sm:text-[16px] lg:text-[18px]" style={{ color: 'rgba(255,255,255,0.55)' }}>/100</span>
                  </p>
                  <p className="ga-ui mt-1.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {score >= 80 ? t('scoreNear') : score >= 40 ? t('scoreProgress') : t('scoreKeepGoing')}
                  </p>
                </div>
              </div>
            </div>

            {/* 5 criteria */}
            <div>
              <GaCap className="mb-3 block">{t('criteriaCap')}</GaCap>
              <div className="border border-ga-line bg-ga-card">
                {CRITERIA.map((c, i) => {
                  const passed = readiness ? Boolean(readiness[c.key]) : false
                  const Icon = c.icon
                  return (
                    <div
                      key={c.key}
                      className="flex items-center gap-3 px-4 py-4 lg:gap-4 lg:px-5"
                      style={{
                        borderTop: i ? '1px solid var(--ga-border)' : 'none',
                        background: passed ? 'var(--ga-green-soft)' : 'transparent',
                      }}
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-ga"
                        style={
                          passed
                            ? { background: 'rgba(30,158,97,0.16)', color: 'var(--ga-green)' }
                            : { background: `${c.color}14`, color: c.color }
                        }
                      >
                        <Icon size={20} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-semibold text-ga-ink">{t(c.labelKey)}</p>
                        <p className="ga-ui text-[12.5px] text-ga-muted">{t(c.descKey)}</p>
                      </div>
                      {passed ? (
                        <CheckCircle2 size={20} className="shrink-0" style={{ color: 'var(--ga-green)' }} aria-label={t('passed')} />
                      ) : (
                        <XCircle size={20} className="shrink-0 text-ga-subtle" aria-label={t('notPassed')} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mock-exam recorder — only while the criterion is unmet */}
            {!readiness?.mockExamPassed && (
              <div className="border border-ga-line bg-ga-card p-4 lg:p-5">
                <p className="font-ga-display text-[18px] font-medium text-ga-ink">{t('mockExamCap')}</p>
                <p className="ga-ui mt-1 text-[13px] text-ga-muted">
                  {t.rich('mockExamHint', {
                    link: (chunks) => (
                      <Link href="/v2/student/mock-exam" className="font-semibold text-ga-accent underline">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <GaBtn variant="primary" loading={mockLoading} onClick={() => handleMockExam(true)}>
                    {t('mockExamPassedCta')}
                  </GaBtn>
                  <GaBtn variant="ghost" loading={mockLoading} onClick={() => handleMockExam(false)}>
                    {t('mockExamFailedCta')}
                  </GaBtn>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <GaBtn variant="ink" size="lg" loading={evaluating} onClick={handleEvaluate}>
                <RefreshCw size={16} aria-hidden /> {t('evaluateCta')}
              </GaBtn>
              {readiness?.lastAssessmentAt && (
                <p className="ga-ui text-[12.5px] text-ga-muted">
                  {t('lastAssessment', { at: new Date(readiness.lastAssessmentAt).toLocaleString('vi-VN') })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Readiness score ring — CSS-transitioned stroke (no animation lib). */
function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0" aria-hidden>
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={6} />
      <circle
        cx={36}
        cy={36}
        r={r}
        fill="none"
        stroke="var(--ga-yellow)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - dash}
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 700ms var(--ga-ease-out, ease-out)' }}
      />
    </svg>
  )
}
