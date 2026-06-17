'use client'

import { useState } from 'react'
import { Check, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { createStripeSession, createMomoOrder } from '@/lib/paymentApi'
import { GaPageHdr, GaBtn } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// Reuse paymentApi (Stripe primary; MoMo secondary). Plans mirror the legacy /student/pricing
// constants (no plan-list endpoint exists). Option-1: Stripe is the primary CTA per strategy.

type PaidPlan = 'PRO' | 'ULTRA'
interface Plan {
  code: 'FREE' | PaidPlan
  name: string
  priceVnd: number
  period: string
  accent: string
  features: string[]
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    code: 'FREE',
    name: 'Miễn phí',
    priceVnd: 0,
    period: 'mãi mãi',
    accent: 'var(--ga-muted)',
    features: ['Học từ vựng & ngữ pháp cơ bản', 'Giới hạn token AI mỗi ngày', 'Theo dõi tiến độ cơ bản'],
  },
  {
    code: 'PRO',
    name: 'Pro',
    priceVnd: 299000,
    period: 'mỗi tháng',
    accent: 'var(--ga-violet)',
    highlight: true,
    features: [
      'Toàn bộ tính năng AI Speaking',
      'Chấm bài & phản hồi AI không giới hạn',
      'Luyện phỏng vấn & thi thử Goethe',
      'Lộ trình cá nhân hoá',
    ],
  },
  {
    code: 'ULTRA',
    name: 'Ultra',
    priceVnd: 699000,
    period: 'mỗi 2 tháng',
    accent: 'var(--ga-gold)',
    features: ['Mọi thứ trong Pro', 'Hạn mức token cao nhất', 'Ưu tiên hàng đợi AI', 'Hỗ trợ ưu tiên'],
  },
]

const vnd = (n: number) => (n === 0 ? 'Miễn phí' : `${n.toLocaleString('vi-VN')}₫`)

function PaymentBody() {
  const [busy, setBusy] = useState<string | null>(null)

  const payStripe = async (plan: PaidPlan) => {
    setBusy(`stripe-${plan}`)
    try {
      const res = await createStripeSession({ planCode: plan })
      window.location.href = res.url
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể tạo phiên thanh toán.')
      setBusy(null)
    }
  }
  const payMomo = async (plan: PaidPlan) => {
    setBusy(`momo-${plan}`)
    try {
      const res = await createMomoOrder({ planCode: plan, durationMonths: plan === 'ULTRA' ? 2 : 1 })
      window.location.href = res.payUrl
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Không thể tạo đơn MoMo.')
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Nâng cấp gói" subtitle="Mở khoá toàn bộ sức mạnh AI cho hành trình tiếng Đức của bạn" />
      <div className="flex-1 px-10 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const paid = plan.code !== 'FREE'
            return (
              <div
                key={plan.code}
                className="relative flex flex-col border bg-ga-card p-7"
                style={{
                  borderColor: plan.highlight ? plan.accent : 'var(--ga-line)',
                  boxShadow: plan.highlight ? 'var(--ga-shadow-card-hover)' : undefined,
                }}
              >
                {plan.highlight && (
                  <span
                    className="ga-ui absolute -top-3 left-7 rounded-ga-pill px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white"
                    style={{ background: plan.accent }}
                  >
                    Phổ biến nhất
                  </span>
                )}
                <p className="font-ga-display text-[24px] font-medium text-ga-ink">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-ga-display text-[34px] font-medium" style={{ color: plan.accent }}>
                    {vnd(plan.priceVnd)}
                  </span>
                  <span className="ga-ui text-[13px] text-ga-muted">/ {plan.period}</span>
                </div>

                <ul className="my-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="ga-ui flex items-start gap-2.5 text-[13.5px] text-ga-ink">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: plan.accent }} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                {paid ? (
                  <div className="space-y-2.5">
                    <GaBtn
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => payStripe(plan.code as PaidPlan)}
                      disabled={busy !== null}
                    >
                      <CreditCard size={15} aria-hidden />
                      {busy === `stripe-${plan.code}` ? 'Đang chuyển…' : 'Thanh toán thẻ (Stripe)'}
                    </GaBtn>
                    <GaBtn
                      variant="ghost"
                      className="w-full justify-center"
                      onClick={() => payMomo(plan.code as PaidPlan)}
                      disabled={busy !== null}
                    >
                      {busy === `momo-${plan.code}` ? 'Đang tạo đơn…' : 'Thanh toán MoMo'}
                    </GaBtn>
                  </div>
                ) : (
                  <div className="ga-ui rounded-ga border border-ga-line py-2.5 text-center text-[13px] font-semibold text-ga-muted">
                    Gói mặc định
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="ga-ui mt-6 text-center text-[12.5px] text-ga-subtle">
          Thanh toán an toàn qua Stripe hoặc MoMo. Gói tự động kích hoạt sau khi thanh toán thành công.
        </p>
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
