'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { StudentShell } from '@/components/layouts/StudentShell'
import { clearTokens } from '@/lib/authSession'

type MeUser = { displayName: string; role: string }

const METRICS = [
  {
    title: 'Token usage',
    value: 'N/A',
    hint: 'Đang chờ kết nối dữ liệu usage từ backend.',
  },
  {
    title: 'Cost estimate',
    value: 'N/A',
    hint: 'Trang này sẽ hiển thị ước tính chi phí khi API sẵn sàng.',
  },
  {
    title: 'Model activity',
    value: 'N/A',
    hint: 'Theo dõi lượt gọi Groq/OpenAI theo ngày, tuần và tháng.',
  },
]

export default function StudentGroqUsagePage() {
  const t = useTranslations('student')
  const router = useRouter()

  const me = useMemo<MeUser>(() => ({ displayName: 'Student', role: 'STUDENT' }), [])

  const initials = useMemo(() => {
    return me.displayName
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [me.displayName])

  const handleLogout = () => {
    clearTokens()
    router.push('/')
  }

  return (
    <StudentShell
      activeSection="groqUsage"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel="A1"
      streakDays={0}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={t('loading')}
      headerSubtitle="Theo dõi mức sử dụng Groq/LLM và ngân sách truy vấn của người học."
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <section className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,48,94,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">Groq usage</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#0F172A]">Usage dashboard</h1>
          <p className="mt-2 text-sm text-[#64748B] leading-relaxed">
            Trang này là khung hiển thị để theo dõi request, token, và chi phí LLM theo từng học viên.
            Hiện tại component đã được chuẩn hóa để Next.js nhận diện như một module hợp lệ.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {METRICS.map((metric) => (
            <div
              key={metric.title}
              className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,48,94,0.04)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">{metric.title}</p>
              <p className="mt-3 text-2xl font-extrabold text-[#0F172A]">{metric.value}</p>
              <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{metric.hint}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[16px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
          <h2 className="text-base font-bold text-[#0F172A]">What’s next</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#475569] list-disc pl-5">
            <li>Hiển thị tổng số request theo ngày, tuần, tháng.</li>
            <li>Phân tách usage theo model, loại prompt và endpoint.</li>
            <li>Thêm chart chi phí để theo dõi ngân sách của từng học viên.</li>
          </ul>
        </section>
      </div>
    </StudentShell>
  )
}
