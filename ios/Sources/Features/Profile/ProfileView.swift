import SwiftUI

/// "Hồ sơ" tab — account identity + sign out + **account deletion**.
///
/// Account deletion is the App Store Guideline 5.1.1(v) requirement: an in-app path to
/// permanently delete the account. Wires `DELETE /api/profile/me` (operationId `deleteAccount`,
/// 204 No Content) behind a confirmation alert, then signs out.
struct ProfileView: View {
    @Environment(AuthSession.self) private var session
    @State private var name = ""
    @State private var email = ""
    @State private var deleting = false
    @State private var confirmDelete = false
    @State private var error: String?

    var body: some View {
        List {
            // Identity
            Section {
                HStack(spacing: GaSpace.md) {
                    ZStack {
                        Circle().fill(Color.gaAccentSoft).frame(width: 52, height: 52)
                        Text(initial).font(GaFont.displayL).foregroundStyle(Color.gaAccent)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name.isEmpty ? "—" : name).font(GaFont.body.bold()).foregroundStyle(Color.gaInk)
                        if !email.isEmpty {
                            Text(email).font(GaFont.caption).foregroundStyle(Color.gaMuted)
                        }
                    }
                    Spacer()
                }
                .padding(.vertical, 4)
            }

            if let error {
                Section {
                    Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed)
                }
            }

            Section {
                Button("Đăng xuất", role: .destructive) { Task { await session.signOut() } }
            }

            Section {
                Button(role: .destructive) {
                    confirmDelete = true
                } label: {
                    HStack {
                        Text("Xoá tài khoản")
                        if deleting {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(deleting)
            } footer: {
                Text("Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học tập. Hành động không thể hoàn tác.")
                    .font(GaFont.caption)
            }
        }
        .navigationTitle("Hồ sơ")
        .background(Color.gaBg)
        .task { await loadProfile() }
        .alert("Xoá tài khoản?", isPresented: $confirmDelete) {
            Button("Huỷ", role: .cancel) {}
            Button("Xoá vĩnh viễn", role: .destructive) { Task { await deleteAccount() } }
        } message: {
            Text("Toàn bộ dữ liệu học tập sẽ bị xoá và không thể khôi phục.")
        }
    }

    private var initial: String {
        let base = name.isEmpty ? email : name
        return base.isEmpty ? "?" : String(base.prefix(1)).uppercased()
    }

    private func loadProfile() async {
        do {
            let client = APIClientFactory.make()
            if case .ok(let ok) = try await client.me2(.init()) {
                let me = try ok.body.json
                name = me.displayName ?? ""
                email = me.email ?? ""
            }
        } catch {
            // Identity is cosmetic here; deletion still works without it.
        }
    }

    private func deleteAccount() async {
        deleting = true
        error = nil
        defer { deleting = false }
        do {
            let client = APIClientFactory.make()
            if case .noContent = try await client.deleteAccount(.init()) {
                await session.signOut()
            } else {
                error = "Không xoá được tài khoản. Vui lòng thử lại."
            }
        } catch {
            self.error = "Lỗi xoá tài khoản: \(error.localizedDescription)"
        }
    }
}
