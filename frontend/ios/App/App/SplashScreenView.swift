import SwiftUI

// ─── D-shape outline path ──────────────────────────────────────────────────

private struct DOutlineShape: Shape {
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

private struct RedTriangleShape: Shape {
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

private struct YellowSquareShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 100.0
        return Path(CGRect(x: 24*s, y: 45*s, width: 9*s, height: 9*s))
    }
}

// ─── Animated D-logo ──────────────────────────────────────────────────────

private struct DFLogoAnimated: View {
    var drawProgress: CGFloat
    var detailOpacity: CGFloat

    private let brandRed    = Color(red: 0.855, green: 0.161, blue: 0.110)
    private let brandYellow = Color(red: 1.0,   green: 0.804, blue: 0.0)

    var body: some View {
        ZStack {
            DOutlineShape()
                .trim(from: 0, to: drawProgress)
                .stroke(
                    Color.white,
                    style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .miter)
                )

            RedTriangleShape()
                .fill(brandRed)
                .opacity(detailOpacity)
                .scaleEffect(detailOpacity < 0.05 ? 0.4 : 1.0)

            YellowSquareShape()
                .fill(brandYellow)
                .opacity(detailOpacity)
                .scaleEffect(detailOpacity < 0.05 ? 0.4 : 1.0)
        }
    }
}

// ─── Splash Screen ────────────────────────────────────────────────────────

struct SplashScreenView: View {
    var onComplete: () -> Void

    @State private var drawProgress:   CGFloat = 0
    @State private var detailOpacity:  CGFloat = 0
    @State private var glowOpacity:    CGFloat = 0
    @State private var textOpacity:    CGFloat = 0
    @State private var taglineOpacity: CGFloat = 0

    private let bgColor     = Color(red: 0.039, green: 0.039, blue: 0.059)
    private let brandRed    = Color(red: 0.855, green: 0.161, blue: 0.110)
    private let brandYellow = Color(red: 1.0,   green: 0.804, blue: 0.0)

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            // Ambient glow behind logo
            ZStack {
                brandRed
                    .opacity(0.22 * glowOpacity)
                    .blur(radius: 60)
                    .frame(width: 260, height: 260)

                brandYellow
                    .opacity(0.08 * glowOpacity)
                    .blur(radius: 80)
                    .frame(width: 220, height: 220)
                    .offset(y: 30)
            }

            VStack(spacing: 32) {
                DFLogoAnimated(drawProgress: drawProgress, detailOpacity: detailOpacity)
                    .frame(width: 120, height: 120)

                VStack(spacing: 8) {
                    HStack(alignment: .lastTextBaseline, spacing: 0) {
                        Text("my")
                            .font(.system(size: 26, weight: .thin))
                            .foregroundColor(.white)
                        Text("Deutsch")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundColor(.white)
                        Text("Flow")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundColor(brandRed)
                    }
                    .opacity(textOpacity)

                    Text("GERMAN LANGUAGE LEARNING")
                        .font(.system(size: 10.5, weight: .regular))
                        .tracking(3.5)
                        .foregroundColor(.white.opacity(0.4))
                        .opacity(taglineOpacity)
                }
            }
        }
        .onAppear { runAnimation() }
    }

    private func runAnimation() {
        // 1. Draw D outline
        withAnimation(.easeInOut(duration: 0.9)) {
            drawProgress = 1.0
        }
        // 2. Glow blooms
        withAnimation(.easeIn(duration: 0.55).delay(0.5)) {
            glowOpacity = 1.0
        }
        // 3. Triangle + square pop in
        withAnimation(.spring(response: 0.38, dampingFraction: 0.58).delay(0.82)) {
            detailOpacity = 1.0
        }
        // 4. Brand text fades in
        withAnimation(.easeOut(duration: 0.45).delay(1.05)) {
            textOpacity = 1.0
        }
        // 5. Tagline
        withAnimation(.easeOut(duration: 0.4).delay(1.35)) {
            taglineOpacity = 1.0
        }
        // 6. Hold then complete
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.75) {
            onComplete()
        }
    }
}
