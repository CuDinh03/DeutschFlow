import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, Filter, LayoutGrid, Layers, List, Mic, Search, X } from 'lucide-react'
import { CATEGORY_OPTIONS, CategoryOption, TagItem } from './types'

type VocabSearchBarProps = {
  total: number
  itCount: number
  q: string
  setQ: (v: string) => void
  debouncedQ: string
  setDebouncedQ: (v: string) => void
  setPage: (v: number) => void
  cefr: string
  setCefr: (v: string) => void
  dtype: string
  setDtype: (v: string) => void
  gender: string
  setGender: (v: string) => void
  tag: string
  setTag: (v: string) => void
  tags: TagItem[]
  size: number
  setSize: (v: number) => void
  viewMode: 'grid' | 'list'
  setViewMode: (v: 'grid' | 'list') => void
  categoryFilter: CategoryOption
  setCategoryFilter: (v: CategoryOption) => void
  loading: boolean
  onReload: () => void
}

export default function VocabSearchBar({
  total,
  itCount,
  q, setQ,
  debouncedQ, setDebouncedQ, setPage,
  cefr, setCefr,
  dtype, setDtype,
  gender, setGender,
  tag, setTag,
  tags,
  size, setSize,
  viewMode, setViewMode,
  categoryFilter, setCategoryFilter,
  loading,
  onReload,
}: VocabSearchBarProps) {
  const t = useTranslations('vocabulary')
  const router = useRouter()
  const [showFilters, setShowFilters] = useState(false)

  return (
    <section className="df-glass-subtle border-b border-white/30 rounded-t-2xl overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 py-4">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <p className="text-[#94A3B8] text-xs max-w-xl">
            {t('pageHeroSubtitle', { total, itCount })}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            {/* Vocab practice shortcut */}
            <button
              type="button"
              onClick={() => {
                const p = new URLSearchParams()
                if (cefr) p.set('cefr', cefr)
                if (tag) p.set('topic', tag)
                const qs = p.toString()
                router.push('/student/vocab-practice' + (qs ? '?' + qs : ''))
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #a78bfa)', color: 'white', boxShadow: '0 2px 8px rgba(34,211,238,0.4)' }}
              title={t('practiceSpeak')}>
              <Mic size={13} />
              {t('practiceSpeak')}
            </button>
            <button
              type="button"
              onClick={() => {
                const p = new URLSearchParams()
                if (cefr) p.set('cefr', cefr)
                if (tag) p.set('tag', tag)
                const qs = p.toString()
                router.push('/student/swipe-cards' + (qs ? '?' + qs : ''))
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 bg-white border border-[#E2E8F0] text-[#475569]"
              title={t('swipeCards')}>
              <Layers size={13} />
              {t('swipeCards')}
            </button>
            <div className="flex items-center gap-1 bg-[#F5F7FA] rounded-xl p-0.5 border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white text-[#121212] shadow-sm' : 'text-[#94A3B8]'}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white text-[#121212] shadow-sm' : 'text-[#94A3B8]'}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setDebouncedQ(q)
                  setPage(0)
                }
              }}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] border border-[#E2E8F0] bg-[#F8FAFF] focus:outline-none focus:ring-2 focus:ring-[#121212]/15"
            />
            {q && (
              <button
                type="button"
                onClick={() => { setQ(''); setDebouncedQ(''); setPage(0) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              showFilters ? 'bg-[#EEF4FF] text-[#121212] border-[#bfd7ff]' : 'bg-[#F8FAFF] text-[#64748B] border-[#E2E8F0]'
            }`}
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <Filter size={14} />
            {t('filterButton')}
            <ChevronDown size={13} />
          </button>
          <button type="button" className="btn-primary btn-md" onClick={onReload} disabled={loading}>
            {t('filter')}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                categoryFilter === cat
                  ? 'bg-[#121212] text-white border-[#121212]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0]'
              }`}
              onClick={() => {
                setCategoryFilter(cat)
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div
          className={`grid sm:grid-cols-2 lg:grid-cols-5 gap-3 transition-all duration-300 overflow-hidden ${
            showFilters ? 'mt-3 opacity-100 max-h-[260px]' : 'mt-0 opacity-0 max-h-0'
          }`}
        >
          <div>
            <label className="text-xs text-[#64748B] font-semibold">CEFR</label>
            <select className="input mt-1" value={cefr} onChange={(e) => setCefr(e.target.value)}>
              <option value="">{t('allLevels')}</option>
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748B] font-semibold">{t('allTypes')}</label>
            <select className="input mt-1" value={dtype} onChange={(e) => setDtype(e.target.value)}>
              <option value="">{t('allTypes')}</option>
              <option value="Noun">{t('noun')}</option>
              <option value="Verb">{t('verb')}</option>
              <option value="Adjective">Adjective</option>
              <option value="Word">Word</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748B] font-semibold">{t('allGenders')}</label>
            <select className="input mt-1" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">{t('allGenders')}</option>
              <option value="DER">DER</option>
              <option value="DIE">DIE</option>
              <option value="DAS">DAS</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748B] font-semibold">{t('allTags')}</label>
            <select className="input mt-1" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">{t('allTags')}</option>
              {tags.map((tagItem) => (
                <option key={tagItem.id} value={tagItem.name}>{tagItem.localizedLabel ?? tagItem.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748B] font-semibold">{t('size')}</label>
            <select className="input mt-1" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
              {[12, 24, 48].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}
