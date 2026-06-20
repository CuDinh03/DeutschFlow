import SwiftUI

/// Generic "coming soon" tab body for Phase 1+ features.
struct PlaceholderScreen: View {
    let title: String
    var body: some View {
        VStack(spacing: GaSpace.md) {
            Text(title).font(GaFont.displayL).foregroundStyle(Color.gaInk)
            Text("Sắp có (Phase 1+)").font(GaFont.body).foregroundStyle(Color.gaMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
        .navigationTitle(title)
    }
}

/// Hồ sơ tab stub — sign out works; account deletion is the App Store 5.1.1(v) requirement,
/// wired in Phase 1.
struct ProfilePlaceholder: View {
    @Environment(AuthSession.self) private var session

    var body: some View {
        List {
            Section {
                Button("Đăng xuất", role: .destructive) { Task { await session.signOut() } }
            }
            Section {
                Button("Xoá tài khoản", role: .destructive) { /* TODO(Phase 1) */ }
                    .disabled(true)
            } footer: {
                Text("Guideline 5.1.1(v): xoá tài khoản trong app → DELETE /api/profile/me (nối ở Phase 1).")
                    .font(GaFont.caption)
            }
        }
        .navigationTitle("Hồ sơ")
    }
}
