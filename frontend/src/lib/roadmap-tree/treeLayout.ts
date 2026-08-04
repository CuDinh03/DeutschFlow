// Hình học của "Cây học tập" — thuần, không React, không DOM.
//
// Cây mọc TỪ DƯỚI LÊN: mỗi tuần của giáo trình là một tầng cành, mỗi ngày là một node trên cành đó.
// Đây là trục duy nhất khớp dữ liệu thật: bốn kỹ năng Nghe/Nói/Đọc/Viết nằm BÊN TRONG mỗi node
// (`POST /skill-tree/{nodeId}/practice/{skill}`), không phải cách chia node — nên cây không có
// "nhánh kỹ năng". Xem TONG_HOP_CAY_HOC_TAP_2026-08-03.md §4.2 B-6.
//
// Số node và số tuần đều co giãn theo `GET /roadmap/me` (lộ trình sinh riêng cho từng học viên),
// nên mọi kích thước ở đây được tính, không hardcode 30 ngày.

/** Bốn hình thái của một node trên cây, theo tiến độ. */
export type TreeMotif = 'leaf' | 'flower' | 'bud' | 'nub'

export interface TreeNodeInput {
  id: number
  dayNumber?: number | null
  weekNumber?: number | null
  /** "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "LOCKED" — từ `/roadmap/me`. */
  progressStatus?: string | null
  /** Trạng thái 3 mức cũ, dùng làm phương án dự phòng khi backend chưa trả `progressStatus`. */
  state: string
}

export interface PlacedLeaf {
  /** Kiểu lá: ba sắc xanh để tán không phẳng. */
  kind: 'A' | 'B' | 'C'
  angle: number
  scale: number
}

export interface PlacedNode {
  id: number
  x: number
  y: number
  motif: TreeMotif
  /** Cuống nối node vào cành, toạ độ tuyệt đối. */
  twig: string
  week: number
  dayNumber: number | null
  leaves: PlacedLeaf[]
}

export interface Branch {
  week: number
  /** −1 = cành mọc sang trái, +1 = sang phải. */
  side: -1 | 1
  path: string
  /** Các nhánh con nhỏ trên cành, thuần trang trí. */
  twigs: string
  strokeWidth: number
  /** Tuần chưa có node nào mở — vẽ mờ. */
  dim: boolean
  labelX: number
  labelY: number
  firstDay: number | null
  lastDay: number | null
}

export interface CanopyBlob {
  cx: number
  cy: number
  rx: number
  ry: number
}

export interface TreeLayout {
  width: number
  height: number
  groundY: number
  trunk: string
  roots: string
  bark: string
  /** Ngọn nét đứt vươn lên cấp kế tiếp. */
  futureTip: string
  grass: string
  branches: Branch[]
  nodes: PlacedNode[]
  canopy: CanopyBlob[]
}

const WIDTH = 520
const TRUNK_X = 256
/** Khoảng cách giữa hai tầng cành. */
const BRANCH_GAP = 70
/** Cành thấp nhất cách mặt đất bao nhiêu. */
const LOWEST_BRANCH_LIFT = 100
/** Chừa chỗ phía trên cành cao nhất cho ngọn nét đứt. */
const CROWN_HEADROOM = 110
const TRUNK_TOP_Y = 140
const NODES_PER_WEEK_FALLBACK = 5

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Điểm trên đường Bézier bậc hai — cùng loại đường dùng để vẽ cành. */
function quadPoint(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ]
}

/**
 * Tuần của một node. Ưu tiên `weekNumber` từ giáo trình; thiếu thì suy từ `dayNumber`; thiếu cả hai
 * thì gom theo thứ tự backend trả về — luôn ra một con số để không node nào rơi khỏi cây.
 */
function weekOf(node: TreeNodeInput, index: number): number {
  if (node.weekNumber != null && node.weekNumber > 0) return node.weekNumber
  if (node.dayNumber != null && node.dayNumber > 0) {
    return Math.ceil(node.dayNumber / NODES_PER_WEEK_FALLBACK)
  }
  return Math.floor(index / NODES_PER_WEEK_FALLBACK) + 1
}

function motifOf(node: TreeNodeInput): TreeMotif {
  switch (node.progressStatus) {
    case 'COMPLETED':
      return 'leaf'
    case 'IN_PROGRESS':
      return 'flower'
    case 'AVAILABLE':
      return 'bud'
    case 'LOCKED':
      return 'nub'
    default:
      break
  }
  // Backend cũ chỉ có 3 mức: "current" gộp cả đang-học lẫn đã-mở. Vẽ thành hoa — thà mời gọi hơn
  // là khoá nhầm một node học viên vào được.
  if (node.state === 'completed') return 'leaf'
  if (node.state === 'current') return 'flower'
  return 'nub'
}

/** Lá quanh một node đã xong. Suy từ `id` để tán không nhảy giữa hai lần render. */
function leavesFor(node: TreeNodeInput, motif: TreeMotif): PlacedLeaf[] {
  if (motif !== 'leaf') return []
  const kinds: PlacedLeaf['kind'][] = ['A', 'B', 'C']
  const count = 2 + (node.id % 2)
  return Array.from({ length: count }, (_, k) => ({
    kind: kinds[(node.id + k) % kinds.length],
    angle: -42 + k * 44 + (node.id % 3) * 5,
    scale: 0.82 + ((node.id + k) % 3) * 0.09,
  }))
}

function trunkPath(groundY: number): string {
  // Thân hơi lượn như nét vẽ tay: mỗi đoạn ~70px lệch nhẹ trái/phải quanh TRUNK_X.
  const segments: string[] = [`M${TRUNK_X - 4} ${groundY - 10}`]
  let y = groundY - 10
  let step = 0
  while (y > TRUNK_TOP_Y) {
    const nextY = Math.max(TRUNK_TOP_Y, y - 90)
    const lean = step % 2 === 0 ? 8 : -8
    segments.push(
      `C ${TRUNK_X + lean} ${y - 30}, ${TRUNK_X - lean} ${nextY + 30}, ${TRUNK_X + (step % 2 === 0 ? 2 : -2)} ${nextY}`,
    )
    y = nextY
    step += 1
  }
  return segments.join(' ')
}

function rootsPath(groundY: number): string {
  const y = groundY - 10
  return [
    `M${TRUNK_X - 4} ${y} C ${TRUNK_X - 32} ${y + 10}, ${TRUNK_X - 62} ${y + 14}, ${TRUNK_X - 94} ${y + 10}`,
    `M${TRUNK_X} ${y} C ${TRUNK_X + 32} ${y + 12}, ${TRUNK_X + 64} ${y + 15}, ${TRUNK_X + 94} ${y + 9}`,
    `M${TRUNK_X - 4} ${y} C ${TRUNK_X - 18} ${y + 12}, ${TRUNK_X - 28} ${y + 18}, ${TRUNK_X - 36} ${y + 26}`,
    `M${TRUNK_X} ${y} C ${TRUNK_X + 16} ${y + 14}, ${TRUNK_X + 26} ${y + 20}, ${TRUNK_X + 36} ${y + 26}`,
  ].join(' ')
}

function barkPath(groundY: number): string {
  const marks: string[] = []
  for (let y = groundY - 50; y > TRUNK_TOP_Y + 30; y -= 110) {
    marks.push(`M${TRUNK_X - 8} ${y} C ${TRUNK_X - 4} ${y - 40}, ${TRUNK_X - 8} ${y - 66}, ${TRUNK_X - 5} ${y - 102}`)
  }
  return marks.join(' ')
}

const futureTipPath = () =>
  [
    `M${TRUNK_X + 2} ${TRUNK_TOP_Y} C ${TRUNK_X - 12} ${TRUNK_TOP_Y - 34}, ${TRUNK_X - 28} ${TRUNK_TOP_Y - 58}, ${TRUNK_X - 48} ${TRUNK_TOP_Y - 82}`,
    `M${TRUNK_X + 2} ${TRUNK_TOP_Y} C ${TRUNK_X + 18} ${TRUNK_TOP_Y - 34}, ${TRUNK_X + 36} ${TRUNK_TOP_Y - 56}, ${TRUNK_X + 56} ${TRUNK_TOP_Y - 80}`,
    `M${TRUNK_X + 2} ${TRUNK_TOP_Y} C ${TRUNK_X + 2} ${TRUNK_TOP_Y - 32}, ${TRUNK_X} ${TRUNK_TOP_Y - 52}, ${TRUNK_X - 2} ${TRUNK_TOP_Y - 76}`,
  ].join(' ')

function grassPath(groundY: number): string {
  const blades = [110, 130, 150, 360, 382, 404]
    .map((x, i) => `M${x} ${groundY - (i % 2)} l${i % 2 === 0 ? -4 : 4} -${11 + (i % 3)}`)
    .join(' ')
  return `M60 ${groundY} Q ${TRUNK_X - 2} ${groundY - 18} 452 ${groundY} ${blades}`
}

/**
 * Dựng toàn bộ hình học của cây từ danh sách node của lộ trình.
 *
 * Cây cao theo số tuần thật: mỗi tuần thêm một tầng cành và đẩy mặt đất xuống, còn ngọn luôn giữ
 * nguyên độ cao — nên lộ trình dài ra thì cây vươn lên chứ cành không chồng lên nhau.
 */
export function buildTreeLayout(nodes: readonly TreeNodeInput[]): TreeLayout {
  const byWeek = new Map<number, { node: TreeNodeInput; motif: TreeMotif }[]>()
  nodes.forEach((node, index) => {
    const week = weekOf(node, index)
    const bucket = byWeek.get(week) ?? []
    bucket.push({ node, motif: motifOf(node) })
    byWeek.set(week, bucket)
  })

  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b)
  const groundY = TRUNK_TOP_Y + CROWN_HEADROOM + Math.max(0, weeks.length - 1) * BRANCH_GAP + LOWEST_BRANCH_LIFT
  const height = groundY + 20

  const branches: Branch[] = []
  const placed: PlacedNode[] = []
  const canopy: CanopyBlob[] = []

  weeks.forEach((week, tier) => {
    const side: -1 | 1 = tier % 2 === 0 ? -1 : 1
    const baseY = groundY - LOWEST_BRANCH_LIFT - tier * BRANCH_GAP
    const inset = Math.floor(tier / 2) * 5
    const start: [number, number] = [TRUNK_X, baseY]
    const control: [number, number] = [TRUNK_X + side * 81, baseY - 12]
    const end: [number, number] = [TRUNK_X + side * (161 - inset), baseY - 55]
    const strokeWidth = clamp(15 - Math.max(0, tier - 1), 8, 15)

    const bucket = byWeek.get(week) ?? []
    const days = bucket.map((b) => b.node.dayNumber).filter((d): d is number => d != null && d > 0)
    const dim = !bucket.some((b) => b.motif !== 'nub')

    branches.push({
      week,
      side,
      path: `M${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`,
      twigs: [0.42, 0.68]
        .map((t) => {
          const [tx, ty] = quadPoint(start, control, end, t)
          return `M${tx.toFixed(1)} ${ty.toFixed(1)} C ${(tx - side * 6).toFixed(1)} ${(ty - 16).toFixed(1)}, ${(tx - side * 10).toFixed(1)} ${(ty - 28).toFixed(1)}, ${(tx - side * 12).toFixed(1)} ${(ty - 42).toFixed(1)}`
        })
        .join(' '),
      strokeWidth,
      dim,
      labelX: side === -1 ? 34 : WIDTH - 34 - 160,
      labelY: baseY + 26,
      firstDay: days.length ? Math.min(...days) : null,
      lastDay: days.length ? Math.max(...days) : null,
    })

    canopy.push({
      cx: (start[0] + end[0]) / 2 + side * 12,
      cy: baseY - 34,
      rx: clamp(86 - tier * 3, 60, 86),
      ry: clamp(52 - tier * 2, 38, 52),
    })

    bucket.forEach(({ node, motif }, j) => {
      const t = bucket.length === 1 ? 0.6 : 0.28 + (j * 0.66) / (bucket.length - 1)
      const [bx, by] = quadPoint(start, control, end, t)
      const above = j % 2 === 0
      const x = bx + side * (j % 3) * 2
      const y = by + (above ? -26 : 17)

      placed.push({
        id: node.id,
        x,
        y,
        motif,
        week,
        dayNumber: node.dayNumber ?? null,
        twig: `M${bx.toFixed(1)} ${by.toFixed(1)} C ${bx.toFixed(1)} ${((by + y) / 2).toFixed(1)}, ${x.toFixed(1)} ${((by + y) / 2).toFixed(1)}, ${x.toFixed(1)} ${(y + (above ? 6 : -6)).toFixed(1)}`,
        leaves: leavesFor(node, motif),
      })
    })
  })

  canopy.push({ cx: TRUNK_X + 6, cy: TRUNK_TOP_Y + 10, rx: 74, ry: 46 })

  return {
    width: WIDTH,
    height,
    groundY,
    trunk: trunkPath(groundY),
    roots: rootsPath(groundY),
    bark: barkPath(groundY),
    futureTip: futureTipPath(),
    grass: grassPath(groundY),
    branches,
    nodes: placed,
    canopy,
  }
}
