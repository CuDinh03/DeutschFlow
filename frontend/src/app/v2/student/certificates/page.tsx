'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Award, Download, Lock, ShieldCheck, Star } from 'lucide-react'
import api, { isAxiosErr } from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaBtn, GaCap, GaPageHdr, LoadingState, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// /v2/student/certificates — CEFR certificate list (Galerie shell).
//
// Port of /student/certificates: same endpoints, same contract —
//   GET  /certificates/me            → Certificate[]
//   POST /certificates/claim         → { alreadyHas | justIssued } (body: { cefrLevel })
//   GET  /api/certificates/{id}/pdf  → raw PDF blob (fetch + Bearer, outside the axios client
//                                      because axios' default JSON transform would corrupt it)
// A certificate is only issued after the matching mock exam is passed — the server enforces it;
// "Nhận ngay" simply asks.
//
// NOT the same page as the PUBLIC verifier /certificate/[token] (kept, unauthenticated) — this is
// the student's own list.
// ─────────────────────────────────────────────────────────────────────────────

interface Certificate {
  id: number
  cefr_level: string
  issued_at: string
  exam_score: number
  certificate_code: string
  is_active: boolean
  alreadyHas?: boolean
  justIssued?: boolean
}

const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

/** Level accent — same palette as /v2/student/mock-exam so a level reads the same colour app-wide. */
const LEVEL_COLOR: Record<string, string> = {
  A1: '#1E9E61',
  A2: '#2F6FC9',
  B1: '#7C56C8',
  B2: '#E07B39',
  C1: '#DA291C',
}

const color = (level: string) => LEVEL_COLOR[level] ?? LEVEL_COLOR.A1

type ClaimNotice = { tone: 'ok' | 'info' | 'error'; text: string }

export default function V2StudentCertificatesPage() {
  usePageTimeTracker('certificates')
  const t = useTranslations('v2.student.certificates')

  const [certs, setCerts] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [notice, setNotice] = useState<ClaimNotice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<Certificate[]>('/certificates/me')
      setCerts(data ?? [])
    } catch {
      setCerts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const downloadPdf = async (id: number) => {
    try {
      const token = getAccessToken() ?? ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? ''}/api/certificates/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(t('downloadError'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DeutschFlow-Certificate-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('downloadError'))
    }
  }

  const claim = async (level: string) => {
    setClaiming(level)
    setNotice(null)
    try {
      const { data } = await api.post<Certificate>('/certificates/claim', { cefrLevel: level })
      if (data.alreadyHas) {
        setNotice({ tone: 'info', text: t('claimAlreadyHas', { level }) })
      } else if (data.justIssued) {
        setNotice({ tone: 'ok', text: t('claimIssued', { level }) })
        void load()
      }
    } catch (e) {
      const serverMsg =
        isAxiosErr(e) && e.response?.data && typeof e.response.data === 'object' && 'error' in e.response.data
          ? String((e.response.data as { error?: unknown }).error)
          : null
      setNotice({ tone: 'error', text: serverMsg ?? t('claimNeedsMockExam', { level }) })
    } finally {
      setClaiming(null)
    }
  }

  const earned = new Set(certs.map((c) => c.cefr_level))
  const locked = ALL_LEVELS.filter((l) => !earned.has(l))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-10 py-6">
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: t('stats.earned'), value: certs.length, sub: t('stats.earnedSub'), color: '#1E9E61' },
                { label: t('stats.locked'), value: locked.length, sub: t('stats.lockedSub'), color: '#C79A00' },
                { label: t('stats.total'), value: ALL_LEVELS.length, sub: t('stats.totalSub'), color: '#2F6FC9' },
              ]}
            />

            {/* Verification note (dark band) */}
            <div className="bg-ga-ink p-7 text-ga-bg">
              <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>
                {t('heroCap')}
              </GaCap>
              <p className="font-ga-display text-[26px] font-medium">{t('heroTitle')}</p>
              <p className="ga-ui mt-2 max-w-xl text-[14.5px]" style={{ color: '#A39E94' }}>
                {t('heroDesc')}
              </p>
            </div>

            {notice && (
              <div
                role="status"
                className="border px-4 py-3 text-[13.5px] font-semibold"
                style={
                  notice.tone === 'error'
                    ? { background: 'var(--ga-red-soft)', borderColor: 'var(--ga-red)', color: 'var(--ga-red)' }
                    : notice.tone === 'ok'
                      ? { background: 'var(--ga-green-soft)', borderColor: 'var(--ga-green)', color: 'var(--ga-green)' }
                      : { background: 'var(--ga-yellow-soft)', borderColor: 'var(--ga-gold)', color: 'var(--ga-ink)' }
                }
              >
                {notice.text}
              </div>
            )}

            {/* Earned */}
            {certs.length > 0 && (
              <div>
                <GaCap className="mb-3 block">{t('earnedCap', { count: certs.length })}</GaCap>
                <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
                  {certs.map((c) => (
                    <CertificateCard key={c.id} cert={c} onDownload={downloadPdf} />
                  ))}
                </div>
              </div>
            )}

            {/* Locked */}
            {locked.length > 0 && (
              <div>
                <GaCap className="mb-3 block">{t('lockedCap')}</GaCap>
                <div className="border border-ga-line bg-ga-card">
                  {locked.map((level, i) => (
                    <div
                      key={level}
                      className="flex items-center gap-4 px-5 py-4"
                      style={{ borderTop: i ? '1px solid var(--ga-border)' : 'none' }}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-ga bg-ga-side-active text-ga-subtle">
                        <Lock size={20} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-semibold text-ga-ink">{t('lockedTitle', { level })}</p>
                        <p className="ga-ui text-[12.5px] text-ga-muted">{t(`levels.${level}`)}</p>
                        <p className="ga-ui mt-0.5 text-[12.5px] text-ga-subtle">{t('lockedHint', { level })}</p>
                      </div>
                      <GaBtn
                        variant="ghost"
                        size="sm"
                        loading={claiming === level}
                        onClick={() => claim(level)}
                        style={{ color: color(level), borderColor: `${color(level)}55` }}
                      >
                        {t('claimCta')}
                      </GaBtn>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CertificateCard({ cert, onDownload }: { cert: Certificate; onDownload: (id: number) => void }) {
  const t = useTranslations('v2.student.certificates')
  const c = color(cert.cefr_level)
  return (
    <div className="border bg-ga-card p-5" style={{ borderColor: `${c}55` }}>
      <div className="flex items-start gap-4">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-ga text-white"
          style={{ background: c }}
        >
          <Award size={28} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-ga-display text-[26px] font-medium leading-none" style={{ color: c }}>
            {cert.cefr_level}
          </p>
          <p className="mt-1.5 text-[13.5px] font-semibold text-ga-ink">{t(`levels.${cert.cefr_level}`)}</p>
          <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">
            {t('cardMeta', {
              score: cert.exam_score,
              date: format(new Date(cert.issued_at), 'dd/MM/yyyy'),
            })}
          </p>
        </div>
        <GaBtn
          variant="ghost"
          size="sm"
          onClick={() => onDownload(cert.id)}
          title={t('download')}
          aria-label={t('download')}
        >
          <Download size={15} aria-hidden />
        </GaBtn>
      </div>

      <div
        className="mt-4 flex items-center justify-between gap-3 border-t pt-3.5"
        style={{ borderColor: `${c}33` }}
      >
        <span className="ga-ui inline-flex items-center gap-1.5 font-mono text-[12px]" style={{ color: c }}>
          <ShieldCheck size={13} aria-hidden />
          {cert.certificate_code}
        </span>
        <span className="ga-ui inline-flex items-center gap-1 text-[11.5px] text-ga-muted">
          <Star size={12} className="fill-current" style={{ color: 'var(--ga-gold)' }} aria-hidden />
          {t('verified')}
        </span>
      </div>
    </div>
  )
}
