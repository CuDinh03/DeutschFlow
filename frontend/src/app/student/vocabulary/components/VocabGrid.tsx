import { useTranslations } from 'next-intl'
import { ChevronRight, Search, Volume2 } from 'lucide-react'
import { speakGerman } from '@/lib/speechDe'
import { VocabCardItem, GENDER_STYLE } from './types'
import VocabWordCard from './VocabWordCard'

type VocabGridProps = {
  items: VocabCardItem[]
  loading: boolean
  loadError: string
  total: number
  page: number
  size: number
  setPage: (p: number | ((prev: number) => number)) => void
  viewMode: 'grid' | 'list'
  selectedItem: VocabCardItem | null
  onOpenModal: (item: VocabCardItem) => void
}

export default function VocabGrid({
  items,
  loading,
  loadError,
  total,
  page,
  size,
  setPage,
  viewMode,
  selectedItem,
  onOpenModal
}: VocabGridProps) {
  const t = useTranslations('vocabulary')

  if (loadError) return <div className="mb-4 alert-error">{loadError}</div>
  if (loading) return <div className="text-[#64748B]">{t('loading')}</div>
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F1F4F9] flex items-center justify-center mb-4">
          <Search size={24} className="text-[#CBD5E1]" />
        </div>
        <p className="text-[#64748B] font-semibold mb-1">{t('emptyTitle')}</p>
        <p className="text-[#94A3B8] text-sm">{t('emptyHint')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between text-sm text-[#64748B] mb-4">
        <span>{t('results', { total, page: page + 1 })}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary btn-sm" disabled={page <= 0} onClick={() => setPage((p: number) => Math.max(0, p - 1))}>
            {t('prev')}
          </button>
          <button type="button" className="btn-secondary btn-sm" disabled={(page + 1) * size >= total} onClick={() => setPage((p: number) => p + 1)}>
            {t('next')}
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <VocabWordCard
              key={item.id}
              item={item}
              index={item.id}
              selected={selectedItem?.id === item.id}
              onSelect={() => onOpenModal(item)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => {
            const style = GENDER_STYLE[item.gender] || { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenModal(item)}
                className="bg-white rounded-2xl border-2 border-[#E2E8F0] px-5 py-3.5 flex items-center gap-4 text-left hover:border-[#121212] df-card-enter cursor-pointer"
                style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
              >
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: style.bg, color: style.text, borderColor: style.border }}>
                  {item.article}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[#121212] truncate">{item.word}</p>
                  {item.phonetic ? <p className="text-xs text-[#94A3B8] font-mono">{item.phonetic}</p> : null}
                </div>
                <p className="hidden md:block text-sm text-[#334155] flex-1">{item.english}</p>
                <button
                  type="button"
                  className="btn-outline btn-sm inline-flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    speakGerman(`${item.article} ${item.word}`)
                  }}
                >
                  <Volume2 size={14} />
                </button>
                <ChevronRight size={14} className="text-[#CBD5E1]" />
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
