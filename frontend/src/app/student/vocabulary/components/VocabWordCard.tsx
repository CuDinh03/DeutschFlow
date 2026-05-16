import { useState } from 'react'
import { Bookmark, BookmarkCheck, ChevronRight } from 'lucide-react'
import { GENDER_STYLE, LEVEL_STYLE, VocabCardItem } from './types'

export default function VocabWordCard({
  item,
  selected,
  index,
  onSelect,
}: {
  item: VocabCardItem
  selected: boolean
  index: number
  onSelect: () => void
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [hovered, setHovered] = useState(false)
  
  const style = GENDER_STYLE[item.gender] || { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' }
  const levelStyle = LEVEL_STYLE[item.level] ?? LEVEL_STYLE.A1
  
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative overflow-hidden text-left bg-white rounded-2xl border-2 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:scale-[1.012] hover:shadow-xl cursor-pointer df-card-enter"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: selected ? '#121212' : hovered ? '#CBD5E1' : '#E2E8F0',
        boxShadow: selected
          ? '0 10px 26px rgba(0,48,94,0.18), 0 0 0 3px rgba(0,48,94,0.08)'
          : hovered
            ? '0 12px 30px rgba(0,48,94,0.16), 0 0 0 3px rgba(0,48,94,0.10)'
            : '0 3px 10px rgba(0,48,94,0.06)',
        animationDelay: `${Math.min(index, 10) * 45}ms`,
        background: hovered ? 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)' : '#ffffff',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-opacity duration-200"
        style={{
          opacity: selected || hovered ? 1 : 0,
          background: 'linear-gradient(90deg, #121212 0%, #2B6CB0 100%)',
        }}
      />
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: style.bg, color: style.text, borderColor: style.border }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
            {item.article}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: levelStyle.bg, color: levelStyle.text }}>
            {item.level}
          </span>
        </div>
        <button
          type="button"
          className="p-1 rounded-md hover:bg-[#F4F7FA]"
          onClick={(e) => {
            e.stopPropagation()
            setBookmarked((prev) => !prev)
          }}
        >
          {bookmarked ? <BookmarkCheck size={16} className="text-[#FFCD00]" /> : <Bookmark size={16} className="text-[#94A3B8]" />}
        </button>
      </div>

      <div className="px-4 pb-3">
        <h3 className="font-extrabold text-lg text-[#121212] tracking-tight">{item.word}</h3>
        {item.phonetic ? <p className="text-[11px] text-[#94A3B8] font-mono">{item.phonetic}</p> : null}
      </div>
      <div className="mx-4 h-px bg-[#EEF2F6]" />
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[#334155]">{item.english}</p>
        <p className="text-xs text-[#94A3B8] mt-1.5 line-clamp-2">{item.meaning}</p>
      </div>
      <div className="px-4 pb-4 flex items-center justify-between">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-semibold">{item.category}</span>
        <span
          className="text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-200"
          style={{ color: hovered || selected ? '#121212' : '#94A3B8' }}
        >
          Details <ChevronRight size={13} />
        </span>
      </div>
    </button>
  )
}
