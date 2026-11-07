'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Lightbulb, ListOrdered, TriangleAlert, Wrench, X } from 'lucide-react'
import { fetchExamStrategies, findStrategy, type TeilStrategyDto } from './examStrategy'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: string | null
  level?: string | null
  section: string
  teil: number
  /** Tên Teil hiện trên đầu ngăn ("Leseverstehen · Teil 2"). */
  title: string
  /** Mẹo chung của phần thi khi Teil chưa có chiến thuật đã duyệt. */
  fallbackSteps?: string[]
}

/**
 * Ngăn Chiến thuật (đợt (c), 07/11/2026): trượt từ phải, mở từ màn Đề và từ nút bóng đèn khi làm
 * bài. Ba mục: Các bước · Bẫy hay gặp · Mất điểm vì → chữa bằng (nội dung LT2 đã duyệt). Teil chưa
 * duyệt thì hiện mẹo chung của phần thi kèm dòng "chiến thuật chi tiết sắp có". Esc hoặc bấm nền để
 * đóng; Radix giữ con trỏ trong ngăn và trả về nút đã mở.
 */
export function StrategyDrawer({ open, onOpenChange, provider, level, section, teil, title, fallbackSteps = [] }: Props) {
  const t = useTranslations('v2.student.examStrategy')
  const locale = useLocale()
  const lang = locale === 'vi' ? 'vi' : 'en'
  const [strategy, setStrategy] = React.useState<TeilStrategyDto | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (!open || !provider || !level) return
    let alive = true
    setLoaded(false)
    void fetchExamStrategies(provider, level, lang).then((list) => {
      if (!alive) return
      setStrategy(findStrategy(list, section, teil))
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [open, provider, level, lang, section, teil])

  const c = strategy?.content && strategy.status !== 'COMING_SOON' ? strategy.content : null
  const steps = c?.steps?.length ? c.steps : fallbackSteps
  const h3 = 'ga-ui mb-2.5 flex items-center gap-2 text-ga-caption font-bold uppercase tracking-[0.06em] text-ga-muted'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ga-scope ga-fade-in fixed inset-0 z-[100] bg-ga-overlay" />
        <Dialog.Content
          className="ga-scope fixed inset-y-0 right-0 z-[101] flex w-full max-w-[420px] flex-col bg-ga-card shadow-ga-drawer pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] ga-drawer-in"
        >
          <div className="flex items-center gap-3 border-b border-ga-line px-4 py-3.5">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-yellow text-ga-ink">
              <Lightbulb size={18} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-ga-display text-ga-h3 text-ga-ink">{t('drawerTitle')}</Dialog.Title>
              <Dialog.Description className="ga-ui truncate text-ga-small text-ga-muted">{title}</Dialog.Description>
            </div>
            {strategy?.status === 'DRAFT' && (
              <span className="ga-ui shrink-0 border border-ga-yellow bg-ga-yellow-soft px-1.5 py-0.5 text-ga-caption text-ga-ink">{t('draft')}</span>
            )}
            <Dialog.Close
              aria-label={t('close')}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ga-line text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            >
              <X size={17} aria-hidden />
            </Dialog.Close>
          </div>

          <div className="ga-autoscroll min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
            {c?.format && <p className="ga-ui text-ga-small text-ga-muted">{c.format}</p>}
            {steps.length > 0 && (
              <section>
                <h3 className={h3}><ListOrdered size={15} aria-hidden />{t('steps')}</h3>
                <ol className="ga-ui space-y-2.5">
                  {steps.map((s, i) => (
                    <li key={s} className="flex gap-2.5 text-ga-body text-ga-ink">
                      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ga-ink text-ga-caption font-bold text-ga-card">{i + 1}</span>
                      <span className="min-w-0">{s}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {c && c.traps.length > 0 && (
              <section>
                <h3 className={h3}><TriangleAlert size={15} aria-hidden />{t('traps')}</h3>
                <ul className="ga-ui space-y-2">
                  {c.traps.map((s) => (
                    <li key={s} className="flex gap-2.5 rounded-ga-touch bg-ga-yellow-soft px-3 py-2.5 text-ga-body text-ga-ink">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                      <span className="min-w-0">{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {c && c.fixes.length > 0 && (
              <section>
                <h3 className={h3}><Wrench size={15} aria-hidden />{t('fixes')}</h3>
                <ul className="ga-ui">
                  {c.fixes.map((f) => (
                    <li key={f.cause} className="grid grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] items-start gap-2 border-b border-ga-line py-2.5 text-ga-small last:border-b-0">
                      <span className="text-ga-red">{f.cause}</span>
                      <ArrowRight size={16} className="mt-0.5 text-ga-subtle" aria-hidden />
                      <span className="text-ga-green">{f.fix}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {loaded && !c && <p className="ga-ui text-ga-small text-ga-muted">{t('comingSoon')}</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
