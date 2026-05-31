// Mode-independent design scales. Semantic color mapping lives in themes.ts.

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

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const

// Font family names as registered by @expo-google-fonts loaders in _layout.tsx.
export const fonts = {
  displayBlack: 'Sora_800ExtraBold',
  displayBold: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  bodyRegular: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const

// Role-based type scale. Display uses Sora, UI/body uses Plus Jakarta, numbers use mono.
export const type = {
  displayLg: { fontFamily: fonts.displayBlack, fontSize: 34, lineHeight: 40 },
  display: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34 },
  titleLg: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28 },
  title: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.monoMedium, fontSize: 15, lineHeight: 20 },
  monoLg: { fontFamily: fonts.monoBold, fontSize: 22, lineHeight: 26 },
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
