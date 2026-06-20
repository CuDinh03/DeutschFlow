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
        // TODO(Phase 0, after codegen): wire the generated client, e.g.
        //   let client = APIClientFactory.make()
        //   let me = try await client.<getCurrentUserOperationId>()
        //   status = "Xin chào \(me.displayName ?? "user")"
        status = "TODO: nối APIClientFactory sau khi chạy swift-openapi-generator (xem ios/README.md)."
    }
}
