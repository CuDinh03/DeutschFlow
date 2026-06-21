'use client'

import { GaPageHdr, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình hệ thống (admin) — navy, read-only overview (W1.7 migrate admin/settings).
// Parity: màn legacy là các thẻ tĩnh giới thiệu nhóm cấu hình (không có backend);
// giữ nguyên tính chất "tổng quan", chỉnh chi tiết qua từng module tương ứng.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: { title: string; desc: string; items: string[] }[] = [
  {
    title: 'Cấu hình nền tảng',
    desc: 'Quản lý cấu hình vận hành, thương hiệu và các tuỳ chọn mặc định cho toàn hệ thống.',
    items: ['Thương hiệu (Branding)', 'Múi giờ', 'Ngôn ngữ mặc định', 'Chế độ đăng ký'],
  },
  {
    title: 'Bảo mật & truy cập',
    desc: 'Thiết lập bảo mật, phân quyền và kiểm soát truy cập cho quản trị viên và giảng viên.',
    items: ['Chính sách mật khẩu', 'Chính sách 2FA', 'Phân quyền vai trò', 'Giới hạn phiên'],
  },
  {
    title: 'Tích hợp',
    desc: 'Các tích hợp đang kết nối: thanh toán, lưu trữ và dịch vụ AI.',
    items: ['SePay / VietQR', 'AWS S3', 'AI providers', 'Webhook endpoints'],
  },
]

export default function V2AdminSettingsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Cấu hình hệ thống" subtitle="Tổng quan cấu hình vận hành quản trị (chỉ xem)" />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border border-ga-line bg-ga-card p-5">
              <h2 className="font-ga-display text-[18px] font-medium text-ga-ink">{s.title}</h2>
              <p className="ga-ui mt-2 text-[13px] leading-relaxed text-ga-muted">{s.desc}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {s.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-[13.5px] text-ga-ink">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-ga-accent" /> {it}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <GaCap className="mt-6 block">Chỉnh sửa chi tiết thực hiện qua từng module tương ứng.</GaCap>
      </div>
    </div>
  )
}
