'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronRight, Clock, FileText, Sparkles, Users } from 'lucide-react'
import type { MyClassroom } from '@/lib/studentClassesApi'

interface Props {
  classroom: MyClassroom
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function teacherChipColor(idx: number): string {
  const palette = ['bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700']
  return palette[idx % palette.length]
}

export function ClassCard({ classroom }: Props) {
  const lessonPercent = classroom.lessonTotal > 0
    ? Math.round((classroom.lessonCompleted / classroom.lessonTotal) * 100)
    : 0

  return (
    <Link
      href={`/student/classes/${classroom.id}`}
      className="group relative block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-800 truncate group-hover:text-indigo-700">
            {classroom.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {classroom.teachers.length === 0 ? (
              <span className="text-xs text-slate-500">Chưa có giáo viên</span>
            ) : (
              classroom.teachers.slice(0, 3).map((t, i) => (
                <span
                  key={t.id}
                  className={`inline-flex items-center gap-1 rounded-full ${teacherChipColor(i)} px-2 py-0.5 text-xs font-semibold`}
                  title={t.displayName}
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-white/60 text-[10px] font-bold">
                    {initials(t.displayName)}
                  </span>
                  <span className="max-w-[100px] truncate">{t.displayName}</span>
                </span>
              ))
            )}
            {classroom.teachers.length > 3 && (
              <span className="text-xs text-slate-500">+{classroom.teachers.length - 3}</span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 group-hover:text-indigo-500" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Bài tập" value={classroom.assignmentCount} icon={FileText} tone="slate" />
        <Stat
          label="Chưa nộp"
          value={classroom.pendingCount}
          icon={Clock}
          tone={classroom.pendingCount > 0 ? 'amber' : 'slate'}
        />
        <Stat
          label="Điểm TB"
          value={classroom.avgScore != null ? classroom.avgScore.toFixed(1) : '–'}
          icon={Sparkles}
          tone={classroom.avgScore != null ? 'emerald' : 'slate'}
        />
      </div>

      {classroom.lessonTotal > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
            <span>Tiến độ lớp</span>
            <span>{classroom.lessonCompleted}/{classroom.lessonTotal} buổi</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all"
              style={{ width: `${lessonPercent}%` }}
            />
          </div>
        </div>
      )}

      {classroom.latestAssignmentTopic && (
        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Bài mới nhất:</span> {classroom.latestAssignmentTopic}
          {classroom.latestAssignmentDueDate && (
            <span className="ml-1 text-slate-500">
              · hạn {format(new Date(classroom.latestAssignmentDueDate), 'dd/MM')}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  icon: typeof Users
  tone: 'slate' | 'amber' | 'emerald'
}) {
  const tones: Record<string, string> = {
    slate: 'text-slate-700 bg-slate-50',
    amber: 'text-amber-700 bg-amber-50',
    emerald: 'text-emerald-700 bg-emerald-50',
  }
  return (
    <div className={`rounded-xl ${tones[tone]} px-2 py-2`}>
      <div className="mx-auto mb-0.5 flex items-center justify-center gap-1">
        <Icon size={12} />
        <span className="text-[10px] uppercase tracking-wide font-bold opacity-70">{label}</span>
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  )
}
