import api from '@/lib/api'

// Typed fetchers for the teacher "Phân tích giảng dạy" page. Every field is parsed defensively
// (num()/String()) because the axios response shape is untrusted at the boundary.

export interface ReportsOverview {
  classCount: number
  studentCount: number
  assignmentCount: number
  avgScore: number
}

export interface ClassSummary {
  id: number
  name: string
  studentCount: number
  assignmentCount: number
  avgScore: number
}

export interface TrendSeries {
  classId: number
  className: string
  /** Aligned to ClassTrend.buckets; null where the class has no confirmed grade that week. */
  values: (number | null)[]
}

export interface ClassTrend {
  buckets: string[]
  series: TrendSeries[]
}

export interface SkillDistribution {
  horen: number | null
  lesen: number | null
  schreiben: number | null
  sprechen: number | null
  ratedCount: number
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function optNum(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export async function getReportsOverview(): Promise<ReportsOverview> {
  const d = record((await api.get('/v2/teacher/reports/overview')).data)
  return {
    classCount: num(d.classCount),
    studentCount: num(d.studentCount),
    assignmentCount: num(d.assignmentCount),
    avgScore: num(d.avgScore),
  }
}

export async function getClassesSummary(): Promise<ClassSummary[]> {
  const data = (await api.get('/v2/teacher/reports/classes-summary')).data
  const rows = Array.isArray(data) ? data : []
  return rows.map((raw) => {
    const r = record(raw)
    return {
      id: num(r.id),
      name: String(r.name ?? `Lớp #${r.id}`),
      studentCount: num(r.studentCount),
      assignmentCount: num(r.assignmentCount),
      avgScore: num(r.avgScore),
    }
  })
}

export async function getWeeklyTrends(): Promise<ClassTrend> {
  const d = record((await api.get('/v2/teacher/reports/trends')).data)
  const buckets = Array.isArray(d.buckets) ? d.buckets.map((b) => String(b)) : []
  const rawSeries = Array.isArray(d.series) ? d.series : []
  const series: TrendSeries[] = rawSeries.map((raw) => {
    const s = record(raw)
    return {
      classId: num(s.classId),
      className: String(s.className ?? ''),
      values: Array.isArray(s.values) ? s.values.map((v) => optNum(v)) : [],
    }
  })
  return { buckets, series }
}

export async function getSkillDistribution(): Promise<SkillDistribution> {
  const d = record((await api.get('/v2/teacher/reports/skill-distribution')).data)
  return {
    horen: optNum(d.horen),
    lesen: optNum(d.lesen),
    schreiben: optNum(d.schreiben),
    sprechen: optNum(d.sprechen),
    ratedCount: num(d.ratedCount),
  }
}
