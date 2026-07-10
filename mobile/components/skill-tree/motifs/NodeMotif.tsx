// Lifecycle motifs for each lesson — the "ripeness" metaphor ported from
// na-tree.jsx to react-native-svg. completed = ripe fruit + ✓; in_progress =
// open flower (+ pulsing bloom); available = green bud; locked = grey nub. Plus
// the recommended-node ring + companion emoji, and a cosmetic skill dot.
//
// Web rotations are ported via react-native-svg's `rotation`/`originX`/`originY`
// props (rotate about an explicit pivot) rather than the web `rotate(a x y)`
// string, which does not port reliably. Decorative motion (bloom pulse, ring
// spin) is gated by `reduced` so reduced-motion users get the static shapes.

import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg'
import type { SkillNode } from '@/lib/skillTreeApi'
import { CheckGlyph } from '../glyphs'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

const PETAL_ANGLES = [0, 72, 144, 216, 288]
const PETAL_DIST = 11

function CompletedMotif({ success }: { success: string }) {
  return (
    <G>
      <Ellipse cx={0} cy={-17} rx={5} ry={8} fill="#5E7C3F" rotation={-18} />
      <Circle r={15} fill="url(#naRipe)" stroke="#C2611A" strokeWidth={1} />
      <Ellipse cx={-5} cy={-5} rx={4} ry={6} fill="#fff" opacity={0.45} />
      <G transform="translate(12,12)">
        <Circle r={8} fill={success} stroke="#fff" strokeWidth={1.5} />
        <CheckGlyph />
      </G>
    </G>
  )
}

function InProgressMotif() {
  return (
    <G>
      {PETAL_ANGLES.map((a) => {
        const rad = (a * Math.PI) / 180
        const px = Math.cos(rad) * PETAL_DIST
        const py = Math.sin(rad) * PETAL_DIST
        return (
          <Ellipse
            key={a}
            cx={px}
            cy={py}
            rx={6.5}
            ry={9}
            fill="#F7DCE6"
            stroke="#E8A9C0"
            strokeWidth={0.8}
            rotation={a + 90}
            originX={px}
            originY={py}
          />
        )
      })}
      <Circle r={7} fill="#FFCD00" stroke="#E0A800" strokeWidth={1} />
    </G>
  )
}

function AvailableMotif() {
  return (
    <G>
      <Ellipse cx={0} cy={-15} rx={4.5} ry={7} fill="#5E7C3F" rotation={-20} />
      <Circle r={12.5} fill="url(#naBud)" stroke="#6F9460" strokeWidth={1.5} />
      <Path d="M 0 -7 Q 4 0 0 8 Q -4 0 0 -7 Z" fill="#7FA86A" opacity={0.55} />
    </G>
  )
}

function LockedMotif() {
  return <Circle r={11} fill="#AEBCA4" stroke="#94A589" strokeWidth={1.2} />
}

export function NodeMotif({ status, success }: { status: SkillNode['status']; success: string }) {
  if (status === 'COMPLETED') return <CompletedMotif success={success} />
  if (status === 'IN_PROGRESS') return <InProgressMotif />
  if (status === 'AVAILABLE') return <AvailableMotif />
  return <LockedMotif />
}

// The foundation "root/seed" motif (#6) for the lowest tier's kiến-thức-nền lessons: a seed at
// the ground with little roots — closed when locked, cracking open / sprouting as it becomes
// available/in-progress, an established rooted seed when completed. Distinct from the fruit
// lifecycle so the base of the tree reads as roots, not fruit floating at the ground.
export function RootMotif({ status }: { status: SkillNode['status'] }) {
  const seedFill = status === 'LOCKED' ? '#C4B49A' : '#C89A5E'
  const seedStroke = status === 'LOCKED' ? '#A69A82' : '#8A6A3F'
  return (
    <G opacity={status === 'LOCKED' ? 0.7 : 1}>
      {/* roots reaching into the soil */}
      <Path d="M -6 9 Q -12 16 -15 24" stroke="#6B4F2C" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
      <Path d="M 0 11 Q 0 18 0 26" stroke="#6B4F2C" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
      <Path d="M 6 9 Q 12 16 15 24" stroke="#6B4F2C" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
      {/* the seed */}
      <Ellipse cx={0} cy={2} rx={11} ry={13} fill={seedFill} stroke={seedStroke} strokeWidth={1.4} />
      {status === 'COMPLETED' ? (
        <G>
          <Path d="M 0 -9 Q 3 2 0 12" stroke={seedStroke} strokeWidth={1} fill="none" opacity={0.6} />
          <Path d="M 0 -8 Q -8 -14 -12 -22 Q -4 -20 0 -11 Z" fill="#5E7C3F" />
          <Path d="M 0 -9 Q 8 -15 12 -23 Q 4 -21 0 -12 Z" fill="#6E9B5C" />
        </G>
      ) : status === 'IN_PROGRESS' ? (
        <G>
          <Path d="M 0 -8 Q -8 -13 -11 -20 Q -3 -18 0 -10 Z" fill="#7FA86A" />
          <Path d="M 0 -9 Q 8 -14 11 -21 Q 3 -19 0 -11 Z" fill="#6E9B5C" />
        </G>
      ) : status === 'AVAILABLE' ? (
        <G>
          <Path d="M -4 -9 Q 0 -2 4 -9" stroke={seedStroke} strokeWidth={1.2} fill="none" />
          <Circle cx={0} cy={-10} r={3} fill="#7FA86A" />
        </G>
      ) : null}
    </G>
  )
}

// Pulsing halo behind an in-progress flower. Static under reduced motion.
export function BloomHalo({ reduced }: { reduced: boolean }) {
  const o = useSharedValue(0.18)
  useEffect(() => {
    if (reduced) {
      o.value = 0.18
      return
    }
    o.value = withRepeat(withTiming(0.26, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true)
    return () => cancelAnimation(o)
  }, [reduced, o])
  const props = useAnimatedProps(() => ({ opacity: o.value }))
  if (reduced) return <Circle r={24} fill="#FFCD00" opacity={0.18} />
  return <AnimatedCircle r={24} fill="#FFCD00" animatedProps={props} />
}

// Slowly rotating dashed gold ring around the recommended node. Static dashed
// ring under reduced motion (the dash, not the spin, is what signals "next").
export function RecRing({ reduced }: { reduced: boolean }) {
  const spin = useSharedValue(0)
  useEffect(() => {
    if (reduced) {
      spin.value = 0
      return
    }
    spin.value = withRepeat(withTiming(360, { duration: 16000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(spin)
  }, [reduced, spin])
  const props = useAnimatedProps(() => ({ transform: `rotate(${spin.value})` }))
  if (reduced) return <Circle r={26} fill="none" stroke="#FFCD00" strokeWidth={2.5} strokeDasharray="3 5" />
  return (
    <AnimatedG animatedProps={props}>
      <Circle r={26} fill="none" stroke="#FFCD00" strokeWidth={2.5} strokeDasharray="3 5" />
    </AnimatedG>
  )
}

// The companion mascot perched on the recommended node.
export function CompanionEmoji({ emoji }: { emoji: string }) {
  return (
    <SvgText x={20} y={-14} fontSize={24} textAnchor="middle">
      {emoji}
    </SvgText>
  )
}

// Cosmetic skill accent dot at the fruit's lower-left (Pha 2: cycled, not real data).
export function SkillBadge({ color }: { color: string }) {
  return (
    <G transform="translate(-12,13)">
      <Circle r={8.5} fill={color} stroke="#fff" strokeWidth={1.5} />
    </G>
  )
}
