import SwiftUI

/// Shared loading/empty/error states (every screen must cover all three — prototype contract).

/// Shimmer placeholder for loading lists/cards.
struct ShimmerView: View {
    @State private var phase: CGFloat = -1
    var body: some View {
        GeometryReader { geo in
            Color.gaLine
                .overlay(
                    LinearGradient(
                        colors: [.clear, Color.white.opacity(0.6), .clear],
                        startPoint: .leading, endPoint: .trailing
                    )
                    .offset(x: phase * geo.size.width)
                )
                .clipped()
        }
        .onAppear {
            withAnimation(.linear(duration: 1.1).repeatForever(autoreverses: false)) { phase = 1 }
        }
    }
}

struct EmptyStateView: View {
    let title: String
    var message: String? = nil
    var systemImage: String = "tray"

    var body: some View {
        VStack(spacing: GaSpace.md) {
            Image(systemName: systemImage).font(.system(size: 36)).foregroundStyle(Color.gaFaint)
            Text(title).font(GaFont.displayS).foregroundStyle(Color.gaInk)
            if let message {
                Text(message).font(GaFont.body).foregroundStyle(Color.gaMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(GaSpace.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorStateView: View {
    var title: String = "Đã có lỗi"
    var message: String? = nil
    let retry: () -> Void

    var body: some View {
        VStack(spacing: GaSpace.md) {
            Image(systemName: "exclamationmark.triangle").font(.system(size: 36)).foregroundStyle(Color.gaOrange)
            Text(title).font(GaFont.displayS).foregroundStyle(Color.gaInk)
            if let message {
                Text(message).font(GaFont.body).foregroundStyle(Color.gaMuted)
                    .multilineTextAlignment(.center)
            }
            Button("Thử lại", action: retry)
                .buttonStyle(.borderedProminent).tint(.gaAccent)
        }
        .padding(GaSpace.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
