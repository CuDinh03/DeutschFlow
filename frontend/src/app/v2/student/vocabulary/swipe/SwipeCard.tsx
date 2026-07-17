'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion'
import { Check, RefreshCw, Volume2, X } from 'lucide-react'
import { speakGerman } from '@/lib/speechDe'
import { ARTICLE_COLOR, type WordListItem } from '@/lib/vocabWords'

/**
 * SwipeCard — thẻ vuốt der/die/das (port từ /student/swipe-cards, giữ nguyên cơ chế).
 *
 * Hai chế độ: `flip` (lật thẻ, vuốt phải = đã thuộc / trái = ôn lại) và `type`
 * (gõ đúng "Der Tisch" — mạo từ viết hoa BẮT BUỘC, so khớp chính xác).
 * ⚠️ Mạo từ der/die/das là phần bắt buộc của đáp án — không được lược bỏ.
 */

export type CardType = 'masculine' | 'feminine' | 'neuter' | 'verb' | 'adjective'
export type CardMode = 'flip' | 'type'

export type SwipeCardData = {
  id: number
  type: CardType
  /** "Der" | "Die" | "Das" (viết hoa) — undefined với động/tính từ. */
  article?: string
  word: string
  english: string
  phonetic: string
  sentence: string
  sentenceEN: string
  emoji: string
  level: string
  /** Đáp án tiếng Đức: "Der Tisch" (danh từ) hoặc lemma — so khớp chính xác ở chế độ type. */
  expectedAnswer: string
}

const EMOJIS = ['📖', '🎯', '✨', '💡', '📝', '🗣️', '⭐', '🔤', '📚', '🎓']

export const CARD_COLOR: Record<
  CardType,
  { primary: string; light: string; gradient: string; glow: string; label: string; tag: string }
> = {
  masculine: {
    primary: ARTICLE_COLOR.der,
    light: '#EBF3FB',
    gradient: `linear-gradient(145deg, ${ARTICLE_COLOR.der} 0%, #1F4E90 100%)`,
    glow: 'rgba(47,111,201,0.40)',
    label: 'Maskulin',
    tag: 'der',
  },
  feminine: {
    primary: ARTICLE_COLOR.die,
    light: '#FDEAEA',
    gradient: `linear-gradient(145deg, ${ARTICLE_COLOR.die} 0%, #9B1D14 100%)`,
    glow: 'rgba(218,41,28,0.40)',
    label: 'Feminin',
    tag: 'die',
  },
  neuter: {
    primary: ARTICLE_COLOR.das,
    light: '#E8F8F0',
    gradient: `linear-gradient(145deg, ${ARTICLE_COLOR.das} 0%, #146E43 100%)`,
    glow: 'rgba(30,158,97,0.40)',
    label: 'Neutrum',
    tag: 'das',
  },
  verb: {
    primary: '#9B51E0',
    light: '#F4EDFF',
    gradient: 'linear-gradient(145deg, #9B51E0 0%, #6D25B3 100%)',
    glow: 'rgba(155,81,224,0.40)',
    label: 'Verb',
    tag: 'vb.',
  },
  adjective: {
    primary: '#F2994A',
    light: '#FEF3E8',
    gradient: 'linear-gradient(145deg, #F2994A 0%, #C26B1A 100%)',
    glow: 'rgba(242,153,74,0.40)',
    label: 'Adjektiv',
    tag: 'adj.',
  },
}

/** Map WordListItem (GET /words) → thẻ vuốt. Giữ nguyên logic v1 (kể cả chọn nghĩa theo locale). */
export function mapWordToSwipe(w: WordListItem, locale: string): SwipeCardData {
  const dtype = (w.dtype || 'Noun').toLowerCase()
  let type: CardType = 'masculine'
  if (dtype === 'verb') type = 'verb'
  else if (dtype === 'adjective') type = 'adjective'
  else if (w.gender === 'DIE') type = 'feminine'
  else if (w.gender === 'DAS') type = 'neuter'

  const art =
    type === 'masculine' || type === 'feminine' || type === 'neuter'
      ? (w.article ?? (type === 'masculine' ? 'der' : type === 'feminine' ? 'die' : 'das'))
      : undefined
  const articleCap = art ? art.charAt(0).toUpperCase() + art.slice(1) : undefined

  const loc = locale.toLowerCase()
  const preferNative = loc.startsWith('vi') || loc.startsWith('de')
  const english = preferNative ? (w.meaning ?? w.meaningEn ?? '') : (w.meaningEn ?? w.meaning ?? '')

  return {
    id: w.id,
    type,
    article: articleCap,
    word: w.baseForm,
    english: english || w.baseForm,
    phonetic: w.phonetic?.trim() || '',
    sentence: w.exampleDe ?? w.example ?? '',
    sentenceEN: w.exampleEn ?? '',
    emoji: EMOJIS[Math.abs(w.id) % EMOJIS.length],
    level: (w.cefrLevel ?? 'A1').toUpperCase(),
    expectedAnswer: articleCap ? `${articleCap} ${w.baseForm}` : w.baseForm,
  }
}

function isExactMatch(input: string, expected: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  return norm(input) === norm(expected)
}

export function SwipeCard({
  card,
  stackIndex,
  onSwipe,
  mode,
  t,
}: {
  card: SwipeCardData
  stackIndex: 0 | 1 | 2
  onSwipe: (dir: 'learned' | 'unlearned') => void
  mode: CardMode
  t: (key: string) => string
}) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [answer, setAnswer] = useState('')
  const [verdict, setVerdict] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const c = CARD_COLOR[card.type]
  const controls = useAnimation()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-16, 16])
  const learnedBg = useTransform(x, [0, 130], [0, 0.88])
  const unlearnedBg = useTransform(x, [-130, 0], [0.88, 0])
  const learnedLabelOp = useTransform(x, [20, 100], [0, 1])
  const unlearnedLabelOp = useTransform(x, [-100, -20], [1, 0])
  const learnedLabelScale = useTransform(x, [20, 100], [0.6, 1])
  const unlearnedLabelScale = useTransform(x, [-100, -20], [1, 0.6])

  const swipeAway = useCallback(
    async (dir: 'learned' | 'unlearned') => {
      await controls.start({
        x: dir === 'learned' ? 700 : -700,
        rotate: dir === 'learned' ? 22 : -22,
        opacity: 0,
        transition: { duration: 0.38, ease: [0.25, 0.1, 0.25, 1] },
      })
      onSwipe(dir)
    },
    [controls, onSwipe],
  )

  useEffect(() => {
    setAnswer('')
    setVerdict('idle')
  }, [card.id, mode])

  useEffect(() => {
    if (verdict !== 'correct') return
    const timer = setTimeout(() => void swipeAway('learned'), 250)
    return () => clearTimeout(timer)
  }, [verdict, swipeAway])

  useEffect(() => {
    if (mode === 'type' && stackIndex === 0) {
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [mode, stackIndex, card.id])

  const handleDragEnd = useCallback(
    async (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      setIsDragging(false)
      const { offset, velocity } = info
      if (offset.x > 100 || velocity.x > 550) await swipeAway('learned')
      else if (offset.x < -100 || velocity.x < -550) await swipeAway('unlearned')
      else controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } })
    },
    [controls, swipeAway],
  )

  const play = (e: React.MouseEvent) => {
    e.stopPropagation()
    const line = card.article ? `${card.article} ${card.word}` : card.word
    setAudioPlaying(true)
    speakGerman(card.sentence || line)
    setTimeout(() => setAudioPlaying(false), 1800)
  }

  const submitAnswer = useCallback(() => {
    if (mode !== 'type' || verdict !== 'idle') return
    setVerdict(isExactMatch(answer, card.expectedAnswer) ? 'correct' : 'wrong')
  }, [mode, verdict, answer, card.expectedAnswer])

  const overlays = (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-start overflow-hidden rounded-ga pl-6"
        style={{ opacity: learnedBg, background: 'rgba(30,158,97,0.18)' }}
      >
        <motion.div
          className="absolute inset-0 rounded-ga"
          style={{ border: `3px solid ${ARTICLE_COLOR.das}`, opacity: learnedBg }}
        />
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ opacity: learnedLabelOp, scale: learnedLabelScale }}
        >
          <span
            className="grid h-16 w-16 place-items-center rounded-full"
            style={{ background: ARTICLE_COLOR.das }}
          >
            <Check size={32} className="text-white" strokeWidth={3} aria-hidden />
          </span>
          <span className="ga-ui mt-1 text-[16px] font-bold" style={{ color: ARTICLE_COLOR.das }}>
            {t('learned')}
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-end overflow-hidden rounded-ga pr-6"
        style={{ opacity: unlearnedBg, background: 'rgba(218,41,28,0.18)' }}
      >
        <motion.div
          className="absolute inset-0 rounded-ga"
          style={{ border: `3px solid ${ARTICLE_COLOR.die}`, opacity: unlearnedBg }}
        />
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ opacity: unlearnedLabelOp, scale: unlearnedLabelScale }}
        >
          <span
            className="grid h-16 w-16 place-items-center rounded-full"
            style={{ background: ARTICLE_COLOR.die }}
          >
            <X size={30} className="text-white" strokeWidth={3} aria-hidden />
          </span>
          <span className="ga-ui mt-1 text-[16px] font-bold" style={{ color: ARTICLE_COLOR.die }}>
            {t('review')}
          </span>
        </motion.div>
      </motion.div>
    </>
  )

  // Thẻ nền (stack) — chỉ là hình khối màu.
  if (stackIndex > 0) {
    return (
      <motion.div
        className="absolute inset-0"
        animate={{
          scale: 1 - stackIndex * 0.038,
          y: stackIndex * 12,
          rotate: stackIndex === 1 ? 1.5 : -1.2,
          filter: `brightness(${1 - stackIndex * 0.1})`,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        <div
          className="h-full w-full overflow-hidden rounded-ga"
          style={{ background: c.gradient, boxShadow: `0 8px 24px ${c.glow}` }}
        />
      </motion.div>
    )
  }

  // ── Chế độ GÕ ĐÁP ÁN
  if (mode === 'type') {
    return (
      <motion.div className="absolute inset-0 z-10 cursor-default" style={{ x, rotate }} animate={controls} drag={false}>
        {overlays}

        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-ga border border-ga-line bg-ga-card shadow-ga-card-hover">
          {verdict === 'correct' ? (
            <div
              className="pointer-events-none absolute inset-0 z-[25] grid place-items-center"
              style={{ background: 'rgba(30,158,97,0.35)' }}
            >
              <span className="font-ga-display text-[26px] font-medium text-white drop-shadow">{t('correct')}</span>
            </div>
          ) : null}

          {verdict === 'wrong' ? (
            <div
              className="absolute inset-0 z-[30] flex flex-col overflow-y-auto p-5"
              style={{ background: 'rgba(122,20,13,0.94)' }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="ga-ui mb-1 text-[11px] font-bold uppercase tracking-widest text-white/70">{t('wrong')}</p>
              <p className="ga-ui mb-1 text-[12px] font-semibold text-white/70">{t('correctAnswerLabel')}</p>
              <p className="font-ga-display mb-1 text-[24px] font-medium text-white">{card.expectedAnswer}</p>
              {card.phonetic ? <p className="ga-ui mb-3 text-[12px] text-white/70">/{card.phonetic}/</p> : <div className="mb-3" />}
              <p className="ga-ui mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">{t('example')}</p>
              <div className="mb-4 shrink-0 rounded-ga border border-white/20 bg-white/10 px-3 py-2">
                <p className="ga-ui mb-1 text-[13.5px] font-semibold text-white">🇩🇪 {card.sentence || '—'}</p>
                <p className="ga-ui text-[12px] italic text-white/80">🇬🇧 {card.sentenceEN || '—'}</p>
              </div>
              <button
                type="button"
                className="ga-ui mt-auto w-full rounded-ga bg-white py-3 text-[13.5px] font-semibold"
                style={{ color: ARTICLE_COLOR.die }}
                onClick={() => void swipeAway('unlearned')}
              >
                {t('next')}
              </button>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col" style={{ background: c.gradient }}>
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
              <span className="ga-ui rounded-ga-pill bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white/90">
                {c.label}
              </span>
              <span className="ga-ui rounded-ga-pill bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white/90">
                {card.level}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-2">
              <span className="ga-ui mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                {t('meaningLabel')}
              </span>
              <p className="ga-ui mb-2 line-clamp-4 text-center text-[17px] font-bold leading-snug text-white">
                {card.english}
              </p>
              <span className="ga-ui mb-3 text-[10px] text-white/50">
                {c.label} · {c.tag}
              </span>
              <div className="pointer-events-auto flex w-full items-stretch gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitAnswer()
                    }
                  }}
                  disabled={verdict !== 'idle'}
                  placeholder={t('inputPlaceholder')}
                  className="ga-ui min-w-0 flex-1 rounded-ga border-2 border-white/40 bg-white/95 px-3 py-2.5 text-[13.5px] font-semibold text-ga-ink outline-none placeholder:text-ga-subtle focus:ring-2 focus:ring-white/80"
                />
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={verdict !== 'idle'}
                  className="ga-ui rounded-ga bg-white px-4 text-[13px] font-bold text-ga-ink disabled:opacity-50"
                >
                  {t('submit')}
                </button>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between bg-white/10 px-4 py-2">
              <button
                type="button"
                onClick={play}
                className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-white/30 bg-white/20 px-2 py-1.5 text-[11px] font-medium text-white"
              >
                <Volume2 size={13} aria-hidden />
                {audioPlaying ? '…' : t('listen')}
              </button>
              <span className="text-[20px]" aria-hidden>
                {card.emoji}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Chế độ LẬT THẺ
  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      animate={controls}
      drag={!isFlipped ? true : 'x'}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.65}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (!isDragging) setIsFlipped((v) => !v)
      }}
      whileDrag={{ scale: 1.02 }}
    >
      {overlays}

      <div
        className="absolute inset-0 overflow-hidden rounded-ga border border-ga-line bg-ga-card shadow-ga-card-hover"
        style={{ perspective: 1200 }}
      >
        <motion.div
          className="relative h-full w-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Mặt trước — mạo từ + từ */}
          <div className="absolute inset-0 flex flex-col" style={{ backfaceVisibility: 'hidden' }}>
            <div className="flex flex-1 flex-col items-center justify-center px-6" style={{ background: c.gradient }}>
              <span className="mb-3 text-[40px]" aria-hidden>
                {card.emoji}
              </span>
              <span className="ga-ui mb-2 rounded-ga-pill bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white/90">
                {c.label}
              </span>
              <p className="font-ga-display text-center text-[26px] font-medium leading-tight text-white">
                {card.article ? `${card.article} ${card.word}` : card.word}
              </p>
              {card.phonetic ? <p className="ga-ui mt-2 text-[12px] text-white/70">/{card.phonetic}/</p> : null}
              <p className="ga-ui mt-3 line-clamp-3 text-center text-[13.5px] text-white/85">{card.english}</p>
            </div>
            <div className="ga-ui flex items-center justify-center gap-1 py-2 text-center text-[10.5px] text-ga-subtle">
              <RefreshCw size={10} aria-hidden /> {t('tapFlip')}
            </div>
          </div>

          {/* Mặt sau — nghĩa + ví dụ */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-ga bg-ga-card"
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            <div className="shrink-0 px-6 pb-4 pt-5" style={{ background: c.gradient }}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="ga-ui rounded-ga-pill bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
                      {c.label}
                    </span>
                    <span className="ga-ui rounded-ga-pill bg-white/15 px-2 py-0.5 text-[11px] text-white/80">
                      {card.level}
                    </span>
                  </div>
                  <p className="font-ga-display line-clamp-2 text-[20px] font-medium leading-tight text-white">
                    {card.english}
                  </p>
                </div>
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-ga border-2 border-white/30 bg-white/20 text-[26px]" aria-hidden>
                  {card.emoji}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="ga-ui mb-0.5 text-[11.5px] font-semibold text-ga-subtle">{t('germanWord')}</p>
                  <p className="text-[15px] font-bold" style={{ color: c.primary }}>
                    {card.article ? `${card.article} ${card.word}` : card.word}
                  </p>
                  {card.phonetic ? <p className="ga-ui mt-0.5 text-[11.5px] text-ga-subtle">/{card.phonetic}/</p> : null}
                </div>
                <button
                  type="button"
                  onClick={play}
                  className="ga-ui inline-flex items-center gap-1.5 rounded-ga border px-3 py-2 text-[12px] font-medium transition-colors"
                  style={{
                    background: audioPlaying ? c.light : 'var(--ga-surface)',
                    color: audioPlaying ? c.primary : 'var(--ga-muted)',
                    borderColor: audioPlaying ? `${c.primary}50` : 'var(--ga-line)',
                  }}
                >
                  <Volume2 size={13} aria-hidden />
                  {audioPlaying ? '…' : t('listen')}
                </button>
              </div>
              <div className="h-px bg-ga-border" />
              <div className="min-h-0 flex-1">
                <p className="ga-ui mb-2 text-[10px] font-bold uppercase tracking-widest text-ga-subtle">{t('example')}</p>
                <div className="rounded-ga border px-4 py-3" style={{ background: c.light, borderColor: `${c.primary}22` }}>
                  <p className="ga-ui mb-2 text-[13.5px] font-semibold leading-snug text-ga-ink">🇩🇪 {card.sentence || '—'}</p>
                  <div className="mb-2 h-px bg-black/10" />
                  <p className="ga-ui text-[12px] italic leading-snug text-ga-muted">🇬🇧 {card.sentenceEN || '—'}</p>
                </div>
              </div>
              <div className="ga-ui flex items-center justify-center gap-1 text-[10.5px] text-ga-subtle">
                <RefreshCw size={10} aria-hidden /> {t('tapFlipBack')}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
