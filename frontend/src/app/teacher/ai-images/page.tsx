'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { logout } from '@/lib/authSession'

export default function TeacherAiImagesPage() {
  const router = useRouter()

  return (
    <TeacherShell
      activeMenu="materials"
      userName="Giáo viên"
      onLogout={() => { logout(); router.push('/') }}
      headerTitle="Unsplash Vocabulary Images"
      headerSubtitle="Chọn ảnh từ Unsplash để gắn vào từ vựng"
    >
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Luồng AI tạo ảnh đã được thay thế</h2>
          <p className="text-slate-600 leading-relaxed">
            Từ giờ hệ thống sẽ dùng ảnh Unsplash để gắn vào từ vựng thay vì tạo ảnh tự động.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/teacher/media" className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold text-center">
              Vào thư viện ảnh
            </Link>
            <Link href="/teacher/vocabulary" className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-center">
              Vào từ vựng
            </Link>
          </div>
        </div>
      </div>
    </TeacherShell>
  )
}
