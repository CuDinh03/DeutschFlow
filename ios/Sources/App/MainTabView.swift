import SwiftUI

/// 5-tab shell: Hôm nay · Lộ trình · Luyện nói · Lớp học · Hồ sơ (matches the prototype bottom bar).
struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label("Hôm nay", systemImage: "sun.max") }
            NavigationStack { PlaceholderScreen(title: "Lộ trình") }
                .tabItem { Label("Lộ trình", systemImage: "map") }
            NavigationStack { PlaceholderScreen(title: "Luyện nói") }
                .tabItem { Label("Luyện nói", systemImage: "mic") }
            NavigationStack { PlaceholderScreen(title: "Lớp học") }
                .tabItem { Label("Lớp học", systemImage: "person.3") }
            NavigationStack { ProfilePlaceholder() }
                .tabItem { Label("Hồ sơ", systemImage: "person.crop.circle") }
        }
        .tint(.gaAccent)
    }
}
