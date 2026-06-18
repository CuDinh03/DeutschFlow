// palette.ts — color tokens for the learning-tree renderer.
//
// The layout engine is color-agnostic (it emits `colorSlot`/`state` tokens). This module is the
// single place that turns those into hex, using the Claude Design prototype's palette
// (tree-data.js topicGroupColor / branch.skills / bark). Pure — snapshot-testable.

import type { Skill, TopicGroup, MilestoneState } from '@/lib/learning-tree/core'

export const BARK = { dark: '#352B21', mid: '#564636', light: '#6E5A45' } as const

export interface GroupColor {
  name: string
  leaf: string
  dark: string
  soft: string
}

/** Leaf colour family per topic group — drives the canopy/leaf hue. */
export const GROUP_COLORS: Record<TopicGroup, GroupColor> = {
  daily: { name: 'Đời sống', leaf: '#6FA85B', dark: '#4E7E3C', soft: '#B2D6A1' },
  work: { name: 'Công việc', leaf: '#5B86C9', dark: '#39599C', soft: '#AEC6E8' },
  travel: { name: 'Du lịch', leaf: '#C9963E', dark: '#9C6F23', soft: '#E8C788' },
  medical: { name: 'Y tế', leaf: '#3FA59B', dark: '#287A71', soft: '#98CFC8' },
  culture: { name: 'Văn hóa', leaf: '#9B7BC4', dark: '#74559E', soft: '#CBB7E4' },
  exam: { name: 'Luyện thi', leaf: '#D4A53A', dark: '#A77E1C', soft: '#EED391' },
}

/**
 * Skill colour — the single distinct signal carried on an icon-only node badge (Nghe/Nói/Đọc/Viết).
 * Topic chips deliberately stay neutral (see TOPIC_CHIP) so the two systems never collide.
 */
export const SKILL_COLORS: Record<Skill, string> = {
  hoeren: '#4F86E0', // Nghe
  sprechen: '#E8853A', // Nói
  lesen: '#5E9150', // Đọc
  schreiben: '#8257D8', // Viết
}

/** Muted, warm-neutral palette for topic chips — icon + text carry topic; colour stays quiet. */
export const TOPIC_CHIP = {
  bg: '#EFEAE0',
  border: '#E0D8C8',
  text: '#6B6457',
  icon: '#8A8170',
} as const

export const SKILL_LABELS: Record<Skill, string> = {
  hoeren: 'Nghe',
  sprechen: 'Nói',
  lesen: 'Đọc',
  schreiben: 'Viết',
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Linear blend of two hex colours; `t` 0→a, 1→b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return (
    '#' +
    [0, 1, 2]
      .map((i) => clampByte(ca[i] + (cb[i] - ca[i]) * t)
        .toString(16)
        .padStart(2, '0'))
      .join('')
  )
}

/** Bark-tinted fill for a skill branch (keeps branches woody, not candy-coloured). */
export function branchFill(skill: Skill): string {
  return mix(BARK.mid, SKILL_COLORS[skill], 0.22)
}

export interface MilestoneColors {
  ringFill: string
  ringStroke: string
  text: string
  /** Halo colour for passed/ready milestones; null = no halo. */
  glow: string | null
  dashed: boolean
}

export function milestoneColors(state: MilestoneState): MilestoneColors {
  switch (state) {
    case 'passed':
      return { ringFill: '#FFCD00', ringStroke: '#B8911C', text: '#161513', glow: '#FFCD00', dashed: false }
    case 'ready':
      return { ringFill: '#FFE27A', ringStroke: '#C79A1E', text: '#161513', glow: '#FFE27A', dashed: false }
    case 'in_progress':
      return { ringFill: '#FBFAF7', ringStroke: '#161513', text: '#161513', glow: null, dashed: false }
    default:
      return { ringFill: '#EFEAE0', ringStroke: '#C9C2B6', text: '#9A9384', glow: null, dashed: true }
  }
}
