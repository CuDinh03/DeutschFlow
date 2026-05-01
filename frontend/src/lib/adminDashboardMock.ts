/**
 * Mock dashboards aligned with real scale (studentCount, sum of usedThisMonth).
 * Labels / copy come from i18n in pages.
 */

export type RevenueMonthRow = {
  key: string
  label: string
  subscribers: number
  grossVnd: number
  storeFeeVnd: number
  apiCostVnd: number
  netVnd: number
  marginPct: number
}

const MONTH_SUB_MS = 15_000 // illustrative API + infra per active learner

export function buildMonthlyRevenueVnd(studentCount: number, locale: string): RevenueMonthRow[] {
  const sc = Math.max(8, studentCount)
  return Array.from({ length: 12 }, (_, i) => {
    const label = new Date(2025, i, 1).toLocaleString(locale, { month: 'short' })
    const key = `m${i}`
    const wave = 1 + i * 0.035 + Math.sin(i * 0.9) * 0.06
    const subscribers = Math.max(10, Math.round(sc * 0.28 * wave))
    const grossVnd = subscribers * 99_000
    const storeFeeVnd = Math.round(grossVnd * 0.15)
    const apiCostVnd = Math.round(5_200_000 + subscribers * MONTH_SUB_MS)
    const netVnd = grossVnd - storeFeeVnd - apiCostVnd
    const marginPct = grossVnd > 0 ? Math.round((netVnd / grossVnd) * 1000) / 10 : 0
    return {
      key,
      label,
      subscribers,
      grossVnd,
      storeFeeVnd,
      apiCostVnd,
      netVnd,
      marginPct,
    }
  })
}

export function aggregateRevenueByQuarter(rows: RevenueMonthRow[]) {
  const q: RevenueMonthRow[] = []
  for (let qi = 0; qi < 4; qi++) {
    const slice = rows.slice(qi * 3, qi * 3 + 3)
    if (slice.length === 0) break
    const subscribers = Math.round(slice.reduce((s, r) => s + r.subscribers, 0) / slice.length)
    const grossVnd = slice.reduce((s, r) => s + r.grossVnd, 0)
    const storeFeeVnd = slice.reduce((s, r) => s + r.storeFeeVnd, 0)
    const apiCostVnd = slice.reduce((s, r) => s + r.apiCostVnd, 0)
    const netVnd = grossVnd - storeFeeVnd - apiCostVnd
    const marginPct = grossVnd > 0 ? Math.round((netVnd / grossVnd) * 1000) / 10 : 0
    q.push({
      key: `q${qi + 1}`,
      label: `Q${qi + 1}`,
      subscribers,
      grossVnd,
      storeFeeVnd,
      apiCostVnd,
      netVnd,
      marginPct,
    })
  }
  return q
}

export function aggregateRevenueYearly(rows: RevenueMonthRow[]) {
  const grossVnd = rows.reduce((s, r) => s + r.grossVnd, 0)
  const storeFeeVnd = rows.reduce((s, r) => s + r.storeFeeVnd, 0)
  const apiCostVnd = rows.reduce((s, r) => s + r.apiCostVnd, 0)
  const netVnd = grossVnd - storeFeeVnd - apiCostVnd
  const marginPct = grossVnd > 0 ? Math.round((netVnd / grossVnd) * 1000) / 10 : 0
  const subscribers = Math.round(rows.reduce((s, r) => s + r.subscribers, 0) / rows.length)
  return [
    {
      key: 'y2025',
      label: '2025',
      subscribers,
      grossVnd,
      storeFeeVnd,
      apiCostVnd,
      netVnd,
      marginPct,
    },
  ]
}

export type TokenSlice = { name: string; value: number; color: string }

/** When totalUsed > 0, split with fixed realistic product mix; else use floor for chart. */
export function buildTokenServicePie(
  totalUsed: number,
  labels: { speaking: string; llm: string; grammar: string; other: string },
): TokenSlice[] {
  const base = totalUsed > 0 ? totalUsed : 2_450_000
  return [
    { name: labels.speaking, value: Math.round(base * 0.41), color: '#2D9CDB' },
    { name: labels.llm, value: Math.round(base * 0.33), color: '#9B51E0' },
    { name: labels.grammar, value: Math.round(base * 0.19), color: '#F2994A' },
    { name: labels.other, value: Math.max(0, Math.round(base * 0.07)), color: '#27AE60' },
  ]
}
