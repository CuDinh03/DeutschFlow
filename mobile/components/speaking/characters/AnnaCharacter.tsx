// Anna — RN port of the web bespoke SVG character (1:1). Pure react-native-svg +
// React state (lip-sync mouth + idle blink). No external animation deps.

import { useFaceAnimation } from '../useFaceAnimation'
import Svg, { Path, Ellipse, Rect, Circle, G } from 'react-native-svg'

export type AnnaExpression = 'idle' | 'talking' | 'winking' | 'thinking' | 'laughing'

interface Props {
  expression?: string
  isTalking?: boolean
  size?: number
  paused?: boolean
}

function Eyebrows({ expression }: { expression: string }) {
  const c = '#3E2723'
  const sw = 5
  switch (expression) {
    case 'talking':
      return (
        <G>
          <Path d="M 88 152 C 98 145 113 143 130 149" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M 158 149 C 175 143 190 145 200 152" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )
    case 'winking':
      return (
        <G>
          <Path d="M 88 155 C 98 149 113 148 130 153" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M 158 153 C 175 148 190 149 200 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )
    case 'thinking':
      return (
        <G>
          <Path d="M 88 155 C 98 149 113 148 130 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M 158 148 C 175 152 190 156 200 152" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )
    case 'laughing':
      return (
        <G>
          <Path d="M 88 150 C 98 143 113 141 130 147" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M 158 147 C 175 141 190 143 200 150" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )
    default:
      return (
        <G>
          <Path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )
  }
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: string }) {
  const SKIN = '#FAD6A5'
  const isWinking = expression === 'winking'
  const isLaughing = expression === 'laughing'

  if (blinking && !isLaughing) {
    return (
      <G>
        <Rect x={95} y={172} width={40} height={5} rx={2.5} fill={SKIN} />
        <Rect x={153} y={172} width={40} height={5} rx={2.5} fill={SKIN} />
      </G>
    )
  }

  return (
    <G>
      {isWinking ? (
        <Path d="M 95 176 C 105 169 121 169 131 176" fill="none" stroke="#3E2723" strokeWidth={5} strokeLinecap="round" />
      ) : isLaughing ? (
        <Path d="M 95 174 C 105 166 121 166 131 174" fill="none" stroke="#3E2723" strokeWidth={5} strokeLinecap="round" />
      ) : (
        <G>
          <Ellipse cx={113} cy={176} rx={16} ry={expression === 'talking' ? 13 : 11} fill="white" />
          <Ellipse cx={115} cy={177} rx={7} ry={7} fill="#4A3B32" />
          <Ellipse cx={118} cy={175} rx={2.5} ry={2.5} fill="white" />
          <Path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#3E2723" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      )}
      {isLaughing ? (
        <Path d="M 157 174 C 167 166 183 166 193 174" fill="none" stroke="#3E2723" strokeWidth={5} strokeLinecap="round" />
      ) : (
        <G>
          <Ellipse cx={175} cy={176} rx={16} ry={expression === 'talking' ? 13 : 11} fill="white" />
          <Ellipse cx={177} cy={177} rx={7} ry={7} fill="#4A3B32" />
          <Ellipse cx={180} cy={175} rx={2.5} ry={2.5} fill="white" />
          <Path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#3E2723" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      )}
    </G>
  )
}

function MouthFrame({ frame, expression }: { frame: number; expression: string }) {
  if (expression === 'winking') {
    return <Path d="M 114 218 C 122 226 132 230 144 230 C 156 230 166 226 174 218" fill="none" stroke="#B83B5E" strokeWidth={3} strokeLinecap="round" />
  }
  if (expression === 'thinking') {
    return <Path d="M 118 218 C 126 222 135 224 144 224 C 153 224 162 222 170 218" fill="none" stroke="#B83B5E" strokeWidth={2.5} strokeLinecap="round" />
  }
  if (expression === 'laughing') {
    return (
      <G>
        <Path d="M 108 214 C 116 224 128 232 144 234 C 160 232 172 224 180 214" fill="#3B1A1A" />
        <Path d="M 108 214 C 116 224 128 232 144 234 C 160 232 172 224 180 214" fill="none" stroke="#B83B5E" strokeWidth={2.5} strokeLinecap="round" />
        <Rect x={122} y={214} width={44} height={8} rx={3} fill="white" />
      </G>
    )
  }
  switch (frame) {
    case 0:
      return (
        <G>
          <Ellipse cx={144} cy={222} rx={18} ry={12} fill="#3B1A1A" />
          <Path d="M 124 216 C 132 210 156 210 164 216" fill="none" stroke="#B83B5E" strokeWidth={3} strokeLinecap="round" />
        </G>
      )
    case 1:
      return (
        <G>
          <Ellipse cx={144} cy={221} rx={12} ry={7} fill="#3B1A1A" />
          <Path d="M 130 217 C 136 213 152 213 158 217" fill="none" stroke="#B83B5E" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      )
    default:
      return (
        <G>
          <Path d="M 118 216 C 126 212 134 210 144 211 C 154 210 162 212 170 216" fill="none" stroke="#B83B5E" strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M 118 216 C 126 226 134 230 144 231 C 154 230 162 226 170 216" fill="#F06292" opacity={0.6} />
        </G>
      )
  }
}

export function AnnaCharacter({ expression = 'idle', isTalking = false, size, paused = false }: Props) {
  const { mouthFrame, blinking } = useFaceAnimation(isTalking, paused)

  const SKIN = '#FAD6A5'
  const SKIN_D = '#E8BB85'
  const HAIR = '#6B4423'
  const OUTFIT = '#FB923C' // Orange
  const ACCENT = '#B83B5E' // Scarf accent
  const POCKET = '#8B5E3C'
  return (
    <Svg width={size ?? '100%'} height={size ?? '100%'} viewBox="0 0 280 500">
      <Path d="M 92,268 C 68,278 48,310 42,344 L 32,500 L 256,500 L 246,344 C 240,310 220,278 196,268 L 178,261 C 171,274 162,280 144,280 C 126,280 117,274 110,261 Z" fill={OUTFIT} />
      <Path d="M 42,344 C 30,362 20,394 22,424 L 38,438 C 48,447 66,446 70,436 L 76,418 C 78,394 76,366 68,344 Z" fill={OUTFIT} />
      <Path d="M 246,344 C 258,362 268,394 266,424 L 250,438 C 240,447 222,446 218,436 L 212,418 C 210,394 212,366 220,344 Z" fill={OUTFIT} />
      {/* Scarf */}
      <Path d="M 110 264 C 116 270 127 280 144 280 C 161 280 172 270 178 264 L 160 320 L 144 330 L 128 320 Z" fill={ACCENT} opacity={0.9} />
      <Circle cx={144} cy={322} r={6} fill={POCKET} opacity={0.35} />
      <Ellipse cx={50} cy={440} rx={18} ry={12} fill={SKIN} />
      <Ellipse cx={238} cy={440} rx={18} ry={12} fill={SKIN} />

      {expression === 'thinking' && (
        <G>
          <Path d="M 30 310 C 46 295 70 274 92 268" fill="none" stroke={OUTFIT} strokeWidth={30} strokeLinecap="round" />
          <Ellipse cx={92} cy={263} rx={20} ry={15} fill={SKIN} />
          <Path d="M 80 252 C 78 258 80 265 84 267" fill="none" stroke={SKIN_D} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
        </G>
      )}

      <Rect x={130} y={254} width={28} height={28} rx={7} fill={SKIN} />

      <G transform="rotate(-3 144 310)">
        {/* Hair Back */}
        <Ellipse cx={144} cy={160} rx={70} ry={90} fill={HAIR} />
        <Ellipse cx={74} cy={196} rx={10} ry={14} fill={SKIN} />
        <Ellipse cx={214} cy={196} rx={10} ry={14} fill={SKIN} />

        {/* Face */}
        <Ellipse cx={144} cy={196} rx={58} ry={64} fill={SKIN} />

        {/* Hair Front */}
        <Path d="M 86 170 C 90 120 110 90 144 90 C 178 90 198 120 202 170 C 190 140 170 130 144 130 C 118 130 98 140 86 170 Z" fill={HAIR} />
        <Path d="M 144 90 C 130 100 120 120 100 140 C 110 130 120 110 144 100" fill="#8D6E63" opacity={0.6} />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <Path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth={2} strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} expression={expression} />

        {expression === 'laughing' && (
          <G>
            <Ellipse cx={92} cy={212} rx={20} ry={10} fill="#FF9080" opacity={0.4} />
            <Ellipse cx={196} cy={212} rx={20} ry={10} fill="#FF9080" opacity={0.4} />
          </G>
        )}
      </G>
    </Svg>
  )
}
