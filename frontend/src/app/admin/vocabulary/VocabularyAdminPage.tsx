'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronRight, Database, Filter } from 'lucide-react'
import { useLocale } from 'next-intl'
import api from '@/lib/api'
import AdminShell from '@/components/admin/AdminShell'

import { WordItem, WordListResponse, TagItem } from './components/types'
import VocabFilterBar from './components/VocabFilterBar'
import VocabDataTable from './components/VocabDataTable'
import EditWordCard from './components/EditWordCard'
import ReviewPanel from './components/ReviewPanel'
import {
  AutoTagPanel,
  GlosbeViPanel,
  LlmViPanel,
  DtypeFixPanel,
  GenderEnrichPanel,
  MissingDataPanel,
  WiktionaryBatchPanel,
  ResetReimportPanel
} from './components/VocabBatchActions'

const PAGE_SIZE = 25

export default function VocabularyAdminPage() {
  const uiLocale = useLocale()
  const [words, setWords] = useState<WordItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [cefr, setCefr] = useState('')
  const [dtype, setDtype] = useState('')
  const [gender, setGender] = useState('')
  const [tag, setTag] = useState('')
  const [tags, setTags] = useState<TagItem[]>([])

  const [editWord, setEditWord] = useState<WordItem | null>(null)
  const [enrichingId, setEnrichingId] = useState<number | null>(null)

  // load tags for topic filter
  useEffect(() => {
    api.get<TagItem[]>('/tags', { params: { locale: uiLocale } })
      .then(r => setTags(r.data ?? []))
      .catch(() => setTags([]))
  }, [uiLocale])

  const fetchWords = useCallback(async (p = 0, overrides?: { cefr?: string; dtype?: string; gender?: string; q?: string; tag?: string }) => {
    setLoading(true)
    try {
      const activeCefr  = overrides?.cefr   !== undefined ? overrides.cefr   : cefr
      const activeDtype = overrides?.dtype  !== undefined ? overrides.dtype  : dtype
      const activeGender = overrides?.gender !== undefined ? overrides.gender : gender
      const activeQ     = overrides?.q      !== undefined ? overrides.q      : q
      const activeTag   = overrides?.tag    !== undefined ? overrides.tag    : tag
      const params: Record<string, string> = { page: String(p), size: String(PAGE_SIZE), locale: 'vi' }
      if (activeQ)      params.q      = activeQ
      if (activeCefr)   params.cefr   = activeCefr
      if (activeDtype)  params.dtype  = activeDtype
      if (activeGender) params.gender = activeGender
      if (activeTag)    params.tag    = activeTag
      const res = await api.get('/words', { params, timeout: 8000 })
      const data: WordListResponse = res.data
      setWords(data.items)
      setTotal(data.total)
      setPage(p)
    } catch { setWords([]); setTotal(0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    finally { setLoading(false) }
  }, [q, cefr, dtype, gender, tag, uiLocale])

  useEffect(() => { fetchWords(0) }, [fetchWords])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const enrichOne = async (wordId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEnrichingId(wordId)
    try {
      await api.post('/admin/vocabulary/wiktionary/enrich/one', { wordId })
      await fetchWords(page)
    } catch { }
    finally { setEnrichingId(null) }
  }

  return (
    <AdminShell title="Quản lý từ vựng" subtitle={`${total.toLocaleString()} từ trong database`} activeNav="vocabulary">
      <div className="space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tổng từ', value: total.toLocaleString(), icon: Database, color: '#121212' },
            { label: 'Đang hiển thị', value: words.length, icon: Filter, color: '#10b981' },
            { label: 'Trang', value: `${page + 1} / ${totalPages}`, icon: ChevronRight, color: '#f59e0b' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-[12px] p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <p className="text-[#0F172A] font-bold text-lg leading-tight">{value}</p>
                <p className="text-[#94A3B8] text-xs">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <VocabFilterBar
          q={q} setQ={setQ}
          cefr={cefr} setCefr={setCefr}
          dtype={dtype} setDtype={setDtype}
          gender={gender} setGender={setGender}
          tag={tag} setTag={setTag}
          tags={tags}
          loading={loading}
          onSearch={(overrides) => fetchWords(0, overrides)}
        />

        {/* Word Table */}
        <VocabDataTable
          words={words}
          total={total}
          page={page}
          totalPages={totalPages}
          loading={loading}
          enrichingId={enrichingId}
          onEnrichOne={enrichOne}
          onEditWord={setEditWord}
          onPageChange={fetchWords}
          pageSize={PAGE_SIZE}
        />

        {/* Wiktionary Batch */}
        <WiktionaryBatchPanel onDone={() => fetchWords(page)} />

        {/* Auto Topic Tagging */}
        <AutoTagPanel onDone={() => fetchWords(page)} />

        {/* Glosbe VI Enrich */}
        <GlosbeViPanel onDone={() => fetchWords(page)} />

        {/* LLM VI Translation */}
        <LlmViPanel onDone={() => fetchWords(page)} />

        {/* Phase 1: dtype Fix */}
        <DtypeFixPanel />

        {/* Phase 2: Gender Enrichment */}
        <GenderEnrichPanel />

        {/* Phase 3: IPA + EN meaning */}
        <MissingDataPanel />

        {/* Phase 4: Quality Review */}
        <ReviewPanel />

        {/* Reset & Reimport */}
        <ResetReimportPanel onDone={() => fetchWords(0)} />

      </div>

      {/* Edit Card Modal */}
      <AnimatePresence>
        {editWord && (
          <EditWordCard
            word={editWord}
            onClose={() => setEditWord(null)}
            onSaved={() => fetchWords(page)}
          />
        )}
      </AnimatePresence>
    </AdminShell>
  )
}
