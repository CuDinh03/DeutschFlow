'use client'

import { motion } from 'framer-motion'
import { Coins, CreditCard, CheckCircle2, ArrowRight } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

type Plan = {
  name: string
  price: string
  cadence: string
  description: string
  features: string[]
  highlighted?: boolean
}

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'Miễn phí',
    cadence: 'cho lớp nhỏ hoặc thử nghiệm',
    description: 'Dành cho giáo viên muốn trải nghiệm quy trình quản lý bài học và học viên cơ bản.',
    features: ['Quản lý lớp cơ bản', 'Theo dõi tiến độ học viên', 'Báo cáo đơn giản'],
  },
  {
    name: 'Pro',
    price: 'Liên hệ',
    cadence: 'cho trường và trung tâm',
    description: 'Gói tối ưu cho nhóm vận hành cần báo cáo sâu, kiểm soát người dùng và quy trình học tập.',
    features: ['Báo cáo nâng cao', 'Tích hợp dữ liệu', 'Ưu tiên hỗ trợ'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Tùy chỉnh',
    cadence: 'theo nhu cầu triển khai',
    description: 'Phù hợp cho tổ chức cần tuỳ biến quy trình, bảo mật và triển khai quy mô lớn.',
    features: ['Thiết kế theo yêu cầu', 'Phân quyền nâng cao', 'Hỗ trợ triển khai'],
  },
]

export default function AdminPlansPage() {
  return (
    <AdminShell title="Plans" subtitle="Quản lý các gói đăng ký, quyền lợi và định hướng thương mại cho hệ thống." activeNav="plans">
      <div className="space-y-5">
        <div className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#94A3B8]">Subscription management</p>
              <h2 className="text-xl font-extrabold text-[#0F172A] mt-1">Gói dịch vụ hiện tại</h2>
              <p className="text-sm text-[#64748B] mt-1">Trang này hiển thị cấu trúc gói dịch vụ để đội ngũ vận hành có thể rà soát nhanh các lựa chọn thương mại.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#0F172A]">
              <Coins size={16} /> Revenue-ready
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`rounded-[16px] p-5 border shadow-sm bg-white transition-shadow hover:shadow-md ${plan.highlighted ? 'border-[#121212] ring-1 ring-[#121212]/10' : 'border-[#E2E8F0]'}`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center bg-[#F1F5F9]">
                    <CreditCard size={20} className="text-[#0F172A]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#0F172A]">{plan.name}</h3>
                    <p className="text-xs text-[#94A3B8]">{plan.cadence}</p>
                  </div>
                </div>
                {plan.highlighted && (
                  <span className="text-[11px] font-bold uppercase tracking-widest rounded-full bg-[#121212] text-white px-3 py-1">Popular</span>
                )}
              </div>

              <p className="text-2xl font-extrabold text-[#0F172A]">{plan.price}</p>
              <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{plan.description}</p>

              <div className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-[#0F172A]">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <a href="#" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#121212] hover:opacity-80 transition-opacity">
                Xem cấu hình <ArrowRight size={16} />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
