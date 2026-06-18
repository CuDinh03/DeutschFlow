'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { createStripeSession, createMomoOrder } from '@/lib/paymentApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// Reskin of proto GaPayment (proto-student-extra.jsx): left selectable plan rows +
// right sticky checkout summary. Reuse paymentApi (Stripe primary + MoMo). Plans mirror the
// real backend plan codes FREE/PRO/ULTRA (no plan-list endpoint). Accent is role-adaptive
// (var(--ga-accent)) since /v2/payment is a shared RoleShell screen.

type PaidPlan = 'PRO' | 'ULTRA'
interface Plan {
  code: 'FREE' | PaidPlan
  name: string
  priceVnd: number
  period: string
  features: string[]
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    code: 'FREE',
    name: 'Miễn phí',
    priceVnd: 0,
    period: '',
    features: ['Học từ vựng & ngữ pháp cơ bản', 'Giới hạn token AI mỗi ngày', 'Theo dõi tiến độ cơ bản'],
  },
  {
    code: 'PRO',
    name: 'Pro',
    priceVnd: 299000,
    period: '/ tháng',
    highlight: true,
    features: [
      'Toàn bộ tính năng AI Speaking',
      'Chấm bài & phản hồi AI không giới hạn',
      'Luyện phỏng vấn & thi thử Goethe',
      'Lộ trình cá nhân hoá',
      'Báo cáo tiến độ nâng cao',
    ],
  },
  {
    code: 'ULTRA',
    name: 'Ultra',
    priceVnd: 699000,
    period: '/ 2 tháng · hạn mức cao nhất',
    features: ['Mọi thứ trong Pro', 'Hạn mức token cao nhất', 'Ưu tiên hàng đợi AI', 'Hỗ trợ ưu tiên'],
  },
]

const PAY_BADGES = ['VISA', 'Mastercard', 'ZaloPay', 'MoMo']
const vnd = (n: number) => (n === 0 ? '0₫' : `${n.toLocaleString('vi-VN')}₫`)

function PaymentBody() {
  const [selected, setSelected] = useState<Plan['code']>('PRO')
  const [busy, setBusy] = useState<string | null>(null)
  const plan = PLANS.find((p) => p.code === selected) ?? PLANS[1]
  const paid = plan.code !== 'FREE'

  const payStripe = async () => {
    if (!paid) return
    setBusy('stripe')
    try {
      const res = await createStripeSession({ planCode: plan.code as PaidPlan })
      window.location.href = res.url
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể tạo phiên thanh toán.')
      setBusy(null)
    }
  }
  const payMomo = async () => {
    if (!paid) return
    setBusy('momo')
    try {
      const res = await createMomoOrder({
        planCode: plan.code as PaidPlan,
        durationMonths: plan.code === 'ULTRA' ? 2 : 1,
      })
      window.location.href = res.payUrl
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể tạo đơn MoMo.')
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Nâng cấp tài khoản" subtitle="Mở khoá toàn bộ tiềm năng luyện tiếng Đức của bạn" />
      <div className="flex-1 px-10 py-8">
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_340px]">
          {/* Plans — selectable rows */}
          <div className="flex flex-col gap-3.5">
            {PLANS.map((p) => {
              const on = selected === p.code
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setSelected(p.code)}
                  aria-pressed={on}
                  className={`relative rounded-ga border p-6 text-left transition-[background-color,border-color] duration-150 ${
                    on ? 'bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
                  }`}
                  style={{ borderColor: on ? 'var(--ga-ink)' : undefined }}
                >
                  {p.highlight && on && (
                    <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'var(--ga-accent)' }} />
                  )}
                  <div className="mb-3.5 flex items-start justify-between">
                    <div>
                      <p
                        className={`ga-ui mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          on ? 'text-ga-bg/55' : 'text-ga-muted'
                        }`}
                      >
                        {p.name}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-ga-display text-[34px] font-medium leading-none">{vnd(p.priceVnd)}</span>
                      </div>
                      {p.period && (
                        <p className={`ga-ui mt-1 text-[13px] ${on ? 'text-ga-bg/55' : 'text-ga-muted'}`}>{p.period}</p>
                      )}
                    </div>
                    <span
                      aria-hidden
                      className="mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2"
                      style={{ borderColor: on ? 'var(--ga-accent)' : 'var(--ga-line)' }}
                    >
                      {on && <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--ga-accent)' }} />}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {p.features.map((f) => (
                      <span
                        key={f}
                        className={`ga-ui flex items-center gap-1.5 text-[13.5px] leading-relaxed ${
                          on ? 'text-ga-bg/85' : 'text-ga-ink'
                        }`}
                      >
                        <span className="h-[5px] w-[5px] shrink-0" style={{ background: 'var(--ga-accent)' }} />
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Checkout summary — sticky */}
          <div className="sticky top-0 border border-ga-line bg-ga-card p-6">
            <GaCap className="mb-4">Tóm tắt đơn hàng</GaCap>
            <div className="mb-4 border-b border-ga-line pb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="ga-ui text-[15px] font-semibold text-ga-ink">{plan.name}</span>
                <span className="font-ga-display text-[18px] font-medium text-ga-ink">{vnd(plan.priceVnd)}</span>
              </div>
              {plan.period && <p className="ga-ui text-[13px] text-ga-muted">{plan.period}</p>}
            </div>
            <div className="mb-5 flex flex-col gap-3">
              <div className="ga-ui flex justify-between text-[14px]">
                <span className="text-ga-muted">Tạm tính</span>
                <span className="text-ga-ink">{vnd(plan.priceVnd)}</span>
              </div>
              <div className="ga-ui flex justify-between text-[14px]">
                <span className="text-ga-muted">VAT (10%)</span>
                <span className="text-ga-ink">Đã bao gồm</span>
              </div>
            </div>
            <div className="mb-5 flex items-center justify-between border-t border-ga-line pt-3.5">
              <span className="ga-ui text-[16px] font-bold text-ga-ink">Tổng cộng</span>
              <span className="font-ga-display text-[22px] font-medium text-ga-ink">{vnd(plan.priceVnd)}</span>
            </div>

            {paid ? (
              <div className="flex flex-col gap-2.5">
                <GaBtn
                  variant="primary"
                  className="w-full justify-center"
                  onClick={payStripe}
                  disabled={busy !== null}
                  loading={busy === 'stripe'}
                >
                  {busy !== 'stripe' && <CreditCard size={15} aria-hidden />}
                  {busy === 'stripe' ? 'Đang chuyển…' : 'Thanh toán qua thẻ'}
                </GaBtn>
                <GaBtn
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={payMomo}
                  disabled={busy !== null}
                  loading={busy === 'momo'}
                >
                  {busy === 'momo' ? 'Đang tạo đơn…' : 'Thanh toán qua MoMo'}
                </GaBtn>
              </div>
            ) : (
              <div className="ga-ui rounded-ga border border-ga-line py-2.5 text-center text-[13px] font-semibold text-ga-muted">
                Gói mặc định — đang sử dụng
              </div>
            )}

            <p className="ga-ui mt-2.5 text-center text-[12px] leading-relaxed text-ga-subtle">
              Huỷ bất kỳ lúc nào · Không phí ẩn · Hoàn tiền trong 7 ngày
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {PAY_BADGES.map((m) => (
                <span
                  key={m}
                  className="ga-ui border border-ga-line px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.06em] text-ga-muted"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function V2PaymentPage() {
  return (
    <RoleShell>
      <PaymentBody />
    </RoleShell>
  )
}
