'use client'

import { useEffect, useState } from 'react'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import type { AusbildungCopy } from '@/content/ausbildung'

/**
 * Danh sách việc cần làm trên trang học nghề (v3.4). Tiến độ chỉ lưu ở trình duyệt (`localStorage`):
 * trang công khai, người xem chưa có tài khoản, bộ nhớ bị chặn thì danh sách vẫn dùng được.
 */
export const CHECKLIST_STORAGE_KEY = 'df.ausbildung.checklist.v1'

function readDone(): string[] {
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeDone(ids: string[]): void {
  try {
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Trình duyệt chặn bộ nhớ: bỏ qua, dấu vẫn đúng tới khi tải lại trang.
  }
}

export function AusbildungChecklist({ copy }: { copy: AusbildungCopy['steps'] }) {
  const [done, setDone] = useState<string[]>([])

  useEffect(() => {
    setDone(readDone())
  }, [])

  const update = (next: string[]) => {
    setDone(next)
    writeDone(next)
  }
  const toggle = (id: string) =>
    update(done.includes(id) ? done.filter((d) => d !== id) : [...done, id])

  const count = copy.items.filter((s) => done.includes(s.id)).length
  const pct = copy.items.length > 0 ? Math.round((count / copy.items.length) * 100) : 0

  return (
    <div>
      <div className="mb-5 rounded-ga-lg border border-ga-border bg-ga-card p-4 shadow-ga-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-ga-body font-semibold text-ga-ink">
            {copy.progress.replace('{done}', String(count)).replace('{total}', String(copy.items.length))}
          </p>
          {count > 0 && (
            <GaBtn type="button" variant="ghost" size="sm" onClick={() => update([])}>
              {copy.reset}
            </GaBtn>
          )}
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-ga-pill bg-ga-bg">
          <div
            className="ga-bar-grow h-full rounded-ga-pill bg-ga-yellow transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-3.5">
        {copy.items.map((step, i) => {
          const checked = done.includes(step.id)
          return (
            <li
              key={step.id}
              className={`rounded-ga-xl border p-4 shadow-ga-sm transition-colors sm:p-5 ${
                checked ? 'border-ga-ink bg-ga-yellow-soft' : 'border-ga-border bg-ga-card hover:border-ga-ink'
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(step.id)}
                  className="mt-1 h-5 w-5 shrink-0 rounded-ga-sm accent-[var(--ga-ink)]"
                />
                <span className="min-w-0">
                  <span className="block text-ga-body-lg font-semibold text-ga-ink">
                    {i + 1}. {step.title}
                  </span>
                  <span className="mt-1 block text-ga-body text-ga-muted">{step.body}</span>
                </span>
              </label>
              {step.items && (
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-12 text-ga-body text-ga-ink">
                  {step.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-ga-caption text-ga-muted">{copy.savedNote}</p>
    </div>
  )
}
