'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, GraduationCap, Loader2, Sparkles, Clock, Target, FileText, Lock } from 'lucide-react'
import { getMockPack, type MockExamPackDetail } from '@/lib/mockPackApi'
import { httpStatus } from '@/lib/api'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; pack: MockExamPackDetail }
  | { kind: 'locked' }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string }

export default function MockExamPackDetailPage() {
  const params = useParams<{ id: string }>()
  const packId = Number(params?.id)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = useCallback(async () => {
    if (!Number.isInteger(packId) || packId <= 0) {
      setState({ kind: 'notFound' })
      return
    }
    setState({ kind: 'loading' })
    try {
      const pack = await getMockPack(packId)
      setState({ kind: 'ok', pack })
    } catch (e) {
      const status = httpStatus(e)
      if (status === 403) setState({ kind: 'locked' })
      else if (status === 404) setState({ kind: 'notFound' })
      else if (status === 401) setState({ kind: 'error', message: 'Vui lòng đăng nhập.' })
      else setState({ kind: 'error', message: 'Không tải được bộ đề. Thử lại sau.' })
    }
  }, [packId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/student/mock-exam/packs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
          <ArrowLeft size={16} /> Bộ đề luyện thi
        </Link>

        {state.kind === 'loading' && (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>
        )}

        {state.kind === 'locked' && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <Lock size={26} className="mx-auto text-amber-500" />
            <h1 className="mt-3 text-lg font-black text-slate-900">Bộ đề bị khoá</h1>
            <p className="mt-1 text-sm text-slate-600">Nâng cấp gói để mở khoá bộ đề luyện thi này.</p>
            <Link href="/pricing" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600">
              <Sparkles size={15} /> Nâng cấp để mở khoá
            </Link>
          </div>
        )}

        {state.kind === 'notFound' && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            Không tìm thấy bộ đề này.
          </div>
        )}

        {state.kind === 'error' && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{state.message}</div>
        )}

        {state.kind === 'ok' && <PackDetail pack={state.pack} />}
      </div>
    </main>
  )
}

function PackDetail({ pack }: { pack: MockExamPackDetail }) {
  return (
    <>
      <div className="mt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
          <GraduationCap size={13} /> {pack.cefrLevel} · {pack.examFormat}
        </span>
        <h1 className="mt-2 font-serif text-3xl font-black text-slate-900">{pack.title}</h1>
        {pack.descriptionVi && <p className="mt-1 text-sm leading-relaxed text-slate-500">{pack.descriptionVi}</p>}
      </div>

      {pack.exams.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          Bộ đề này chưa có đề thi thử nào.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {/* Exams are taken in-page on /student/mock-exam (no per-exam route), so each row links
              to that take surface where the user starts the exam. */}
          {pack.exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href="/student/mock-exam"
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{exam.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    {exam.totalPoints != null && (
                      <span className="inline-flex items-center gap-1"><Target size={12} /> {exam.totalPoints} điểm{exam.passPoints != null ? ` · đạt ${exam.passPoints}` : ''}</span>
                    )}
                    {exam.timeLimitMinutes != null && (
                      <span className="inline-flex items-center gap-1"><Clock size={12} /> {exam.timeLimitMinutes} phút</span>
                    )}
                  </div>
                </div>
                <ArrowRight size={16} className="shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/student/mock-exam"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
      >
        Vào luyện thi <ArrowRight size={15} />
      </Link>
    </>
  )
}
