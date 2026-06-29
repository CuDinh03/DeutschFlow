// SkillRadar — 4-axis SVG radar for the CEFR skill scores (Galerie v2).
// Ports the mockup `SkillRadar` (na-progress.jsx) 1:1: concentric grid polygons,
// axis spokes, a gold-filled data polygon with vertex dots, and muted axis labels.
// Axis order matches the mockup: top → right → bottom → left.

import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg'
import { fonts, useTheme } from '@/lib/theme'

export interface RadarPoint {
  label: string
  /** 0–100 */
  value: number
}

// top, right, bottom, left — same as the mockup.
const ANGLES = [-90, 0, 90, 180]
const RINGS = [0.25, 0.5, 0.75, 1]

const rad = (deg: number) => (deg * Math.PI) / 180
const clamp = (v: number) => Math.max(0, Math.min(100, v))

interface SkillRadarProps {
  data: RadarPoint[]
  size?: number
  style?: StyleProp<ViewStyle>
}

export function SkillRadar({ data, size = 200, style }: SkillRadarProps) {
  const c = useTheme().colors
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 30

  const vertex = (value: number, i: number): [number, number] => {
    const a = rad(ANGLES[i])
    const r = R * (clamp(value) / 100)
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }
  const axisEnd = (i: number): [number, number] => {
    const a = rad(ANGLES[i])
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]
  }
  const ring = (f: number) =>
    ANGLES.map((a) => `${cx + Math.cos(rad(a)) * R * f},${cy + Math.sin(rad(a)) * R * f}`).join(' ')

  const dataPoly = data.map((d, i) => vertex(d.value, i).join(',')).join(' ')

  return (
    <View style={style}>
      <Svg width={size} height={size}>
        {RINGS.map((f, k) => (
          <Polygon key={k} points={ring(f)} fill="none" stroke={c.border} strokeWidth={1} />
        ))}
        {ANGLES.map((_, i) => {
          const [x2, y2] = axisEnd(i)
          return <Line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke={c.border} strokeWidth={1} />
        })}
        <Polygon points={dataPoly} fill={`${c.accentText}38`} stroke={c.accentText} strokeWidth={2} />
        {data.map((d, i) => {
          const [x, y] = vertex(d.value, i)
          return <Circle key={i} cx={x} cy={y} r={3.5} fill={c.accentText} />
        })}
        {data.map((d, i) => {
          const [ex, ey] = axisEnd(i)
          const dx = ex - cx
          const dy = ey - cy
          return (
            <SvgText
              key={i}
              x={ex + dx * 0.18}
              y={ey + dy * 0.18 + 4}
              textAnchor="middle"
              fontFamily={fonts.bodySemi}
              fontSize={10}
              fill={c.textMuted}
            >
              {d.label}
            </SvgText>
          )
        })}
      </Svg>
    </View>
  )
}
