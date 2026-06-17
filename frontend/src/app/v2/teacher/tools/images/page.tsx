'use client'

import { useState } from 'react'
import { Sparkles, Star, Download, Tag, X } from 'lucide-react'
import { toast } from 'sonner'
import { generateAiImages } from '@/lib/aiImageApi'
import type { MediaAsset } from '@/lib/mediaApi'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Tạo ảnh AI (GaAiImages) — violet, 2-col (config · gallery).
// Plumbing reused 1:1 (zero backend): POST /v2/ai-images/generate
//   { prompt, preset, style, size, count } → { provider, finalPrompt, assets: MediaAsset[] }.
//   Generated assets are persisted to the S3 media library by the service, so the proto's
//   "Lưu vào thư viện" is relabeled "Tải xuống" (already saved). Ratio → size map.
// Generation needs the image provider (Bedrock) configured (prod); locally it surfaces
// the real error state. preset/style/size are free-form (prompt-builder interpolates them).
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'
const STYLES = ['Ảnh thực tế', 'Minh hoạ', 'Hoạt hình', 'Phẳng (flat)']
const RATIOS: [string, string, string][] = [
  ['1:1', '1024²', '1024x1024'],
  ['4:3', 'ngang', '1024x768'],
  ['3:4', 'dọc', '768x1024'],
]
const RECENT = [
  'Y tá đo huyết áp cho bệnh nhân',
  'Cảnh phỏng vấn xin việc văn phòng',
  'Đầu bếp trong nhà hàng Đức',
  'Công nhân xây dựng đội mũ bảo hộ',
]
const COUNT = 4

type Phase = 'idle' | 'loading' | 'done' | 'error'

export default function V2AiImagesPage() {
  const [prompt, setPrompt] = useState('Một y tá đang chăm sóc bệnh nhân lớn tuổi trong bệnh viện Đức')
  const [style, setStyle] = useState(STYLES[0])
  const [ratio, setRatio] = useState('1:1')
  const [phase, setPhase] = useState<Phase>('idle')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [error, setError] = useState('')
  const [fav, setFav] = useState<Record<number, boolean>>({})

  const gen = async () => {
    if (!prompt.trim()) return
    setPhase('loading')
    setError('')
    setAssets([])
    try {
      const size = RATIOS.find((r) => r[0] === ratio)?.[2] ?? '1024x1024'
      const res = await generateAiImages({ prompt: prompt.trim(), preset: 'LESSON', style, size, count: COUNT, mode: 'final' })
      setAssets(res.assets ?? [])
      setPhase('done')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setPhase('error')
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <GaPageHdr accent title="Tạo ảnh AI" subtitle="Sinh ảnh minh hoạ cho từ vựng và bài học bằng AI · lưu vào thư viện S3" />

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: '330px 1fr' }}>
        {/* Config */}
        <div className="overflow-auto border-r border-ga-line bg-ga-card px-[22px] py-6">
          <GaCap className="mb-2.5 block">Mô tả ảnh (prompt)</GaCap>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="ga-ui mb-[18px] block w-full resize-none border border-ga-line bg-ga-bg px-3.5 py-3 text-[14px] leading-[1.6] text-ga-ink outline-none focus:border-ga-accent"
          />

          <GaCap className="mb-2.5 block">Phong cách</GaCap>
          <div className="mb-[18px] grid grid-cols-2 gap-2">
            {STYLES.map((s) => {
              const on = s === style
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className="ga-ui p-2.5 text-[12.5px] transition-colors"
                  style={{
                    fontWeight: on ? 600 : 400,
                    background: on ? 'var(--ga-side-active)' : 'transparent',
                    color: on ? 'var(--ga-ink)' : 'var(--ga-muted)',
                    border: `1px solid ${on ? VIOLET : 'var(--ga-line)'}`,
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>

          <GaCap className="mb-2.5 block">Tỉ lệ</GaCap>
          <div className="mb-5 flex gap-2">
            {RATIOS.map(([r, sub]) => {
              const on = r === ratio
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRatio(r)}
                  className="ga-ui flex-1 py-2.5 text-[12.5px] transition-colors"
                  style={{
                    fontWeight: on ? 700 : 500,
                    background: on ? 'var(--ga-ink)' : 'transparent',
                    color: on ? 'var(--ga-bg)' : 'var(--ga-muted)',
                    border: `1px solid ${on ? 'var(--ga-ink)' : 'var(--ga-line)'}`,
                  }}
                >
                  {r}
                  <span className="mt-0.5 block text-[9.5px] opacity-70">{sub}</span>
                </button>
              )
            })}
          </div>

          <GaBtn variant="yellow" className="w-full" loading={phase === 'loading'} disabled={phase === 'loading' || !prompt.trim()} onClick={gen}>
            <Sparkles size={16} /> Tạo {COUNT} ảnh
          </GaBtn>
          <p className="ga-ui my-3 text-[12px] leading-[1.6] text-ga-muted">
            Ảnh sinh ra dùng được cho video bài học, thẻ từ vựng và tài liệu. Tốn token AI của tổ chức.
          </p>

          <GaCap className="mb-2.5 block">Prompt gần đây</GaCap>
          <div className="flex flex-col gap-1.5">
            {RECENT.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className="ga-ui border border-ga-line bg-ga-bg px-3 py-2.5 text-left text-[12.5px] leading-[1.4] text-ga-muted transition-colors hover:text-ga-ink"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery */}
        <div className="overflow-auto px-9 py-7">
          {phase === 'idle' ? (
            <div className="grid h-full place-items-center text-center text-ga-muted">
              <p className="ga-ui text-[14px]">
                Nhập mô tả và bấm <strong className="text-ga-ink">Tạo {COUNT} ảnh</strong>. Ảnh sẽ hiện ở đây.
              </p>
            </div>
          ) : phase === 'error' ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <X size={32} className="mx-auto mb-3 text-ga-red" />
                <p className="font-ga-display text-[20px] font-medium text-ga-ink">Không tạo được ảnh</p>
                <p className="ga-ui mx-auto mt-1.5 max-w-sm text-[13.5px] text-ga-muted">{error}</p>
                <GaBtn variant="primary" className="mt-4" onClick={gen}>Thử lại</GaBtn>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <GaCap>{phase === 'loading' ? 'Đang sinh ảnh…' : `${assets.length} ảnh · ${style} · ${ratio}`}</GaCap>
                {phase === 'done' && <GaBtn variant="ghost" size="sm" onClick={gen}>Tạo lại</GaBtn>}
              </div>
              <div className="grid grid-cols-2 gap-[18px]">
                {phase === 'loading'
                  ? Array.from({ length: COUNT }).map((_, i) => (
                      <div key={i} className="ga-shimmer grid h-[200px] place-items-center border border-ga-line" aria-hidden>
                        <span className="font-ga-display text-[14px] italic text-ga-subtle">đang vẽ #{i + 1}…</span>
                      </div>
                    ))
                  : assets.map((a, i) => (
                      <div key={a.id ?? i} className="border border-ga-line bg-ga-card">
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={`Ảnh AI #${i + 1}`} className="block max-h-[280px] w-full object-cover" />
                          <button
                            type="button"
                            aria-label="Yêu thích"
                            onClick={() => setFav((f) => ({ ...f, [i]: !f[i] }))}
                            className="absolute right-2.5 top-2.5 grid h-[30px] w-[30px] place-items-center"
                            style={{ background: fav[i] ? 'var(--ga-yellow)' : 'rgba(255,255,255,0.9)', color: fav[i] ? 'var(--ga-ink)' : 'var(--ga-muted)' }}
                          >
                            <Star size={15} fill={fav[i] ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                        <div className="flex gap-2 px-3 py-2.5">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ga-ui flex flex-1 items-center justify-center gap-1.5 bg-ga-ink py-2 text-[11.5px] font-semibold text-ga-bg"
                          >
                            <Download size={13} /> Tải xuống
                          </a>
                          <button
                            type="button"
                            onClick={() => toast('Gắn ảnh vào từ vựng (sắp ra mắt)')}
                            className="ga-ui inline-flex items-center gap-1.5 border border-ga-line px-2.5 py-2 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                          >
                            <Tag size={13} /> Gắn vào từ
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
              {phase === 'done' && (
                <p className="ga-ui mt-4 text-[12.5px] text-ga-subtle">Các ảnh đã được lưu vào thư viện S3 của tổ chức.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
