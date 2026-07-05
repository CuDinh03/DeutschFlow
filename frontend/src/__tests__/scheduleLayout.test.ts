import { describe, expect, it } from 'vitest'
import { assignLanes } from '@/lib/scheduleLayout'

// Buổi test: [start, end] tính bằng phút trong ngày, kèm nhãn để đối chiếu.
interface Ev {
  id: string
  start: number
  end: number
}
const ev = (id: string, start: number, end: number): Ev => ({ id, start, end })
const run = (items: Ev[]) => assignLanes(items, (e) => e.start, (e) => e.end)
const byId = (items: Ev[]) => {
  const out: Record<string, { lane: number; lanes: number }> = {}
  for (const r of run(items)) out[r.item.id] = { lane: r.lane, lanes: r.lanes }
  return out
}

describe('assignLanes', () => {
  it('returns empty for no items', () => {
    expect(run([])).toEqual([])
  })

  it('single item occupies lane 0 of 1', () => {
    const r = run([ev('a', 480, 570)])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ lane: 0, lanes: 1 })
  })

  it('two sequential (non-overlapping) sessions both use full width', () => {
    const m = byId([ev('a', 480, 570), ev('b', 600, 690)])
    expect(m.a).toEqual({ lane: 0, lanes: 1 })
    expect(m.b).toEqual({ lane: 0, lanes: 1 })
  })

  it('adjacent sessions (end === next start) do NOT overlap', () => {
    const m = byId([ev('a', 480, 570), ev('b', 570, 660)])
    expect(m.a).toEqual({ lane: 0, lanes: 1 })
    expect(m.b).toEqual({ lane: 0, lanes: 1 })
  })

  it('two fully-overlapping sessions split into 2 side-by-side lanes', () => {
    const m = byId([ev('a', 480, 570), ev('b', 480, 570)])
    expect(m.a.lanes).toBe(2)
    expect(m.b.lanes).toBe(2)
    expect(new Set([m.a.lane, m.b.lane])).toEqual(new Set([0, 1]))
  })

  it('partial overlap still splits into 2 lanes', () => {
    // a: 08:00–09:30, b: 09:00–10:30 → overlap 09:00–09:30
    const m = byId([ev('a', 480, 570), ev('b', 540, 630)])
    expect(m.a).toMatchObject({ lane: 0, lanes: 2 })
    expect(m.b).toMatchObject({ lane: 1, lanes: 2 })
  })

  it('three mutually-overlapping sessions use 3 lanes', () => {
    const m = byId([ev('a', 480, 600), ev('b', 480, 600), ev('c', 480, 600)])
    for (const id of ['a', 'b', 'c']) expect(m[id].lanes).toBe(3)
    expect(new Set([m.a.lane, m.b.lane, m.c.lane])).toEqual(new Set([0, 1, 2]))
  })

  it('separate clusters are sized independently', () => {
    // Cluster 1 (morning): a,b overlap → 2 lanes. Cluster 2 (evening): c alone → 1 lane.
    const m = byId([ev('a', 480, 570), ev('b', 480, 570), ev('c', 1200, 1290)])
    expect(m.a.lanes).toBe(2)
    expect(m.b.lanes).toBe(2)
    expect(m.c).toEqual({ lane: 0, lanes: 1 })
  })

  it('chained overlap (A∩B, B∩C, A∌C) forms one 2-lane cluster and reuses lane 0', () => {
    // a: 08:00–09:00, b: 08:30–09:30, c: 09:00–10:00
    // a & c do not overlap → c can reclaim lane 0 while b holds lane 1.
    const m = byId([ev('a', 480, 540), ev('b', 510, 570), ev('c', 540, 600)])
    expect(m.a).toMatchObject({ lane: 0, lanes: 2 })
    expect(m.b).toMatchObject({ lane: 1, lanes: 2 })
    expect(m.c).toMatchObject({ lane: 0, lanes: 2 })
  })

  it('is order-independent (unsorted input yields same placement)', () => {
    const sorted = byId([ev('a', 480, 570), ev('b', 540, 630)])
    const shuffled = byId([ev('b', 540, 630), ev('a', 480, 570)])
    expect(shuffled).toEqual(sorted)
  })
})
