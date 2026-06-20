import SwiftUI

/// Typography. Display = **Newsreader**, UI = **Instrument Sans** (both Google Fonts — bundle the
/// `.ttf` files into the app and register them in Info.plist `UIAppFonts`). `.custom` falls back to
/// the system font when the family is missing, so the app still renders before the fonts are bundled.
///
/// TODO(iOS): bundle Newsreader + Instrument Sans `.ttf`, add `UIAppFonts`, and confirm these
/// PostScript names against the actual files.
enum GaFont {
    private static let displayFamily = "Newsreader"
    private static let uiFamily = "InstrumentSans-Regular"

    static func display(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .custom(displayFamily, size: size).weight(weight)
    }
    static func ui(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom(uiFamily, size: size).weight(weight)
    }

    // Type scale from the prototype (display 24/22/20/18; ui 15/14/13).
    static var displayXL: Font { display(24, .semibold) }
    static var displayL: Font { display(22, .semibold) }
    static var displayM: Font { display(20, .semibold) }
    static var displayS: Font { display(18, .medium) }
    static var bodyL: Font { ui(15) }
    static var body: Font { ui(14) }
    static var caption: Font { ui(13) }
}
