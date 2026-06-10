// Weber — RN port of the web bespoke SVG character (1:1). Pure react-native-svg +
// React state (lip-sync mouth + idle blink). No external animation deps.

import { useFaceAnimation } from '../useFaceAnimation'
import Svg, { Path, Ellipse, Rect, Circle, G } from 'react-native-svg'

export type WeberExpression = 'idle' | 'talking' | 'winking' | 'thinking' | 'laughing'

interface Props {
  expression?: string
  isTalking?: boolean
  size?: number
  paused?: boolean
}

function Eyebrows({ expression }: { expression: string }) {
  const c = '#3E2723'
  const sw = 5
  return (
    <G>
      <Path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </G>
  )
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: string }) {
  const SKIN = '#FFE0B2'
  if (blinking) {
    return (
      <G>
        <Rect x={95} y={172} width={40} height={5} rx={2.5} fill={SKIN} />
        <Rect x={153} y={172} width={40} height={5} rx={2.5} fill={SKIN} />
      </G>
    )
  }
  return (
    <G>
      <Ellipse cx={113} cy={176} rx={16} ry={expression === 'talking' ? 13 : 11} fill="white" />
      <Ellipse cx={115} cy={177} rx={7} ry={7} fill="#3E2723" />
      <Ellipse cx={118} cy={175} rx={2.5} ry={2.5} fill="white" />
      <Path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#3E2723" strokeWidth={2.5} strokeLinecap="round" />

      <Ellipse cx={175} cy={176} rx={16} ry={expression === 'talking' ? 13 : 11} fill="white" />
      <Ellipse cx={177} cy={177} rx={7} ry={7} fill="#3E2723" />
      <Ellipse cx={180} cy={175} rx={2.5} ry={2.5} fill="white" />
      <Path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#3E2723" strokeWidth={2.5} strokeLinecap="round" />
    </G>
  )
}

function MouthFrame({ frame }: { frame: number }) {
  switch (frame) {
    case 0:
      return (
        <G>
          <Ellipse cx={144} cy={222} rx={18} ry={12} fill="#3E2723" />
          <Path d="M 124 216 C 132 210 156 210 164 216" fill="none" stroke="#E91E63" strokeWidth={3} strokeLinecap="round" />
        </G>
      )
    case 1:
      return (
        <G>
          <Ellipse cx={144} cy={221} rx={12} ry={7} fill="#3E2723" />
          <Path d="M 130 217 C 136 213 152 213 158 217" fill="none" stroke="#E91E63" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      )
    default:
      return (
        <G>
          <Path d="M 118 216 C 126 212 134 210 144 211 C 154 210 162 212 170 216" fill="none" stroke="#E91E63" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      )
  }
}

export function WeberCharacter({ expression = 'idle', isTalking = false, size, paused = false }: Props) {
  const { mouthFrame, blinking } = useFaceAnimation(isTalking, paused)

  const SKIN = '#FFE0B2'
  const SKIN_D = '#FFCC80'
  const HAIR = '#3E2723'
  const SCRUB = '#F48FB1' // Pink scrub
  const COAT = '#FFFFFF' // Doctor coat
  const ACCENT = '#0F766E' // Medical accent

  return (
    <Svg width={size ?? '100%'} height={size ?? '100%'} viewBox="0 0 280 500">
      {/* SCRUB INNER */}
      <Path d="M 120 280 L 144 330 L 168 280 Z" fill={SCRUB} />

      {/* COAT */}
      <Path d="M 96,268 C 72,278 52,310 46,344 L 36,500 L 252,500 L 242,344 C 236,310 216,278 192,268 L 168,280 L 144,350 L 120,280 Z" fill={COAT} stroke="#CFD8DC" strokeWidth={2} />
      <Path d="M 46,344 C 34,362 24,394 26,422 L 41,437 C 51,446 69,445 74,435 L 80,417 C 82,394 80,366 72,344 Z" fill={COAT} stroke="#CFD8DC" strokeWidth={2} />
      <Path d="M 242,344 C 254,362 264,394 262,422 L 247,437 C 237,446 219,445 214,435 L 208,417 C 206,394 208,366 216,344 Z" fill={COAT} stroke="#CFD8DC" strokeWidth={2} />

      {/* Coat Collar */}
      <Path d="M 120 280 L 110 330 L 144 350" fill="none" stroke="#CFD8DC" strokeWidth={3} />
      <Path d="M 168 280 L 178 330 L 144 350" fill="none" stroke="#CFD8DC" strokeWidth={3} />

      {/* Stethoscope */}
      <Path d="M 115 300 C 115 350 173 350 173 300" fill="none" stroke={ACCENT} strokeWidth={6} strokeLinecap="round" />
      <Circle cx={173} cy={355} r={10} fill="#E0E0E0" stroke={ACCENT} strokeWidth={3} />
      <Path d="M 173 300 L 173 345" stroke={ACCENT} strokeWidth={6} />
      <Circle cx={144} cy={325} r={6} fill={ACCENT} opacity={0.35} />

      <Ellipse cx={50} cy={440} rx={18} ry={12} fill={SKIN} />
      <Ellipse cx={238} cy={440} rx={18} ry={12} fill={SKIN} />

      <Rect x={130} y={254} width={28} height={28} rx={7} fill={SKIN} />

      <G>
        {/* Hair Back */}
        <Ellipse cx={144} cy={150} rx={66} ry={70} fill={HAIR} />
        <Ellipse cx={74} cy={196} rx={10} ry={14} fill={SKIN} />
        <Ellipse cx={214} cy={196} rx={10} ry={14} fill={SKIN} />

        <Ellipse cx={144} cy={196} rx={58} ry={64} fill={SKIN} />

        {/* Hair Front */}
        <Path d="M 86 170 C 90 120 110 90 144 90 C 178 90 198 120 202 170 C 190 150 170 140 144 140 C 118 140 98 150 86 170 Z" fill={HAIR} />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <Path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth={2} strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} />
      </G>
    </Svg>
  )
}
