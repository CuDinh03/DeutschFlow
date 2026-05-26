'use client'

import { useMemo, useState } from 'react'
import { generateVocabularyImageBatch, getVocabWordInfo, previewVocabularyImageBatch, WordInfo } from '@/lib/mediaApi'

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
  const [wordInfoMap, setWordInfoMap] = useState<Record<number, WordInfo>>({})
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
      const data = await previewVocabularyImageBatch(limit, personaStyle, cefr || undefined, dtype || undefined, tag || undefined)
      setResult(data)
      if (data?.missingWordIds?.length) {
        const info = await getVocabWordInfo(data.missingWordIds)
        setWordInfoMap(Object.fromEntries(info.map((w) => [w.id, w])))
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || 'Không thể preview batch')
    } finally {
      setLoadingPreview(false)
    }
  }

  const generate = async () => {
    setLoadingGenerate(true)
    setError('')
    try {
      const data = await generateVocabularyImageBatch(limit, personaStyle, cefr || undefined, dtype || undefined, tag || undefined, approvedIds.length ? approvedIds : undefined)
      setResult(data)
      setWordInfoMap({})
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || 'Không thể chạy batch')
    } finally {
      setLoadingGenerate(false)
    }
  }

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#0F172A]">Batch auto-assign ảnh từ Unsplash</p>
        <p className="text-xs text-[#94A3B8]">Lọc theo CEFR / dtype / tag rồi preview trước khi chạy hàng loạt.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 font-medium">Limit</label>
          <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 font-medium">CEFR</label>
          <input value={cefr} onChange={(e) => setCefr(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="A1, B2…" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 font-medium">dtype</label>
          <input value={dtype} onChange={(e) => setDtype(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="Noun…" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 font-medium">Tag</label>
          <input value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="topic tag" />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-[10px] text-slate-500 font-medium">Approved IDs (comma-separated)</label>
          <input value={approvedWordIds} onChange={(e) => setApprovedWordIds(e.target.value)} className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-sm" placeholder="123, 456, 789" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={preview} disabled={loadingPreview} className="flex-1 px-4 py-2 rounded-[10px] bg-[#121212] text-white text-sm font-semibold disabled:opacity-60">
          {loadingPreview ? 'Đang preview...' : 'Preview (xem danh sách từ thiếu ảnh)'}
        </button>
        <button onClick={generate} disabled={loadingGenerate} className="flex-1 px-4 py-2 rounded-[10px] bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">
          {loadingGenerate ? 'Đang chạy...' : approvedIds.length ? `Auto-assign ${approvedIds.length} từ đã chọn` : 'Auto-assign tất cả (theo limit)'}
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
              <p className="text-[11px] text-slate-500">Thiếu ảnh</p>
              <p className="text-sm font-semibold text-slate-900">{result.missingCount ?? 0}</p>
            </div>
            <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Đã tạo</p>
              <p className="text-sm font-semibold text-slate-900">{result.created ?? 0}</p>
            </div>
          </div>

          {Array.isArray(result.missingWordIds) && result.missingWordIds.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Danh sách {result.missingWordIds.length} từ sẽ được assign ảnh:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {result.missingWordIds.map((id) => {
                  const info = wordInfoMap[id]
                  return (
                    <div key={id} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      {info ? (
                        <>
                          <p className="font-semibold text-slate-800 truncate">{info.base_form}</p>
                          <p className="text-slate-400">{info.cefr_level} · {info.dtype} · #{id}</p>
                        </>
                      ) : (
                        <p className="font-semibold text-slate-700">Word #{id}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
