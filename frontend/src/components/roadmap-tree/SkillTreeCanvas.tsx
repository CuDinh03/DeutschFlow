'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CAMERA_IDLE,
  focusCamera,
  focusScaleFor,
  panBy,
  zoomAtPoint,
  type Camera,
} from '@/lib/roadmap-tree/camera'
import type { Branch, PlacedNode, TreeLayout } from '@/lib/roadmap-tree/treeLayout'
import '@/styles/roadmap-tree.css'

/**
 * Cây học tập — phần vẽ thuần. Không gọi API, không biết `/roadmap/me`: nhận hình học đã tính từ
 * {@link buildTreeLayout} và bắn ra id node khi người học chạm vào.
 *
 * Điều hướng bằng bàn phím là bắt buộc chứ không phải bonus: cây là một cách nhìn khác của danh
 * sách bài học, nên mọi node phải tới được bằng Tab như một nút bình thường.
 */

/** Ngưỡng px để phân biệt "bấm chọn node" với "kéo cây". */
const DRAG_SLOP = 4
const LEAF_HREF: Record<string, string> = { A: '#rtLeafA', B: '#rtLeafB', C: '#rtLeafC' }
/** Bán kính vùng bấm của node (đơn vị viewBox) — khớp `.rt-hit` r=19 bên dưới. */
const NODE_HIT_RADIUS = 19
/** Auto-focus nhắm node đang học hiện ~cỡ này trên màn hình (px). */
const FOCUS_TARGET_PX = 20
/** Nhãn tuần không được bé hơn cỡ này trên màn hình (px) — F9: cây dài co nhãn thành 6px. */
const LABEL_MIN_PX = 12.5
const LABEL_FONT = 13
const LABEL_MAX_BOOST = 2.6

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
  /** Node đang học — camera tự nhắm vào khi mở tab, và nút ⌖ quay lại nó. */
  focusNodeId: number | null
  focusLabel: string
}

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
  focusNodeId,
  focusLabel,
}: SkillTreeCanvasProps) {
  const [camera, setCamera] = useState<Camera>(CAMERA_IDLE)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; camX: number; camY: number; moved: boolean } | null>(null)
  /** Các con trỏ đang chạm — nền tảng của pinch 2 ngón. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null)
  /** Vừa pinch xong thì cú nhả tay không được tính là click chọn node. */
  const pinchedRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  /** Bật transition NGẮN HẠN khi camera nhảy có chủ đích (auto-focus / nút ⌖) — kéo/lăn thì tắt. */
  const [gliding, setGliding] = useState(false)
  const glideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  /** Cỡ khung đo được — cho auto-focus scale và nhãn screen-space. */
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const rect = svg.getBoundingClientRect()
      setFrame({ w: rect.width, h: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const glide = useCallback(() => {
    // Tôn trọng cả nút tắt chuyển động của cây lẫn cài đặt hệ điều hành.
    if (!motionEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setGliding(true)
    if (glideTimerRef.current) clearTimeout(glideTimerRef.current)
    glideTimerRef.current = setTimeout(() => setGliding(false), 500)
  }, [motionEnabled])

  /** Đưa camera về node đang học — dùng cho lần mở tab và nút ⌖. */
  const focusCurrent = useCallback(() => {
    if (focusNodeId == null) return false
    const node = layout.nodes.find((n) => n.id === focusNodeId)
    const svg = svgRef.current
    if (!node || !svg) return false
    const rect = svg.getBoundingClientRect()
    const scale = focusScaleFor(rect.width, rect.height, layout.width, layout.height, NODE_HIT_RADIUS, FOCUS_TARGET_PX)
    setCamera(focusCamera(node.x, node.y, layout.width, layout.height, scale))
    return true
  }, [focusNodeId, layout])

  // Mở tab (hoặc dữ liệu đổi hẳn) → nhắm ngay node đang học thay vì toàn cây co nhỏ (F8):
  // với lộ trình 11 tuần, mức fit biến node hoa thành chấm ~8px không bấm nổi.
  const focusedLayoutRef = useRef<TreeLayout | null>(null)
  useLayoutEffect(() => {
    if (focusedLayoutRef.current === layout) return
    if (focusCurrent()) focusedLayoutRef.current = layout
  }, [layout, focusCurrent])

  /** Phóng/thu quanh một điểm neo (toạ độ viewBox) — điểm neo đứng yên trên màn hình. */
  const zoomAt = useCallback((factor: number, anchorX: number, anchorY: number) => {
    setCamera((cam) => zoomAtPoint(cam, factor, anchorX, anchorY))
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
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointersRef.current.size === 1) pinchedRef.current = false

      if (pointersRef.current.size === 2) {
        // Ngón thứ hai chạm xuống → chuyển hẳn sang pinch: huỷ kéo-1-ngón đang dở và bắt cả hai
        // con trỏ ngay (2 ngón là cử chỉ rõ ràng, không còn nguy cơ nuốt click chọn node).
        dragRef.current = null
        pinchedRef.current = true
        setDragging(true)
        const [a, b] = Array.from(pointersRef.current.values())
        pinchRef.current = {
          dist: Math.hypot(b.x - a.x, b.y - a.y),
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
        }
        const svgEl = event.currentTarget
        pointersRef.current.forEach((_, id) => {
          try {
            svgEl.setPointerCapture(id)
          } catch {
            /* con trỏ vừa nhấc lên giữa chừng — bỏ qua */
          }
        })
        return
      }

      // CHƯA bắt con trỏ ở đây. setPointerCapture ngay từ pointerdown sẽ kéo mọi sự kiện sau đó về
      // <svg>, và click trên node không bao giờ bắn — cây nhìn thì đẹp mà bấm không ăn. Chỉ bắt con
      // trỏ khi người dùng thực sự kéo (vượt DRAG_SLOP).
      dragRef.current = { x: event.clientX, y: event.clientY, camX: camera.x, camY: camera.y, moved: false }
    },
    [camera.x, camera.y],
  )

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const tracked = pointersRef.current.get(event.pointerId)
    if (tracked) {
      tracked.x = event.clientX
      tracked.y = event.clientY
    }

    // Pinch 2 ngón: zoom quanh trung điểm + pan theo trung điểm trôi. Mọi thứ tính TRƯỚC khi gọi
    // setCamera (bẫy currentTarget-null của F1) và tính TĂNG DẦN giữa hai lần move — không giữ
    // camera gốc, nên kẹp scale ở biên không làm hình nhảy.
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const svg = svgRef.current
      if (!svg) return
      const [a, b] = Array.from(pointersRef.current.values())
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const factor = pinch.dist > 0 ? dist / pinch.dist : 1
      const anchor = toViewBoxPoint(svg, midX, midY)
      const prevMid = toViewBoxPoint(svg, pinch.midX, pinch.midY)
      pinchRef.current = { dist, midX, midY }
      if (!anchor || !prevMid) return
      const dx = anchor.x - prevMid.x
      const dy = anchor.y - prevMid.y
      setCamera((cam) => panBy(zoomAtPoint(cam, factor, anchor.x, anchor.y), dx, dy))
      return
    }

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

  const endDrag = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      dragRef.current = null
      setDragging(false)
    }
  }, [])

  /** Kéo cây (hoặc pinch) rồi nhả tay trên một node thì đó là thao tác cử chỉ, không phải chọn node. */
  const consumedByDrag = useCallback(() => dragRef.current?.moved === true || pinchedRef.current, [])

  // Hệ số phóng bù cho nhãn: 1 đơn vị viewBox = meetScale·camera.scale px màn hình.
  const meetScale =
    frame.w > 0 && frame.h > 0 ? Math.min(frame.w / layout.width, frame.h / layout.height) : 1
  const labelBoost = Math.min(
    LABEL_MAX_BOOST,
    Math.max(1, LABEL_MIN_PX / (LABEL_FONT * meetScale * camera.scale)),
  )

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

        {/* Transform bằng CSS (không phải attribute) để glide được khi camera nhảy có chủ đích —
            attribute transform không ăn CSS transition. */}
        <g
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
            transition: gliding ? 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
          }}
        >
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

            {/* Nhãn tuần — screen-space: cây dài co theo fit + camera thì nhãn phóng bù (labelBoost)
                để chữ không bao giờ tụt dưới ~12.5px màn hình (F9). Pill rộng theo độ dài chuỗi
                thay vì cứng 160px — "Woche 6 · Tag 23–26" tiếng nào cũng vừa (T4). */}
            <g fontSize={LABEL_FONT} className="ga-ui">
              {layout.branches.map((branch) => {
                const label = weekLabel(branch)
                const pillWidth = Math.max(72, Math.round(label.length * 7.2) + 20)
                return (
                  <g
                    key={branch.week}
                    transform={`translate(${branch.labelX} ${branch.labelY}) scale(${labelBoost.toFixed(3)})`}
                    opacity={branch.dim ? 0.55 : 1}
                  >
                    <rect
                      width={pillWidth}
                      height="21"
                      rx="10.5"
                      fill="#fff"
                      stroke={branch.dim ? 'var(--tree-nub-line)' : 'var(--tree-ink)'}
                      strokeWidth="1.5"
                      strokeDasharray={branch.dim ? '5 4' : undefined}
                    />
                    <text x="10" y="15" fill={branch.dim ? 'var(--tree-label-mute)' : 'var(--tree-ink)'}>
                      {label}
                    </text>
                  </g>
                )
              })}
              <g transform={`translate(${layout.width / 2 - 62} 70) scale(${labelBoost.toFixed(3)})`}>
                <text fill="var(--tree-label-mute)" fontSize="12">
                  {futureTipLabel}
                </text>
              </g>
            </g>

            {/* Mặt đất */}
            <path d={layout.grass} stroke="var(--tree-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        </g>
      </svg>

      <div className="absolute right-3 top-3 flex gap-1.5">
        <CameraButton label="−" onClick={() => zoomBy(1 / zoomStep)} />
        <CameraButton label="+" onClick={() => zoomBy(zoomStep)} />
        <CameraButton
          label="⌖"
          ariaLabel={focusLabel}
          onClick={() => {
            glide()
            focusCurrent()
          }}
        />
        <CameraButton label="⤢" onClick={() => setCamera(CAMERA_IDLE)} />
      </div>
    </div>
  )
}

function CameraButton({
  label,
  onClick,
  ariaLabel,
}: {
  label: string
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      title={ariaLabel}
      className="grid h-8 w-8 place-items-center rounded-ga border border-ga-line bg-ga-card text-[15px] text-ga-ink transition-colors hover:bg-ga-surface"
    >
      {label}
    </button>
  )
}
