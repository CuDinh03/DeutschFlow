import SwiftUI

// ─── Data ─────────────────────────────────────────────────────────────────

private struct OnboardingPage {
    let systemIcon: String
    let accentColor: Color
    let headline: String
    let body: String
}

private let onboardingPages: [OnboardingPage] = [
    OnboardingPage(
        systemIcon: "sparkles",
        accentColor: Color(red: 1.0, green: 0.804, blue: 0.0),
        headline: "Smart Vocabulary",
        body: "AI-powered spaced repetition keeps every word fresh. Build your German vocabulary at the perfect pace — automatically."
    ),
    OnboardingPage(
        systemIcon: "mic.fill",
        accentColor: Color(red: 0.855, green: 0.161, blue: 0.110),
        headline: "Speak with Confidence",
        body: "Practice real conversations with AI personas. Get instant feedback on pronunciation and fluency — no judgement."
    ),
    OnboardingPage(
        systemIcon: "checkmark.seal.fill",
        accentColor: Color(red: 0.855, green: 0.161, blue: 0.110),
        headline: "Get Certified",
        body: "Prepare for Goethe-Zertifikat with structured mock exams. Follow the A1 → B1 roadmap to your certificate."
    ),
]

// ─── Onboarding View ──────────────────────────────────────────────────────

struct OnboardingView: View {
    var onGetStarted: () -> Void

    @State private var currentPage = 0

    private let bgColor   = Color(red: 0.039, green: 0.039, blue: 0.059)
    private let brandRed  = Color(red: 0.855, green: 0.161, blue: 0.110)
    private let cardBg    = Color(white: 1, opacity: 0.045)
    private let cardBorder = Color(white: 1, opacity: 0.09)

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            // Subtle gradient overlay — warmer at bottom
            LinearGradient(
                colors: [
                    Color.clear,
                    brandRed.opacity(0.06)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button
                skipButton

                // Slide pages
                TabView(selection: $currentPage) {
                    ForEach(onboardingPages.indices, id: \.self) { index in
                        OnboardingPageView(
                            page: onboardingPages[index],
                            cardBg: cardBg,
                            cardBorder: cardBorder
                        )
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                // Footer: dots + CTA
                footer
                    .padding(.bottom, 48)
            }
        }
    }

    // ── Skip ────────────────────────────────────────────────────────────────

    private var skipButton: some View {
        HStack {
            Spacer()
            if currentPage < onboardingPages.count - 1 {
                Button("Skip") { finish() }
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.white.opacity(0.4))
                    .padding(.trailing, 24)
                    .padding(.top, 20)
            } else {
                Color.clear.frame(height: 44).padding(.top, 20)
            }
        }
        .frame(height: 44)
    }

    // ── Footer ──────────────────────────────────────────────────────────────

    private var footer: some View {
        VStack(spacing: 28) {
            // Page dots
            HStack(spacing: 8) {
                ForEach(onboardingPages.indices, id: \.self) { i in
                    Capsule()
                        .fill(i == currentPage ? Color.white : Color.white.opacity(0.2))
                        .frame(width: i == currentPage ? 22 : 6, height: 6)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentPage)
                }
            }

            // CTA
            Button {
                if currentPage < onboardingPages.count - 1 {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                        currentPage += 1
                    }
                } else {
                    finish()
                }
            } label: {
                Text(currentPage < onboardingPages.count - 1 ? "Continue" : "Get Started")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(brandRed)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
                            )
                    )
            }
            .padding(.horizontal, 28)
        }
    }

    private func finish() {
        UserDefaults.standard.set(true, forKey: "hasSeenOnboarding")
        onGetStarted()
    }
}

// ─── Single Slide ─────────────────────────────────────────────────────────

private struct OnboardingPageView: View {
    let page: OnboardingPage
    let cardBg: Color
    let cardBorder: Color

    @State private var visible = false

    var body: some View {
        VStack(spacing: 36) {
            Spacer()

            // Icon card
            ZStack {
                RoundedRectangle(cornerRadius: 32)
                    .fill(cardBg)
                    .overlay(
                        RoundedRectangle(cornerRadius: 32)
                            .stroke(cardBorder, lineWidth: 1)
                    )

                // Glow blob
                page.accentColor
                    .opacity(0.18)
                    .blur(radius: 50)
                    .frame(width: 130, height: 130)

                Image(systemName: page.systemIcon)
                    .font(.system(size: 62, weight: .light))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [page.accentColor, page.accentColor.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .scaleEffect(visible ? 1.0 : 0.7)
                    .opacity(visible ? 1.0 : 0.0)
                    .animation(.spring(response: 0.45, dampingFraction: 0.65).delay(0.05), value: visible)
            }
            .frame(width: 168, height: 168)
            .scaleEffect(visible ? 1.0 : 0.88)
            .opacity(visible ? 1.0 : 0.0)
            .animation(.spring(response: 0.5, dampingFraction: 0.7), value: visible)

            // Text block
            VStack(spacing: 16) {
                Text(page.headline)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .offset(y: visible ? 0 : 14)
                    .opacity(visible ? 1.0 : 0.0)
                    .animation(.easeOut(duration: 0.4).delay(0.12), value: visible)

                Text(page.body)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(.white.opacity(0.58))
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
                    .padding(.horizontal, 36)
                    .offset(y: visible ? 0 : 14)
                    .opacity(visible ? 1.0 : 0.0)
                    .animation(.easeOut(duration: 0.4).delay(0.2), value: visible)
            }

            Spacer()
            Spacer()
        }
        .onAppear {
            visible = true
        }
        .onDisappear {
            visible = false
        }
    }
}
