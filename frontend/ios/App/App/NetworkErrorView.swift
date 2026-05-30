import SwiftUI
import Network

struct NetworkErrorView: View {
    let onRetry: () -> Void
    @State private var isChecking = false

    var body: some View {
        ZStack {
            Color(DF.UIKit.bg).ignoresSafeArea()

            VStack(spacing: 28) {
                DFLogoStatic(size: 52)

                Image(systemName: "wifi.slash")
                    .font(.system(size: 46, weight: .thin))
                    .foregroundColor(.white.opacity(0.45))
                    .padding(.top, 4)

                VStack(spacing: 8) {
                    Text("Không có kết nối mạng")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                    Text("DeutschFlow cần internet để hoạt động.\nKiểm tra kết nối và thử lại.")
                        .font(.system(size: 14))
                        .foregroundColor(.white.opacity(0.5))
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                }

                Button {
                    isChecking = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                        isChecking = false
                        onRetry()
                    }
                } label: {
                    Group {
                        if isChecking {
                            ProgressView().tint(Color(DF.UIKit.bg))
                        } else {
                            Text("Thử lại")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(Color(DF.UIKit.bg))
                        }
                    }
                    .frame(width: 160, height: 50)
                    .background(DF.Brand.yellow)
                    .clipShape(Capsule())
                }
                .padding(.top, 4)
            }
            .padding(36)
        }
    }
}
