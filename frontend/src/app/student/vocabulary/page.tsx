"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import api from '@/lib/api'
import { getAccessToken, clearTokens } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useVocabulary, useVocabularyReload } from '@/hooks/useVocabulary'
import { useTracking } from '@/hooks/useTracking'
import { primeGermanVoices } from '@/lib/speechDe'
import { QuickAiToolbar } from '@/components/vocabulary/QuickAiToolbar'
import { VocabCardItem, TagItem, Me, CategoryOption, mapWordListItemToCard, WordListItem } from './components/types'
import VocabSearchBar from './components/VocabSearchBar'
import VocabGrid from './components/VocabGrid'
import VocabDetailModal from './components/VocabDetailModal'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'

const DEFAULT_CATEGORY: CategoryOption = 'Alle'

export default function StudentVocabularyPage() {
  usePageTimeTracker('vocabulary')
  const { trackFeatureAction } = useTracking()
  const t = useTranslations('vocabulary')
  const uiLocale = useLocale()
  const router = useRouter()
  const { notifyApiError } = useVocabulary()

  const [me, setMe] = useState<Me | null>(null)
  const [targetLevel, setTargetLevel] = useState('A1')
  const [streakDays, setStreakDays] = useState(0)
  const [items, setItems] = useState<VocabCardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cefr, setCefr] = useState('')
  const [dtype, setDtype] = useState<string>('')
  const [tags, setTags] = useState<TagItem[]>([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(24)
  const [total, setTotal] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [selectedItem, setSelectedItem] = useState<VocabCardItem | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [categoryFilter, setCategoryFilter] = useState<CategoryOption>(DEFAULT_CATEGORY)
  const [modalClosing, setModalClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { trackFeatureAction('vocabulary_dictionary', 'started'); return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); trackFeatureAction('vocabulary_dictionary', 'quit') } }, [trackFeatureAction])

  const filtered = useMemo(() => items.filter((item) => categoryFilter === 'Alle' || item.category === categoryFilter), [items, categoryFilter])
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => { const timer = setTimeout(() => { setDebouncedQ(q); setPage(0) }, 400); return () => clearTimeout(timer) }, [q])

  useEffect(() => {
    if (!getAccessToken()) { router.push('/login'); return }
    ;(async () => {
      try {
        setLoadError('')
        primeGermanVoices()
        const meRes = await api.get('/auth/me')
        if (meRes.data.role !== 'STUDENT') { router.push(`/${String(meRes.data.role).toLowerCase()}`); return }
        setMe(meRes.data)
        const [planRes, dashRes] = await Promise.all([api.get<{ plan?: { targetLevel?: string } }>('/plan/me').catch(() => null), api.get<{ streakDays?: number }>('/student/dashboard').catch(() => null)])
        setTargetLevel(planRes?.data?.plan?.targetLevel ?? 'A1')
        setStreakDays(Number(dashRes?.data?.streakDays ?? 0))
        const tagsRes = await api.get<TagItem[]>('/tags', { params: { locale: uiLocale || meRes.data.locale || 'vi', topicsOnly: 'true' } })
        setTags(tagsRes.data ?? [])
        const { data } = await api.get('/words', { params: { cefr, q: debouncedQ || undefined, dtype: dtype || undefined, locale: uiLocale || meRes.data.locale || 'vi', page, size } })
        setItems((data.items ?? []).map((it: WordListItem) => mapWordListItemToCard({ ...it, category: (it as WordListItem & { category?: string }).category ?? 'Alltag' })))
        setTotal(data.total ?? 0)
      } catch (e) { if (isAxiosError(e) && e.response?.status === 401) { router.push('/login'); return } setItems([]); setTotal(0); setLoadError(t('loadError')); notifyApiError(e) } finally { setLoading(false) }
    })()
  }, [router, cefr, debouncedQ, dtype, page, size, uiLocale, t, notifyApiError])

  const reload = useVocabularyReload(async () => {
    if (!me) return
    setLoading(true)
    setLoadError('')
    try {
      setPage(0)
      const { data } = await api.get('/words', { params: { cefr, q: q || undefined, dtype: dtype || undefined, locale: uiLocale || me.locale || 'vi', page: 0, size } })
      setItems((data.items ?? []).map((it: WordListItem) => mapWordListItemToCard({ ...it, category: (it as WordListItem & { category?: string }).category ?? 'Alltag' })))
      setTotal(data.total ?? 0)
      setDebouncedQ(q)
    } catch (e) { if (isAxiosError(e) && e.response?.status === 401) { router.push('/login'); return } setLoadError(t('loadError')); notifyApiError(e, reload) } finally { setLoading(false) }
  })

  const openModal = (item: VocabCardItem) => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); setModalClosing(false); setSelectedItem(item) }
  const requestCloseModal = () => { if (!selectedItem || modalClosing) return; setModalClosing(true); closeTimerRef.current = setTimeout(() => { setSelectedItem(null); setModalClosing(false); closeTimerRef.current = null }, 230) }
  const handleLogout = useCallback(() => { clearTokens(); router.push('/') }, [router])

  if (loading && !me) return <div className="min-h-screen df-page-mesh flex items-center justify-center"><p className="text-[#64748B]">{t('loading')}</p></div>
  if (!me) return null
  const initials = me.displayName.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()
  const itCount = filtered.filter((item) => item.category === 'IT').length

  return (
    <StudentShell activeSection="vocabulary" user={{ displayName: me.displayName, role: me.role }} targetLevel={targetLevel} streakDays={streakDays} initials={initials} onLogout={handleLogout} headerTitle={t('pageHeroTitle')} headerSubtitle={t('subtitle')}>
      <div className="flex flex-col -mx-6 -mt-6">
        <VocabSearchBar total={total} itCount={itCount} q={q} setQ={setQ} setPage={setPage} cefr={cefr} setCefr={setCefr} dtype={dtype} setDtype={setDtype} gender={''} setGender={() => {}} tag={''} setTag={() => {}} tags={tags} size={size} setSize={setSize} viewMode={viewMode} setViewMode={setViewMode} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} loading={loading} onReload={reload} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-6">
          <VocabGrid items={filtered} loading={loading} loadError={loadError} total={total} page={page} size={size} setPage={setPage} viewMode={viewMode} selectedItem={selectedItem} onOpenModal={openModal} />
        </main>
        {selectedItem ? <VocabDetailModal item={selectedItem} closing={modalClosing} onClose={requestCloseModal} /> : null}
        <QuickAiToolbar />
      </div>
    </StudentShell>
  )
}
