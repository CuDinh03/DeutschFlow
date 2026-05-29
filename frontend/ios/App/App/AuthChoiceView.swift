import SwiftUI

struct AuthChoiceView: View {
    var onRegister: () -> Void
    var onLogin: () -> Void

    @State private var appeared = false

    var body: some View {
        ZStack {
            DF.Brand.bg.ignoresSafeArea()

            DF.Brand.red
                .opacity(0.10)
                .blur(radius: 80)
                .frame(width: 300, height: 300)
                .offset(y: 80)

            VStack(spacing: 0) {
                Spacer()

                dLogo
                    .padding(.bottom, 32)
                    .opacity(appeared ? 1 : 0)
                    .scaleEffect(appeared ? 1 : 0.8)
                    .animation(DF.Spring.gentle, value: appeared)

                VStack(spacing: 10) {
                    Text("Bắt đầu hành trình")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundColor(.white)
                    Text("học tiếng Đức của bạn")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundColor(.white)
                }
                .multilineTextAlignment(.center)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 16)
                .animation(.easeOut(duration: 0.4).delay(0.1), value: appeared)
                .padding(.bottom, 12)

                Text("Tạo tài khoản miễn phí hoặc đăng nhập\nđể tiếp tục luyện tập.")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundColor(.white.opacity(0.48))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 12)
                    .animation(.easeOut(duration: 0.4).delay(0.17), value: appeared)

                Spacer()

                VStack(spacing: 14) {
                    Button(action: {
                        let impact = UIImpactFeedbackGenerator(style: .light)
                        impact.impactOccurred()
                        onRegister()
                    }) {
                        HStack(spacing: 10) {
                            Image(systemName: "person.badge.plus")
                                .font(.system(size: 17, weight: .semibold))
                            Text("Tạo tài khoản miễn phí")
                                .font(.system(size: 17, weight: .semibold))
                        }
                        .foregroundColor(DF.Brand.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(DF.Brand.yellow)
                        .clipShape(RoundedRectangle(cornerRadius: DF.Radius.md))
                        .shadow(color: DF.Brand.yellow.opacity(0.35), radius: 16, y: 6)
                    }

                    Button(action: {
                        let impact = UIImpactFeedbackGenerator(style: .light)
                        impact.impactOccurred()
                        onLogin()
                    }) {
                        HStack(spacing: 10) {
                            Image(systemName: "arrow.right.circle")
                                .font(.system(size: 17, weight: .regular))
                            Text("Đã có tài khoản? Đăng nhập")
                                .font(.system(size: 17, weight: .medium))
                        }
                        .foregroundColor(.white.opacity(0.75))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: DF.Radius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: DF.Radius.md)
                                .stroke(DF.Brand.cardBdr, lineWidth: 1)
                        )
                    }
                }
                .padding(.horizontal, 28)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 24)
                .animation(.easeOut(duration: 0.45).delay(0.25), value: appeared)

                Text("Miễn phí, không cần thẻ tín dụng")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(.white.opacity(0.28))
                    .padding(.top, 16)
                    .opacity(appeared ? 1 : 0)
                    .animation(.easeOut(duration: 0.4).delay(0.35), value: appeared)

                Spacer().frame(height: 48)
            }
        }
        .onAppear { appeared = true }
    }

    // ── Compact D-logo ────────────────────────────────────────────────────────

    private var dLogo: some View {
        ZStack {
            DOutline()
                .stroke(Color.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .miter))
            RedTriangle()
                .fill(DF.Brand.red)
            YellowSquare()
                .fill(DF.Brand.yellow)
        }
        .frame(width: 64, height: 64)
    }

    private struct DOutline: Shape {
        func path(in rect: CGRect) -> Path {
            let s = rect.width / 100
            var p = Path()
            p.move(to: CGPoint(x: 20*s, y: 18*s))
            p.addLine(to: CGPoint(x: 20*s, y: 82*s))
            p.addLine(to: CGPoint(x: 52*s, y: 82*s))
            p.addLine(to: CGPoint(x: 74*s, y: 62*s))
            p.addLine(to: CGPoint(x: 74*s, y: 38*s))
            p.addLine(to: CGPoint(x: 52*s, y: 18*s))
            p.closeSubpath()
            return p
        }
    }

    private struct RedTriangle: Shape {
        func path(in rect: CGRect) -> Path {
            let s = rect.width / 100
            var p = Path()
            p.move(to: CGPoint(x: 52*s, y: 38*s))
            p.addLine(to: CGPoint(x: 74*s, y: 50*s))
            p.addLine(to: CGPoint(x: 52*s, y: 62*s))
            p.closeSubpath()
            return p
        }
    }

    private struct YellowSquare: Shape {
        func path(in rect: CGRect) -> Path {
            let s = rect.width / 100
            return Path(CGRect(x: 24*s, y: 45*s, width: 9*s, height: 9*s))
        }
    }
}
