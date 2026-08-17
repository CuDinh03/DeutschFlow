'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Branch, PlacedNode, TreeLayout } from '@/lib/roadmap-tree/treeLayout'
import '@/styles/roadmap-tree.css'

/**
 * Cây học tập — phần vẽ thuần. Không gọi API, không biết `/roadmap/me`: nhận hình học đã tính từ
 * {@link buildTreeLayout} và bắn ra id node khi người học chạm vào.
 *
 * Điều hướng bằng bàn phím là bắt buộc chứ không phải bonus: cây là một cách nhìn khác của danh
 * sách bài học, nên mọi node phải tới được bằng Tab như một nút bình thường.
 */

const MIN_SCALE = 0.55
const MAX_SCALE = 2.4
/** Ngưỡng px để phân biệt "bấm chọn node" với "kéo cây". */
const DRAG_SLOP = 4
const LEAF_HREF: Record<string, string> = { A: '#rtLeafA', B: '#rtLeafB', C: '#rtLeafC' }

export interface SkillTreeCanvasProps {
  layout: TreeLayout
  selectedId: number | null
  onSelect: (nodeId: number) => void
  /** Nhãn cho từng node, đọc bởi trình đọc màn hình. */
  nodeLabel: (node: PlacedNode) => string
  weekLabel: (branch: Branch) => string
  futureTipLabel: string
  treeLabel: string
  /** Tắt lay lá + nhịp vòng sáng. Người dùng bật "giảm chuyển động" cũng tự tắt qua CSS. */
  motionEnabled: boolean
  zoomStep: number
}

interface Camera {
  scale: number
  x: number
  y: number
}

const IDLE: Camera = { scale: 1, x: 0, y: 0 }

/**
 * Đổi toạ độ chuột (client) sang hệ toạ độ viewBox — cùng hệ đơn vị với camera, nên phép neo
 * "điểm dưới con trỏ đứng yên" mới đúng ở mọi cỡ khung (SVG co theo `preserveAspectRatio`).
 */
function toViewBoxPoint(svg: SVGSVGElement, clientX: number, clientY: number): DOMPoint | null {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
}

export function SkillTreeCanvas({
  layout,
  selectedId,
  onSelect,
  nodeLabel,
  weekLabel,
  futureTipLabel,
  treeLabel,
  motionEnabled,
  zoomStep,
}: SkillTreeCanvasProps) {
  const [camera, setCamera] = useState<Camera>(IDLE)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; camX: number; camY: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  /** Phóng/thu quanh một điểm neo (toạ độ viewBox) — điểm neo đứng yên trên màn hình. */
  const zoomAt = useCallback((factor: number, anchorX: number, anchorY: number) => {
    setCamera((cam) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale * factor))
      const ratio = scale / cam.scale
      return { scale, x: anchorX - (anchorX - cam.x) * ratio, y: anchorY - (anchorY - cam.y) * ratio }
    })
  }, [])

  // Nút ± neo vào TÂM khung nhìn (xMidYMid ⇒ tâm viewBox = tâm khung). Bản trước chỉ nhân scale
  // quanh gốc (0,0) nên mỗi nấc zoom lại trôi khung nhìn về góc — node đang học bay mất.
  const zoomBy = useCallback(
    (factor: number) => zoomAt(factor, layout.width / 2, layout.height / 2),
    [zoomAt, layout.width, layout.height],
  )

  // Zoom bằng con lăn: listener gắn tay, KHÔNG qua JSX `onWheel`, vì hai bẫy đã trả giá trên prod:
  //  1. React gắn wheel dạng passive ⇒ `preventDefault()` trong JSX là no-op — vừa zoom cây vừa
  //     cuộn trang.
  //  2. Đọc `event.currentTarget` BÊN TRONG updater của `setCamera` thì updater chạy ở render
  //     phase, khi React đã null hoá currentTarget ⇒ sập cả trang ngay nấc lăn đầu tiên.
  //     Mọi thứ cần từ event phải đọc xong TRƯỚC khi gọi setCamera.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const anchor = toViewBoxPoint(svg, event.clientX, event.clientY)
      if (!anchor) return
      zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, anchor.x, anchor.y)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return
      // CHƯA bắt con trỏ ở đây. setPointerCapture ngay từ pointerdown sẽ kéo mọi sự kiện sau đó về
      // <svg>, và click trên node không bao giờ bắn — cây nhìn thì đẹp mà bấm không ăn. Chỉ bắt con
      // trỏ khi người dùng thực sự kéo (vượt DRAG_SLOP).
      dragRef.current = { x: event.clientX, y: event.clientY, camX: camera.x, camY: camera.y, moved: false }
    },
    [camera.x, camera.y],
  )

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const start = dragRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.moved) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return
      start.moved = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setCamera((cam) => ({ ...cam, x: start.camX + dx, y: start.camY + dy }))
  }, [])

  const endDrag = useCallback(() => {
    dragRef.current = null
    setDragging(false)
  }, [])

  /** Kéo cây rồi nhả tay trên một node thì đó là thao tác kéo, không phải chọn node. */
  const consumedByDrag = useCallback(() => dragRef.current?.moved === true, [])

  return (
    <div className={`rt-scope relative h-full w-full ${motionEnabled ? '' : 'rt-still'}`}>
      <svg
        ref={svgRef}
        className="rt-canvas h-full w-full"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={treeLabel}
        style={{ background: 'var(--tree-paper)', cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <g id="rtLeafA">
            <path
              d="M0 0 C 9 -11, 10 -26, 0 -35 C -10 -26, -9 -11, 0 0 Z"
              fill="var(--tree-leaf-a)"
              stroke="var(--tree-ink)"
              strokeWidth="2"
            />
            <path
              d="M0 -3 L0 -30 M0 -11 L5 -17 M0 -11 L-5 -17 M0 -20 L5 -26 M0 -20 L-5 -26"
              fill="none"
              stroke="var(--tree-ink)"
              strokeWidth="1.1"
            />
          </g>
          <g id="rtLeafB">
            <path
              d="M0 0 C 9 -11, 10 -26, 0 -35 C -10 -26, -9 -11, 0 0 Z"
              fill="var(--tree-leaf-b)"
              stroke="var(--tree-ink)"
              strokeWidth="2"
            />
            <path
              d="M0 -3 L0 -30 M0 -11 L5 -17 M0 -11 L-5 -17 M0 -20 L5 -26 M0 -20 L-5 -26"
              fill="none"
              stroke="var(--tree-ink)"
              strokeWidth="1.1"
            />
          </g>
          <g id="rtLeafC">
            <path
              d="M0 0 C 8 -10, 9 -23, 0 -31 C -9 -23, -8 -10, 0 0 Z"
              fill="var(--tree-leaf-c)"
              stroke="var(--tree-ink)"
              strokeWidth="2"
            />
            <path d="M0 -3 L0 -27" fill="none" stroke="var(--tree-ink)" strokeWidth="1.1" />
          </g>
          <g id="rtBud">
            <path
              d="M0 0 C -7 -6, -7 -18, 0 -24 C 7 -18, 7 -6, 0 0 Z"
              fill="var(--tree-bud)"
              stroke="var(--tree-ink)"
              strokeWidth="2"
            />
            <path d="M0 -3 L0 -20" fill="none" stroke="var(--tree-ink)" strokeWidth="1.1" />
          </g>
          <g id="rtFlower" stroke="var(--tree-ink)" strokeWidth="2">
            <ellipse cx="0" cy="-13" rx="7" ry="11" fill="var(--tree-flower)" />
            <ellipse cx="13" cy="0" rx="11" ry="7" fill="var(--tree-flower)" />
            <ellipse cx="0" cy="13" rx="7" ry="11" fill="var(--tree-flower)" />
            <ellipse cx="-13" cy="0" rx="11" ry="7" fill="var(--tree-flower)" />
            <ellipse cx="9" cy="-9" rx="9" ry="6" fill="var(--tree-flower-lit)" transform="rotate(-45 9 -9)" />
            <ellipse cx="-9" cy="9" rx="9" ry="6" fill="var(--tree-flower-lit)" transform="rotate(-45 -9 9)" />
            <circle r="6.5" fill="#fff" />
          </g>
        </defs>

        <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
          <g>
            {/* Tán mờ phía sau tạo chiều sâu — và là thứ DUY NHẤT lay theo gió.
                Thân, cành và node đứng yên có chủ đích: một node đang đung đưa là một node khó bấm
                trúng, nhất là trên màn cảm ứng. Chuyển động ở lớp nền vẫn đủ để cây "sống". */}
            <g className="rt-sway" fill="var(--tree-canopy)" opacity="0.9">
              {layout.canopy.map((blob, i) => (
                <ellipse key={i} cx={blob.cx} cy={blob.cy} rx={blob.rx} ry={blob.ry} />
              ))}
            </g>

            {/* Thân, rễ, vân vỏ, ngọn tương lai */}
            <g fill="none" strokeLinecap="round">
              <path d={layout.trunk} stroke="var(--tree-ink)" strokeWidth="34" />
              <path d={layout.trunk} stroke="var(--tree-bark)" strokeWidth="24" />
              <path d={layout.roots} stroke="var(--tree-ink)" strokeWidth="10" />
              <path d={layout.bark} stroke="var(--tree-ink)" strokeWidth="1.6" opacity="0.65" />
              <path d={layout.futureTip} stroke="var(--tree-ghost)" strokeWidth="5" strokeDasharray="8 9" />
            </g>

            {/* Cành theo tuần */}
            {layout.branches.map((branch) => (
              <g key={branch.week} fill="none" strokeLinecap="round" opacity={branch.dim ? 0.45 : 1}>
                <path d={branch.path} stroke="var(--tree-ink)" strokeWidth={branch.strokeWidth} />
                <path d={branch.path} stroke="var(--tree-bark)" strokeWidth={branch.strokeWidth - 6} />
                <path d={branch.twigs} stroke="var(--tree-ink)" strokeWidth="4.5" />
              </g>
            ))}

            {/* Node */}
            {layout.nodes.map((node) => {
              const selected = node.id === selectedId
              const hovered = node.id === hoveredId
              return (
                <g key={node.id}>
                  <path d={node.twig} stroke="var(--tree-bark)" strokeWidth="3" fill="none" strokeLinecap="round" />
                  {/* Vòng nhịp thở của node đang học nằm NGOÀI vùng bấm: nếu để bên trong, khung
                      bao của nút phình ra co vào theo nhịp và con trỏ khó bám. */}
                  {node.motif === 'flower' && (
                    <g transform={`translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`} pointerEvents="none">
                      <circle
                        className="rt-ring-pulse"
                        r="27"
                        fill="none"
                        stroke="var(--tree-flower)"
                        strokeWidth="3"
                        strokeDasharray="4 5"
                      />
                      <circle className="rt-ring-out" r="27" fill="none" stroke="var(--tree-flower)" strokeWidth="2" />
                    </g>
                  )}
                  <g
                    className="rt-node"
                    role="button"
                    tabIndex={0}
                    aria-label={nodeLabel(node)}
                    aria-pressed={selected}
                    transform={`translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`}
                    onClick={() => {
                      if (consumedByDrag()) return
                      onSelect(node.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(node.id)
                      }
                    }}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {selected && <circle r="24" fill="none" stroke="var(--tree-ink)" strokeWidth="2.5" />}
                    {hovered && !selected && (
                      <circle r="21" fill="none" stroke="var(--tree-ink)" strokeWidth="1.5" strokeDasharray="3 3" />
                    )}
                    {node.leaves.map((leaf, i) => (
                      <g key={i} transform={`rotate(${leaf.angle}) scale(${leaf.scale})`}>
                        <use href={LEAF_HREF[leaf.kind]} />
                      </g>
                    ))}
                    {node.motif === 'flower' && <use href="#rtFlower" />}
                    {node.motif === 'bud' && <use href="#rtBud" />}
                    {node.motif === 'nub' && (
                      <circle r="7" fill="var(--tree-nub)" stroke="var(--tree-nub-line)" strokeWidth="2" />
                    )}
                    <circle className="rt-focus" r="22" />
                    <circle className="rt-hit" r="19" />
                  </g>
                </g>
              )
            })}

            {/* Nhãn tuần */}
            <g fontSize="13" className="ga-ui">
              {layout.branches.map((branch) => (
                <g key={branch.week} transform={`translate(${branch.labelX} ${branch.labelY})`} opacity={branch.dim ? 0.55 : 1}>
                  <rect
                    width="160"
                    height="21"
                    rx="10.5"
                    fill="#fff"
                    stroke={branch.dim ? 'var(--tree-nub-line)' : 'var(--tree-ink)'}
                    strokeWidth="1.5"
                    strokeDasharray={branch.dim ? '5 4' : undefined}
                  />
                  <text x="10" y="15" fill={branch.dim ? 'var(--tree-label-mute)' : 'var(--tree-ink)'}>
                    {weekLabel(branch)}
                  </text>
                </g>
              ))}
              <text x={layout.width / 2 - 62} y={70} fill="var(--tree-label-mute)" fontSize="12">
                {futureTipLabel}
              </text>
            </g>

            {/* Mặt đất */}
            <path d={layout.grass} stroke="var(--tree-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        </g>
      </svg>

      <div className="absolute right-3 top-3 flex gap-1.5">
        <CameraButton label="−" onClick={() => zoomBy(1 / zoomStep)} />
        <CameraButton label="+" onClick={() => zoomBy(zoomStep)} />
        <CameraButton label="⤢" onClick={() => setCamera(IDLE)} />
      </div>
    </div>
  )
}

function CameraButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-ga border border-ga-line bg-ga-card text-[15px] text-ga-ink transition-colors hover:bg-ga-surface"
    >
      {label}
    </button>
  )
}
