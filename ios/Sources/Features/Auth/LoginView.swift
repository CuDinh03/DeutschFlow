import SwiftUI
import Foundation

/// Phase 1 — Auth: real `POST /api/auth/login` → `AuthResponse` → `session.didSignIn(...)`.
/// (Register / forgot-password come next in the Auth feature.)
struct LoginView: View {
    @Environment(AuthSession.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty && !loading
    }

    var body: some View {
        VStack(spacing: GaSpace.lg) {
            Spacer()
            Text("DeutschFlow").font(GaFont.displayXL).foregroundStyle(Color.gaInk)
            Text("Đăng nhập để tiếp tục").font(GaFont.body).foregroundStyle(Color.gaMuted)

            VStack(spacing: GaSpace.md) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                SecureField("Mật khẩu", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)

                if let error {
                    Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(loading ? "Đang đăng nhập…" : "Đăng nhập") { Task { await login() } }
                    .buttonStyle(.borderedProminent)
                    .tint(.gaAccent)
                    .frame(maxWidth: .infinity)
                    .disabled(!canSubmit)
            }
            .padding(GaSpace.lg)
            .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
            .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))

            NavigationLink("Chưa có tài khoản? Đăng ký") { RegisterView() }
                .font(GaFont.caption)
                .foregroundStyle(Color.gaAccent)

            Spacer()
        }
        .padding(GaSpace.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
    }

    private func login() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let client = APIClientFactory.make()
            let output = try await client.login(
                body: .json(.init(email: email.trimmingCharacters(in: .whitespaces), password: password))
            )
            switch output {
            case .ok(let ok):
                let auth = try ok.body.json
                guard let access = auth.accessToken else {
                    error = "Phản hồi thiếu access token."
                    return
                }
                await session.didSignIn(access: access, refresh: auth.refreshToken)
            default:
                error = "Email hoặc mật khẩu không đúng."
            }
        } catch {
            self.error = "Lỗi đăng nhập: \(error.localizedDescription)"
        }
    }
}
