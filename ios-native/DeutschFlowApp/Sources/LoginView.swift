import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: AppSession
    @State private var email = ""
    @State private var password = ""
    @State private var submitting = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Tài khoản") {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Mật khẩu", text: $password)
                }

                if let error = session.lastError {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }

                Section {
                    Button {
                        Task {
                            submitting = true
                            await session.login(email: email, password: password)
                            submitting = false
                        }
                    } label: {
                        if submitting { ProgressView() } else { Text("Đăng nhập").bold() }
                    }
                    .disabled(submitting || email.isEmpty || password.isEmpty)
                }
            }
            .navigationTitle("DeutschFlow")
        }
    }
}
