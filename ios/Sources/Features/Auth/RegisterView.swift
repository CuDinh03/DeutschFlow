import SwiftUI
import Foundation

/// Phase 1 — Auth: real `POST /api/auth/register` (201 → `AuthResponse`) → `session.didSignIn(...)`.
/// Backend requires displayName + email + password + phoneNumber (VN); locale optional (default "vi").
/// Mirrors `LoginView`; pushed from Login via NavigationStack.
struct RegisterView: View {
    @Environment(AuthSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var email = ""
    @State private var phoneNumber = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    private var canSubmit: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty
            && !email.trimmingCharacters(in: .whitespaces).isEmpty
            && !phoneNumber.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 6
            && !loading
    }

    var body: some View {
        ScrollView {
            VStack(spacing: GaSpace.lg) {
                Text("Tạo tài khoản").font(GaFont.displayXL).foregroundStyle(Color.gaInk)
                Text("Bắt đầu hành trình tiếng Đức").font(GaFont.body).foregroundStyle(Color.gaMuted)

                VStack(spacing: GaSpace.md) {
                    TextField("Họ tên", text: $displayName)
                        .textContentType(.name)
                        .textFieldStyle(.roundedBorder)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                    TextField("Số điện thoại", text: $phoneNumber)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                        .textFieldStyle(.roundedBorder)
                    SecureField("Mật khẩu (≥ 6 ký tự)", text: $password)
                        .textContentType(.newPassword)
                        .textFieldStyle(.roundedBorder)

                    if let error {
                        Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button(loading ? "Đang tạo tài khoản…" : "Đăng ký") { Task { await register() } }
                        .buttonStyle(.borderedProminent)
                        .tint(.gaAccent)
                        .frame(maxWidth: .infinity)
                        .disabled(!canSubmit)
                }
                .padding(GaSpace.lg)
                .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
                .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))

                Button("Đã có tài khoản? Đăng nhập") { dismiss() }
                    .font(GaFont.caption)
                    .foregroundStyle(Color.gaAccent)
            }
            .padding(GaSpace.xl)
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func register() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let client = APIClientFactory.make()
            let output = try await client.register(
                body: .json(.init(
                    email: email.trimmingCharacters(in: .whitespaces),
                    phoneNumber: phoneNumber.trimmingCharacters(in: .whitespaces),
                    password: password,
                    displayName: displayName.trimmingCharacters(in: .whitespaces),
                    locale: "vi"
                ))
            )
            switch output {
            case .created(let created):
                let auth = try created.body.json
                guard let access = auth.accessToken else {
                    error = "Phản hồi thiếu access token."
                    return
                }
                await session.didSignIn(access: access, refresh: auth.refreshToken)
            default:
                error = "Đăng ký không thành công. Email hoặc số điện thoại có thể đã được dùng."
            }
        } catch {
            self.error = "Lỗi đăng ký: \(error.localizedDescription)"
        }
    }
}
