// Animated flat persona character — RN port of the web `IllustratedPersonaCharacter`.
// Pure react-native-svg + React state (talking mouth + random blink), no extra deps.
// One configurable component renders every persona via a `variant` colour/style config.

import { useMemo } from 'react'
import Svg, { Path, Ellipse, Rect, Circle, Line, G } from 'react-native-svg'
import { useFaceAnimation } from './useFaceAnimation'

export type PersonaExpression =
  | 'neutral' | 'talking' | 'smiling' | 'thinking' | 'serious' | 'idle' | 'winking' | 'laughing'

export interface PersonaVariant {
  skin: string
  skinShadow: string
  hair: string
  outfit: string
  outfitAccent?: string
  eyeColor: string
  eyebrow: string
  lip: string
  accessory?: 'headset' | 'hat' | 'none'
  accessoryColor?: string
  hairStyle?: 'short' | 'long' | 'curly' | 'side_part'
  gender?: 'male' | 'female'
  facialHair?: 'none' | 'stubble'
}

type Mood = 'calm' | 'bright' | 'confident' | 'energetic'

function Eyebrows({ color, mood }: { color: string; mood: Mood }) {
  const left =
    mood === 'calm' ? 'M 100 156 C 111 150 123 149 136 154'
      : mood === 'bright' ? 'M 100 153 C 111 147 123 146 137 152'
        : mood === 'confident' ? 'M 100 154 C 112 147 124 146 138 151'
          : 'M 100 153 C 111 146 123 145 137 150'
  const right =
    mood === 'calm' ? 'M 144 154 C 157 149 169 150 180 156'
      : mood === 'bright' ? 'M 143 152 C 157 146 170 147 180 153'
        : mood === 'confident' ? 'M 143 151 C 157 145 169 146 180 154'
          : 'M 143 150 C 157 144 169 145 180 153'
  return (
    <G>
      <Path d={left} fill="none" stroke={color} strokeWidth={5.2} strokeLinecap="round" />
      <Path d={right} fill="none" stroke={color} strokeWidth={5.2} strokeLinecap="round" />
    </G>
  )
}

function Eyes({ blinking, eyeColor, skin, mood }: { blinking: boolean; eyeColor: string; skin: string; mood: Mood }) {
  const ry = mood === 'calm' ? 9 : mood === 'bright' ? 10 : mood === 'confident' ? 9 : 11
  const rx = mood === 'energetic' ? 14 : 13
  if (blinking) {
    return (
      <G>
        <Rect x={108} y={173} width={34} height={5} rx={2.5} fill={skin} />
        <Rect x={146} y={173} width={34} height={5} rx={2.5} fill={skin} />
      </G>
    )
  }
  return (
    <G>
      <Ellipse cx={125} cy={176} rx={rx} ry={ry} fill="white" />
      <Ellipse cx={126} cy={177} rx={6} ry={6} fill={eyeColor} />
      <Ellipse cx={128} cy={175} rx={2} ry={2} fill="white" />
      <Ellipse cx={163} cy={176} rx={rx} ry={ry} fill="white" />
      <Ellipse cx={164} cy={177} rx={6} ry={6} fill={eyeColor} />
      <Ellipse cx={166} cy={175} rx={2} ry={2} fill="white" />
    </G>
  )
}

function MouthFrame({ frame, lip }: { frame: number; lip: string }) {
  if (frame === 0) return <Ellipse cx={144} cy={219} rx={15} ry={11} fill="#3B1A1A" stroke={lip} strokeWidth={2} />
  if (frame === 1) return <Ellipse cx={144} cy={219} rx={10} ry={6} fill="#3B1A1A" stroke={lip} strokeWidth={2} />
  return (
    <Path
      d="M 129 216 C 135 220 143 221 149 220 C 156 219 162 217 168 216"
      fill="none"
      stroke={lip}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  )
}

interface PersonaCharacterProps {
  variant: PersonaVariant
  expression?: PersonaExpression
  isTalking?: boolean
  size?: number
  paused?: boolean
}

export function PersonaCharacter({ variant, isTalking = false, size, paused = false }: PersonaCharacterProps) {
  const { mouthFrame, blinking } = useFaceAnimation(isTalking, paused)

  const outfitAccent = variant.outfitAccent ?? variant.outfit
  const accessory = variant.accessory ?? 'none'
  const accessoryColor = variant.accessoryColor ?? variant.outfit
  const hairStyle = variant.hairStyle ?? 'short'
  const gender = variant.gender ?? 'male'
  const facialHair = variant.facialHair ?? 'none'
  const mood: Mood =
    variant.hairStyle === 'long' ? 'bright'
      : variant.hairStyle === 'curly' ? 'energetic'
        : variant.accessory === 'headset' ? 'confident'
          : 'calm'

  const hairFront = useMemo(() => {
    if (accessory === 'hat') {
      return <Path d="M 86 170 C 90 128 110 100 144 100 C 178 100 198 128 202 170 C 190 142 170 132 144 132 C 118 132 98 142 86 170 Z" fill={variant.hair} />
    }
    switch (hairStyle) {
      case 'long':
        return <Path d="M 84 170 C 90 118 112 90 144 90 C 176 90 198 118 204 170 C 194 152 182 140 170 136 C 160 130 152 128 144 128 C 136 128 128 130 118 136 C 106 140 94 152 84 170 Z" fill={variant.hair} />
      case 'curly':
        return <Path d="M 82 170 C 86 120 104 92 144 92 C 184 92 202 120 198 170 C 190 146 180 136 170 132 C 160 126 152 126 144 126 C 136 126 128 126 118 132 C 108 136 98 146 82 170 Z" fill={variant.hair} />
      case 'side_part':
        return <Path d="M 86 170 C 90 120 110 92 144 92 C 178 92 198 120 202 170 C 192 146 174 134 144 132 C 116 130 98 144 86 170 Z" fill={variant.hair} />
      default:
        return <Path d="M 86 170 C 90 122 110 94 144 94 C 178 94 198 122 202 170 C 190 144 170 136 144 136 C 118 136 98 144 86 170 Z" fill={variant.hair} />
    }
  }, [accessory, hairStyle, variant.hair])

  return (
    <Svg width={size ?? '100%'} height={size ?? '100%'} viewBox="0 0 280 500">
      <Path d="M 92,268 C 68,278 48,310 42,344 L 32,500 L 256,500 L 246,344 C 240,310 220,278 196,268 L 178,261 C 171,274 162,280 144,280 C 126,280 117,274 110,261 Z" fill={variant.outfit} />
      <Path d="M 42,344 C 30,362 20,394 22,424 L 38,438 C 48,447 66,446 70,436 L 76,418 C 78,394 76,366 68,344 Z" fill={variant.outfit} />
      <Path d="M 246,344 C 258,362 268,394 266,424 L 250,438 C 240,447 222,446 218,436 L 212,418 C 210,394 212,366 220,344 Z" fill={variant.outfit} />
      <Ellipse cx={50} cy={440} rx={18} ry={12} fill={variant.skin} />
      <Ellipse cx={238} cy={440} rx={18} ry={12} fill={variant.skin} />

      <Path d="M 122 280 L 144 326 L 166 280 Z" fill={variant.skin} opacity={0.9} />
      <Path d="M 122 280 L 144 326 L 166 280" fill="none" stroke={outfitAccent} strokeWidth={4} />

      <Rect x={130} y={254} width={28} height={28} rx={7} fill={variant.skin} />
      <Ellipse cx={144} cy={196} rx={58} ry={64} fill={variant.skin} />
      <Ellipse cx={144} cy={160} rx={66} ry={78} fill={variant.hair} opacity={0.98} />

      {accessory === 'hat' ? (
        <G>
          <Path d="M 90 120 C 80 82 120 62 144 62 C 170 62 210 82 198 120 Z" fill={accessoryColor} stroke="#E5E7EB" strokeWidth={2} />
          <Ellipse cx={144} cy={120} rx={56} ry={14} fill={accessoryColor} stroke="#E5E7EB" strokeWidth={2} />
        </G>
      ) : null}

      {accessory === 'headset' ? (
        <G>
          <Path d="M 144 100 C 92 100 70 138 70 180" fill="none" stroke={accessoryColor} strokeWidth={8} />
          <Rect x={62} y={170} width={16} height={30} rx={5} fill={accessoryColor} />
          <Path d="M 70 190 C 80 230 110 240 125 240" fill="none" stroke={accessoryColor} strokeWidth={4} />
          <Circle cx={125} cy={240} r={5} fill={outfitAccent} />
        </G>
      ) : null}

      <Ellipse cx={144} cy={194} rx={58} ry={64} fill={variant.skin} />
      {facialHair === 'stubble' ? (
        <Path
          d="M 102 224 C 114 246 130 254 144 254 C 158 254 174 246 186 224 C 178 240 162 248 144 248 C 126 248 110 240 102 224 Z"
          fill={variant.skinShadow}
          opacity={0.3}
        />
      ) : null}
      <Ellipse cx={74} cy={196} rx={10} ry={14} fill={variant.skin} />
      <Ellipse cx={214} cy={196} rx={10} ry={14} fill={variant.skin} />

      {hairFront}
      <Path d="M 92 168 C 102 154 118 148 144 148 C 170 148 186 154 196 168" fill="none" stroke={variant.skinShadow} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      <Eyebrows color={variant.eyebrow} mood={mood} />
      <Eyes blinking={blinking} eyeColor={variant.eyeColor} skin={variant.skin} mood={mood} />
      {gender === 'female' && !blinking ? (
        <G stroke={variant.eyebrow} strokeWidth={2.2} strokeLinecap="round">
          <Line x1={112} y1={170} x2={106} y2={165} />
          <Line x1={117} y1={168} x2={113} y2={162} />
          <Line x1={176} y1={170} x2={182} y2={165} />
          <Line x1={171} y1={168} x2={175} y2={162} />
        </G>
      ) : null}
      <Path d="M 139 202 C 137 208 141 213 144 213 C 147 213 151 208 149 202" fill="none" stroke={variant.skinShadow} strokeWidth={2} strokeLinecap="round" />
      <MouthFrame frame={isTalking ? mouthFrame : 2} lip={variant.lip} />
    </Svg>
  )
}
