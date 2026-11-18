// Mode-independent design scales. Semantic color mapping lives in themes.ts.
//
// Nhận diện v3.4 "Warm Modern German EdTech" (18/11/2026, giống web
// docs/HE_THONG_THIET_KE_GIAO_DIEN_BEN_TRONG_V3.md): Newsreader cho tiêu đề, Be Vietnam Pro
// cho giao diện, bo góc mềm 8/12/18/24, bóng ấm. Trước đó là Galerie v2 (góc ~4px,
// Plus Jakarta Sans). KHOÁ token giữ nguyên qua các lần đổi để mọi màn vẫn biên dịch;
// chỉ GIÁ TRỊ đổi.

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

// v3.4: sm 8 (nhãn, ô nhỏ) · md 12 (ô nhập, phương án) · lg 18 (thẻ) · xl 24 (thẻ sân
// khấu) · 2xl/3xl cho tấm lớn. `full` cho nút viên thuốc và hình tròn.
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  full: 9999,
} as const

// Font family names as registered by @expo-google-fonts loaders in _layout.tsx.
// v3.4: display/titles = Newsreader (serif), UI/body = Be Vietnam Pro. Keys kept
// stable (displayBlack/…/monoBold) so the type scale + any direct refs still resolve.
// 06/09/2026: body đổi từ Instrument Sans → Plus Jakarta Sans vì Instrument Sans thiếu
// 50/70 glyph tiếng Việt (ơ ư ạ ả ấ ầ ẩ … ỹ Ư Ơ, kiểm bảng cmap TTF) → hệ điều hành
// fallback từng ký tự, chữ Việt lẫn hai kiểu nét. Newsreader đủ glyph nên giữ nguyên.
export const fonts = {
  displayBlack: 'Newsreader_700Bold',
  displayBold: 'Newsreader_600SemiBold',
  displaySemi: 'Newsreader_500Medium',
  bodyRegular: 'BeVietnamPro_400Regular',
  bodyMedium: 'BeVietnamPro_500Medium',
  bodySemi: 'BeVietnamPro_600SemiBold',
  bodyBold: 'BeVietnamPro_700Bold',
  // "mono" role retired in v2 — numbers use the serif; map to keep refs valid.
  monoMedium: 'BeVietnamPro_500Medium',
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

// Dynamic Type caps (iOS Settings → larger text). Per-variant so low-vision
// users still get meaningful scaling without the editorial v2 layout breaking:
// large serif display/titles are already big and overflow fastest, so they cap
// tighter; body/label scale more generously where it matters most for reading.
export const maxFontScale: Record<TypeVariant, number> = {
  displayLg: 1.25,
  display: 1.3,
  titleLg: 1.35,
  title: 1.4,
  bodyLg: 1.6,
  body: 1.6,
  bodyStrong: 1.6,
  label: 1.5,
  caption: 1.5,
  mono: 1.5,
  monoLg: 1.3,
}

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
