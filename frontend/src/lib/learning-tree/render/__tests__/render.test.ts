import { describe, it, expect } from 'vitest'
import {
  taperedLimbPath,
  trunkOutlinePath,
  leafPath,
  leafletPath,
  softBlobCircles,
} from '../paths'
import { mix, branchFill, milestoneColors, GROUP_COLORS, SKILL_COLORS } from '../palette'

// Snapshots lock the geometry/colour the SVG renderer derives from the (separately-tested) layout
// engine. They guard against accidental drift in the path builders and palette.

describe('render/paths', () => {
  it('taperedLimbPath — straight, no bend', () => {
    expect(taperedLimbPath({ x: 0, y: 0 }, { x: 0, y: -100 }, 12, 4)).toMatchSnapshot()
  })

  it('taperedLimbPath — with a sideways bend', () => {
    expect(taperedLimbPath({ x: 0, y: 0 }, { x: 60, y: -80 }, 10, 3, 0.16)).toMatchSnapshot()
  })

  it('trunkOutlinePath — smoothed offset spine', () => {
    const spine = [
      { x: 0, y: 0, hw: 13 },
      { x: 8, y: -90, hw: 9 },
      { x: -6, y: -180, hw: 5 },
    ]
    expect(trunkOutlinePath(spine)).toMatchSnapshot()
  })

  it('trunkOutlinePath — degenerate (<2 points) → empty', () => {
    expect(trunkOutlinePath([{ x: 0, y: 0, hw: 10 }])).toBe('')
  })

  it('leafPath / leafletPath — almond silhouettes', () => {
    expect(leafPath(21, 9.5)).toMatchSnapshot()
    expect(leafletPath()).toMatchSnapshot()
  })

  it('softBlobCircles — multi-lobe canopy', () => {
    expect(softBlobCircles(10, -50, 24, 6, 0.42)).toMatchSnapshot()
  })
})

describe('render/palette', () => {
  it('mix blends two hex colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mix('#352B21', '#2F6FC9', 0)).toBe('#352b21')
  })

  it('branchFill keeps branches woody (bark-tinted)', () => {
    expect(branchFill('hoeren')).toMatchSnapshot()
    expect(branchFill('schreiben')).toMatchSnapshot()
  })

  it('milestoneColors covers every state', () => {
    expect({
      passed: milestoneColors('passed'),
      ready: milestoneColors('ready'),
      in_progress: milestoneColors('in_progress'),
      locked: milestoneColors('locked'),
    }).toMatchSnapshot()
  })

  it('group + skill palettes are stable', () => {
    expect({ GROUP_COLORS, SKILL_COLORS }).toMatchSnapshot()
  })
})
