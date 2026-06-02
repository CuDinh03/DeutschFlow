import SwiftUI

/// Skeleton tab bar for Phase 1+. Today and Paywall are wired; SRS / Speaking / Profile arrive in later phases.
struct MainTabView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Hôm nay", systemImage: "sun.max.fill") }
            PaywallView()
                .tabItem { Label("Nâng cấp", systemImage: "sparkles") }
            ProfileView()
                .tabItem { Label("Tài khoản", systemImage: "person.crop.circle") }
        }
    }
}

struct TodayView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        NavigationStack {
            List {
                Section("Gói hiện tại") {
                    if let plan = session.plan {
                        LabeledContent("Mã gói", value: plan.planCode)
                        LabeledContent("Tier", value: plan.tier)
                        if let endsAt = plan.endsAtUtc {
                            LabeledContent("Hết hạn", value: endsAt)
                        }
                    } else {
                        Text("Đang tải…").foregroundStyle(.secondary)
                    }
                }
                Section {
                    Button("Làm mới") { Task { await session.refreshPlan() } }
                }
            }
            .navigationTitle("Hôm nay")
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(role: .destructive) {
                        Task { await session.logout() }
                    } label: {
                        Text("Đăng xuất")
                    }
                }
            }
            .navigationTitle("Tài khoản")
        }
    }
}
