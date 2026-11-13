'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, BookOpenText, Check, ChevronDown, Pencil, Repeat, Trash2, Volume2, X } from 'lucide-react'
import { colorForArticle } from '@/lib/vocabWords'
import { myWordsApi, passageHref, type SavedWord, type WordTopic } from '@/lib/myWordsApi'
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  GaCap,
  GaInput,
  GaPageHdr,
  LoadingState,
  TkSearch,
  TkSeg,
} from '@/components/ui-v2'
import { filterWords, groupWords, type GroupBy } from './groups'

const REVIEW_HREF = '/v2/student/review'
const EXAM_HREF = '/v2/student/exam'

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

const display = (w: SavedWord) => (w.article ? `${w.article} ${w.lemma}` : w.lemma)

/** Câu gốc, chữ đã bôi in đậm (lần xuất hiện đầu). */
function Sentence({ text, word }: { text: string; word: string }) {
  const i = text.toLowerCase().indexOf(word.toLowerCase())
  if (i < 0) return <>“{text}”</>
  return (
    <>
      “{text.slice(0, i)}
      <strong className="font-semibold not-italic text-ga-ink">{text.slice(i, i + word.length)}</strong>
      {text.slice(i + word.length)}”
    </>
  )
}

/**
 * /v2/student/vocabulary/my-words — sổ từ riêng (đợt 2 "lưu từ", 13/11/2026). Từ học viên lưu khi luyện đọc,
 * xem theo chủ đề sẵn của kho hoặc theo bài đọc; mở lại đúng câu trong bài, chuyển chủ đề, sửa nghĩa, gỡ.
 * Từ đã tự vào lịch ôn từ lúc lưu ⇒ CTA dẫn sang màn Ôn tập.
 */
export default function MyWordsPage() {
  const t = useTranslations('v2.student.vocabulary.myWords')
  const locale = useLocale()
  const [words, setWords] = React.useState<SavedWord[] | null>(null)
  const [topics, setTopics] = React.useState<WordTopic[]>([])
  const [error, setError] = React.useState(false)
  const [by, setBy] = React.useState<GroupBy>('topic')
  const [query, setQuery] = React.useState('')
  const [editing, setEditing] = React.useState<{ id: number; text: string } | null>(null)
  const [busy, setBusy] = React.useState<number | null>(null)
  const [removing, setRemoving] = React.useState<SavedWord | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [announce, setAnnounce] = React.useState('')

  const load = React.useCallback(() => {
    setError(false)
    setWords(null)
    Promise.all([myWordsApi.list(locale), myWordsApi.topics(locale).catch(() => [] as WordTopic[])])
      .then(([list, tps]) => {
        setWords(list.items)
        setTopics(tps)
      })
      .catch(() => setError(true))
  }, [locale])

  React.useEffect(() => load(), [load])

  const replace = (w: SavedWord) => setWords((ws) => (ws ? ws.map((x) => (x.id === w.id ? w : x)) : ws))

  const changeTopic = async (w: SavedWord, topic: string | null) => {
    setBusy(w.id)
    setActionError(null)
    try {
      const next = await myWordsApi.setTopic(w.id, topic, locale)
      replace(next)
      setAnnounce(t('movedTo', { word: display(w), topic: next.topicLabel ?? t('unsorted') }))
    } catch {
      setActionError(t('actionError'))
    } finally {
      setBusy(null)
    }
  }

  const saveMeaning = async () => {
    if (!editing) return
    const text = editing.text.trim()
    if (!text) return
    setBusy(editing.id)
    setActionError(null)
    try {
      replace(await myWordsApi.setMeaning(editing.id, text, locale))
      setEditing(null)
      setAnnounce(t('meaningSaved'))
    } catch {
      setActionError(t('actionError'))
    } finally {
      setBusy(null)
    }
  }

  const confirmRemove = async () => {
    const w = removing
    if (!w) return
    setBusy(w.id)
    setActionError(null)
    try {
      await myWordsApi.remove(w.id)
      setWords((ws) => (ws ? ws.filter((x) => x.id !== w.id) : ws))
      setAnnounce(t('removed', { word: display(w) }))
      setRemoving(null)
    } catch {
      setActionError(t('actionError'))
    } finally {
      setBusy(null)
    }
  }

  const shown = words ? filterWords(words, query) : []
  const groups = groupWords(shown, by)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/v2/student/vocabulary"
            className="mb-5 grid h-10 w-10 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface lg:h-9 lg:w-9"
            aria-label={t('back')}
          >
            <ArrowLeft size={16} aria-hidden />
          </Link>

          {error && <ErrorBanner message={t('loadError')} onRetry={load} />}
          {!error && words == null && <LoadingState />}

          {words && words.length === 0 && (
            <EmptyState
              variant="invite"
              icon={BookOpenText}
              title={t('emptyTitle')}
              description={t('emptyDesc')}
              action={
                <Link href={EXAM_HREF} className="ga-ui inline-flex items-center gap-1.5 text-ga-small font-semibold text-ga-accent hover:underline">
                  {t('emptyCta')} <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
          )}

          {words && words.length > 0 && (
            <>
              <Link
                href={REVIEW_HREF}
                className="group mb-5 flex items-center gap-3 border border-ga-line bg-ga-card px-4 py-3 transition-colors hover:border-ga-accent"
              >
                <Repeat size={18} aria-hidden className="shrink-0 text-ga-navy" />
                <span className="ga-ui min-w-0 flex-1 text-ga-small text-ga-ink">
                  <span className="font-semibold">{t('count', { n: words.length })}</span> · {t('inReview')}
                </span>
                <span className="ga-ui shrink-0 text-ga-small font-semibold text-ga-accent group-hover:underline">{t('reviewCta')}</span>
              </Link>

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <TkSearch
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search')}
                  containerClassName="w-full sm:flex-1"
                />
                <TkSeg<GroupBy>
                  value={by}
                  onValueChange={setBy}
                  options={[
                    { value: 'topic', label: t('byTopic') },
                    { value: 'passage', label: t('byPassage') },
                  ]}
                />
              </div>

              {actionError && <ErrorBanner message={actionError} />}
              {shown.length === 0 && <p className="ga-ui py-8 text-center text-ga-small text-ga-subtle">{t('noMatch')}</p>}

              <div className="space-y-7">
                {groups.map((g) => (
                  <section key={g.key} aria-labelledby={`grp-${g.key}`}>
                    <div className="mb-2 flex items-baseline gap-2 border-b border-ga-line pb-1.5">
                      <GaCap className="min-w-0 truncate" >
                        <span id={`grp-${g.key}`}>
                          {g.label ?? (by === 'topic' ? t('unsorted') : t('noPassage'))}
                          {g.sub && <span className="font-normal text-ga-muted"> · {g.sub}</span>}
                        </span>
                      </GaCap>
                      <span className="ga-ui ml-auto shrink-0 text-ga-caption tabular-nums text-ga-subtle">{g.words.length}</span>
                    </div>
                    <ul className="divide-y divide-ga-line border border-ga-line bg-ga-card">
                      {g.words.map((w) => {
                        const color = colorForArticle(w.article) ?? 'var(--ga-ink)'
                        const href = passageHref(w)
                        const isEditing = editing?.id === w.id
                        return (
                          <li key={w.id} className="px-4 py-3" data-testid="my-word">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="break-words font-ga-display text-ga-h2" style={{ color }} lang="de">
                                  {display(w)}
                                </p>
                                {isEditing ? (
                                  <form
                                    className="mt-1.5 flex items-center gap-1.5"
                                    onSubmit={(e) => {
                                      e.preventDefault()
                                      void saveMeaning()
                                    }}
                                  >
                                    <GaInput
                                      autoFocus
                                      aria-label={t('meaningLabel', { word: display(w) })}
                                      value={editing.text}
                                      maxLength={200}
                                      onChange={(e) => setEditing({ id: w.id, text: e.target.value })}
                                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                                      className="h-9 flex-1"
                                    />
                                    <button type="submit" disabled={busy === w.id || !editing.text.trim()} aria-label={t('save')} className="grid h-9 w-9 place-items-center rounded-ga border border-ga-line text-ga-ink hover:bg-ga-surface disabled:opacity-50">
                                      <Check size={16} aria-hidden />
                                    </button>
                                    <button type="button" onClick={() => setEditing(null)} aria-label={t('cancel')} className="grid h-9 w-9 place-items-center rounded-ga border border-ga-line text-ga-muted hover:bg-ga-surface">
                                      <X size={16} aria-hidden />
                                    </button>
                                  </form>
                                ) : (
                                  <p className="ga-ui mt-0.5 text-ga-body text-ga-ink">{w.meaning || '—'}</p>
                                )}
                                {w.sentence && (
                                  <p className="ga-ui mt-1.5 text-ga-small italic text-ga-muted" lang="de">
                                    <Sentence text={w.sentence} word={w.surface} />
                                  </p>
                                )}
                                <div className="ga-ui mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-ga-caption text-ga-muted">
                                  {by === 'topic' && w.examTitle && <span className="truncate">{w.examTitle}</span>}
                                  {href && (
                                    <Link href={href} className="font-semibold text-ga-ink underline decoration-ga-accent decoration-2 underline-offset-2 hover:decoration-ga-ink">
                                      {t('openInText')}
                                    </Link>
                                  )}
                                  {/* Chip chủ đề: nhãn tự vẽ theo thang chữ Galerie; select thật phủ trong suốt lên trên
                                      để vẫn mở bộ chọn của hệ thống (màn hẹp/iOS) mà không lộ kiểu ô mặc định —
                                      .ga-scope ép select 16px dưới 1024px nên ô lộ ra trông to và bị cắt chữ. */}
                                  <span className="relative inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-full border border-ga-line bg-ga-card pl-2.5 pr-2 font-semibold text-ga-ink hover:bg-ga-side-active focus-within:ring-2 focus-within:ring-ga-focus">
                                    <span aria-hidden className="truncate">{w.topicLabel ?? t('unsorted')}</span>
                                    <ChevronDown size={12} aria-hidden className="shrink-0 text-ga-muted" />
                                    <select
                                      aria-label={t('topicLabel', { word: display(w) })}
                                      value={w.topic ?? ''}
                                      disabled={busy === w.id}
                                      onChange={(e) => void changeTopic(w, e.target.value || null)}
                                      className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 focus:outline-none disabled:cursor-wait"
                                    >
                                      <option value="">{t('unsorted')}</option>
                                      {topics.map((tp) => (
                                        <option key={tp.name} value={tp.name}>
                                          {tp.label}
                                        </option>
                                      ))}
                                    </select>
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center">
                                <button type="button" onClick={() => speak(w.lemma)} aria-label={t('speak', { word: display(w) })} className="grid h-9 w-9 place-items-center rounded-ga text-ga-subtle hover:text-ga-accent">
                                  <Volume2 size={16} aria-hidden />
                                </button>
                                {!isEditing && (
                                  <button type="button" onClick={() => setEditing({ id: w.id, text: w.meaning ?? '' })} aria-label={t('editMeaning', { word: display(w) })} className="grid h-9 w-9 place-items-center rounded-ga text-ga-subtle hover:text-ga-accent">
                                    <Pencil size={15} aria-hidden />
                                  </button>
                                )}
                                <button type="button" onClick={() => setRemoving(w)} aria-label={t('remove', { word: display(w) })} className="grid h-9 w-9 place-items-center rounded-ga text-ga-subtle hover:text-ga-red">
                                  <Trash2 size={15} aria-hidden />
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('removeTitle', { word: removing ? display(removing) : '' })}
        description={t('removeBody')}
        confirmLabel={t('removeConfirm')}
        cancelLabel={t('cancel')}
        tone="caution"
        loading={removing != null && busy === removing.id}
        onConfirm={() => {
          void confirmRemove()
        }}
      />
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
