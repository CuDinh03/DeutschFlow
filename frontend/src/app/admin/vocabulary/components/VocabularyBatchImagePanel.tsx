'use client'

import { useMemo, useState } from 'react'
import { generateVocabularyImageBatch, previewVocabularyImageBatch } from '@/lib/mediaApi'

type BatchResult = {
  limit: number
  personaStyle: string
  missingCount?: number
  remainingMissingCount?: number
  created?: number
  missingWordIds?: number[]
}

export default function VocabularyBatchImagePanel() {
  const [limit, setLimit] = useState(20)
  const [personaStyle, setPersonaStyle] = useState('DEFAULT')
  const [cefr, setCefr] = useState('')
  const [dtype, setDtype] = useState('')
  const [tag, setTag] = useState('')
  const [approvedWordIds, setApprovedWordIds] = useState<string>('')
  const [result, setResult] = useState<BatchResult | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [error, setError] = useState('')

  const approvedIds = useMemo(
    () => approvedWordIds
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0),
    [approvedWordIds],
  )

  const preview = async () => {
    setLoadingPreview(true)
    setError('')
    try {
      setResult(await previewVocabularyImageBatch(limit, personaStyle, cefr || undefined, dtype || undefined, tag || undefined))
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể preview batch')
    } finally {
      setLoadingPreview(false)
    }
  }

  const generate = async () => {
    setLoadingGenerate(true)
    setError('')
    try {
      setResult(await generateVocabularyImageBatch(limit, personaStyle, cefr || undefined, dtype || undefined, tag || undefined, approvedIds.length ? approvedIds : undefined))
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể chạy batch')
    } finally {
      setLoadingGenerate(false)
    }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#0F172A]">Batch auto-assign ảnh từ Unsplash</p>
        <p className="text-xs text-[#94A3B8]">Lọc theo CEFR / dtype / tag rồi preview grid trước khi chạy hàng loạt.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="Limit" />
        <input value={personaStyle} onChange={(e) => setPersonaStyle(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="DEFAULT" />
        <input value={cefr} onChange={(e) => setCefr(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="CEFR" />
        <input value={dtype} onChange={(e) => setDtype(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="dtype" />
        <input value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="tag" />
        <input value={approvedWordIds} onChange={(e) => setApprovedWordIds(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm md:col-span-2" placeholder="Approved word IDs (comma-separated)" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={preview} disabled={loadingPreview} className="flex-1 px-4 py-2 rounded-[10px] bg-[#121212] text-white text-sm font-semibold disabled:opacity-60">
          {loadingPreview ? 'Đang preview...' : 'Preview grid'}
        </button>
        <button onClick={generate} disabled={loadingGenerate} className="flex-1 px-4 py-2 rounded-[10px] bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">
          {loadingGenerate ? 'Đang chạy...' : 'Auto-assign only approved'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Limit</p>
              <p className="text-sm font-semibold text-slate-900">{result.limit}</p>
            </div>
            <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Style</p>
              <p className="text-sm font-semibold text-slate-900">{result.personaStyle}</p>
            </div>
            <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Missing</p>
              <p className="text-sm font-semibold text-slate-900">{result.missingCount ?? 0}</p>
            </div>
            <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Created</p>
              <p className="text-sm font-semibold text-slate-900">{result.created ?? 0}</p>
            </div>
          </div>

          {Array.isArray(result.missingWordIds) && result.missingWordIds.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {result.missingWordIds.map((id) => (
                <div key={id} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Word #{id}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
