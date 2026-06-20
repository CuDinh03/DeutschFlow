import SwiftUI

extension Color {
    /// Hex initializer ("#RRGGBB" or "RRGGBB"), opaque.
    init(hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// GA design tokens — source of truth: `frontend/src/styles/galerie.css` (student accent = yellow).
/// Do NOT use the obsolete Expo theme (`mobile/lib/theme/tokens.ts`).
extension Color {
    static let gaBg = Color(hex: "FBFAF7")          // --ga-bg
    static let gaCard = Color(hex: "FFFFFF")        // --ga-card
    static let gaInk = Color(hex: "161513")         // --ga-ink
    static let gaMuted = Color(hex: "76716A")       // --ga-muted
    static let gaFaint = Color(hex: "C9C4BC")       // --ga-faint
    static let gaLine = Color(hex: "E7E3DA")        // --ga-line / border
    static let gaAccent = Color(hex: "FFCD00")      // --ga-yellow (accent)
    static let gaAccentSoft = Color(hex: "FFCD00").opacity(0.12) // --ga-yellow-soft
    static let gaBlue = Color(hex: "2F6FC9")        // --ga-blue (đã nộp)
    static let gaGreen = Color(hex: "1E9E61")       // --ga-green
    static let gaOrange = Color(hex: "E07B39")      // --ga-orange
    static let gaRed = Color(hex: "DA291C")         // --ga-red
    static let gaGold = Color(hex: "C79A00")        // --ga-gold
}
