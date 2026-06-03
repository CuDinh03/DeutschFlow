// Oliver — RN port of the web bespoke SVG character (1:1). Pure react-native-svg +
// React state (lip-sync mouth + idle blink). No external animation deps.

import { useEffect, useState } from 'react'
import Svg, { Path, Ellipse, Rect, Circle, Line, G } from 'react-native-svg'

export type OliverExpression = 'neutral' | 'talking' | 'smiling' | 'thinking' | 'serious'

interface Props {
  expression?: string
  isTalking?: boolean
  size?: number
  paused?: boolean
}

function Eyebrows({ expression }: { expression: string }) {
  const c = '#4E342E'
  const sw = 6
  return (
    <G>
      <Path d="M 100 155 C 109 149 122 148 136 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M 152 154 C 166 148 179 149 188 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </G>
  )
}

function Eyes({ blinking }: { blinking: boolean }) {
  if (blinking) {
    return (
      <G>
        <Rect x={106} y={173} width={36} height={5} rx={2.5} fill="#F5C89A" />
        <Rect x={146} y={173} width={36} height={5} rx={2.5} fill="#F5C89A" />
      </G>
    )
  }
  return (
    <G>
      <Ellipse cx={124} cy={176} rx={14} ry={10} fill="white" />
      <Ellipse cx={126} cy={177} rx={6} ry={6} fill="#4E342E" />
      <Ellipse cx={128} cy={175} rx={2} ry={2} fill="white" />
      <Ellipse cx={164} cy={176} rx={14} ry={10} fill="white" />
      <Ellipse cx={166} cy={177} rx={6} ry={6} fill="#4E342E" />
      <Ellipse cx={168} cy={175} rx={2} ry={2} fill="white" />
    </G>
  )
}

function MouthFrame({ frame }: { frame: number }) {
  switch (frame) {
    case 0:
      return (
        <G>
          <Ellipse cx={144} cy={218} rx={16} ry={11} fill="#3E2723" />
          <Ellipse cx={144} cy={213} rx={16} ry={4} fill="#F5C89A" />
        </G>
      )
    case 1:
      return (
        <G>
          <Ellipse cx={144} cy={218} rx={11} ry={6} fill="#3E2723" />
          <Ellipse cx={144} cy={215} rx={11} ry={3} fill="#F5C89A" />
        </G>
      )
    default:
      return <Path d="M 128 215 C 134 219 144 221 158 218 C 166 216 168 212 168 212" fill="none" stroke="#8D6E63" strokeWidth={2.5} strokeLinecap="round" />
  }
}

export function OliverCharacter({ expression = 'neutral', isTalking = false, size, paused = false }: Props) {
  const [mouthFrame, setMouthFrame] = useState(2)
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    if (!isTalking) {
      setMouthFrame(2)
      return
    }
    const id = setInterval(() => setMouthFrame((f) => (f + 1) % 3), 115)
    return () => clearInterval(id)
  }, [isTalking])

  useEffect(() => {
    if (paused) return
    let tid: ReturnType<typeof setTimeout>
    const blink = () => {
      setBlinking(true)
      setTimeout(() => setBlinking(false), 140)
      tid = setTimeout(blink, 3000 + Math.random() * 2000)
    }
    tid = setTimeout(blink, 2000 + Math.random() * 1500)
    return () => clearTimeout(tid)
  }, [])

  const SKIN = '#F5C89A'
  const SKIN_D = '#D49060'
  const HAIR = '#795548' // Brown hair
  const SHIRT = '#37474F' // Dark grey workshop polo
  const COLLAR = '#263238'
  const ACCENT = '#7C3AED'
  return (
    <Svg width={size ?? '100%'} height={size ?? '100%'} viewBox="0 0 280 500">
      {/* SHIRT */}
      <Path d="M 96,268 C 72,278 52,310 46,344 L 36,500 L 252,500 L 242,344 C 236,310 216,278 192,268 L 174,261 C 167,273 158,279 144,279 C 130,279 121,273 114,261 Z" fill={SHIRT} />
      <Path d="M 46,344 C 34,362 24,394 26,422 L 41,437 C 51,446 69,445 74,435 L 80,417 C 82,394 80,366 72,344 Z" fill={SHIRT} />
      <Path d="M 242,344 C 254,362 264,394 262,422 L 247,437 C 237,446 219,445 214,435 L 208,417 C 206,394 208,366 216,344 Z" fill={SHIRT} />

      {/* Polo Collar */}
      <Path d="M 110 264 L 144 300 L 178 264 Z" fill="#CFD8DC" />
      <Path d="M 110 264 L 144 300 L 178 264" fill="none" stroke={COLLAR} strokeWidth={10} strokeLinejoin="round" />

      {/* Pocket */}
      <Rect x={180} y={360} width={25} height={30} rx={3} fill={COLLAR} />
      <Line x1={185} y1={360} x2={185} y2={375} stroke="#F5F5F5" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={192} cy={379} r={4} fill={ACCENT} opacity={0.75} />

      <Ellipse cx={53} cy={440} rx={18} ry={12} fill={SKIN} />
      <Ellipse cx={235} cy={440} rx={18} ry={12} fill={SKIN} />

      <Rect x={132} y={252} width={24} height={28} rx={7} fill={SKIN} />

      <Ellipse cx={89} cy={192} rx={10} ry={14} fill={SKIN} />
      <Ellipse cx={199} cy={192} rx={10} ry={14} fill={SKIN} />

      <Ellipse cx={144} cy={150} rx={55} ry={50} fill={HAIR} />

      <Ellipse cx={144} cy={194} rx={58} ry={64} fill={SKIN} />

      <Eyebrows expression={expression} />
      <Eyes blinking={blinking} />
      <Path d="M 139 202 C 137 208 141 213 144 213 C 147 213 151 208 149 202" fill="none" stroke={SKIN_D} strokeWidth={2} strokeLinecap="round" />
      <MouthFrame frame={isTalking ? mouthFrame : 2} />
    </Svg>
  )
}
