import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const VIEW_FILES = [
  'GrammarView.tsx',
  'ReadingView.tsx',
  'ListeningView.tsx',
  'SpeakingView.tsx',
  'WritingView.tsx',
]

describe('learning skill views — Galerie visual contract', () => {
  it.each(VIEW_FILES)('%s uses explicit transitions and Galerie radii', (file) => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/learn', file), 'utf8')

    expect(source).not.toMatch(/\btransition-all\b/)
    expect(source).not.toMatch(/\brounded-(?:xl|2xl|3xl)\b/)
  })

  it.each(VIEW_FILES)('%s uses semantic palette classes', (file) => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/learn', file), 'utf8')

    expect(source).not.toMatch(/(?:text|bg|border|from|to|hover:bg|focus:border)-\[#[0-9a-f]{3,8}\]/i)
    expect(source).not.toMatch(/(?:text|bg|border|from|to|hover:bg)-(?:red|green|blue|indigo|amber|yellow|orange|slate|gray)-\d+/)
    expect(source).not.toMatch(/ga-[a-z-]+0(?:\b|\/)/)
  })
})
