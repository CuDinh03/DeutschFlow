'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchVocabularyImageReview, approveVocabularyImageReview, VocabularyImageReviewResponse } from '@/lib/vocabularyImageApi'
import { previewVocabularyImageBatch } from '@/lib/mediaApi'
import { WordItem } from './types'

type Props = {
  selectedWord?: WordItem | null
  onOpenEdit?: (word: WordItem) => void
}

export default function VocabularyImageReviewPanel({ selectedWord, onOpenEdit }: Props) {
  const [wordId, setWordId] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [review, setReview] = useState<VocabularyImageReviewResponse | null>(null)
  const [error, setError] = useState('')
  const [selectedUnsplashId, setSelectedUnsplashId] = useState('')
  const [personaStyle, setPersonaStyle] = useState('DEFAULT')
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const currentWordId = Number(wordId)

  useEffect(() => {
    if (selectedWord?.id) {
      setWordId(String(selectedWord.id))
      setSelectedUnsplashId('')
      window.requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        searchInputRef.current?.focus({ preventScroll: true })
      })
    }
  }, [selectedWord?.id])

  const loadReviewForWord = async (id: number) => {
    setLoading(true)
    setError('')
    try {
      setReview(await fetchVocabularyImageReview(id, 8))
      setSelectedUnsplashId('')
      window.requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không tải được review')
    } finally {
      setLoading(false)
    }
  }

  const loadReview = async () => {
    const id = currentWordId
    if (!id || !Number.isFinite(id) || id <= 0) {
      setError('Chọn từ từ bảng hoặc dùng auto tìm từ thiếu ảnh')
      return
    }
    await loadReviewForWord(id)
  }

  const autoFindNextMissing = async () => {
    setAutoLoading(true)
    setError('')
    try {
      const batch = await previewVocabularyImageBatch(1, personaStyle)
      const nextId = batch?.missingWordIds?.[0]
      if (!nextId) {
        setError('Không còn từ nào thiếu ảnh')
        return
      }
      setWordId(String(nextId))
      await loadReviewForWord(nextId)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể tự tìm từ thiếu ảnh')
    } finally {
      setAutoLoading(false)
    }
  }

  const approve = async () => {
    if (!review || !selectedUnsplashId) return
    setSaving(true)
    setError('')
    try {
      await approveVocabularyImageReview(review.wordId, {
        unsplashId: selectedUnsplashId,
        decision: 'APPROVE',
        personaStyle,
      })
      setReview(null)
      setSelectedUnsplashId('')
      setError('Đã lưu ảnh Unsplash thành công')
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể approve ảnh')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={panelRef} className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Review ảnh Unsplash cho từ vựng</p>
          <p className="text-xs text-[#94A3B8]">Tự tìm từ thiếu ảnh, hoặc chọn trực tiếp từ bảng từ vựng.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedWord && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              Selected: {selectedWord.id} · {selectedWord.baseForm}
            </span>
          )}
          <select
            value={personaStyle}
            onChange={(e) => setPersonaStyle(e.target.value)}
            className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="DEFAULT">DEFAULT</option>
            <option value="LUKAS">LUKAS</option>
            <option value="EMMA">EMMA</option>
            <option value="ANNA">ANNA</option>
            <option value="KLAUS">KLAUS</option>
            <option value="TUAN">TUAN</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <input
          ref={searchInputRef}
          value={selectedWord ? String(selectedWord.id) : wordId}
          onChange={(e) => setWordId(e.target.value)}
          placeholder="wordId"
          className="w-full rounded-[12px] border border-[#CBD5E1] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
        />
        <button
          onClick={loadReview}
          disabled={loading}
          className="px-4 py-2.5 rounded-[12px] bg-[#121212] text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Đang tải...' : 'Load review'}
        </button>
        <button
          onClick={autoFindNextMissing}
          disabled={autoLoading}
          className="px-4 py-2.5 rounded-[12px] bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {autoLoading ? 'Đang tìm...' : 'Auto next missing'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {review && (
        <div className="space-y-4">
          <div className="rounded-[16px] bg-slate-50 border border-slate-200 p-4 text-sm text-[#475569] space-y-1">
            <p><span className="font-semibold">Base form:</span> {review.baseForm}</p>
            <p><span className="font-semibold">Meaning:</span> {review.meaning}</p>
            <p><span className="font-semibold">Query:</span> {review.queryUsed}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {review.suggestions.map((item) => {
              const selected = selectedUnsplashId === item.unsplashId
              return (
                <button
                  key={item.unsplashId}
                  onClick={() => setSelectedUnsplashId(item.unsplashId)}
                  className={`group text-left rounded-[18px] border bg-white overflow-hidden transition-all ${selected ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-md' : 'border-[#E2E8F0] hover:shadow-md hover:border-slate-300'}`}
                >
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img
                      src={item.thumbUrl}
                      alt={item.altText || item.description || item.unsplashId}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    {selected && (
                      <div className="absolute inset-0 bg-indigo-600/10 flex items-start justify-end p-3">
                        <span className="inline-flex items-center rounded-full bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 shadow">
                          Selected
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.photographerName || 'Unsplash'}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{item.altText || item.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="truncate">{item.unsplashId}</span>
                      <a
                        href={item.pageUrl || item.fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={approve}
            disabled={saving || !selectedUnsplashId}
            className="px-4 py-2.5 rounded-[12px] bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Approve & Save'}
          </button>
        </div>
      )}
    </div>
  )
}
