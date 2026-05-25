'use client'

import AdminShell from '@/components/admin/AdminShell'

const settings = [
  {
    title: 'General platform settings',
    description: 'Quản lý cấu hình vận hành, thương hiệu và các tuỳ chọn mặc định cho toàn hệ thống.',
    items: ['Branding', 'Timezone', 'Default language', 'Registration mode'],
  },
  {
    title: 'Security & access',
    description: 'Thiết lập bảo mật, phân quyền và kiểm soát truy cập cho quản trị viên và giảng viên.',
    items: ['Password policy', '2FA policy', 'Role permissions', 'Session limits'],
  },
  {
    title: 'Integrations',
    description: 'Theo dõi các tích hợp đang kết nối với hệ thống như thanh toán, storage và AI services.',
    items: ['Momo', 'S3', 'AI providers', 'Webhook endpoints'],
  },
]

export default function AdminSettingsPage() {
  return (
    <AdminShell title="Settings" subtitle="Trang cấu hình quản trị hệ thống." activeNav="settings">
      <div className="grid gap-4 lg:grid-cols-3">
        {settings.map((section) => (
          <section key={section.title} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-[#0F172A]">{section.title}</h2>
            <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{section.description}</p>
            <ul className="mt-4 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="text-sm text-[#0F172A] flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#121212]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AdminShell>
  )
}
