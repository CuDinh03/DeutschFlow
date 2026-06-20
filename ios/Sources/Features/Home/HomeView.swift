import SwiftUI

/// Phase 0 "Hello API": once the generated client exists, calls `GET /api/auth/me` and shows the
/// real user — the Phase 0 Definition of Done. Phase 1 replaces this with the real Hôm nay screen
/// (`/api/today`, `/api/student`, `/api/progress`, `/api/xp`).
struct HomeView: View {
    @State private var status = "Chưa gọi API"
    @State private var loading = false

    var body: some View {
        VStack(alignment: .leading, spacing: GaSpace.lg) {
            Text("Hôm nay").font(GaFont.displayL).foregroundStyle(Color.gaInk)
            Text(status).font(GaFont.body).foregroundStyle(Color.gaMuted)
            Button(loading ? "Đang gọi…" : "Gọi /api/auth/me") {
                Task { await callMe() }
            }
            .buttonStyle(.borderedProminent).tint(.gaAccent).disabled(loading)
            Spacer()
        }
        .padding(GaSpace.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.gaBg)
        .navigationTitle("DeutschFlow")
    }

    private func callMe() async {
        loading = true
        defer { loading = false }
        do {
            // Bearer header is injected by AuthenticationMiddleware → Input has no auth param.
            // NOTE: `me2` is the generator's auto-name for `GET /api/auth/me` — several paths end
            // in `/me` (auth, plan, profile…) so the generator disambiguates with a numeric suffix
            // that can shift when the spec gains paths. Stable names need backend operationIds
            // (see ios/BUILD_AND_DEPLOY.md → "Known caveats").
            let client = APIClientFactory.make()
            let output = try await client.me2(.init())
            switch output {
            case .ok(let ok):
                let me = try ok.body.json
                status = "Xin chào \(me.displayName ?? me.email ?? "user") · role \(me.role ?? "?")"
            default:
                status = "Phản hồi không phải 200 (kiểm tra token/đăng nhập)."
            }
        } catch {
            status = "Lỗi gọi /api/auth/me: \(error.localizedDescription)"
        }
    }
}
