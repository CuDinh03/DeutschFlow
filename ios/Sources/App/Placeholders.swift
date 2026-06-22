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
