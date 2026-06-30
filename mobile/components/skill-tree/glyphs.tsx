// Inline SVG glyphs for milestone + ground motifs. React Native has no
// "Material Symbols" font, so the design's `<text>`-as-icon glyphs would render
// as literal strings (spec M2). These draw the same shapes as <Path>/<Circle>
// children, centred at the origin so a parent <G transform="translate(x,y)">
// positions them. Sizes are tuned to the disc radii in SkillTreeView.

import { Circle, G, Path, Rect } from 'react-native-svg'

// Trophy — `passed` milestone (dark ink on the gold disc).
export function TrophyGlyph({ color = '#161513' }: { color?: string }) {
  return (
    <G>
      <Path d="M-6 -8 H6 V-5 Q6 1.5 0 1.5 Q-6 1.5 -6 -5 Z" fill={color} />
      <Path d="M-6 -7 Q-10 -7 -10 -3.5 Q-10 -0.5 -6 -0.5" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M6 -7 Q10 -7 10 -3.5 Q10 -0.5 6 -0.5" stroke={color} strokeWidth={1.6} fill="none" />
      <Rect x={-1.4} y={1} width={2.8} height={4} fill={color} />
      <Rect x={-4.6} y={5} width={9.2} height={2.6} rx={1} fill={color} />
    </G>
  )
}

// Padlock — `locked` milestone (muted sage on the parchment disc).
export function LockGlyph({ color = '#9AA593' }: { color?: string }) {
  return (
    <G>
      <Path
        d="M-3.2 -1 V-4 a3.2 3.2 0 0 1 6.4 0 V-1"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
      <Rect x={-5} y={-1} width={10} height={8.5} rx={1.6} fill={color} />
    </G>
  )
}

// Sprout — the seed at the base of the trunk (matches na-tree's seed motif).
export function SproutGlyph() {
  return (
    <G>
      <Path d="M0 9 Q-1 3 0 -2" stroke="#6F9460" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M0 2 Q-9 0 -11 -8 Q-3 -7 0 1 Z" fill="#7FA86A" />
      <Path d="M0 -1 Q9 -3 11 -11 Q3 -10 0 -4 Z" fill="#6E9B5C" />
      <Circle cx={0} cy={-5} r={2.2} fill="#FFCD00" />
    </G>
  )
}

// Check — the completion badge on a ripe (completed) fruit.
export function CheckGlyph({ color = '#fff' }: { color?: string }) {
  return (
    <Path
      d="M-3 0 L-1 2.4 L3.4 -2.8"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}
