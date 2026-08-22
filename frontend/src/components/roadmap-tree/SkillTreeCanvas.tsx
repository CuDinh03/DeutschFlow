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
import type { RitualPlan } from '@/lib/roadmap-tree/ritual'
import type { Branch, PlacedNode, TreeLayout } from '@/lib/roadmap-tree/treeLayout'
import type { Skill } from '@/lib/skills'
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
  /**
   * Kỹ năng đã đạt (≥70%) của node hoa — mỗi cánh hoa là một kỹ năng, cánh tô màu kỹ năng khi đạt
   * (N2). Null/undefined khi chưa có dữ liệu: hoa vẽ bản mặc định, không đổi hình khi đang tải.
   */
  flowerMastery?: Partial<Record<Skill, boolean>> | null
  /**
   * Nghi thức trở về đang diễn (≤2,5s) — canvas chỉ gắn class `rt-rit-*` theo kế hoạch, không
   * giữ timer: tab sở hữu vòng đời và gỡ prop khi xong. Null = cây tĩnh lặng.
   */
  ritual?: RitualPlan | null
  /**
   * Điểm camera nhắm tới theo yêu cầu (glide) — đổi `seq` để bắn lại cùng một node. Dùng cho bậc 2
   * của nghi thức: camera lướt từ hoa vừa hoá lá sang hoa kế.
   */
  cameraTarget?: { id: number; seq: number } | null
  /**
   * Node camera nhắm lúc mở tab — mặc định `focusNodeId`. Nghi thức đặt nó vào node vừa luyện để
   * bậc 1–2 diễn ngay trong khung nhìn, thay vì mở thẳng ở hoa kế rồi nhảy ngược lại.
   */
  autoFocusId?: number | null
}

/**
 * Hoa kỹ năng botanical v2: 4 cánh CHÍNH theo 4 hướng = 4 kỹ năng, đúng thứ tự trình bày của panel
 * (trên=Nghe, phải=Đọc, dưới=Nói, trái=Viết — hai chỗ phải kể cùng một câu chuyện), lệch xoay/scale
 * để không cánh nào sao chép hệt nhau. Cánh đạt: gradient màu kỹ năng (giảm bão hoà) + lớp lót màu
 * mềm phía sau; cánh chưa đạt: ngà ấm CÓ cấu trúc — hoa 0/4 kỹ năng vẫn là một bông hoàn chỉnh.
 */
const SKILL_PETALS: { skill: Skill; rotate: number; scale: number; petal: string }[] = [
  { skill: 'hoeren', rotate: 1, scale: 1, petal: '#rtPetP1' },
  { skill: 'lesen', rotate: 90, scale: 1.03, petal: '#rtPetP3' },
  { skill: 'sprechen', rotate: 182, scale: 0.98, petal: '#rtPetP4' },
  { skill: 'schreiben', rotate: 271, scale: 1, petal: '#rtPetP2' },
]
const SKILL_PETAL_FILL: Record<Skill, string> = {
  hoeren: 'url(#rtGSkillH)',
  lesen: 'url(#rtGSkillL)',
  sprechen: 'url(#rtGSkillS)',
  schreiben: 'url(#rtGSkillW)',
}
/** Lớp lót mềm sau cánh đã đạt — thay cho halo stroke (halo render thành vệt lệch ở mọi cỡ). */
const SKILL_PETAL_UNDER: Record<Skill, string> = {
  hoeren: '#5B82CE',
  lesen: '#5E9150',
  sprechen: '#DE8A43',
  schreiben: '#7E5EC4',
}
/** 4 cánh chéo ivory phía sau — bông luôn đủ 8 cánh dù chưa đạt kỹ năng nào. */
const BACK_PETALS = [
  { rotate: 45, scale: 0.86, petal: '#rtPetP2' },
  { rotate: 136, scale: 0.88, petal: '#rtPetP4' },
  { rotate: 224, scale: 0.84, petal: '#rtPetP3' },
  { rotate: 315, scale: 0.87, petal: '#rtPetP2' },
] as const

function FlowerWithSkills({
  mastery,
  ritualSkill,
  ritualTier,
}: {
  mastery: Partial<Record<Skill, boolean>>
  /** Cánh đang diễn nghi thức: bậc 0 nhún, bậc ≥1 bung + nhận màu + 2 hạt phấn. */
  ritualSkill?: Skill | null
  ritualTier?: number
}) {
  const anyMastered = SKILL_PETALS.some((p) => mastery[p.skill])
  return (
    <g>
      {SKILL_PETALS.filter((p) => mastery[p.skill]).map((p) => (
        <g key={`under-${p.skill}`} transform={`rotate(${p.rotate}) scale(${(p.scale * 1.07).toFixed(3)})`}>
          <use href={p.petal} fill={SKILL_PETAL_UNDER[p.skill]} opacity="0.15" />
        </g>
      ))}
      {BACK_PETALS.map((p, i) => (
        <g key={i} transform={`rotate(${p.rotate}) scale(${p.scale})`}>
          <use
            href={p.petal}
            fill="url(#rtGIvory)"
            stroke="var(--tree-ink)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </g>
      ))}
      {SKILL_PETALS.map((p) => {
        const mastered = mastery[p.skill] === true
        const celebrating = ritualSkill === p.skill
        // Animation CSS ghi đè attribute transform của SVG, nên lớp diễn nằm TRONG g xoay.
        const ritualClass = !celebrating
          ? undefined
          : (ritualTier ?? 0) >= 1
            ? 'rt-rit-petal-gain'
            : 'rt-rit-petal-nudge'
        return (
          <g
            key={p.skill}
            data-skill-petal={p.skill}
            data-mastered={mastered}
            data-ritual={celebrating ? ritualClass : undefined}
            transform={`rotate(${p.rotate}) scale(${p.scale})`}
          >
            <g className={ritualClass}>
              <use
                href={p.petal}
                fill={mastered ? SKILL_PETAL_FILL[p.skill] : 'url(#rtGIvory)'}
                stroke="var(--tree-ink)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              {mastered ? <use href="#rtPetHi" opacity="0.35" /> : <use href="#rtPetShade" />}
            </g>
            {celebrating && (ritualTier ?? 0) >= 1 && (
              <g pointerEvents="none">
                <circle className="rt-rit-pollen" cx="-2" cy="-16" r="1.2" fill="var(--tree-aura)" />
                <circle className="rt-rit-pollen rt-p2" cx="3" cy="-13" r="0.9" fill="var(--tree-aura-2)" />
              </g>
            )}
          </g>
        )
      })}
      <use href="#rtCenter" />
      {anyMastered && (
        <>
          <circle cx="4.6" cy="-6.4" r="1" fill="#F4BE24" opacity="0.85" />
          <circle cx="6.6" cy="-3.4" r="0.7" fill="#F4BE24" opacity="0.7" />
        </>
      )}
    </g>
  )
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
  flowerMastery,
  ritual,
  cameraTarget,
  autoFocusId,
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

  /** Đưa camera nhắm một node cụ thể ở mức zoom auto-focus. */
  const focusOn = useCallback(
    (id: number | null) => {
      if (id == null) return false
      const node = layout.nodes.find((n) => n.id === id)
      const svg = svgRef.current
      if (!node || !svg) return false
      const rect = svg.getBoundingClientRect()
      const scale = focusScaleFor(rect.width, rect.height, layout.width, layout.height, NODE_HIT_RADIUS, FOCUS_TARGET_PX)
      setCamera(focusCamera(node.x, node.y, layout.width, layout.height, scale))
      return true
    },
    [layout],
  )

  /** Đưa camera về node đang học — dùng cho nút ⌖. */
  const focusCurrent = useCallback(() => focusOn(focusNodeId), [focusOn, focusNodeId])

  // Mở tab (hoặc dữ liệu đổi hẳn) → nhắm ngay node đang học thay vì toàn cây co nhỏ (F8):
  // với lộ trình 11 tuần, mức fit biến node hoa thành chấm ~8px không bấm nổi.
  const focusedLayoutRef = useRef<TreeLayout | null>(null)
  useLayoutEffect(() => {
    if (focusedLayoutRef.current === layout) return
    const preferred = autoFocusId !== undefined ? autoFocusId : focusNodeId
    if (focusOn(preferred) || focusOn(focusNodeId)) focusedLayoutRef.current = layout
  }, [layout, focusOn, autoFocusId, focusNodeId])

  // Camera theo yêu cầu (bậc 2 nghi thức): lướt sang node được chỉ. `seq` đổi ⇒ bắn lại.
  useEffect(() => {
    if (!cameraTarget) return
    glide()
    focusOn(cameraTarget.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo seq/id, không theo glide/focusOn
  }, [cameraTarget?.id, cameraTarget?.seq])

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
        {/* Bộ botanical v2 (Lernbaum) — nguồn chuẩn: artifact "Lernbaum v2". Footprint và điểm neo
            GIỮ NGUYÊN bản cũ (lá mọc từ 0,0 hướng lên, hoa/nụ neo tâm) nên treeLayout không đổi.
            Chỉ gradient + nét — KHÔNG filter (46 node × 3 lá phải rẻ như bản cũ). */}
        <defs>
          <linearGradient id="rtGA2" x1="0.15" y1="1" x2="0.5" y2="0">
            <stop offset="0" stopColor="#347D75" />
            <stop offset="0.55" stopColor="#58AFA3" />
            <stop offset="1" stopColor="#8CCDBF" />
          </linearGradient>
          <linearGradient id="rtGB2" x1="0.2" y1="1" x2="0.55" y2="0">
            <stop offset="0" stopColor="#4E8F67" />
            <stop offset="0.55" stopColor="#8EBF7A" />
            <stop offset="1" stopColor="#B5DA9C" />
          </linearGradient>
          <linearGradient id="rtGC2" x1="0.2" y1="1" x2="0.5" y2="0">
            <stop offset="0" stopColor="#8CC46B" />
            <stop offset="1" stopColor="#D2EAB4" />
          </linearGradient>
          <linearGradient id="rtGPet" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#E09A28" />
            <stop offset="0.5" stopColor="#F6C63A" />
            <stop offset="1" stopColor="#FFEFB8" />
          </linearGradient>
          <linearGradient id="rtGPetBack" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#CE8A26" />
            <stop offset="1" stopColor="#F3D98F" />
          </linearGradient>
          <linearGradient id="rtGIvory" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#E9DDC4" />
            <stop offset="0.55" stopColor="#F7F2E8" />
            <stop offset="1" stopColor="#FFFBF2" />
          </linearGradient>
          <linearGradient id="rtGBudPetal" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#E4D6B4" />
            <stop offset="1" stopColor="#FBF6EA" />
          </linearGradient>
          <radialGradient id="rtGCen" cx="0.5" cy="0.42" r="0.75">
            <stop offset="0" stopColor="#FFF4D4" />
            <stop offset="0.68" stopColor="#F4BE24" />
            <stop offset="1" stopColor="#E89B2C" />
          </radialGradient>
          <linearGradient id="rtGSkillH" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#3E5FA8" />
            <stop offset="0.55" stopColor="#5B82CE" />
            <stop offset="1" stopColor="#A9C2EE" />
          </linearGradient>
          <linearGradient id="rtGSkillL" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#3F6B36" />
            <stop offset="0.55" stopColor="#5E9150" />
            <stop offset="1" stopColor="#A6C892" />
          </linearGradient>
          <linearGradient id="rtGSkillS" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#B4652A" />
            <stop offset="0.55" stopColor="#DE8A43" />
            <stop offset="1" stopColor="#F5C58F" />
          </linearGradient>
          <linearGradient id="rtGSkillW" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#5A3F99" />
            <stop offset="0.55" stopColor="#7E5EC4" />
            <stop offset="1" stopColor="#C3ACE8" />
          </linearGradient>

          {/* Lá A: thon dài, trưởng thành — trái phồng hơn, ngọn nghiêng ~2° phải */}
          <g id="rtLeafA">
            <path
              d="M0 0 C -3 -4, -8.5 -10, -9.5 -18 C -10.2 -25, -6.5 -32, 1.2 -36.5 C 6.8 -31.5, 9.6 -24, 8.4 -16.5 C 7.4 -9.5, 3 -4, 0 0 Z"
              fill="url(#rtGA2)"
              stroke="var(--tree-ink)"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path d="M1.5 -5 C 6 -10, 7.6 -18, 5.6 -26 C 7.9 -19.5, 7.3 -11, 3.4 -6 Z" fill="#2E6B62" opacity="0.2" />
            <path d="M-2 -8 C -4.5 -13, -4.8 -22, -2.6 -29 C -1.2 -24, -1 -14, -2 -8 Z" fill="#8ED2C4" opacity="0.45" />
            <path
              d="M0 -1.5 C 0.6 -9, 0.2 -18, 1 -32"
              fill="none"
              stroke="#24564F"
              strokeWidth="1.4"
              opacity="0.75"
              strokeLinecap="round"
            />
            <path
              d="M0.2 -8.2 C -2.2 -9.6, -4.2 -11.4, -5.6 -13.8 M0.3 -13.6 C -2.4 -15, -4.6 -17.2, -6.2 -20 M0.5 -19.4 C -1.8 -20.8, -3.8 -22.8, -5 -25.4 M0.7 -25 C -1.2 -26.4, -2.6 -28, -3.4 -30 M0.3 -6.4 C 2.6 -7.8, 4.4 -9.6, 5.6 -12 M0.4 -11.2 C 2.9 -12.6, 4.9 -14.6, 6.1 -17.4 M0.6 -16.8 C 3 -18.2, 4.8 -20.2, 5.8 -23 M0.8 -22.6 C 2.8 -24, 4.2 -25.8, 4.8 -28.2 M1 -28 C 2.2 -29.2, 3.2 -30.4, 3.7 -32.2"
              fill="none"
              stroke="#24564F"
              strokeWidth="0.8"
              opacity="0.45"
              strokeLinecap="round"
            />
            <path
              d="M-3 -1.5 C -1.5 -3.5, 1.5 -3.5, 3 -1.5 C 1.5 -0.5, -1.5 -0.5, -3 -1.5 Z"
              fill="#24564F"
              opacity="0.28"
            />
          </g>
          {/* Lá B: bầu, đầy đặn — ngọn nghiêng nhẹ trái, moss green */}
          <g id="rtLeafB">
            <path
              d="M0 0 C -4.5 -3.5, -11 -9, -12 -16.5 C -12.8 -23.5, -7.5 -30, -0.8 -33.5 C 6.5 -30.5, 11.8 -24.5, 11 -17 C 10.3 -10, 4.5 -4, 0 0 Z"
              fill="url(#rtGB2)"
              stroke="var(--tree-ink)"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path d="M-2 -5 C -7 -9.5, -9.4 -16.5, -8 -24 C -9.9 -17.5, -8.9 -10.5, -4.4 -5.8 Z" fill="#3D7A55" opacity="0.2" />
            <path d="M2 -8 C 4.6 -13, 5 -21, 2.8 -27.5 C 1.4 -22.5, 1.2 -13.5, 2 -8 Z" fill="#B4DCA0" opacity="0.5" />
            <path
              d="M0 -1.5 C -0.9 -8, -0.3 -16, -0.8 -29.5"
              fill="none"
              stroke="#35684A"
              strokeWidth="1.4"
              opacity="0.75"
              strokeLinecap="round"
            />
            <path
              d="M-0.4 -7.4 C -3.4 -8.8, -6 -10.6, -7.8 -13.2 M-0.5 -12.4 C -3.6 -13.8, -6.4 -15.8, -8.4 -18.8 M-0.6 -17.6 C -3.4 -19, -5.8 -21, -7.4 -23.8 M-0.7 -22.6 C -3 -24, -4.8 -25.8, -5.9 -28.2 M-0.3 -9.6 C 2.8 -11, 5.4 -12.8, 7.2 -15.4 M-0.4 -14.8 C 2.6 -16.2, 5.2 -18.2, 6.9 -21 M-0.5 -20 C 2 -21.4, 4.2 -23.2, 5.5 -25.8 M-0.6 -25 C 1.4 -26.4, 3 -28, 3.9 -30.1"
              fill="none"
              stroke="#35684A"
              strokeWidth="0.8"
              opacity="0.45"
              strokeLinecap="round"
            />
            <path
              d="M-4.6 -1.8 C -2.3 -3.8, 2.3 -3.8, 4.6 -1.8 C 2.3 -0.6, -2.3 -0.6, -4.6 -1.8 Z"
              fill="#35684A"
              opacity="0.26"
            />
          </g>
          {/* Lá C: lá non phụ hoạ — nhỏ, ít gân, im lặng */}
          <g id="rtLeafC">
            <path
              d="M0 0 C -2.5 -3, -6 -7.5, -6.5 -13 C -6.8 -18.5, -3.5 -24, 0.6 -27 C 4.5 -23.5, 6.6 -18, 6 -12.5 C 5.4 -7.5, 2.5 -3, 0 0 Z"
              fill="url(#rtGC2)"
              stroke="var(--tree-ink)"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M-1.3 -6 C -3.1 -9.5, -3.6 -15, -2.4 -20 C -1.7 -15.5, -1.4 -10, -1.3 -6 Z" fill="#E4F3CC" opacity="0.5" />
            <path
              d="M0 -1.5 C 0.3 -8, 0.1 -15, 0.5 -24"
              fill="none"
              stroke="#5E8F3E"
              strokeWidth="1.1"
              opacity="0.65"
              strokeLinecap="round"
            />
            <path
              d="M0.1 -7.5 C -1.6 -8.7, -3 -10.1, -4 -12 M0.2 -13 C -1.7 -14.3, -3.2 -15.9, -4.2 -18 M0.3 -10 C 1.9 -11.3, 3.3 -12.9, 4.2 -15 M0.4 -16 C 1.8 -17.2, 3 -18.7, 3.7 -20.6"
              fill="none"
              stroke="#5E8F3E"
              strokeWidth="0.7"
              opacity="0.4"
              strokeLinecap="round"
            />
          </g>
          {/* Nụ: 2 đài + 3 cánh khép chồng lớp + chấm vàng đầu nụ — đọc rõ là NỤ HOA.
              Không có cuống riêng: cuống là twig của node, vẽ ở tầng layout. */}
          <g id="rtBud">
            <path
              d="M-0.6 0.5 C -4.6 -0.4, -7.6 -3.6, -8.2 -8.4 C -4.8 -7.2, -1.9 -4.6, -0.3 -1.2 Z"
              fill="#7FAF77"
              stroke="var(--tree-ink)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M0.7 0.5 C 4.9 -0.6, 7.8 -4.2, 8 -9.2 C 4.6 -7.7, 1.8 -4.8, 0.4 -1.2 Z"
              fill="#8EBF7A"
              stroke="var(--tree-ink)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M-0.6 -2.6 C -4.8 -5.4, -6.6 -11, -5.4 -17.6 C -4.4 -19.8, -2.8 -21, -1.6 -20.6 C -2.6 -14.6, -2 -7.8, -0.6 -2.6 Z"
              fill="#ECDFC4"
              stroke="var(--tree-ink)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M0.8 -2.8 C 5 -5.8, 6.6 -11.6, 5.2 -18 C 4.2 -20.2, 2.6 -21.2, 1.6 -20.8 C 2.6 -14.6, 1.9 -7.8, 0.8 -2.8 Z"
              fill="#F1E7D2"
              stroke="var(--tree-ink)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M0 -1.8 C -3.4 -6.8, -3.9 -14.6, -0.4 -22.8 C 3.4 -15.2, 3.4 -7.2, 0 -1.8 Z"
              fill="url(#rtGBudPetal)"
              stroke="var(--tree-ink)"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M-0.6 -6 C -0.9 -11, -0.7 -16, -0.3 -20"
              fill="none"
              stroke="#C9B78F"
              strokeWidth="0.8"
              opacity="0.5"
              strokeLinecap="round"
            />
            <circle cx="-0.3" cy="-21.6" r="1.7" fill="#F4BE24" stroke="#C77F1F" strokeWidth="0.8" />
            <circle cx="-0.75" cy="-22.1" r="0.5" fill="#FFF4D4" />
          </g>
          {/* Hạt mầm ngủ — node khoá: khoá nhưng là một sự sống đang chờ */}
          <g id="rtNub">
            <ellipse cx="0" cy="-1" rx="6.5" ry="7.5" fill="var(--tree-nub)" stroke="var(--tree-nub-line)" strokeWidth="2" />
            <path
              d="M0 -8 C 0 -12, 4 -12.5, 4 -10 C 4 -8.4, 2 -8, 0.6 -8.6"
              fill="none"
              stroke="var(--tree-nub-line)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path d="M-2.5 -2 C -1 -4, 1 -4, 2.5 -2" fill="none" stroke="var(--tree-ghost)" strokeWidth="1.2" />
          </g>

          {/* 4 biến thể cánh hoa (path trần, tô màu lúc use) + chi tiết + tâm nhị */}
          <path
            id="rtPetP1"
            d="M0 -3.6 C -3.4 -5.4, -5 -10.2, -4 -14.6 C -3.2 -17.8, -0.6 -19.8, 0.7 -19.1 C 3.3 -17.6, 4.5 -12.4, 3.2 -7.6 C 2.4 -5.4, 1.2 -4, 0 -3.6 Z"
          />
          <path
            id="rtPetP2"
            d="M0 -3.6 C -4 -5.2, -5.6 -9.6, -4.8 -13.6 C -4 -16.9, -1.4 -18.9, -0.4 -18.2 C 2.8 -16.9, 4.9 -11.9, 3.7 -7.3 C 2.8 -5.1, 1.3 -3.9, 0 -3.6 Z"
          />
          <path
            id="rtPetP3"
            d="M0 -3.7 C -2.9 -5.5, -4.2 -10.8, -3.4 -15.4 C -2.8 -18.6, -0.4 -20.6, 0.5 -19.9 C 2.7 -18.3, 3.8 -12.6, 2.7 -7.5 C 2 -5.3, 1 -4, 0 -3.7 Z"
          />
          <path
            id="rtPetP4"
            d="M0 -3.6 C -3.1 -5.6, -4.4 -10.4, -3.6 -14.8 C -2.9 -17.9, -0.2 -19.6, 0.9 -18.8 C 3.7 -17, 5 -11.7, 3.5 -7.2 C 2.6 -5.2, 1.2 -3.9, 0 -3.6 Z"
          />
          <path
            id="rtPetShade"
            d="M-2.1 -4.9 C -2.7 -7.1, -2.6 -9.1, -1.9 -10.7 C -0.7 -8.7, 0.6 -6.7, 1.8 -5.1 C 0.6 -4.3, -0.9 -4.3, -2.1 -4.9 Z"
            fill="#9C6114"
            opacity="0.15"
          />
          <path
            id="rtPetHi"
            d="M-0.7 -7.4 C -1.2 -10.6, -1 -13.9, -0.2 -16.4 C 0.7 -13.9, 0.9 -10.4, 0.4 -7.6 Z"
            fill="#FFF6D6"
            opacity="0.5"
          />
          <g id="rtCenter">
            <circle r="5" fill="url(#rtGCen)" stroke="#C77F1F" strokeWidth="1.2" />
            <path
              d="M0 -3.4 L0 -4.4 M2.4 -2.4 L3.1 -3.1 M3.4 0 L4.4 0 M2.4 2.4 L3.1 3.1 M0 3.4 L0 4.4 M-2.4 2.4 L-3.1 3.1 M-3.4 0 L-4.4 0 M-2.4 -2.4 L-3.1 -3.1"
              stroke="#C77F1F"
              strokeWidth="0.8"
              opacity="0.6"
              strokeLinecap="round"
            />
            <circle cx="2.2" cy="0" r="0.75" fill="#A9641C" />
            <circle cx="1.1" cy="1.9" r="0.75" fill="#A9641C" />
            <circle cx="-1.1" cy="1.9" r="0.75" fill="#A9641C" />
            <circle cx="-2.2" cy="0" r="0.75" fill="#A9641C" />
            <circle cx="-1.1" cy="-1.9" r="0.75" fill="#A9641C" />
            <circle cx="1.1" cy="-1.9" r="0.75" fill="#A9641C" />
            <circle r="0.95" fill="#8F5417" />
          </g>
          {/* Hoa vàng mặc định (chưa có dữ liệu kỹ năng): 8 cánh, lớp sau sẫm tạo overlap depth */}
          <g id="rtFlower">
            <g transform="rotate(44) scale(0.93)">
              <use href="#rtPetP2" fill="url(#rtGPetBack)" stroke="var(--tree-ink)" strokeWidth="1.4" strokeLinejoin="round" />
            </g>
            <g transform="rotate(137) scale(0.96)">
              <use href="#rtPetP4" fill="url(#rtGPetBack)" stroke="var(--tree-ink)" strokeWidth="1.4" strokeLinejoin="round" />
            </g>
            <g transform="rotate(226) scale(0.91)">
              <use href="#rtPetP3" fill="url(#rtGPetBack)" stroke="var(--tree-ink)" strokeWidth="1.4" strokeLinejoin="round" />
            </g>
            <g transform="rotate(313) scale(0.95)">
              <use href="#rtPetP2" fill="url(#rtGPetBack)" stroke="var(--tree-ink)" strokeWidth="1.4" strokeLinejoin="round" />
            </g>
            <g transform="rotate(2)">
              <use href="#rtPetP1" fill="url(#rtGPet)" stroke="var(--tree-ink)" strokeWidth="1.6" strokeLinejoin="round" />
              <use href="#rtPetShade" />
              <use href="#rtPetHi" />
            </g>
            <g transform="rotate(91) scale(1.04)">
              <use href="#rtPetP3" fill="url(#rtGPet)" stroke="var(--tree-ink)" strokeWidth="1.6" strokeLinejoin="round" />
              <use href="#rtPetShade" />
              <use href="#rtPetHi" />
            </g>
            <g transform="rotate(183) scale(0.98)">
              <use href="#rtPetP4" fill="url(#rtGPet)" stroke="var(--tree-ink)" strokeWidth="1.6" strokeLinejoin="round" />
              <use href="#rtPetShade" />
              <use href="#rtPetHi" />
            </g>
            <g transform="rotate(272) scale(1.01)">
              <use href="#rtPetP2" fill="url(#rtGPet)" stroke="var(--tree-ink)" strokeWidth="1.6" strokeLinejoin="round" />
              <use href="#rtPetShade" />
              <use href="#rtPetHi" />
            </g>
            <use href="#rtCenter" />
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
              {/* Bậc 3 — tuần khép tán: mảng màu nước đậm thêm một tông + 5 hạt phấn bay chậm
                  qua tán một lượt rồi thôi. Lớp phủ nằm trong nhóm lay để đi cùng tán. */}
              {ritual?.week != null &&
                layout.canopy
                  .filter((blob) => blob.week === ritual.week)
                  .map((blob) => (
                    <g key={`close-${blob.week}`} data-ritual="week-close" pointerEvents="none">
                      <ellipse
                        className="rt-rit-canopy-close"
                        cx={blob.cx}
                        cy={blob.cy}
                        rx={blob.rx}
                        ry={blob.ry}
                        fill="var(--tree-canopy-deep)"
                        opacity="0"
                      />
                      {[0, 1, 2, 3, 4].map((k) => (
                        <circle
                          key={k}
                          className={`rt-rit-week-pollen rt-p${k + 1}`}
                          cx={blob.cx - blob.rx * 0.6 + k * blob.rx * 0.3}
                          cy={blob.cy + blob.ry * 0.5 - (k % 2) * 14}
                          r={k % 2 ? 1.3 : 1.7}
                          fill="var(--tree-aura)"
                          opacity="0"
                        />
                      ))}
                    </g>
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
              const ritualHere = ritual?.nodeId === node.id ? ritual : null
              /** Bậc 2: node này vừa hoá lá — diễn hoa khép + lá mở. */
              const leafing = ritualHere != null && ritualHere.tier >= 2 && node.motif === 'leaf'
              /** Bậc 2: hoa kế tiếp nở từ nụ. */
              const blooming = ritual != null && ritual.tier >= 2 && ritual.nextNodeId === node.id && node.motif === 'flower'
              return (
                <g key={node.id}>
                  <path d={node.twig} stroke="var(--tree-bark)" strokeWidth="3" fill="none" strokeLinecap="round" />
                  {/* Vòng nhịp thở của node đang học nằm NGOÀI vùng bấm: nếu để bên trong, khung
                      bao của nút phình ra co vào theo nhịp và con trỏ khó bám. */}
                  {node.motif === 'flower' && (
                    <g transform={`translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`} pointerEvents="none">
                      {/* Nhịp thở 5 lớp lệch pha (xem roadmap-tree.css): gạch xoay chậm + hít–thở
                          bất đối xứng + hào quang ngược pha + 2 gợn lan so le + 3 đốm phấn.
                          Gạch dasharray KHÔNG đều — botanical aura, không phải ring chọn item game. */}
                      <circle className="rt-ring-glow" r="22" fill="none" stroke="var(--tree-aura)" strokeWidth="6" />
                      <g className="rt-ring-spin">
                        <circle
                          className="rt-ring-pulse"
                          r="26"
                          fill="none"
                          stroke="var(--tree-aura)"
                          strokeWidth="2.4"
                          strokeDasharray="5 8 2 10"
                        />
                      </g>
                      <circle className="rt-ring-out" r="26" fill="none" stroke="var(--tree-aura)" strokeWidth="1.8" />
                      <circle className="rt-ring-out rt-r2" r="26" fill="none" stroke="var(--tree-aura-2)" strokeWidth="1.4" />
                      <g className="rt-spark rt-s1"><circle cx="2" cy="-29" r="1.5" fill="var(--tree-aura)" /></g>
                      <g className="rt-spark rt-s2"><circle cx="25" cy="16" r="1.2" fill="var(--tree-aura)" /></g>
                      <g className="rt-spark rt-s3"><circle cx="-26" cy="13" r="1.3" fill="var(--tree-aura)" /></g>
                      <circle cx="14" cy="-22" r="1" fill="var(--tree-aura-2)" opacity="0.3" />
                      <circle cx="-19" cy="-16" r="0.8" fill="var(--tree-aura-2)" opacity="0.3" />
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
                    <g className={leafing ? 'rt-rit-leaf-in' : undefined} data-ritual={leafing ? 'leaf-in' : undefined}>
                      {node.leaves.map((leaf, i) => (
                        <g key={i} transform={`rotate(${leaf.angle}) scale(${leaf.scale})`}>
                          <use href={LEAF_HREF[leaf.kind]} />
                        </g>
                      ))}
                    </g>
                    {leafing && (
                      // Bóng hoa đủ 4 cánh khép lại rồi tan — cánh vừa đạt vẫn bung trước (bậc 1).
                      <g className="rt-rit-flower-out" data-ritual="flower-out" pointerEvents="none">
                        <FlowerWithSkills
                          mastery={{ hoeren: true, lesen: true, sprechen: true, schreiben: true }}
                          ritualSkill={ritualHere.skill}
                          ritualTier={1}
                        />
                      </g>
                    )}
                    {blooming && (
                      <g className="rt-rit-bud-out" data-ritual="bud-out" pointerEvents="none">
                        <use href="#rtBud" />
                      </g>
                    )}
                    {node.motif === 'flower' && (
                      <g className={blooming ? 'rt-rit-flower-in' : undefined} data-ritual={blooming ? 'flower-in' : undefined}>
                        {flowerMastery ? (
                          <FlowerWithSkills
                            mastery={flowerMastery}
                            ritualSkill={ritualHere?.skill ?? null}
                            ritualTier={ritualHere?.tier}
                          />
                        ) : (
                          <use href="#rtFlower" />
                        )}
                      </g>
                    )}
                    {node.motif === 'bud' && <use href="#rtBud" />}
                    {node.motif === 'nub' && <use href="#rtNub" />}
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
                    <text
                      x="10"
                      y="15"
                      fill={branch.dim ? 'var(--tree-label-mute)' : branch.complete ? 'var(--tree-label-done)' : 'var(--tree-ink)'}
                      data-week-complete={branch.complete || undefined}
                    >
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
