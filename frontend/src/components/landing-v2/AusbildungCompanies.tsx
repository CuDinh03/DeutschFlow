'use client'

import { useState } from 'react'
import type { AusbildungCopy } from '@/content/ausbildung'
import type { AusbildungCompany } from '@/lib/ausbildung'
import { WORKPLACES, type Workplace } from '@/lib/occupationTypes'

/** Danh bạ doanh nghiệp trên trang học nghề: lọc theo ngành, mỗi dòng mở website của doanh nghiệp. */
export function AusbildungCompanies({
  copy,
  companies,
}: {
  copy: AusbildungCopy['companies']
  companies: readonly AusbildungCompany[]
}) {
  const [group, setGroup] = useState<Workplace | null>(null)
  const groups = WORKPLACES.filter((w) => companies.some((c) => c.workplace === w))
  const shown = group ? companies.filter((c) => c.workplace === group) : companies

  const chip = (active: boolean) =>
    `min-h-11 border px-3.5 py-2 text-ga-small font-semibold transition-colors ${
      active ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-border bg-ga-card text-ga-ink hover:border-ga-ink'
    }`

  return (
    <div>
      <div role="group" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={group === null} onClick={() => setGroup(null)} className={chip(group === null)}>
          {copy.all}
        </button>
        {groups.map((w) => (
          <button key={w} type="button" aria-pressed={group === w} onClick={() => setGroup(w)} className={chip(group === w)}>
            {copy.groups[w]}
          </button>
        ))}
      </div>
      <p role="status" className="mt-4 text-ga-small text-ga-muted">
        {copy.count.replace('{count}', String(shown.length))}
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li key={c.url}>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full min-h-[92px] flex-col justify-between gap-2 border border-ga-border bg-ga-card p-4 transition-colors hover:border-ga-ink"
            >
              <span className="text-ga-body font-semibold text-ga-ink">{c.name}</span>
              <span className="flex items-center justify-between gap-3 text-ga-caption text-ga-muted">
                <span>{copy.groups[c.workplace]}</span>
                <span className="shrink-0 font-semibold text-ga-ink">{copy.open} <span aria-hidden>↗</span></span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-l-2 border-ga-yellow pl-3 text-ga-body text-ga-muted">{copy.note}</p>
    </div>
  )
}
