// Mode-independent design scales. Semantic color mapping lives in themes.ts.
//
// v2 "Galerie" design language (2026-06-28): warm-paper editorial — Newsreader
// serif large-titles, Instrument Sans UI, hairline borders, SHARP corners (~4px),
// yellow-square motif. Token KEYS are kept stable across the v1→v2 reskin so every
// screen/component keeps compiling; only the VALUES changed.

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

// Galerie = sharp corners. Almost everything is ~4px; larger surfaces get a hair
// more. `full` stays for pills/circles.
export const radius = {
  sm: 4,
  md: 4,
  lg: 4,
  xl: 6,
  '2xl': 8,
  '3xl': 10,
  full: 9999,
} as const

// Font family names as registered by @expo-google-fonts loaders in _layout.tsx.
// v2: display/titles = Newsreader (serif), UI/body = Instrument Sans. Keys kept
// stable (displayBlack/…/monoBold) so the type scale + any direct refs still resolve.
export const fonts = {
  displayBlack: 'Newsreader_700Bold',
  displayBold: 'Newsreader_600SemiBold',
  displaySemi: 'Newsreader_500Medium',
  bodyRegular: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  bodySemi: 'InstrumentSans_600SemiBold',
  bodyBold: 'InstrumentSans_700Bold',
  // "mono" role retired in v2 — numbers use the serif; map to keep refs valid.
  monoMedium: 'InstrumentSans_500Medium',
  monoBold: 'Newsreader_600SemiBold',
} as const

// Role-based type scale. Display/title = Newsreader serif; body/label/caption =
// Instrument Sans; large numbers (monoLg) = serif.
export const type = {
  displayLg: { fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 42 },
  display: { fontFamily: fonts.displaySemi, fontSize: 30, lineHeight: 36 },
  titleLg: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.monoMedium, fontSize: 15, lineHeight: 20 },
  monoLg: { fontFamily: fonts.monoBold, fontSize: 24, lineHeight: 28 },
} as const

export type TypeVariant = keyof typeof type

export const motion = {
  duration: { fast: 150, normal: 250, slow: 400 },
  spring: {
    snappy: { damping: 18, stiffness: 220, mass: 1 },
    gentle: { damping: 20, stiffness: 120, mass: 1 },
    bouncy: { damping: 12, stiffness: 180, mass: 0.9 },
  },
  // Cubic ease-out-expo, used for timing-based reveals.
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
} as const
