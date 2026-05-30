import SwiftUI

// Shape primitives and DFLogoAnimated are defined in DFLogo.swift.

// ─── Splash Screen ────────────────────────────────────────────────────────

struct SplashScreenView: View {
    var onComplete: () -> Void

    @State private var drawProgress:   CGFloat = 0
    @State private var detailOpacity:  CGFloat = 0
    @State private var glowOpacity:    CGFloat = 0
    @State private var textOpacity:    CGFloat = 0
    @State private var taglineOpacity: CGFloat = 0

    var body: some View {
        ZStack {
            DF.Brand.bg.ignoresSafeArea()

            ZStack {
                DF.Brand.red
                    .opacity(0.22 * glowOpacity)
                    .blur(radius: 60)
                    .frame(width: 260, height: 260)

                DF.Brand.yellow
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
                            .foregroundColor(DF.Brand.red)
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
        withAnimation(.easeInOut(duration: 0.9)) {
            drawProgress = 1.0
        }
        withAnimation(.easeIn(duration: 0.55).delay(0.5)) {
            glowOpacity = 1.0
        }
        withAnimation(DF.Spring.snappy.delay(0.82)) {
            detailOpacity = 1.0
        }
        withAnimation(.easeOut(duration: 0.45).delay(1.05)) {
            textOpacity = 1.0
        }
        withAnimation(.easeOut(duration: 0.4).delay(1.35)) {
            taglineOpacity = 1.0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.75) {
            onComplete()
        }
    }
}
