'use client'

import { useState } from 'react'
import { Sparkles, FileText, Info } from 'lucide-react'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Tạo Tài liệu AI (GaMaterialsAI) — violet, 2-col (config · preview).
// DECISION (user: "build proto UI, wire later"): the proto is a parameter-driven
// worksheet generator (type/topic/level/count → reading + MCQ). There is NO backend
// for that — the only real materials endpoint is doc→PPTX (`/v2/teacher/materials/
// generate-pptx`, a different feature). So the config panel is fully built (real
// client-side controls) but generation is DISABLED — NO fabricated worksheet content
// is rendered (same approach as the admin personas create modal). Wire to a real
// worksheet-generation endpoint when it exists (backend backlog).
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'
const MAT_TYPES = ['Bài đọc hiểu', 'Bài nghe', 'Bài kiểm tra từ vựng', 'Bài tập ngữ pháp', 'Đề phỏng vấn', 'Bài tập tình huống']
const MAT_TOPICS = ['Krankenhaus & Pflege', 'Arbeitsalltag', 'Bewerbungsgespräch', 'Freizeit & Familie', 'Stadtleben & Wohnen', 'Technik & IT']
const LEVELS = ['A2', 'B1', 'B2', 'C1']

export default function V2MaterialsAiPage() {
  const [type, setType] = useState(MAT_TYPES[0])
  const [topic, setTopic] = useState(MAT_TOPICS[0])
  const [level, setLevel] = useState('B1')
  const [count, setCount] = useState(5)

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:overflow-hidden">
      <GaPageHdr accent title="Tạo Tài liệu AI" subtitle="Tự động tạo bài tập, đề kiểm tra và tài liệu học tập cá nhân hoá" />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Config */}
        <div className="border-b border-ga-line bg-ga-card px-4 py-6 sm:px-6 lg:overflow-auto lg:border-b-0 lg:border-r lg:px-5">
          <GaCap className="mb-3 block">Loại tài liệu</GaCap>
          <div className="mb-5 flex flex-col gap-1.5">
            {MAT_TYPES.map((t) => {
              const on = t === type
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="ga-ui px-3 py-2.5 text-left text-[13.5px] transition-colors"
                  style={{
                    fontWeight: on ? 600 : 400,
                    color: on ? 'var(--ga-ink)' : 'var(--ga-muted)',
                    background: on ? 'var(--ga-side-active)' : 'transparent',
                    border: `1px solid ${on ? 'var(--ga-ink)' : 'var(--ga-line)'}`,
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>

          <GaCap className="mb-2.5 block">Chủ đề</GaCap>
          <div className="mb-5 flex flex-col gap-1.5">
            {MAT_TOPICS.map((t) => {
              const on = t === topic
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="ga-ui px-3 py-2.5 text-left text-[13.5px] transition-colors"
                  style={{
                    fontWeight: on ? 600 : 400,
                    color: on ? 'var(--ga-ink)' : 'var(--ga-muted)',
                    background: on ? 'var(--ga-side-active)' : 'transparent',
                    border: `1px solid ${on ? 'var(--ga-ink)' : 'var(--ga-line)'}`,
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>

          <GaCap className="mb-2.5 block">Trình độ</GaCap>
          <div className="mb-5 flex border border-ga-line">
            {LEVELS.map((l, i) => {
              const on = l === level
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className="ga-ui min-w-0 flex-1 py-3 text-[12px] font-semibold transition-colors lg:py-2"
                  style={{
                    background: on ? 'var(--ga-ink)' : 'transparent',
                    color: on ? 'var(--ga-bg)' : 'var(--ga-muted)',
                    borderLeft: i ? '1px solid var(--ga-line)' : 'none',
                  }}
                >
                  {l}
                </button>
              )
            })}
          </div>

          <GaCap className="mb-2.5 block">Số câu hỏi: {count}</GaCap>
          <input
            type="range"
            min={3}
            max={15}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mb-6 w-full"
            style={{ accentColor: VIOLET }}
          />

          <GaBtn
            variant="yellow"
            className="w-full"
            disabled
            title="Tính năng tạo tài liệu AI đang được hoàn thiện"
          >
            <Sparkles size={16} /> Tạo tài liệu
          </GaBtn>
          <p className="ga-ui mt-2.5 text-[11.5px] leading-[1.5] text-ga-subtle">
            Đang hoàn thiện — sẽ kết nối khi dịch vụ tạo tài liệu AI sẵn sàng.
          </p>
        </div>

        {/* Preview (idle — no fabricated content until backend exists) */}
        <div className="grid place-items-center bg-ga-bg px-4 py-8 sm:px-6 lg:overflow-auto lg:px-9 lg:py-7">
          <div className="max-w-md text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center" style={{ background: 'var(--ga-violet-soft)' }}>
              <FileText size={26} style={{ color: VIOLET }} />
            </span>
            <h2 className="font-ga-display text-[20px] font-medium leading-[1.25] text-ga-ink lg:text-[22px]">Bản xem trước tài liệu</h2>
            <p className="ga-ui mt-2 text-[14px] leading-[1.65] text-ga-muted">
              Cấu hình sẽ tạo: <strong className="text-ga-ink">{type}</strong> · chủ đề{' '}
              <strong className="text-ga-ink">{topic}</strong> · trình độ <strong className="text-ga-ink">{level}</strong> ·{' '}
              <strong className="text-ga-ink">{count}</strong> câu hỏi.
            </p>
            <div className="mt-5 flex items-start gap-2.5 border border-ga-line bg-ga-card px-4 py-3 text-left">
              <Info size={16} className="mt-0.5 shrink-0 text-ga-subtle" />
              <p className="ga-ui m-0 text-[12.5px] leading-[1.6] text-ga-muted">
                Tính năng tạo tài liệu AI từ tham số đang được hoàn thiện. Giao diện đã sẵn sàng và sẽ tạo bản xem trước
                ngay tại đây khi dịch vụ backend được kết nối.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
