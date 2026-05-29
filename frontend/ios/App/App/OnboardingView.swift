import SwiftUI

// ─── Data ─────────────────────────────────────────────────────────────────

private enum OnboardingVisual {
    case grammarCards
    case symbol(String)
}

private struct OnboardingPage {
    let visual: OnboardingVisual
    let accentColor: Color
    let headline: String
    let germanHint: String?
    let body: String
}

private let onboardingPages: [OnboardingPage] = [
    OnboardingPage(
        visual: .grammarCards,
        accentColor: DF.Brand.yellow,
        headline: "Ngữ pháp bằng màu sắc",
        germanHint: "der · die · das",
        body: "Nhớ giống của danh từ tự nhiên qua hệ thống màu độc quyền — mỗi giống một màu, không cần học thuộc."
    ),
    OnboardingPage(
        visual: .symbol("mic.fill"),
        accentColor: DF.Brand.genderDer,
        headline: "Nói với AI Coach",
        germanHint: "„Wie geht es dir?"",
        body: "Luyện hội thoại tiếng Đức thực tế. Nhận sửa lỗi phát âm và ngữ pháp ngay lập tức — không ngại sai."
    ),
    OnboardingPage(
        visual: .symbol("arrow.triangle.2.circlepath"),
        accentColor: DF.Brand.genderDas,
        headline: "Ôn tập thông minh",
        germanHint: "Wiederholung",
        body: "Hệ thống lặp lại ngắt quãng (SRS) nhắc bạn ôn đúng từ vào đúng thời điểm để nhớ lâu dài."
    ),
    OnboardingPage(
        visual: .symbol("map.fill"),
        accentColor: DF.Brand.genderDie,
        headline: "Lộ trình A1 → B2",
        germanHint: "Goethe-Zertifikat",
        body: "Lộ trình cá nhân hóa do AI thiết kế riêng — hướng tới chứng chỉ Goethe theo tốc độ của bạn."
    ),
]

// ─── Onboarding View ──────────────────────────────────────────────────────

struct OnboardingView: View {
    var onGetStarted: () -> Void

    @State private var currentPage = 0

    var body: some View {
        ZStack {
            DF.Brand.bg.ignoresSafeArea()

            onboardingPages[currentPage].accentColor
                .opacity(0.10)
                .blur(radius: 90)
                .frame(width: 320, height: 320)
                .offset(y: -120)
                .animation(DF.Spring.gentle, value: currentPage)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                skipButton

                TabView(selection: $currentPage) {
                    ForEach(onboardingPages.indices, id: \.self) { index in
                        OnboardingPageView(page: onboardingPages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

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
                Button("Bỏ qua") { finish() }
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
            HStack(spacing: 8) {
                ForEach(onboardingPages.indices, id: \.self) { i in
                    Capsule()
                        .fill(i == currentPage ? DF.Brand.yellow : Color.white.opacity(0.2))
                        .frame(width: i == currentPage ? 22 : 6, height: 6)
                        .animation(DF.Spring.snappy, value: currentPage)
                }
            }

            Button {
                if currentPage < onboardingPages.count - 1 {
                    withAnimation(DF.Spring.snappy) { currentPage += 1 }
                } else {
                    finish()
                }
            } label: {
                Text(currentPage < onboardingPages.count - 1 ? "Tiếp tục" : "Bắt đầu")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(DF.Brand.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(
                        RoundedRectangle(cornerRadius: DF.Radius.md)
                            .fill(DF.Brand.yellow)
                            .shadow(color: DF.Brand.yellow.opacity(0.35), radius: 16, y: 6)
                    )
            }
            .simultaneousGesture(TapGesture().onEnded {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            })
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

    @State private var visible = false

    var body: some View {
        VStack(spacing: 36) {
            Spacer()

            Group {
                switch page.visual {
                case .grammarCards:
                    GrammarCardsVisual(visible: visible)
                case .symbol(let name):
                    SymbolVisual(systemIcon: name, accentColor: page.accentColor, visible: visible)
                }
            }
            .scaleEffect(visible ? 1.0 : 0.88)
            .opacity(visible ? 1.0 : 0.0)
            .animation(DF.Spring.gentle, value: visible)

            VStack(spacing: 14) {
                Text(page.headline)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .offset(y: visible ? 0 : 14)
                    .opacity(visible ? 1.0 : 0.0)
                    .animation(.easeOut(duration: 0.4).delay(0.12), value: visible)

                if let hint = page.germanHint {
                    Text(hint)
                        .font(.system(size: 14, weight: .semibold, design: .serif))
                        .foregroundColor(page.accentColor)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(page.accentColor.opacity(0.12)))
                        .overlay(Capsule().stroke(page.accentColor.opacity(0.25), lineWidth: 1))
                        .offset(y: visible ? 0 : 14)
                        .opacity(visible ? 1.0 : 0.0)
                        .animation(.easeOut(duration: 0.4).delay(0.18), value: visible)
                }

                Text(page.body)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(.white.opacity(0.58))
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
                    .padding(.horizontal, 36)
                    .offset(y: visible ? 0 : 14)
                    .opacity(visible ? 1.0 : 0.0)
                    .animation(.easeOut(duration: 0.4).delay(0.24), value: visible)
            }

            Spacer()
            Spacer()
        }
        .onAppear  { visible = true  }
        .onDisappear { visible = false }
    }
}

// ─── SF Symbol visual ─────────────────────────────────────────────────────

private struct SymbolVisual: View {
    let systemIcon: String
    let accentColor: Color
    let visible: Bool

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: DF.Radius.xxl)
                .fill(DF.Brand.cardBg)
                .overlay(
                    RoundedRectangle(cornerRadius: DF.Radius.xxl)
                        .stroke(DF.Brand.cardBdr, lineWidth: 1)
                )

            accentColor
                .opacity(0.18)
                .blur(radius: 50)
                .frame(width: 130, height: 130)

            Image(systemName: systemIcon)
                .font(.system(size: 62, weight: .light))
                .foregroundStyle(
                    LinearGradient(
                        colors: [accentColor, accentColor.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .scaleEffect(visible ? 1.0 : 0.7)
                .opacity(visible ? 1.0 : 0.0)
                .animation(DF.Spring.gentle.delay(0.05), value: visible)
        }
        .frame(width: 168, height: 168)
    }
}

// ─── Grammar colour cards ─────────────────────────────────────────────────

private struct GrammarCardsVisual: View {
    let visible: Bool

    private struct Gender {
        let article: String
        let noun: String
        let color: Color
    }

    private let genders: [Gender] = [
        Gender(article: "der", noun: "Mann", color: DF.Brand.genderDer),
        Gender(article: "die", noun: "Frau", color: DF.Brand.genderDie),
        Gender(article: "das", noun: "Kind", color: DF.Brand.genderDas),
    ]

    var body: some View {
        HStack(spacing: 12) {
            ForEach(genders.indices, id: \.self) { i in
                let g = genders[i]
                VStack(spacing: 6) {
                    Text(g.article)
                        .font(.system(size: 20, weight: .bold, design: .serif))
                        .foregroundColor(g.color)
                    Text(g.noun)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white.opacity(0.85))
                }
                .frame(width: 84, height: 96)
                .background(
                    RoundedRectangle(cornerRadius: DF.Radius.xl)
                        .fill(g.color.opacity(0.12))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: DF.Radius.xl)
                        .stroke(g.color.opacity(0.35), lineWidth: 1.5)
                )
                .scaleEffect(visible ? 1.0 : 0.7)
                .opacity(visible ? 1.0 : 0.0)
                .animation(
                    DF.Spring.gentle.delay(0.08 + Double(i) * 0.1),
                    value: visible
                )
            }
        }
        .frame(height: 168)
    }
}
