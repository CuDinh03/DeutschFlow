'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock, GraduationCap, ArrowRight, Sparkles, Loader2, FileText } from 'lucide-react'
import { getMockPacks, type MockExamPack } from '@/lib/mockPackApi'
import { httpStatus } from '@/lib/api'

export default function MockExamPacksPage() {
  const [packs, setPacks] = useState<MockExamPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPacks(await getMockPacks())
    } catch (e) {
      setError(httpStatus(e) === 401 ? 'Vui lòng đăng nhập.' : 'Không tải được bộ đề. Thử lại sau.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/student/mock-exam" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
          <ArrowLeft size={16} /> Thi thử
        </Link>

        <div className="mt-4">
          <h1 className="font-serif text-3xl font-black text-slate-900">Bộ đề luyện thi</h1>
          <p className="mt-1 text-sm text-slate-500">Các bộ đề thi thử theo kỳ thi — mở khoá khi nâng cấp gói.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
        ) : packs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            Chưa có bộ đề nào.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {packs.map((p) => (
              <PackCard key={p.id} pack={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function PackCard({ pack }: { pack: MockExamPack }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${pack.locked ? 'border-slate-200 bg-slate-50' : 'border-indigo-100 bg-white'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
          <GraduationCap size={13} /> {pack.cefrLevel} · {pack.examFormat}
        </span>
        {pack.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            <Lock size={12} /> Khoá
          </span>
        ) : null}
      </div>

      <h2 className="text-base font-black text-slate-800">{pack.title}</h2>
      {pack.descriptionVi ? <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{pack.descriptionVi}</p> : null}

      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <FileText size={13} /> {pack.examCount} đề thi thử
      </p>

      <div className="mt-4">
        {pack.locked ? (
          <Link
            href="/pricing"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600"
          >
            <Sparkles size={15} /> Nâng cấp để mở khoá
          </Link>
        ) : (
          <Link
            href="/student/mock-exam"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            Vào luyện thi <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </div>
  )
}
