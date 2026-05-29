import SwiftUI

// Single source of truth for DeutschFlow design tokens.
// Web equivalents live in src/app/globals.css and src/lib/motion.ts.
enum DF {

    // MARK: – Radius (mirrors CSS --radius-* tokens)
    enum Radius {
        static let xs:  CGFloat = 8
        static let sm:  CGFloat = 10
        static let md:  CGFloat = 14   // buttons — aligns with web --radius-md
        static let lg:  CGFloat = 16   // cards   — aligns with web --radius-lg
        static let xl:  CGFloat = 24   // large cards
        static let xxl: CGFloat = 32   // hero visuals
    }

    // MARK: – Spring (mirrors src/lib/motion.ts spring presets)
    enum Spring {
        static let gentle = Animation.spring(response: 0.5, dampingFraction: 0.8)
        static let snappy = Animation.spring(response: 0.3, dampingFraction: 0.75)
        static let micro  = Animation.spring(response: 0.2, dampingFraction: 0.9)
    }

    // MARK: – Brand palette
    enum Brand {
        static let bg       = Color(red: 0.039, green: 0.039, blue: 0.059) // #0A0A0F
        static let black    = Color(red: 0.071, green: 0.071, blue: 0.071) // #121212
        static let yellow   = Color(red: 1.0,   green: 0.804, blue: 0.0)   // #FFCD00
        static let red      = Color(red: 0.855, green: 0.161, blue: 0.110) // #DA291C
        static let cardBg   = Color(white: 1, opacity: 0.045)
        static let cardBdr  = Color(white: 1, opacity: 0.09)
        static let genderDer = Color(red: 0.231, green: 0.510, blue: 0.965) // #3b82f6
        static let genderDie = Color(red: 0.937, green: 0.267, blue: 0.267) // #ef4444
        static let genderDas = Color(red: 0.133, green: 0.773, blue: 0.369) // #22c55e
    }

    // MARK: – UIKit colours (for UIViewController backgrounds)
    enum UIKit {
        static let bg = UIColor(red: 0.039, green: 0.039, blue: 0.059, alpha: 1)
    }
}
