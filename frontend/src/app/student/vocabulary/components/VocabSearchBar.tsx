'use client'

import { Search, Filter, ChevronDown } from 'lucide-react'
import type { CategoryOption, GenderCode, TagItem } from './types'

type Props = {
  total: number
  itCount: number
  q: string
  setQ: (v: string) => void
  setPage: (v: number) => void
  cefr: string
  setCefr: (v: string) => void
  dtype: string
  setDtype: (v: string) => void
  gender: GenderCode | ''
  setGender: (v: GenderCode | '') => void
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

const QUICK_FILTERS: CategoryOption[] = ['Alle', 'Alltag', 'IT', 'Business']

export default function VocabSearchBar(props: Props) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="max-w-7xl mx-auto px-5 py-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Vocabulary</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Quick practice</h2>
            <p className="text-sm text-slate-500">{props.total.toLocaleString()} từ • {props.itCount.toLocaleString()} từ IT</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((item) => (
              <button key={item} type="button" onClick={() => props.setCategoryFilter(item)}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${props.categoryFilter === item ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                {item}
              </button>
            ))}
            <button type="button" onClick={props.onReload} disabled={props.loading} className="px-3.5 py-2 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 disabled:opacity-50 hover:bg-amber-100 transition-colors">
              Làm mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm focus-within:border-[#121212]/20 focus-within:ring-4 focus-within:ring-slate-100">
            <Search size={16} className="text-slate-400" />
            <input value={props.q} onChange={(e) => props.setQ(e.target.value)} placeholder="Tìm từ, nghĩa, ví dụ..." className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 inline-flex items-center justify-between gap-2 shadow-sm hover:border-slate-300 transition-colors">
              <span>CEFR</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            <button type="button" className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 inline-flex items-center justify-between gap-2 shadow-sm hover:border-slate-300 transition-colors">
              <span>Loại</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            <button type="button" className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-600 inline-flex items-center justify-center gap-2 shadow-sm hover:border-slate-300 transition-colors">
              <Filter size={14} /> Lọc
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
