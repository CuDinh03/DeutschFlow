'use client'

import * as React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts'
import { GaCard } from '@/components/ui-v2'
import { cn } from '@/lib/utils'

/**
 * Galerie 2.0 — shared ANALYTICS primitives (pattern-setter for the analytics cohort:
 * admin revenue/tokens/interviews/overview + teacher/org analytics).
 *
 * Mirrors Prototype A's AdSection / AdBars / AdDonut / Legend, ported to recharts
 * (already a dep) + ga-* tokens. Chart colours are HEX (recharts SVG fills) drawn
 * from galerie.css's accent family so charts read as part of the design system.
 */

/** Accent family (matches galerie.css --ga-blue/violet/teal/orange/green/navy/gold/red). */
export const GA_CHART = [
  '#2F6FC9', // blue
  '#7C56C8', // violet
  '#11888A', // teal
  '#E07B39', // orange
  '#1E9E61', // green
  '#27406B', // navy
  '#C79A00', // gold
  '#DA291C', // red
] as const

const AXIS = '#B3ADA5' // ga-subtle
const GRID = '#E7E3DA' // ga-border

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 2,
  border: '1px solid #E7E3DA',
  fontFamily: 'var(--ga-ui)',
  fontSize: 12,
  color: '#161513',
}

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmtVnd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}tỷ₫`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr₫`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k₫`
  return `${Math.round(n)}₫`
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export const nfVN = new Intl.NumberFormat('vi-VN')

// ── Section card (= proto AdSection) ────────────────────────────────────────────
export function GaSection({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <GaCard className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-ga-border px-5 py-[14px]">
        <h3 className="font-ga-display text-[17px] font-medium text-ga-ink">{title}</h3>
        {right}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </GaCard>
  )
}

// ── Bar chart (= proto AdBars) ──────────────────────────────────────────────────
export interface ChartPoint {
  label: string | number
  value: number
}

export function GaBars({
  data,
  color = '#27406B',
  height = 160,
  valueFmt,
}: {
  data: ChartPoint[]
  color?: string
  height?: number
  valueFmt?: (v: number) => string
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: AXIS }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={valueFmt}
          />
          <Tooltip
            cursor={{ fill: 'rgba(124,86,200,0.06)' }}
            formatter={(v: number | string) => (valueFmt ? valueFmt(Number(v)) : String(v))}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Grouped bar chart (multi-series, e.g. học/ôn/nói theo ngày) ─────────────────
export interface MultiSeries {
  /** Key trong mỗi điểm dữ liệu. */
  key: string
  /** Nhãn hiển thị (đã dịch) — dùng cho tooltip + legend. */
  name: string
  color: string
}

export function GaMultiBars({
  data,
  series,
  height = 190,
}: {
  data: Array<Record<string, string | number>>
  series: MultiSeries[]
  height?: number
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -16, bottom: 0 }} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} width={40} />
          <Tooltip cursor={{ fill: 'rgba(124,86,200,0.06)' }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey={series[0]?.key} name={series[0]?.name} fill={series[0]?.color} radius={[2, 2, 0, 0]} maxBarSize={14} />
          {series.slice(1).map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={14} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Area chart (cost / time-series trend) ───────────────────────────────────────
export function GaArea({
  data,
  color = '#7C56C8',
  height = 170,
  valueFmt,
}: {
  data: ChartPoint[]
  color?: string
  height?: number
  valueFmt?: (v: number) => string
}) {
  const gid = React.useId().replace(/:/g, '')
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: AXIS }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={valueFmt}
          />
          <Tooltip
            formatter={(v: number | string) => (valueFmt ? valueFmt(Number(v)) : String(v))}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Multi-series line chart (time-series trend, one line per series) ─────────────
export interface LineSeries {
  /** Key into each data row. */
  key: string
  /** Display name (localised) for tooltip/legend. */
  name: string
  color: string
}

export function GaLines({
  data,
  series,
  height = 220,
  valueFmt,
  yDomain,
}: {
  data: Array<Record<string, string | number | null>>
  series: LineSeries[]
  height?: number
  valueFmt?: (v: number) => string
  yDomain?: [number, number]
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
          <YAxis
            domain={yDomain ?? ['auto', 'auto']}
            tick={{ fontSize: 10, fill: AXIS }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={valueFmt}
          />
          <Tooltip
            formatter={(v: number | string) => (valueFmt ? valueFmt(Number(v)) : String(v))}
            contentStyle={TOOLTIP_STYLE}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Donut + legend (= proto AdDonut + Legend) ───────────────────────────────────
export interface DonutSeg {
  label: string
  value: number
  color: string
}

export function GaDonut({ segments, size = 150 }: { segments: DonutSeg[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={size * 0.33}
            outerRadius={size * 0.48}
            paddingAngle={2}
            stroke="none"
          >
            {segments.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => nfVN.format(v)} contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      {total > 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="font-ga-display text-[20px] font-medium text-ga-ink">{nfVN.format(total)}</span>
        </div>
      )}
    </div>
  )
}

export function GaLegend({
  items,
}: {
  items: { label: string; color: string; display?: React.ReactNode }[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((s, i) => (
        <div key={i} className="ga-ui flex items-center gap-2 text-[13px]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
          <span className="truncate text-ga-muted">{s.label}</span>
          {s.display != null && <span className="ml-auto font-medium text-ga-ink">{s.display}</span>}
        </div>
      ))}
    </div>
  )
}

// ── Simple horizontal bar row (CEFR / distribution lists) ───────────────────────
export function GaBarRow({
  label,
  value,
  max,
  color = '#7C56C8',
  display,
}: {
  label: string
  value: number
  max: number
  color?: string
  display?: React.ReactNode
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="py-[9px]">
      <div className="ga-ui mb-1.5 flex items-center justify-between text-[13px]">
        <span className="text-ga-ink">{label}</span>
        <span className="font-medium text-ga-muted">{display ?? value}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-[3px] bg-ga-border">
        <div className="h-full rounded-[3px] transition-[width]" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
