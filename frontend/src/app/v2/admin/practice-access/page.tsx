'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  addPracticeAccessUser,
  getPracticeAccessState,
  removePracticeAccessToken,
  removePracticeAccessUser,
  searchPracticeAccessUsers,
  setPracticeAccessMode,
  type PracticeAccessMember,
  type PracticeAccessMode,
  type PracticeAccessState,
} from '@/lib/adminPracticeAccessApi'
import { GaBtn, GaCap, GaPageHdr } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Quyền luyện đề telc (admin, 04/11/2026): chế độ OFF / ALLOWLIST / ALL + danh sách học viên được
// dùng. Có hiệu lực ngay — backend đọc thẳng system_config mỗi lần học viên mở luyện đề.
// ─────────────────────────────────────────────────────────────────────────────

const MODES: PracticeAccessMode[] = ['OFF', 'ALLOWLIST', 'ALL']
const SEARCH_DEBOUNCE_MS = 300

export default function V2AdminPracticeAccessPage() {
  const t = useTranslations('v2.adminContent.practiceAccess')
  const tc = useTranslations('v2.common')
  const [state, setState] = useState<PracticeAccessState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PracticeAccessMember[]>([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    try {
      setState(await getPracticeAccessState())
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const id = window.setTimeout(() => {
      searchPracticeAccessUsers(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query])

  const run = async (fn: () => Promise<PracticeAccessState>, ok?: string) => {
    setBusy(true)
    try {
      setState(await fn())
      if (ok) toast.success(ok)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const memberIds = new Set(state?.members.map((m) => m.id) ?? [])
  const looksLikeEmail = /\S+@\S+\.\S+/.test(query.trim())
  const exactHit = results.some((r) => r.email.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center">
            <h2 className="font-ga-display text-ga-h2 text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-ga-body text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : !state ? (
          <div className="ga-shimmer h-40 border border-ga-line" aria-hidden />
        ) : (
          <div className="grid max-w-[1100px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ── chế độ ── */}
            <section className="lg:col-span-2">
              <GaCap className="mb-2.5 block">{t('modeCap')}</GaCap>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={t('modeCap')}>
                {MODES.map((m) => {
                  const on = state.mode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={busy}
                      onClick={() => !on && run(() => setPracticeAccessMode(m), t('modeSaved'))}
                      className={`ga-ui flex flex-col items-start gap-1 border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                        on ? 'border-ga-navy bg-ga-navy-soft shadow-ga-selected-bar' : 'border-ga-line bg-ga-card hover:bg-ga-surface'
                      }`}
                    >
                      <span className="text-ga-body font-semibold text-ga-ink">{t(`mode.${m}`)}</span>
                      <span className="text-ga-small text-ga-muted">{t(`modeDesc.${m}`)}</span>
                    </button>
                  )
                })}
              </div>
              {state.mode !== 'ALLOWLIST' && <p className="ga-ui mt-2.5 text-ga-small text-ga-warning">{t(`modeNote.${state.mode}`)}</p>}
            </section>

            {/* ── thêm học viên ── */}
            <section>
              <GaCap className="mb-2.5 block">{t('addCap')}</GaCap>
              <label className="ga-ui flex items-center gap-2 border border-ga-line bg-ga-card px-3 py-2.5 focus-within:border-ga-navy">
                <Search size={16} className="shrink-0 text-ga-muted" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-ga-body text-ga-ink outline-none"
                />
              </label>
              <p className="ga-ui mt-1.5 text-ga-caption text-ga-muted">{t('searchHint')}</p>
              <ul className="mt-3 divide-y divide-ga-line border border-ga-line bg-ga-card empty:hidden">
                {results.map((r) => {
                  const added = memberIds.has(r.id)
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="ga-ui block truncate text-ga-body font-semibold text-ga-ink">{r.displayName}</span>
                        <span className="ga-ui block truncate text-ga-small text-ga-muted">
                          {r.email} · #{r.id} · {r.role}
                        </span>
                      </span>
                      {added ? (
                        <span className="ga-ui shrink-0 text-ga-small text-ga-muted">{t('alreadyAdded')}</span>
                      ) : (
                        <GaBtn variant="yellow" size="sm" disabled={busy} onClick={() => run(() => addPracticeAccessUser(String(r.id)), t('added', { name: r.displayName }))}>
                          <UserPlus size={14} /> {t('add')}
                        </GaBtn>
                      )}
                    </li>
                  )
                })}
              </ul>
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="ga-ui mt-3 text-ga-small text-ga-muted">{t('noResults')}</p>
              )}
              {looksLikeEmail && !exactHit && (
                <div className="mt-3">
                  <GaBtn variant="ghost" size="sm" disabled={busy} onClick={() => run(() => addPracticeAccessUser(query.trim()), t('added', { name: query.trim() }))}>
                    <UserPlus size={14} /> {t('addByEmail', { email: query.trim() })}
                  </GaBtn>
                </div>
              )}
            </section>

            {/* ── danh sách ── */}
            <section>
              <GaCap className="mb-2.5 block">{t('listCap', { count: state.members.length })}</GaCap>
              {state.members.length === 0 ? (
                <div className="ga-ui border border-dashed border-ga-line px-4 py-8 text-center text-ga-body text-ga-muted">{t('empty')}</div>
              ) : (
                <ul className="divide-y divide-ga-line border border-ga-line bg-ga-card">
                  {state.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="ga-ui block truncate text-ga-body font-semibold text-ga-ink">{m.displayName}</span>
                        <span className="ga-ui block truncate text-ga-small text-ga-muted">
                          {m.email} · #{m.id} · {m.role}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => removePracticeAccessUser(m.id), t('removed', { name: m.displayName }))}
                        aria-label={t('removeOne', { name: m.displayName })}
                        className="ga-ui inline-flex min-h-9 shrink-0 items-center gap-1 border border-ga-line px-2.5 text-ga-small font-semibold text-ga-muted transition-colors hover:border-ga-red hover:text-ga-red disabled:opacity-50"
                      >
                        <X size={13} aria-hidden /> {t('remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {state.unknown.length > 0 && (
                <div className="mt-4">
                  <GaCap className="mb-1.5 block">{t('unknownCap')}</GaCap>
                  <ul className="flex flex-wrap gap-1.5">
                    {state.unknown.map((tok) => (
                      <li key={tok} className="ga-ui inline-flex items-center gap-1.5 bg-ga-side-active px-2.5 py-1 text-ga-small text-ga-muted">
                        {tok}
                        <button type="button" disabled={busy} onClick={() => run(() => removePracticeAccessToken(tok))} aria-label={t('removeOne', { name: tok })} className="hover:text-ga-red">
                          <X size={12} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
