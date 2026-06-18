'use client'

import { useEffect, useState } from 'react'
import { Lock, ChevronRight, Clock, ArrowRight } from 'lucide-react'
import { getMockPacks, getMockPack, type MockExamPack, type MockExamPackDetail } from '@/lib/mockPackApi'
import { coinApi } from '@/lib/coinApi'
import { useStudentCoins } from '@/lib/flags'
import { GaPageHdr, GaCard, GaCap, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reuse mockPackApi (getMockPacks + getMockPack). Catalog + per-pack exam list. The exam RUNNER
// is the proven legacy flow (/student/mock-exam) → "Bắt đầu" deep-links there (Option-1).
// Coin (student-coins-v1): a FREE learner can spend coins for ONE trial attempt on a locked pack —
// PRO stays the only path to unlimited access. Must match backend CoinService.PRICE_MOCK_TRIAL_PASS.
const TRIAL_PRICE = 5

const LEVEL_COLOR: Record<string, string> = {
  A1: '#1E9E61', A2: '#2F6FC9', B1: '#7C56C8', B2: '#E07B39', C1: '#DA291C',
}

export default function V2StudentMockExamPage() {
  const coinsEnabled = useStudentCoins()
  const [packs, setPacks] = useState<MockExamPack[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<MockExamPackDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coins, setCoins] = useState<number | null>(null)
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getMockPacks()
      .then(setPacks)
      .catch(() => setError('Không thể tải danh sách đề thi.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    if (!coinsEnabled) return
    coinApi.getBalance().then((b) => setCoins(b.balance)).catch(() => setCoins(null))
  }, [coinsEnabled])

  const openPack = async (id: number) => {
    setOpenId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      setDetail(await getMockPack(id))
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const toggle = async (p: MockExamPack) => {
    if (p.locked) return
    if (openId === p.id) {
      setOpenId(null)
      return
    }
    await openPack(p.id)
  }

  // Spend coins for a single-attempt trial pass, then refetch + auto-open the now-unlocked pack.
  const buyTrialPass = async (p: MockExamPack) => {
    setBuyingId(p.id)
    setBuyError(null)
    try {
      const res = await coinApi.buyTrialPass(p.id)
      setCoins(res.balance)
      const fresh = await getMockPacks()
      setPacks(fresh)
      if (!fresh.find((x) => x.id === p.id)?.locked) await openPack(p.id)
    } catch {
      setBuyError('Không mở được bằng xu. Vui lòng thử lại.')
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Thi thử"
        subtitle="Bộ đề mô phỏng Goethe có chấm điểm tự động"
        right={
          coinsEnabled && coins != null ? (
            <span
              className="ga-ui inline-flex items-center gap-1.5 border border-ga-line bg-ga-bg px-3 py-2 text-[13px] text-ga-ink"
              title="Xu thưởng — hoàn thành bài học để nhận"
            >
              <span className="font-ga-display text-[18px] font-medium">{coins.toLocaleString('vi-VN')}</span>
              <span className="text-ga-muted">🪙 xu</span>
            </span>
          ) : undefined
        }
      />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {buyError && (
          <div className="mb-5">
            <ErrorBanner message={buyError} onRetry={() => setBuyError(null)} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải bộ đề…" />
        ) : packs.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">Chưa có bộ đề</p>
            <p className="ga-ui mt-2 text-[14px] text-ga-muted">Các bộ đề thi thử sẽ sớm được cập nhật.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {packs.map((p) => {
              const color = LEVEL_COLOR[p.cefrLevel?.toUpperCase()] ?? 'var(--ga-accent)'
              const open = openId === p.id
              return (
                <GaCard key={p.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={p.locked}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors enabled:hover:bg-ga-surface disabled:cursor-not-allowed"
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-ga font-ga-display text-[16px] font-medium text-white"
                      style={{ background: color }}
                    >
                      {p.cefrLevel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-ga-ink">{p.title}</p>
                        {p.locked && <TkBadge tone="yellow">PRO</TkBadge>}
                      </div>
                      {p.descriptionVi && <p className="ga-ui mt-0.5 truncate text-[13px] text-ga-muted">{p.descriptionVi}</p>}
                      <p className="ga-ui mt-0.5 text-[12px] text-ga-subtle">
                        {p.examFormat} · {p.examCount} đề
                      </p>
                    </div>
                    {p.locked ? (
                      <Lock size={18} className="text-ga-subtle" aria-hidden />
                    ) : (
                      <ChevronRight
                        size={18}
                        className={`text-ga-subtle transition-transform ${open ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                    )}
                  </button>

                  {/* Coin trial pass — only for locked (PRO) packs when the coin economy is on. */}
                  {p.locked && coinsEnabled && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ga-border bg-ga-surface px-5 py-3">
                      <span className="ga-ui text-[12.5px] text-ga-muted">
                        Mở 1 lượt làm thử bằng xu — gói PRO vẫn là cách mở khoá đầy đủ.
                      </span>
                      {coins != null && coins >= TRIAL_PRICE ? (
                        <button
                          type="button"
                          onClick={() => buyTrialPass(p)}
                          disabled={buyingId === p.id}
                          className="ga-ui inline-flex shrink-0 items-center gap-1.5 rounded-ga bg-ga-accent px-3.5 py-2 text-[12.5px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {buyingId === p.id ? 'Đang mở…' : `Mở bằng ${TRIAL_PRICE} 🪙 (1 lượt)`}
                        </button>
                      ) : (
                        <span className="ga-ui shrink-0 text-[12px] text-ga-subtle">
                          Cần {TRIAL_PRICE} 🪙 (bạn có {coins ?? 0})
                        </span>
                      )}
                    </div>
                  )}

                  {open && (
                    <div className="border-t border-ga-border bg-ga-surface px-5 py-4">
                      {detailLoading ? (
                        <LoadingState label="Đang tải đề…" />
                      ) : detail && detail.exams.length > 0 ? (
                        <div className="space-y-2">
                          {detail.exams.map((ex) => (
                            <div key={ex.id} className="flex items-center gap-3 border border-ga-line bg-ga-card px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-ga-ink">{ex.title}</p>
                                <p className="ga-ui mt-0.5 flex items-center gap-3 text-[12px] text-ga-muted">
                                  {ex.timeLimitMinutes != null && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock size={12} aria-hidden /> {ex.timeLimitMinutes}′
                                    </span>
                                  )}
                                  {ex.totalPoints != null && <span>{ex.totalPoints} điểm</span>}
                                  {ex.passPoints != null && <span>Đạt: {ex.passPoints}</span>}
                                </p>
                              </div>
                              <a
                                href="/student/mock-exam"
                                className="ga-ui inline-flex shrink-0 items-center gap-1 rounded-ga bg-ga-accent px-3.5 py-2 text-[12.5px] font-semibold text-ga-accent-ink"
                              >
                                Bắt đầu <ArrowRight size={13} aria-hidden />
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ga-ui py-3 text-center text-[13px] text-ga-muted">Bộ đề này chưa có đề con.</p>
                      )}
                    </div>
                  )}
                </GaCard>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
