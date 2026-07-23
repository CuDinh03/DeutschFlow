'use client'

import { AlertTriangle, BookOpen, Headphones, PenTool, Mic2, ArrowRight } from 'lucide-react'

const SECTION_META: Record<string, { icon: React.ReactNode; label: string; color: string; studyLink: string; tipVi: string }> = {
  LESEN: {
    icon: <BookOpen size={16} />,
    label: 'Đọc hiểu',
    color: '#6366F1',
    studyLink: '/student/grammar-practice',
    tipVi: 'Luyện đọc văn bản tiếng Đức ngắn hàng ngày, chú ý từ vựng chủ đề sinh hoạt hàng ngày.',
  },
  HOEREN: {
    icon: <Headphones size={16} />,
    label: 'Nghe hiểu',
    color: '#0EA5E9',
    studyLink: '/student/practice',
    tipVi: 'Nghe podcast Deutsch A1 và hội thoại giao tiếp hàng ngày để quen âm điệu tiếng Đức.',
  },
  SCHREIBEN: {
    icon: <PenTool size={16} />,
    label: 'Viết',
    color: '#10B981',
    studyLink: '/student/assignments',
    tipVi: 'Thực hành viết email ngắn theo format Goethe: giới thiệu, hỏi thăm, lời kết. Chú ý ngữ pháp và cấu trúc câu.',
  },
  SPRECHEN: {
    icon: <Mic2 size={16} />,
    label: 'Nói',
    color: '#F59E0B',
    studyLink: '/student/interviews',
    tipVi: 'Luyện tự giới thiệu và hội thoại đơn giản. Dùng tính năng phỏng vấn AI để nhận phản hồi về phát âm.',
  },
}

interface WeakAreasRecommendationProps {
  weakAreas: string[]
}

export function WeakAreasRecommendation({ weakAreas }: WeakAreasRecommendationProps) {
  if (!weakAreas || weakAreas.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-lg">🎉</span>
        </div>
        <div>
          <p className="font-bold text-emerald-800 text-sm">Xuất sắc! Không có điểm yếu</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Bạn đã vượt ngưỡng 60% ở tất cả các phần. Tiếp tục duy trì và thử thách bản thân với đề khó hơn!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="font-bold text-[#0F172A] text-sm">Điểm yếu cần cải thiện</h3>
      </div>

      <div className="space-y-2">
        {weakAreas.map(section => {
          const meta = SECTION_META[section]
          if (!meta) return null

          return (
            <div
              key={section}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: meta.color + '18', color: meta.color }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 font-bold text-sm text-[#0F172A]">{section} — {meta.label}</p>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: meta.color + '18', color: meta.color }}
                    >
                      Dưới 60%
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{meta.tipVi}</p>
                  <a
                    href={meta.studyLink}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold transition-colors"
                    style={{ color: meta.color }}
                  >
                    Luyện tập ngay <ArrowRight size={12} strokeWidth={2.5} />
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-[#94A3B8] text-center pt-1">
        Luyện tập đều đặn mỗi ngày — kết quả sẽ cải thiện rõ rệt sau 2 tuần
      </p>
    </div>
  )
}
