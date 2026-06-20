import SwiftUI

/// Motion. `--ga-ease-out` = `cubic-bezier(0.2, 0.8, 0.2, 1)`.
enum GaMotion {
    static func easeOut(_ duration: Double = 0.3) -> Animation {
        .timingCurve(0.2, 0.8, 0.2, 1, duration: duration)
    }
    static let standard = easeOut()
}
