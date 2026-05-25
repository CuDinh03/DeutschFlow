import { Search, RefreshCw } from 'lucide-react'
import { TagItem } from './types'

type VocabFilterBarProps = {
  q: string
  setQ: (v: string) => void
  cefr: string
  setCefr: (v: string) => void
  dtype: string
  setDtype: (v: string) => void
  gender: string
  setGender: (v: string) => void
  tag: string
  setTag: (v: string) => void
  tags: TagItem[]
  loading: boolean
  onSearch: (overrides?: { cefr?: string; dtype?: string; gender?: string; q?: string; tag?: string }) => void
}

export default function VocabFilterBar({
  q, setQ,
  cefr, setCefr,
  dtype, setDtype,
  gender, setGender,
  tag, setTag,
  tags,
  loading,
  onSearch
}: VocabFilterBarProps) {
  return (
    <div className="bg-white rounded-[16px] p-4 border border-[#E2E8F0] shadow-sm">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input 
            value={q} 
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch({ q })}
            placeholder="Tìm từ... (Enter)"
            className="w-full pl-8 pr-3 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/15" 
          />
        </div>
        <select 
          value={cefr} 
          onChange={e => { setCefr(e.target.value); onSearch({ cefr: e.target.value }) }}
          className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/15 bg-white"
        >
          {['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(o => <option key={o} value={o}>{o || 'Cấp độ'}</option>)}
        </select>
        <select 
          value={dtype} 
          onChange={e => { setDtype(e.target.value); onSearch({ dtype: e.target.value }) }}
          className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/15 bg-white"
        >
          {['', 'Noun', 'Verb', 'Adjective', 'Word'].map(o => <option key={o} value={o}>{o || 'Loại từ'}</option>)}
        </select>
        <select 
          value={gender} 
          onChange={e => { setGender(e.target.value); onSearch({ gender: e.target.value }) }}
          className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/15 bg-white"
        >
          {['', 'DER', 'DIE', 'DAS'].map(o => <option key={o} value={o}>{o || 'Giống'}</option>)}
        </select>
        <select 
          value={tag} 
          onChange={e => { setTag(e.target.value); onSearch({ tag: e.target.value }) }}
          className="pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]/15 bg-white min-w-[160px]"
        >
          <option value="">Chủ đề</option>
          {tags.map(t => (
            <option key={t.id} value={t.name}>{t.localizedLabel ?? t.name}</option>
          ))}
        </select>
        <button 
          onClick={() => onSearch()} 
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#121212] text-white text-sm font-semibold hover:bg-[#000000] transition-colors disabled:opacity-60"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Tìm kiếm
        </button>
      </div>
    </div>
  )
}
