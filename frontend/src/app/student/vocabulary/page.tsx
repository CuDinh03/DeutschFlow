'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { ArrowLeft, Search } from 'lucide-react'

type WordListItem = {
  id: number
  dtype: string
  baseForm: string
  cefrLevel: string
  meaning?: string | null
  example?: string | null
  gender?: 'DER' | 'DIE' | 'DAS' | null
  article?: 'der' | 'die' | 'das' | null
  genderColor?: string | null
}

type WordListResponse = {
  items: WordListItem[]
  page: number
  size: number
  total: number
}

type TagItem = {
  id: number
  name: string
  color?: string | null
}

type Me = {
  locale: string
  role: string
}

const genderClass = (g?: string | null) => {
  if (g === 'DER') return 'bg-gender-der'
  if (g === 'DIE') return 'bg-gender-die'
  if (g === 'DAS') return 'bg-gender-das'
  return 'bg-muted'
}

export default function StudentVocabularyPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<WordListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cefr, setCefr] = useState('A1')
  const [dtype, setDtype] = useState<'Noun' | 'Verb' | ''>('')
  const [gender, setGender] = useState<'DER' | 'DIE' | 'DAS' | ''>('')
  const [tag, setTag] = useState<string>('')
  const [tags, setTags] = useState<TagItem[]>([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(24)
  const [total, setTotal] = useState(0)

  const filtered = useMemo(() => items, [items])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      router.push('/login')
      return
    }

    ;(async () => {
      try {
        const meRes = await api.get('/auth/me')
        if (meRes.data.role !== 'STUDENT') {
          router.push(`/${String(meRes.data.role).toLowerCase()}`)
          return
        }
        setMe(meRes.data)

        const tagsRes = await api.get<TagItem[]>('/tags')
        setTags(tagsRes.data ?? [])

        const { data } = await api.get<WordListResponse>('/words', {
          params: {
            cefr,
            q: q || undefined,
            dtype: dtype || undefined,
            gender: gender || undefined,
            tag: tag || undefined,
            locale: meRes.data.locale ?? 'vi',
            page,
            size,
          },
        })
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    })()
  }, [router, cefr, dtype, gender, tag, page, size])

  const reload = async () => {
    if (!me) return
    setLoading(true)
    try {
      setPage(0)
      const { data } = await api.get<WordListResponse>('/words', {
        params: {
          cefr,
          q: q || undefined,
          dtype: dtype || undefined,
          gender: gender || undefined,
          tag: tag || undefined,
          locale: me.locale ?? 'vi',
          page: 0,
          size,
        },
      })
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <button className="btn-secondary btn-sm" onClick={() => router.push('/student')}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div className="ml-2">
            <h1 className="text-xl font-bold text-foreground">Từ vựng</h1>
            <p className="text-sm text-muted-foreground">Danh sách từ theo CEFR và màu giống (DER/DIE/DAS).</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="card p-4 mb-5">
          <div className="grid md:grid-cols-6 gap-3 items-center">
            <div className="md:col-span-2 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm từ (VD: Tisch, Haus...)"
              />
            </div>
            <select className="input" value={cefr} onChange={(e) => setCefr(e.target.value)}>
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>

            <select className="input" value={dtype} onChange={(e) => setDtype(e.target.value as any)}>
              <option value="">All types</option>
              <option value="Noun">Noun</option>
              <option value="Verb">Verb</option>
            </select>

            <select className="input" value={gender} onChange={(e) => setGender(e.target.value as any)} disabled={dtype === 'Verb'}>
              <option value="">All genders</option>
              <option value="DER">DER</option>
              <option value="DIE">DIE</option>
              <option value="DAS">DAS</option>
            </select>

            <select className="input" value={tag} onChange={(e) => setTag(e.target.value as any)}>
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2 md:col-span-6">
              <select className="input" value={cefr} onChange={(e) => setCefr(e.target.value)}>
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <button className="btn-primary btn-md whitespace-nowrap" onClick={reload} disabled={loading}>
                Lọc
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Đang tải...</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
              <span>
                {total} kết quả · trang {page + 1}
              </span>
              <div className="flex items-center gap-2">
                <span>Size</span>
                <select className="input" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
                  {[12, 24, 48].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((w) => (
                <div key={w.id} className="card p-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg ${genderClass(w.gender)} flex items-center justify-center`}>
                        <span className="text-white font-bold text-sm">{w.gender ?? w.dtype?.slice(0, 1) ?? '?'}</span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{w.cefrLevel}</p>
                        <p className="font-semibold text-foreground">
                          {w.article ? `${w.article} ` : ''}
                          {w.baseForm}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{w.dtype}</span>
                  </div>

                  <p className="text-sm text-foreground mb-2">{w.meaning ?? '—'}</p>
                  {w.example && <p className="text-xs text-muted-foreground line-clamp-3">{w.example}</p>}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button className="btn-secondary btn-md" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Prev
              </button>
              <button
                className="btn-secondary btn-md"
                disabled={(page + 1) * size >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

