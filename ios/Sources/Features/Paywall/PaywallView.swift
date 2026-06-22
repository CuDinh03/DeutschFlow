import SwiftUI
import StoreKit

/// Paywall (M5.4 scaffold) — presented as a sheet from "Hồ sơ".
/// Lists backend-backed StoreKit subscriptions, purchases via `PaywallModel`, restores, and shows
/// the App Store auto-renew disclosure (Guideline 3.1.2 — required for auto-renewable subscriptions).
struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = PaywallModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: GaSpace.lg) {
                    Text("Nâng cấp DeutschFlow").font(GaFont.displayL).foregroundStyle(Color.gaInk)
                    Text("Mở khoá luyện nói AI, chấm điểm chi tiết và lộ trình cá nhân hoá.")
                        .font(GaFont.body).foregroundStyle(Color.gaMuted)

                    if let plan = model.activePlanCode {
                        activeBanner(plan)
                    }

                    if model.loading {
                        ProgressView().tint(.gaAccent).frame(maxWidth: .infinity).padding(.top, GaSpace.xl)
                    } else if model.tiers.isEmpty {
                        Text("Chưa có gói nào khả dụng. Vui lòng thử lại sau.")
                            .font(GaFont.caption).foregroundStyle(Color.gaMuted)
                    } else {
                        ForEach(model.tiers) { tier in
                            tierCard(tier)
                        }
                    }

                    if let error = model.error {
                        Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        Task { await model.restore() }
                    } label: {
                        if model.restoring {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Khôi phục giao dịch").frame(maxWidth: .infinity)
                        }
                    }
                    .font(GaFont.body)
                    .tint(.gaAccent)
                    .disabled(model.restoring)

                    Text(disclosure)
                        .font(GaFont.caption)
                        .foregroundStyle(Color.gaMuted)
                        .padding(.top, GaSpace.sm)
                }
                .padding(GaSpace.xl)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .background(Color.gaBg)
            .navigationTitle("Gói nâng cấp")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Đóng") { dismiss() } } }
            .task { await model.load() }
        }
    }

    private func activeBanner(_ plan: String) -> some View {
        HStack(spacing: GaSpace.sm) {
            Image(systemName: "checkmark.seal.fill").foregroundStyle(Color.gaGreen)
            VStack(alignment: .leading, spacing: 2) {
                Text("Đang dùng gói \(plan)").font(GaFont.body.bold()).foregroundStyle(Color.gaInk)
                if let until = model.activeUntil {
                    Text("Hiệu lực đến \(until.formatted(date: .abbreviated, time: .omitted))")
                        .font(GaFont.caption).foregroundStyle(Color.gaMuted)
                }
            }
            Spacer()
        }
        .padding(GaSpace.md)
        .background(Color.gaAccentSoft, in: RoundedRectangle(cornerRadius: GaRadius.card))
    }

    private func tierCard(_ tier: PaywallModel.Tier) -> some View {
        VStack(alignment: .leading, spacing: GaSpace.sm) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(tier.product.displayName).font(GaFont.body.bold()).foregroundStyle(Color.gaInk)
                    Text(tier.durationMonths >= 12 ? "Thanh toán theo năm" : "Thanh toán theo tháng")
                        .font(GaFont.caption).foregroundStyle(Color.gaMuted)
                }
                Spacer()
                Text(tier.product.displayPrice).font(GaFont.body.bold()).foregroundStyle(Color.gaInk)
            }
            if !tier.product.description.isEmpty {
                Text(tier.product.description).font(GaFont.caption).foregroundStyle(Color.gaMuted)
            }
            Button {
                Task { await model.purchase(tier) }
            } label: {
                Group {
                    if model.purchasingId == tier.id {
                        ProgressView().tint(.white)
                    } else {
                        Text("Chọn gói này")
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.gaInk)
            .disabled(model.purchasingId != nil)
        }
        .padding(GaSpace.md)
        .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
        .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
    }

    private var disclosure: String {
        """
        Gói đăng ký tự động gia hạn. Thanh toán tính vào tài khoản Apple ID khi xác nhận mua. \
        Gói tự gia hạn trừ khi tắt tối thiểu 24 giờ trước khi kết thúc chu kỳ; phí gia hạn được trừ \
        trong 24 giờ trước chu kỳ mới. Quản lý hoặc huỷ trong Cài đặt tài khoản App Store. \
        Điều khoản sử dụng và Chính sách bảo mật được áp dụng.
        """
    }
}
