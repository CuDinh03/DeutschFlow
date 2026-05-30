import SwiftUI

// Single source of truth for the DeutschFlow 'D' logo geometry.
// Previously, SplashScreenView and AuthChoiceView each defined their own copies
// of these three shapes under slightly different names. All logo shape code now
// lives here so a visual change only needs one edit.

// ─── Shared shape primitives ──────────────────────────────────────────────────

struct DFOutlineShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 100.0
        var p = Path()
        p.move(to:    CGPoint(x: 20*s, y: 18*s))
        p.addLine(to: CGPoint(x: 20*s, y: 82*s))
        p.addLine(to: CGPoint(x: 52*s, y: 82*s))
        p.addLine(to: CGPoint(x: 74*s, y: 62*s))
        p.addLine(to: CGPoint(x: 74*s, y: 38*s))
        p.addLine(to: CGPoint(x: 52*s, y: 18*s))
        p.closeSubpath()
        return p
    }
}

struct DFRedTriangleShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 100.0
        var p = Path()
        p.move(to:    CGPoint(x: 52*s, y: 38*s))
        p.addLine(to: CGPoint(x: 74*s, y: 50*s))
        p.addLine(to: CGPoint(x: 52*s, y: 62*s))
        p.closeSubpath()
        return p
    }
}

struct DFYellowSquareShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 100.0
        return Path(CGRect(x: 24*s, y: 45*s, width: 9*s, height: 9*s))
    }
}

// ─── Animated variant — SplashScreenView ─────────────────────────────────────

struct DFLogoAnimated: View {
    var drawProgress: CGFloat
    var detailOpacity: CGFloat

    var body: some View {
        ZStack {
            DFOutlineShape()
                .trim(from: 0, to: drawProgress)
                .stroke(
                    Color.white,
                    style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .miter)
                )

            DFRedTriangleShape()
                .fill(DF.Brand.red)
                .opacity(detailOpacity)
                .scaleEffect(detailOpacity < 0.05 ? 0.4 : 1.0)

            DFYellowSquareShape()
                .fill(DF.Brand.yellow)
                .opacity(detailOpacity)
                .scaleEffect(detailOpacity < 0.05 ? 0.4 : 1.0)
        }
    }
}

// ─── Static variant — AuthChoiceView ─────────────────────────────────────────

struct DFLogoStatic: View {
    var size: CGFloat = 64

    var body: some View {
        ZStack {
            DFOutlineShape()
                .stroke(Color.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .miter))
            DFRedTriangleShape()
                .fill(DF.Brand.red)
            DFYellowSquareShape()
                .fill(DF.Brand.yellow)
        }
        .frame(width: size, height: size)
    }
}
