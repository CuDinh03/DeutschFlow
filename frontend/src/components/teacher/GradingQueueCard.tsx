'use client'

import { Clock, FileText, User, BookOpen, Mic, PenLine, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

export interface GradingQueueItem {
  id: number
  assignmentId: number
  studentId: number
  studentName: string
  studentEmail: string
  topic: string
  description: string
  assignmentType: string
  dueDate: string | null
  classId: number
  className: string
  status: string
  submittedAt: string | null
  submissionContent: string | null
  submissionFileUrl: string | null
  score: number | null
  feedback: string | null
  attachmentUrl: string | null
}

interface GradingQueueCardProps {
  item: GradingQueueItem
  onGrade: (item: GradingQueueItem) => void
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SPEAKING_SCENARIO: {
    label: 'Luyện Nói AI',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <Mic size={13} />,
  },
  ESSAY: {
    label: 'Viết luận',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <PenLine size={13} />,
  },
  MOCK_TEST: {
    label: 'Thi thử',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <FileText size={13} />,
  },
  VOCABULARY: {
    label: 'Từ vựng',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    icon: <BookOpen size={13} />,
  },
  GRAMMAR: {
    label: 'Ngữ pháp',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <BookOpen size={13} />,
  },
  GENERAL: {
    label: 'Bài tập chung',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText size={13} />,
  },
}

export function GradingQueueCard({ item, onGrade }: GradingQueueCardProps) {
  const type = typeConfig[item.assignmentType] ?? typeConfig.GENERAL

  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Student + Assignment info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {item.studentName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              {/* Student name + class */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-slate-800 text-sm">{item.studentName}</span>
                <span className="text-slate-400 text-xs">·</span>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  {item.className}
                </span>
              </div>

              {/* Topic */}
              <p className="font-semibold text-slate-700 text-sm truncate">{item.topic}</p>

              {/* Meta */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${type.color}`}>
                  {type.icon}
                  {type.label}
                </span>

                {item.submittedAt && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock size={11} />
                    Nộp lúc {format(new Date(item.submittedAt), 'dd/MM HH:mm')}
                  </span>
                )}

                {item.dueDate && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                    Hạn: {format(new Date(item.dueDate), 'dd/MM/yyyy')}
                    {isOverdue && ' (Quá hạn)'}
                  </span>
                )}
              </div>

              {/* Preview submission content */}
              {item.submissionContent && (
                <p className="mt-2 text-xs text-slate-500 line-clamp-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  {item.submissionContent}
                </p>
              )}
              {item.submissionFileUrl && !item.submissionContent && (
                <p className="mt-2 text-xs text-indigo-600 font-medium flex items-center gap-1">
                  <FileText size={12} /> Có file đính kèm
                </p>
              )}
            </div>
          </div>

          {/* Right: Grade button */}
          <button
            onClick={() => onGrade(item)}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm hover:shadow-md"
          >
            Chấm bài
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
