import SwiftUI

/// Phase 0 placeholder. Phase 1 implements real `POST /api/auth/login` → `AuthResponse` →
/// `session.didSignIn(...)`. For the Phase 0 "Hello API" milestone you can paste a test JWT to
/// reach the signed-in shell and exercise `/api/auth/me`.
struct LoginView: View {
    @Environment(AuthSession.self) private var session
    @State private var pastedToken = ""

    var body: some View {
        VStack(spacing: GaSpace.xl) {
            Spacer()
            Text("DeutschFlow").font(GaFont.displayXL).foregroundStyle(Color.gaInk)

            VStack(alignment: .leading, spacing: GaSpace.sm) {
                Text("Dán JWT test (Phase 0)").font(GaFont.caption).foregroundStyle(Color.gaMuted)
                TextField("eyJ…", text: $pastedToken, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .font(GaFont.caption)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Vào app") {
                    let token = pastedToken.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !token.isEmpty else { return }
                    Task { await session.didSignIn(access: token, refresh: nil) }
                }
                .buttonStyle(.borderedProminent)
                .tint(.gaAccent)
                .disabled(pastedToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(GaSpace.lg)
            .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
            .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))

            Spacer()
        }
        .padding(GaSpace.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
    }
}
