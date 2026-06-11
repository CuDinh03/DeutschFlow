'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Award, X, ExternalLink, Loader2, Check, AlertCircle } from 'lucide-react'
import { issueCertificate, type CefrLevel, type Certificate } from '@/lib/certificateApi'
import { apiMessage } from '@/lib/api'

interface CertificateIssuerProps {
  classId: number
  studentId: number
  studentName?: string
}

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const MAX_NOTE = 500

/**
 * Teacher action to issue a co-branded readiness/completion certificate (D5) for the student
 * currently in view. Self-contained: own modal + form state; the backend snapshots the student's
 * real name and the center co-brand, so only level/score/note are collected here.
 */
export function CertificateIssuer({ classId, studentId, studentName }: CertificateIssuerProps) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<CefrLevel>('B1')
  const [score, setScore] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Certificate | null>(null)

  function reset() {
    setLevel('B1')
    setScore('')
    setNote('')
    setError(null)
    setResult(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function submit() {
    setError(null)
    const trimmedScore = score.trim()
    let parsedScore: number | null = null
    if (trimmedScore !== '') {
      const n = Number(trimmedScore)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError('Điểm phải là số trong khoảng 0–100.')
        return
      }
      parsedScore = Math.round(n)
    }
    setSubmitting(true)
    try {
      const cert = await issueCertificate({
        classId,
        studentId,
        cefrLevel: level,
        score: parsedScore,
        note: note.trim() || null,
      })
      setResult(cert)
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <Award size={18} /> Cấp chứng nhận
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-800">
                <Award size={20} className="text-emerald-600" /> Cấp chứng nhận
              </h3>
              <button type="button" onClick={close} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            {result ? (
              <div className="px-6 py-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <Check size={26} />
                </div>
                <p className="text-base font-bold text-slate-800">Đã cấp chứng nhận {result.cefrLevel}</p>
                <p className="mt-1 text-sm text-slate-500">cho {result.studentName}</p>
                <p className="mt-3 font-mono text-xs font-semibold text-slate-600">{result.certificateCode}</p>
                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href={`/certificate/${result.verifyToken}`}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <ExternalLink size={16} /> Mở chứng nhận
                  </Link>
                  <button type="button" onClick={reset} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    Cấp chứng nhận khác
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5">
                {studentName ? (
                  <p className="mb-4 text-sm text-slate-500">
                    Học viên: <span className="font-semibold text-slate-800">{studentName}</span>
                  </p>
                ) : null}

                <label className="block text-sm font-semibold text-slate-700">Trình độ CEFR</label>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setLevel(lv)}
                      className={`rounded-xl border px-2 py-2 text-sm font-bold transition ${
                        level === lv
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      {lv}
                    </button>
                  ))}
                </div>

                <label htmlFor="cert-score" className="mt-4 block text-sm font-semibold text-slate-700">
                  Điểm đánh giá <span className="font-normal text-slate-400">(tùy chọn, 0–100)</span>
                </label>
                <input
                  id="cert-score"
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="vd: 85"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />

                <label htmlFor="cert-note" className="mt-4 block text-sm font-semibold text-slate-700">
                  Nhận xét <span className="font-normal text-slate-400">(tùy chọn)</span>
                </label>
                <textarea
                  id="cert-note"
                  value={note}
                  maxLength={MAX_NOTE}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Lời nhận xét ngắn in trên chứng nhận…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />

                {error ? (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600">
                    <AlertCircle size={15} /> {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />}
                  {submitting ? 'Đang cấp…' : 'Cấp chứng nhận'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
