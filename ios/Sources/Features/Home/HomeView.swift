import SwiftUI
import Foundation
import OpenAPIRuntime

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
            let client = APIClientFactory.make()
            let output = try await client.me1(.init())
            switch output {
            case .ok(let ok):
                // The pinned spec declares responses as `*/*`, so the generated body is `.any`
                // (opaque). Decode AuthResponse manually for now. Once the backend's
                // springdoc.default-produces-media-type=application/json (PR #127) is deployed and
                // the spec re-pinned, switch to the typed accessor: `let me = try ok.body.json`.
                let bytes = try await Data(collecting: try ok.body.any, upTo: 1 * 1024 * 1024)
                let me = try JSONDecoder().decode(Components.Schemas.AuthResponse.self, from: bytes)
                status = "Xin chào \(me.displayName ?? me.email ?? "user") · role \(me.role ?? "?")"
            default:
                status = "Phản hồi không phải 200 (kiểm tra token/đăng nhập)."
            }
        } catch {
            status = "Lỗi gọi /api/auth/me: \(error.localizedDescription)"
        }
    }
}
