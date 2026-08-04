import { describe, it, expect } from 'vitest'
import { buildTreeLayout, type TreeNodeInput } from './treeLayout'

/**
 * Bố cục cây phải bám dữ liệu thật, không phải 30 node cứng: `/roadmap/me` sinh lộ trình theo từng
 * học viên nên số node và số tuần đều co giãn. Các test này khoá phần hình học thuần — quy tắc gom
 * tuần, motif theo trạng thái, và bất biến "không node nào rơi ra ngoài khung".
 */

const node = (id: number, over: Partial<TreeNodeInput> = {}): TreeNodeInput => ({
  id,
  dayNumber: id,
  weekNumber: Math.ceil(id / 5),
  progressStatus: 'LOCKED',
  state: 'locked',
  ...over,
})

/** Lộ trình A1 chuẩn: 30 ngày, 6 tuần. */
const a1Nodes = (): TreeNodeInput[] => Array.from({ length: 30 }, (_, i) => node(i + 1))

describe('buildTreeLayout — gom node thành cành theo tuần', () => {
  it('dựng 6 cành cho lộ trình A1 30 ngày, mỗi cành 5 node', () => {
    const layout = buildTreeLayout(a1Nodes())

    expect(layout.branches).toHaveLength(6)
    expect(layout.nodes).toHaveLength(30)
    for (const branch of layout.branches) {
      expect(layout.nodes.filter((n) => n.week === branch.week)).toHaveLength(5)
    }
  })

  it('cành mọc xen kẽ trái–phải để tán không dồn một bên', () => {
    const sides = buildTreeLayout(a1Nodes()).branches.map((b) => b.side)

    expect(sides).toEqual([-1, 1, -1, 1, -1, 1])
  })

  it('cành dưới to hơn cành trên', () => {
    const widths = buildTreeLayout(a1Nodes()).branches.map((b) => b.strokeWidth)

    expect(widths).toEqual([...widths].sort((a, b) => b - a))
    expect(widths[0]).toBeGreaterThan(widths[widths.length - 1])
  })

  it('nhãn cành ghi đúng khoảng ngày của tuần đó', () => {
    const [week1, week3] = [1, 3].map(
      (w) => buildTreeLayout(a1Nodes()).branches.find((b) => b.week === w)!,
    )

    expect([week1.firstDay, week1.lastDay]).toEqual([1, 5])
    expect([week3.firstDay, week3.lastDay]).toEqual([11, 15])
  })
})

describe('buildTreeLayout — co giãn theo lộ trình thật', () => {
  it('lộ trình ngắn cho cây thấp hơn', () => {
    const short = buildTreeLayout(Array.from({ length: 10 }, (_, i) => node(i + 1)))
    const full = buildTreeLayout(a1Nodes())

    expect(short.branches).toHaveLength(2)
    expect(short.height).toBeLessThan(full.height)
  })

  it('lộ trình dài hơn 6 tuần thì cây cao thêm chứ không chồng cành', () => {
    const long = buildTreeLayout(Array.from({ length: 45 }, (_, i) => node(i + 1)))
    const full = buildTreeLayout(a1Nodes())

    expect(long.branches).toHaveLength(9)
    expect(long.height).toBeGreaterThan(full.height)
    const ys = long.branches.map((b) => b.labelY)
    expect(new Set(ys).size).toBe(ys.length)
  })

  it('lộ trình rỗng vẫn ra khung hợp lệ, không ném', () => {
    const layout = buildTreeLayout([])

    expect(layout.branches).toHaveLength(0)
    expect(layout.nodes).toHaveLength(0)
    expect(layout.height).toBeGreaterThan(0)
    expect(layout.trunk).toContain('M')
  })

  it('một tuần lẻ loi vẫn đặt được node', () => {
    const layout = buildTreeLayout([node(1, { weekNumber: 1, dayNumber: 1 })])

    expect(layout.nodes).toHaveLength(1)
    expect(layout.nodes[0].x).toBeGreaterThan(0)
  })
})

describe('buildTreeLayout — gom tuần khi dữ liệu thiếu', () => {
  it('thiếu weekNumber thì suy ra từ dayNumber (5 ngày một tuần)', () => {
    const nodes = Array.from({ length: 12 }, (_, i) => node(i + 1, { weekNumber: null }))

    const layout = buildTreeLayout(nodes)

    expect(layout.branches.map((b) => b.week)).toEqual([1, 2, 3])
    expect(layout.nodes.filter((n) => n.week === 3)).toHaveLength(2)
  })

  it('thiếu cả week lẫn day thì gom theo thứ tự trả về', () => {
    const nodes = Array.from({ length: 7 }, (_, i) =>
      node(i + 1, { weekNumber: null, dayNumber: null }),
    )

    const layout = buildTreeLayout(nodes)

    expect(layout.branches).toHaveLength(2)
    expect(layout.nodes).toHaveLength(7)
  })
})

describe('buildTreeLayout — motif theo trạng thái', () => {
  it.each([
    ['COMPLETED', 'leaf'],
    ['IN_PROGRESS', 'flower'],
    ['AVAILABLE', 'bud'],
    ['LOCKED', 'nub'],
  ])('%s → %s', (progressStatus, motif) => {
    const layout = buildTreeLayout([node(1, { progressStatus })])

    expect(layout.nodes[0].motif).toBe(motif)
  })

  it('không có progressStatus thì suy từ state cũ, và "current" thành hoa', () => {
    const layout = buildTreeLayout([
      node(1, { progressStatus: null, state: 'completed' }),
      node(2, { progressStatus: null, state: 'current' }),
      node(3, { progressStatus: null, state: 'locked' }),
    ])

    expect(layout.nodes.map((n) => n.motif)).toEqual(['leaf', 'flower', 'nub'])
  })

  it('node đã xong mọc lá, node chưa xong thì không', () => {
    const layout = buildTreeLayout([
      node(1, { progressStatus: 'COMPLETED' }),
      node(2, { progressStatus: 'AVAILABLE' }),
    ])

    expect(layout.nodes[0].leaves.length).toBeGreaterThan(0)
    expect(layout.nodes[1].leaves).toHaveLength(0)
  })

  it('lá mọc cùng một kiểu qua nhiều lần dựng — không nhảy mỗi lần render', () => {
    const first = buildTreeLayout(a1Nodes().map((n) => ({ ...n, progressStatus: 'COMPLETED' })))
    const second = buildTreeLayout(a1Nodes().map((n) => ({ ...n, progressStatus: 'COMPLETED' })))

    expect(first.nodes.map((n) => n.leaves)).toEqual(second.nodes.map((n) => n.leaves))
  })
})

describe('buildTreeLayout — bất biến khung nhìn', () => {
  it('mọi node nằm trong khung, kể cả lộ trình dài', () => {
    for (const count of [1, 7, 30, 45]) {
      const layout = buildTreeLayout(Array.from({ length: count }, (_, i) => node(i + 1)))

      for (const placed of layout.nodes) {
        expect(placed.x).toBeGreaterThan(0)
        expect(placed.x).toBeLessThan(layout.width)
        expect(placed.y).toBeGreaterThan(0)
        expect(placed.y).toBeLessThan(layout.height)
      }
    }
  })

  it('không có hai node nào chồng khít lên nhau', () => {
    const layout = buildTreeLayout(a1Nodes())
    const seen = new Set(layout.nodes.map((n) => `${Math.round(n.x)}:${Math.round(n.y)}`))

    expect(seen.size).toBe(layout.nodes.length)
  })

  it('gốc cây nằm dưới cành thấp nhất', () => {
    const layout = buildTreeLayout(a1Nodes())
    const lowestNode = Math.max(...layout.nodes.map((n) => n.y))

    expect(layout.groundY).toBeGreaterThan(lowestNode)
    expect(layout.groundY).toBeLessThan(layout.height)
  })
})
