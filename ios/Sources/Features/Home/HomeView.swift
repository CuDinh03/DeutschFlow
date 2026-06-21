import SwiftUI

/// Phase 1 — "Hôm nay": real dashboard. Greeting from `GET /api/auth/me` (me2) + live stats from
/// `GET /api/student/dashboard` (dashboard → StudentDashboardResponse). Replaces the Phase-0 hello.
struct HomeView: View {
    @Environment(AuthSession.self) private var session
    @State private var name = ""
    @State private var streak = 0
    @State private var weeklyXp = 0
    @State private var progress = 0
    @State private var sessionsWeek = 0
    @State private var minutesWeek = 0
    @State private var dueCount = 0
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: GaSpace.lg) {
                Text("Hôm nay").font(GaFont.displayL).foregroundStyle(Color.gaInk)
                Text(name.isEmpty ? "Chào mừng trở lại 👋" : "Xin chào, \(name) 👋")
                    .font(GaFont.body).foregroundStyle(Color.gaMuted)

                if loading {
                    ProgressView().tint(.gaAccent).frame(maxWidth: .infinity).padding(.top, GaSpace.xl)
                } else if let error {
                    VStack(spacing: GaSpace.md) {
                        Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Button("Thử lại") { Task { await load() } }
                            .buttonStyle(.bordered).tint(.gaAccent)
                    }
                    .padding(GaSpace.lg)
                    .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
                    .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: GaSpace.md) {
                        stat("Chuỗi ngày", "\(streak)", "🔥")
                        stat("XP tuần này", "\(weeklyXp)", "⚡️")
                        stat("Tiến độ lộ trình", "\(progress)%", "🎯")
                        stat("Buổi học tuần này", "\(sessionsWeek)", "✅")
                    }
                    statWide("Phút học tuần này", "\(minutesWeek) phút")

                    NavigationLink { ReviewView() } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Ôn tập từ vựng (SRS)").font(GaFont.body.bold()).foregroundStyle(Color.gaInk)
                                Text("\(dueCount) thẻ đến hạn hôm nay").font(GaFont.caption).foregroundStyle(Color.gaMuted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(Color.gaMuted)
                        }
                        .padding(GaSpace.md)
                        .background(Color.gaAccentSoft, in: RoundedRectangle(cornerRadius: GaRadius.card))
                        .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(GaSpace.xl)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
        .navigationTitle("DeutschFlow")
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Đăng xuất") { Task { await session.signOut() } } } }
        .task { await load() }
    }

    private func stat(_ label: String, _ value: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(icon).font(.system(size: 20))
            Text(value).font(GaFont.displayL).foregroundStyle(Color.gaInk)
            Text(label).font(GaFont.caption).foregroundStyle(Color.gaMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(GaSpace.md)
        .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
        .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
    }

    private func statWide(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(GaFont.body).foregroundStyle(Color.gaMuted)
            Spacer()
            Text(value).font(GaFont.body.bold()).foregroundStyle(Color.gaInk)
        }
        .padding(GaSpace.md)
        .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
        .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let client = APIClientFactory.make()
            async let meOut = client.me2(.init())
            async let dashOut = client.dashboard(.init())
            async let countOut = client.getDueCount(.init())

            if case .ok(let ok) = try await meOut {
                let me = try ok.body.json
                name = me.displayName ?? me.email ?? ""
            }
            if case .ok(let ok) = try await dashOut {
                let d = try ok.body.json
                streak = Int(d.streakDays ?? 0)
                weeklyXp = Int(d.weeklyXp ?? 0)
                progress = Int(d.planProgressPercent ?? 0)
                sessionsWeek = Int(d.completedSessionsThisWeek ?? 0)
                minutesWeek = Int(d.weeklyMinutesStudied ?? 0)
            }
            if case .ok(let ok) = try await countOut {
                dueCount = Int((try ok.body.json).dueCount ?? 0)
            }
        } catch {
            self.error = "Lỗi tải dữ liệu: \(error.localizedDescription)"
        }
    }
}
