import CoreGraphics

/// Corner radius. Native **overrides** the web token (`--ga-radius: 2px`) → **6**
/// (decided in the prototype Tweaks panel).
enum GaRadius {
    static let card: CGFloat = 6
    static let control: CGFloat = 6
    static let pill: CGFloat = 999
}
