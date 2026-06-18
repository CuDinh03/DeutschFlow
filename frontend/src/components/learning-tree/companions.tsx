import * as React from 'react'

// companions.tsx — flat, stylized guide creatures that perch on the recommended node.
// Deliberately simple silhouettes (no big-eyed cartoon). Inline SVG, drawn ~24px around the origin.

export type CompanionChoice = 'owl' | 'bird' | 'butterfly' | 'squirrel' | 'none'

export const COMPANIONS: { id: CompanionChoice; label: string }[] = [
  { id: 'owl', label: 'Cú' },
  { id: 'bird', label: 'Chim' },
  { id: 'butterfly', label: 'Bướm' },
  { id: 'squirrel', label: 'Sóc' },
  { id: 'none', label: 'Không' },
]

const STROKE = '#5C4A33'

function Owl(): React.ReactElement {
  return (
    <g stroke={STROKE} strokeWidth={0.8}>
      <path d="M-8 -6 L-5 -1 L-9 -2 Z" fill="#8A5E37" />
      <path d="M8 -6 L5 -1 L9 -2 Z" fill="#8A5E37" />
      <ellipse cx={0} cy={2} rx={9} ry={11} fill="#A6794E" />
      <ellipse cx={0} cy={4} rx={5} ry={7} fill="#E8D5B5" stroke="none" />
      <circle cx={-3.4} cy={-2} r={2.6} fill="#FBFAF7" />
      <circle cx={3.4} cy={-2} r={2.6} fill="#FBFAF7" />
      <circle cx={-3.4} cy={-2} r={1.1} fill="#3A2E20" stroke="none" />
      <circle cx={3.4} cy={-2} r={1.1} fill="#3A2E20" stroke="none" />
      <path d="M0 0 L-1.5 2.4 L1.5 2.4 Z" fill="#E0A52E" />
    </g>
  )
}

function Bird(): React.ReactElement {
  return (
    <g stroke={STROKE} strokeWidth={0.8}>
      <path d="M-7 1 L-12 -1 L-10 4 Z" fill="#3F5F9C" />
      <ellipse cx={0} cy={2} rx={8} ry={6.5} fill="#5B86C9" />
      <path d="M-6 0 Q -10 6 -1 7 Q -3 2 -6 0 Z" fill="#3F5F9C" />
      <circle cx={4} cy={-4} r={4.5} fill="#5B86C9" />
      <circle cx={5.5} cy={-5} r={1} fill="#2A2A2A" stroke="none" />
      <path d="M8 -5 L12 -3.5 L8 -2.5 Z" fill="#E0A52E" />
    </g>
  )
}

function Butterfly(): React.ReactElement {
  return (
    <g stroke={STROKE} strokeWidth={0.7}>
      <ellipse cx={-5} cy={-3.5} rx={5.2} ry={5.5} fill="#9B7BC4" />
      <ellipse cx={5} cy={-3.5} rx={5.2} ry={5.5} fill="#9B7BC4" />
      <ellipse cx={-4} cy={4} rx={4} ry={4.5} fill="#C9963E" />
      <ellipse cx={4} cy={4} rx={4} ry={4.5} fill="#C9963E" />
      <ellipse cx={0} cy={0} rx={1.4} ry={8} fill="#5C4A33" stroke="none" />
      <path d="M-0.6 -7.5 Q -3 -11 -4.5 -11.5" fill="none" />
      <path d="M0.6 -7.5 Q 3 -11 4.5 -11.5" fill="none" />
    </g>
  )
}

function Squirrel(): React.ReactElement {
  return (
    <g stroke={STROKE} strokeWidth={0.8}>
      <path d="M6 7 Q 17 3 12 -8 Q 11 -1 5 1 Z" fill="#9C6A40" />
      <ellipse cx={-1} cy={3} rx={6} ry={7.5} fill="#B07A4E" />
      <ellipse cx={-1} cy={5} rx={3} ry={4.5} fill="#E8D5B5" stroke="none" />
      <circle cx={-2} cy={-4} r={4} fill="#B07A4E" />
      <circle cx={-4} cy={-7} r={1.8} fill="#9C6A40" />
      <circle cx={-2.7} cy={-4.5} r={1} fill="#2A2A2A" stroke="none" />
    </g>
  )
}

/** Renders the chosen creature as an SVG group around the origin (null for 'none'). */
export function CompanionGlyph({ choice }: { choice: CompanionChoice }): React.ReactElement | null {
  switch (choice) {
    case 'owl':
      return <Owl />
    case 'bird':
      return <Bird />
    case 'butterfly':
      return <Butterfly />
    case 'squirrel':
      return <Squirrel />
    default:
      return null
  }
}
