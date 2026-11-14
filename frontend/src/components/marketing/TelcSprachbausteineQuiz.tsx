'use client'

import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'

interface QuizItem {
  id: number
  label: string
  options: readonly [string, string, string]
  correct: number
  explain: string
}

const ITEMS: readonly QuizItem[] = [
  {
    id: 1,
    label: 'Ô trống (1)',
    options: ['deshalb', 'obwohl', 'trotzdem'],
    correct: 1,
    explain: '„obwohl“ (mặc dù) nối mệnh đề phụ chỉ sự nhượng bộ, động từ chia „hatte“ đứng cuối mệnh đề.',
  },
  {
    id: 2,
    label: 'Ô trống (2)',
    options: ['auf', 'über', 'für'],
    correct: 0,
    explain: 'Cụm cố định „auf einen Vorschlag eingehen / antworten“ hoặc „sich auf etwas freuen“ đi với giới từ „auf“ + Akkusativ.',
  },
  {
    id: 3,
    label: 'Ô trống (3)',
    options: ['die', 'den', 'dem'],
    correct: 2,
    explain: 'Sau giới từ „an“ chỉ thời điểm („an dem Tag“), đại từ quan hệ giống đực số ít chia ở Dativ là „dem“.',
  },
]

/**
 * Mini-quiz tương tác mô phỏng phần `Sprachbausteine Teil 1` trên trang `/luyen-thi/telc-b1/` (v3.4):
 * Cho người học thử điền nhanh 3 chỗ trống ngữ pháp B1 trong một bức thư ngắn và xem ngay giải thích.
 */
export function TelcSprachbausteineQuiz() {
  const [picked, setPicked] = React.useState<Record<number, number>>({})

  const answeredCount = Object.keys(picked).length
  const score = ITEMS.reduce((acc, it) => acc + (picked[it.id] === it.correct ? 1 : 0), 0)

  return (
    <section
      aria-labelledby="telc-mini-quiz"
      className="mt-10 rounded-ga-xl border border-ga-border-strong bg-ga-card p-5 shadow-ga-md sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GaGlyphMark name="nguphap" size={26} className="shrink-0 text-ga-ink" />
          <div>
            <p className="text-ga-eyebrow uppercase text-ga-muted">Làm thử ngay · Sprachbausteine B1</p>
            <h3 id="telc-mini-quiz" className="font-ga-display text-ga-h2 text-ga-ink">
              Điền nhanh 3 chỗ trống ngữ pháp trong email B1
            </h3>
          </div>
        </div>
        {answeredCount > 0 && (
          <button
            type="button"
            onClick={() => setPicked({})}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-ga-pill border border-ga-border bg-ga-bg px-3 text-ga-caption font-semibold text-ga-ink transition-colors hover:border-ga-ink"
          >
            <RotateCcw size={13} aria-hidden />
            Làm lại ({score}/{ITEMS.length})
          </button>
        )}
      </div>

      {/* Đoạn thư mẫu */}
      <div
        lang="de"
        className="briefpapier mt-4 rounded-ga-md border border-ga-border p-4 font-ga-display text-ga-body-lg leading-[1.75] text-ga-ink sm:p-5"
      >
        <p>Liebe Frau Weber,</p>
        <p className="mt-1">
          vielen Dank für Ihre Nachricht. Ich antworte Ihnen erst heute,{' '}
          <strong className="rounded-ga-sm bg-ga-yellow-soft px-1.5 py-0.5 font-ga-ui text-ga-small font-bold not-italic">
            (1) {picked[1] !== undefined ? ITEMS[0].options[picked[1]] : '___'}
          </strong>{' '}
          ich gestern den ganzen Tag im Krankenhaus Dienst hatte. Ich freue mich sehr{' '}
          <strong className="rounded-ga-sm bg-ga-yellow-soft px-1.5 py-0.5 font-ga-ui text-ga-small font-bold not-italic">
            (2) {picked[2] !== undefined ? ITEMS[1].options[picked[2]] : '___'}
          </strong>{' '}
          unser Gespräch. Könnten wir uns am Freitag treffen, an{' '}
          <strong className="rounded-ga-sm bg-ga-yellow-soft px-1.5 py-0.5 font-ga-ui text-ga-small font-bold not-italic">
            (3) {picked[3] !== undefined ? ITEMS[2].options[picked[3]] : '___'}
          </strong>{' '}
          ich früher Feierabend habe?
        </p>
        <p className="mt-1">Mit freundlichen Grüßen</p>
      </div>

      {/* 3 câu chọn đáp án */}
      <div className="mt-5 grid gap-3.5 sm:grid-cols-3">
        {ITEMS.map((item) => {
          const choice = picked[item.id]
          const isAnswered = choice !== undefined
          const isRight = choice === item.correct
          return (
            <div key={item.id} className="rounded-ga-md border border-ga-border bg-ga-bg p-3.5">
              <div className="mb-2.5 text-ga-caption font-bold uppercase text-ga-muted">{item.label}</div>
              <div className="flex flex-wrap gap-2">
                {item.options.map((opt, idx) => {
                  const selected = choice === idx
                  let cls = 'border-ga-border bg-ga-card text-ga-ink hover:border-ga-ink'
                  if (isAnswered) {
                    if (idx === item.correct) {
                      cls = 'border-ga-green bg-ga-green-soft font-bold text-ga-green'
                    } else if (selected) {
                      cls = 'border-ga-red bg-ga-red-soft font-semibold text-ga-red'
                    }
                  }
                  return (
                    <button
                      key={opt}
                      type="button"
                      lang="de"
                      aria-pressed={selected}
                      onClick={() => setPicked((prev) => ({ ...prev, [item.id]: idx }))}
                      className={`min-h-9 rounded-ga-pill border px-3 text-ga-small transition-colors ${cls}`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {isAnswered && (
                <p className={`mt-2.5 text-ga-caption ${isRight ? 'text-ga-green' : 'text-ga-ink'}`}>
                  <strong className="font-semibold">{isRight ? 'Đúng: ' : 'Giải thích: '}</strong>
                  {item.explain}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
