'use client'

import { useEffect, useState } from 'react'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import type { AusbildungCopy } from '@/content/ausbildung'

/**
 * Danh sách việc cần làm trên trang học nghề. Tiến độ chỉ lưu ở trình duyệt: trang công khai, người xem
 * chưa có tài khoản, và giai đoạn 1 chưa thêm migration. Bộ nhớ bị chặn thì danh sách vẫn dùng được,
 * chỉ không nhớ sau khi tải lại.
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ga-border pb-3">
        <p role="status" className="text-ga-body font-semibold text-ga-ink">
          {copy.progress.replace('{done}', String(count)).replace('{total}', String(copy.items.length))}
        </p>
        {count > 0 && (
          <GaBtn type="button" variant="ghost" size="sm" onClick={() => update([])}>
            {copy.reset}
          </GaBtn>
        )}
      </div>
      <ol className="flex flex-col gap-3">
        {copy.items.map((step, i) => {
          const checked = done.includes(step.id)
          return (
            <li key={step.id} className="border border-ga-border bg-ga-card p-4 sm:p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(step.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--ga-accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-ga-body-lg font-semibold text-ga-ink">
                    {i + 1}. {step.title}
                  </span>
                  <span className="mt-1 block text-ga-body text-ga-muted">{step.body}</span>
                </span>
              </label>
              {step.items && (
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-[52px] text-ga-body text-ga-ink">
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
