'use client'

import { useEffect, useMemo, useState } from 'react'
import { UploadCloud, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import type { VocabularyImageReviewResponse } from '@/lib/vocabularyImageApi'
import { GaPageHdr, GaBtn, GaCap, AdStatStrip, TkModal } from '@/components/ui-v2'

// ── Green header accent (vocab screen overrides the admin-navy chrome) ────────
const GREEN = '#1E9E61'
const vocabAccentVars = {
  '--ga-accent': GREEN,
  '--ga-hdr-bg': 'rgba(30,158,97,0.07)',
  '--ga-hdr-line': 'rgba(30,158,97,0.20)',
} as React.CSSProperties

// Gender tint (vocab): API returns m/f/n → der(blue) / die(red) / das(green).
const GENDER_MAP: Record<string, { label: string; color: string }> = {
  m: { label: 'der', color: '#3b82f6' },
  f: { label: 'die', color: '#ef4444' },
  n: { label: 'das', color: '#22c55e' },
}

// The missing-image backlog can be huge (10k+); render a capped review batch.
const QUEUE_CAP = 24

// ── Normalized word (queue = words still missing an image) ────────────────────
interface VocabWord {
  id: number
  de: string
  vi: string
  gender: string
  hasImage: boolean
  hasAudio: boolean
}

function normalizeWord(r: Record<string, unknown>): VocabWord {
  const g = String(r.gender ?? '').toLowerCase()
  const img = typeof r.imageUrl === 'string' ? r.imageUrl : ''
  const audio = r.audioUrl
  return {
    id: Number(r.id),
    de: String(r.word ?? ''),
    vi: String(r.translation ?? ''),
    gender: GENDER_MAP[g] ? g : '',
    // /vocabulary/words substitutes a `via.placeholder.com` URL for null images → treat as missing.
    hasImage: img.trim() !== '' && !img.includes('placeholder'),
    hasAudio: typeof audio === 'string' && audio.trim() !== '',
  }
}

export default function V2AdminVocabPage() {
  const [target, setTarget] = useState<VocabWord | null>(null)

  const { data, loading, error, reload } = useAdminData<VocabWord[]>({
    initialData: [],
    errorMessage: 'Không thể tải cơ sở dữ liệu từ vựng.',
    fetchData: async () => {
      const res = await api.get('/vocabulary/words')
      return ((res.data ?? []) as Record<string, unknown>[]).map(normalizeWord)
    },
  })

  const { queue, stats } = useMemo(() => {
    // Ignore stub rows (imported ids with no base form yet) — only real words count.
    const real = data.filter((w) => w.de.trim() !== '')
    const total = real.length
    const q = real.filter((w) => !w.hasImage)
    const audio = real.filter((w) => w.hasAudio).length
    return {
      queue: q,
      stats: {
        total,
        missing: q.length,
        audioPct: total ? Math.round((audio / total) * 100) : 0,
      },
    }
  }, [data])

  return (
    <div className="flex min-h-screen flex-col" style={vocabAccentVars}>
      <GaPageHdr
        accent
        title="Cơ sở dữ liệu từ vựng"
        subtitle="Duyệt từ, gắn ảnh và làm giàu dữ liệu"
        right={
          <GaBtn variant="ghost" onClick={() => toast('Mở hộp thoại nhập CSV (sắp ra mắt)')}>
            <UploadCloud size={15} aria-hidden />
            Nhập CSV
          </GaBtn>
        }
      />

      <div className="flex-1 px-10 py-6">
        <AdStatStrip
          className="mb-6"
          cells={[
            { label: 'Tổng từ vựng', value: stats.total.toLocaleString('vi-VN'), color: GREEN },
            {
              label: 'Thiếu ảnh',
              value: stats.missing.toLocaleString('vi-VN'),
              color: '#E07B39',
              sub: 'cần gắn ảnh',
              alert: stats.missing > 0,
            },
            { label: 'Chờ duyệt', value: stats.missing.toLocaleString('vi-VN'), color: '#C79A00' },
            { label: 'Đã có audio (TTS)', value: `${stats.audioPct}%`, color: '#2F6FC9' },
          ]}
        />

        <GaCap className="mb-3.5 block">Hàng đợi duyệt từ vựng ({queue.length})</GaCap>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[130px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[26px] font-medium leading-[1.2] text-ga-red">
              Không tải được từ vựng
            </h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14.5px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/vocabulary/words</code>
            </p>
            <GaBtn variant="primary" onClick={() => reload({ silent: false })}>
              Thử lại
            </GaBtn>
          </div>
        ) : queue.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-10 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: GREEN }} aria-hidden />
            <p className="font-ga-display text-[18px] italic text-ga-ink">Đã duyệt hết hàng đợi 🎉</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {queue.slice(0, QUEUE_CAP).map((w) => (
              <div key={w.id} className="flex gap-4 border border-ga-line bg-ga-card p-4">
                <div
                  className="grid h-24 w-24 shrink-0 place-items-center text-center text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ background: 'var(--ga-orange-soft)', color: 'var(--ga-orange)' }}
                >
                  Thiếu ảnh
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {w.gender && GENDER_MAP[w.gender] && (
                      <span
                        className="text-[11px] font-bold uppercase"
                        style={{ color: GENDER_MAP[w.gender].color }}
                      >
                        {GENDER_MAP[w.gender].label}
                      </span>
                    )}
                    <span className="font-ga-display text-[18px] font-semibold text-ga-ink">{w.de}</span>
                  </div>
                  <p className="mb-3 truncate text-[13px] text-ga-muted">{w.vi || '—'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTarget(w)}
                      className="rounded-ga px-[11px] py-[6px] text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: GREEN }}
                    >
                      Gắn ảnh
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Cần gắn ảnh trước khi duyệt"
                      className="rounded-ga border border-ga-line px-[11px] py-[6px] text-[11.5px] font-semibold text-ga-subtle disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Từ chối từ vựng — cần endpoint backend')}
                      className="rounded-ga px-[11px] py-[6px] text-[11.5px] font-semibold transition-colors"
                      style={{ color: 'var(--ga-red)' }}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !error && queue.length > QUEUE_CAP && (
          <p className="mt-4 text-center text-[13px] text-ga-muted">
            Hiển thị {QUEUE_CAP} từ đầu · còn {(queue.length - QUEUE_CAP).toLocaleString('vi-VN')} từ trong hàng đợi
          </p>
        )}
      </div>

      {target && (
        <AttachImageModal
          word={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null)
            reload({ silent: true })
          }}
        />
      )}
    </div>
  )
}

// ── Attach-image modal: Unsplash suggestions → approve one ────────────────────
function AttachImageModal({
  word,
  onClose,
  onDone,
}: {
  word: VocabWord
  onClose: () => void
  onDone: () => void
}) {
  const [review, setReview] = useState<VocabularyImageReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // Correct path (baseURL already ends in /api). The legacy vocabularyImageApi.ts
    // wrapper double-prefixes /api → 404; call the endpoint directly here.
    api
      .get(`/v2/admin/vocabulary/images/review/${word.id}`, { params: { limit: 8 } })
      .then((r) => !cancelled && setReview(r.data as VocabularyImageReviewResponse))
      .catch((e: unknown) => !cancelled && setErr(apiMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [word.id])

  const chosen = review?.suggestions.find((s) => s.unsplashId === selected)

  const approve = async () => {
    if (!chosen) return
    setSaving(true)
    try {
      await api.post(`/v2/admin/vocabulary/images/review/${word.id}/approve`, {
        unsplashId: chosen.unsplashId,
        decision: 'APPROVE',
        imageUrl: chosen.regularUrl,
      })
      toast.success(`Đã gắn ảnh cho "${word.de}"`)
      onDone()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={`Gắn ảnh — ${word.de}`}
      footer={
        <div className="flex justify-end gap-2.5">
          <GaBtn variant="ghost" onClick={onClose}>
            Huỷ
          </GaBtn>
          <GaBtn variant="primary" disabled={!chosen || saving} onClick={approve}>
            {saving ? 'Đang gắn…' : 'Duyệt ảnh đã chọn'}
          </GaBtn>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ga-shimmer aspect-square rounded-ga" aria-hidden />
          ))}
        </div>
      ) : err ? (
        <p className="py-8 text-center text-[14px] text-ga-red">{err}</p>
      ) : !review?.suggestions.length ? (
        <p className="py-8 text-center text-[14px] text-ga-muted">Không tìm thấy ảnh gợi ý cho từ này.</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {review.suggestions.map((s) => {
            const on = s.unsplashId === selected
            return (
              <button
                key={s.unsplashId}
                type="button"
                onClick={() => setSelected(s.unsplashId)}
                className="relative aspect-square overflow-hidden rounded-ga border-2 transition-colors"
                style={{ borderColor: on ? GREEN : 'transparent' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.thumbUrl} alt={s.altText ?? word.de} className="h-full w-full object-cover" />
                {on && (
                  <span
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-white"
                    style={{ background: GREEN }}
                  >
                    <CheckCircle2 size={14} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </TkModal>
  )
}
