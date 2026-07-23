'use client'

// NodeLessonPanel — full-screen lesson overlay shown when a leaf is tapped.
// Loads the node descriptor from the backend (GET /roadmap/tree/node/{id}); the lesson body + check
// are a group-keyed demo set (the backend stores only a content_key hook today — real content-gen is
// a later pass). Completing the check calls onComplete, which POSTs and re-grows the tree.

import * as React from 'react'
import { ArrowLeft, Check, X } from 'lucide-react'
import { GaBtn, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'
import { fetchNodeLesson, type TreeNodeLesson } from '@/lib/learning-tree/treeApi'
import { GROUP_COLORS } from '@/lib/learning-tree/render/palette'
import type { TopicGroup } from '@/lib/learning-tree/core'

interface LessonContent {
  de: string
  vi: string
  tip: string
  q: string
  opts: string[]
  correct: number
}

/** Demo lesson + check per topic group (mirrors the prototype's TREE_LESSON). */
const LESSON_BY_GROUP: Record<TopicGroup, LessonContent> = {
  medical: {
    de: '„Können Sie mir bitte bei der Übergabe helfen?"',
    vi: 'Bạn giúp tôi bàn giao ca trực được không?',
    tip: '„die Übergabe" = ca bàn giao. „Können Sie…?" dùng để đề nghị lịch sự.',
    q: 'Câu trên thường dùng trong tình huống nào?',
    opts: ['Bàn giao ca trực ở bệnh viện', 'Gọi món trong nhà hàng', 'Hỏi đường ra ga'],
    correct: 0,
  },
  daily: {
    de: '„Ich stehe jeden Tag um sechs Uhr auf."',
    vi: 'Tôi dậy lúc 6 giờ mỗi ngày.',
    tip: '„aufstehen" là động từ tách: trong câu, „auf" đứng cuối.',
    q: 'Câu này nói về điều gì?',
    opts: ['Thói quen sinh hoạt hằng ngày', 'Triệu chứng bệnh', 'Điều khoản hợp đồng'],
    correct: 0,
  },
  work: {
    de: '„Ich möchte mich um die Stelle als Pflegekraft bewerben."',
    vi: 'Tôi muốn ứng tuyển vị trí điều dưỡng.',
    tip: '„sich bewerben um + Akk." = ứng tuyển vào…',
    q: 'Ngữ cảnh phù hợp của câu?',
    opts: ['Nộp đơn xin việc', 'Đặt phòng khách sạn', 'Mua thuốc'],
    correct: 0,
  },
  travel: {
    de: '„Wann fährt der nächste Zug nach Berlin?"',
    vi: 'Chuyến tàu kế tiếp đi Berlin chạy lúc mấy giờ?',
    tip: '„fahren" cho phương tiện; „nach + thành phố" = đi tới…',
    q: 'Bạn dùng câu này khi nào?',
    opts: ['Hỏi giờ tàu ở nhà ga', 'Khám bệnh', 'Phỏng vấn'],
    correct: 0,
  },
  culture: {
    de: '„In Deutschland ist Pünktlichkeit sehr wichtig."',
    vi: 'Ở Đức, sự đúng giờ rất quan trọng.',
    tip: '„die Pünktlichkeit" = tính đúng giờ — giá trị văn hóa Đức.',
    q: 'Câu nói về điều gì?',
    opts: ['Giá trị văn hóa Đức', 'Cách pha thuốc', 'Lịch tàu xe'],
    correct: 0,
  },
  exam: {
    de: '„Lesen Sie den Text und beantworten Sie die Fragen."',
    vi: 'Hãy đọc văn bản và trả lời các câu hỏi.',
    tip: 'Dạng yêu cầu (Aufgabe) thường gặp trong đề telc/Goethe.',
    q: 'Câu lệnh này xuất hiện ở đâu?',
    opts: ['Đề thi đọc hiểu', 'Thực đơn nhà hàng', 'Biển báo giao thông'],
    correct: 0,
  },
}

interface NodeLessonPanelProps {
  nodeId: string
  group: string
  alreadyCompleted: boolean
  completing: boolean
  onClose: () => void
  onComplete: (nodeId: string) => void
}

export function NodeLessonPanel({
  nodeId,
  group,
  alreadyCompleted,
  completing,
  onClose,
  onComplete,
}: NodeLessonPanelProps): React.ReactElement {
  const [lesson, setLesson] = React.useState<TreeNodeLesson | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pick, setPick] = React.useState<number | null>(null)

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)
    fetchNodeLesson(nodeId)
      .then(setLesson)
      .catch(() => setError('Không thể tải bài học.'))
      .finally(() => setLoading(false))
  }, [nodeId])
  React.useEffect(load, [load])

  const groupKey: TopicGroup = (group in GROUP_COLORS ? group : 'daily') as TopicGroup
  const content = LESSON_BY_GROUP[groupKey]
  const accent = GROUP_COLORS[groupKey].leaf

  // Deterministic option order per node, so the answer position is stable but not always first.
  const order = React.useMemo(() => {
    const seed = nodeId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const r = seed % 3
    return [0, 1, 2].map((_, i) => [0, 1, 2][(i + r) % 3])
  }, [nodeId])
  const correctPos = order.indexOf(content.correct)
  const answered = pick !== null
  const isRight = pick === correctPos

  return (
    <div
      className="ga-scope absolute inset-0 z-20 flex flex-col overflow-hidden bg-ga-bg"
      data-role="student"
      style={{ fontFamily: 'var(--ga-vn)' }}
    >
      {/* Header */}
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-ga-line bg-ga-card px-4 py-4 lg:gap-4 lg:px-7">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />
        <button
          type="button"
          onClick={onClose}
          title="Quay lại cây"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-bg text-ga-ink"
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="ga-ui mb-1 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ga-muted">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: accent }} />
            {lesson ? `${lesson.skill} · ${lesson.topicLabel}` : 'Bài học'}
          </div>
          <div className="font-ga-display text-[20px] font-medium leading-tight text-ga-ink lg:text-[26px]">
            {lesson?.title ?? '…'}
          </div>
        </div>
        {alreadyCompleted && (
          <span className="ga-ui flex-shrink-0 rounded-ga-pill border border-ga-green/40 px-3 py-1.5 text-[12.5px] font-semibold text-ga-green">
            Đã hoàn thành
          </span>
        )}
      </div>

      {/* Body */}
      <div className="ga-scroll flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        {loading ? (
          <LoadingState label="Đang tải bài học…" />
        ) : error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : (
          <div className="mx-auto flex max-w-[680px] flex-col gap-5">
            {/* Lesson card */}
            <div className="border border-ga-line bg-ga-card p-5 lg:p-7">
              <GaCap className="mb-3.5 block">Bài học</GaCap>
              <div className="font-ga-display mb-2 text-[19px] font-medium leading-snug text-ga-ink lg:text-[24px]">{content.de}</div>
              <div className="ga-ui mb-4 text-[15.5px] text-ga-muted">{content.vi}</div>
              <div className="ga-ui flex items-start gap-2.5 border-t border-ga-line pt-4 text-[14px] leading-relaxed text-ga-ink">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 bg-ga-yellow" />
                <div>
                  <strong>Ghi nhớ.</strong> {content.tip}
                </div>
              </div>
            </div>

            {/* Exercise card */}
            <div className="border border-ga-line bg-ga-card p-5 lg:p-7">
              <GaCap className="mb-3.5 block">Bài tập</GaCap>
              <div className="ga-ui mb-4 text-[16px] font-semibold text-ga-ink">{content.q}</div>
              <div className="flex flex-col gap-2.5">
                {order.map((optIdx, pos) => {
                  const sel = pick === pos
                  const showState = answered && (pos === correctPos || sel)
                  const ok = pos === correctPos
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => !alreadyCompleted && setPick(pos)}
                      disabled={alreadyCompleted}
                      className="flex items-center gap-3 rounded-ga border px-4 py-3.5 text-left"
                      style={{
                        background: showState ? (ok ? 'var(--ga-green-soft)' : 'var(--ga-red-soft)') : 'var(--ga-bg)',
                        borderColor: showState ? (ok ? 'var(--ga-green)' : 'var(--ga-red)') : 'var(--ga-border)',
                      }}
                    >
                      <span
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{
                          border: `2px solid ${showState ? (ok ? 'var(--ga-green)' : 'var(--ga-red)') : 'var(--ga-border)'}`,
                          background: showState ? (ok ? 'var(--ga-green)' : sel ? 'var(--ga-red)' : 'transparent') : 'transparent',
                        }}
                      >
                        {showState && ok ? (
                          <Check size={14} aria-hidden />
                        ) : showState && sel && !ok ? (
                          <X size={14} aria-hidden />
                        ) : (
                          String.fromCharCode(65 + pos)
                        )}
                      </span>
                      <span className="ga-ui text-[15px] text-ga-ink">{content.opts[optIdx]}</span>
                    </button>
                  )
                })}
              </div>
              {answered && !isRight && (
                <div className="ga-ui mt-3 text-[13.5px] text-ga-red">Chưa đúng — thử lại nhé.</div>
              )}
              {answered && isRight && !alreadyCompleted && (
                <div className="ga-ui mt-3 text-[13.5px] font-semibold text-ga-green">
                  Chính xác! Hoàn thành để cây mọc thêm.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-3 border-t border-ga-line bg-ga-card px-4 py-4 lg:flex-nowrap lg:px-10">
        {!alreadyCompleted ? (
          <GaBtn
            variant="yellow"
            disabled={!isRight || completing || loading}
            loading={completing}
            onClick={() => isRight && onComplete(nodeId)}
          >
            {isRight ? 'Hoàn thành & xem cây lớn lên' : 'Trả lời đúng để hoàn thành'}
          </GaBtn>
        ) : (
          <GaBtn variant="ghost" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden /> Quay lại cây
          </GaBtn>
        )}
        {!alreadyCompleted && (
          <GaBtn variant="ghost" onClick={onClose}>
            Để sau
          </GaBtn>
        )}
      </div>
    </div>
  )
}
