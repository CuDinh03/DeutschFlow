'use client'

import { Check } from 'lucide-react'
import { GaPageHdr, GaBtn } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// v1.0: PRO only (ULTRA deferred). Web self-serve payment (SePay "gói N ngày") ships in v1.1;
// until then the paid card shows a "coming soon" CTA. MoMo/Stripe removed per the locked billing
// decision (SePay is the VN channel; Stripe hidden; MoMo deferred).

interface Plan {
  code: 'FREE' | 'PRO'
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
    features: ['Học từ vựng & ngữ pháp cơ bản', 'Bài học lộ trình A1–B1', 'Theo dõi tiến độ cơ bản'],
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
]

const vnd = (n: number) => (n === 0 ? 'Miễn phí' : `${n.toLocaleString('vi-VN')}₫`)

function PaymentBody() {
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Nâng cấp gói" subtitle="Mở khoá toàn bộ sức mạnh AI cho hành trình tiếng Đức của bạn" />
      <div className="flex-1 px-10 py-8">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 lg:grid-cols-2">
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
                    <GaBtn variant="primary" className="w-full justify-center" disabled>
                      Sắp ra mắt
                    </GaBtn>
                    <p className="ga-ui text-center text-[12px] text-ga-subtle">
                      Thanh toán qua SePay sẽ sớm có mặt.
                    </p>
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
