import SwiftUI

/// Phase MVP — "Ôn tập SRS" (M5.2): real spaced-repetition review.
/// GET /api/srs/due (getDueCards → [VocabReviewCard]) → flashcard (German → flip → meaning/example)
/// → grade (quality 0–5, SM-2) → POST /api/srs/review (recordReview) → next card.
struct ReviewView: View {
    @State private var cards: [CardVM] = []
    @State private var index = 0
    @State private var flipped = false
    @State private var loading = true
    @State private var submitting = false
    @State private var error: String?

    struct CardVM: Identifiable { let id: Int; let vocabId: String; let german: String; let meaning: String; let example: String }

    private let grades: [(String, Int32, Color)] = [
        ("Lại", 1, .gaRed), ("Khó", 3, .gaOrange), ("Tốt", 4, .gaBlue), ("Dễ", 5, .gaGreen),
    ]

    var body: some View {
        VStack(spacing: GaSpace.lg) {
            if loading {
                ProgressView().tint(.gaAccent)
            } else if let error {
                VStack(spacing: GaSpace.md) {
                    Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed)
                    Button("Thử lại") { Task { await load() } }.buttonStyle(.bordered).tint(.gaAccent)
                }
            } else if index >= cards.count {
                VStack(spacing: GaSpace.sm) {
                    Text("🎉").font(.system(size: 44))
                    Text(cards.isEmpty ? "Không có thẻ đến hạn" : "Đã ôn xong \(cards.count) thẻ!")
                        .font(GaFont.displayL).foregroundStyle(Color.gaInk)
                    Button("Tải lại") { Task { await load() } }.buttonStyle(.borderedProminent).tint(.gaAccent)
                }
            } else {
                let card = cards[index]
                Text("Thẻ \(index + 1)/\(cards.count)").font(GaFont.caption).foregroundStyle(Color.gaMuted)

                VStack(spacing: GaSpace.md) {
                    Text(card.german).font(GaFont.displayXL).foregroundStyle(Color.gaInk)
                        .multilineTextAlignment(.center)
                    if flipped {
                        Divider()
                        Text(card.meaning).font(GaFont.body).foregroundStyle(Color.gaInk)
                            .multilineTextAlignment(.center)
                        if !card.example.isEmpty {
                            Text(card.example).font(GaFont.caption).italic().foregroundStyle(Color.gaMuted)
                                .multilineTextAlignment(.center)
                        }
                    } else {
                        Text("Chạm để xem nghĩa").font(GaFont.caption).foregroundStyle(Color.gaFaint)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 200)
                .padding(GaSpace.lg)
                .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
                .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
                .contentShape(Rectangle())
                .onTapGesture { withAnimation(.easeInOut(duration: 0.15)) { flipped.toggle() } }

                if flipped {
                    HStack(spacing: GaSpace.sm) {
                        ForEach(grades, id: \.0) { (label, q, color) in
                            Button(label) { Task { await submit(quality: q) } }
                                .font(GaFont.body)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, GaSpace.sm)
                                .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: GaRadius.card))
                                .foregroundStyle(color)
                                .disabled(submitting)
                        }
                    }
                } else {
                    Text("Nhớ lại nghĩa rồi chạm thẻ để chấm").font(GaFont.caption).foregroundStyle(Color.gaMuted)
                }
            }
            Spacer()
        }
        .padding(GaSpace.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
        .navigationTitle("Ôn tập")
        .task { await load() }
    }

    private func submit(quality: Int32) async {
        guard index < cards.count else { return }
        submitting = true
        defer { submitting = false }
        let vocabId = cards[index].vocabId
        do {
            let client = APIClientFactory.make()
            _ = try await client.recordReview(body: .json(.init(vocabId: vocabId, quality: quality)))
        } catch {
            // Non-blocking: log-and-advance so a single failed grade doesn't stall the session.
        }
        flipped = false
        index += 1
    }

    private func load() async {
        loading = true
        error = nil
        index = 0
        flipped = false
        defer { loading = false }
        do {
            let client = APIClientFactory.make()
            let output = try await client.getDueCards(.init())
            switch output {
            case .ok(let ok):
                let list = try ok.body.json
                cards = list.map { c in
                    CardVM(
                        id: Int(c.id ?? 0),
                        vocabId: c.vocabId ?? "",
                        german: c.german ?? "—",
                        meaning: c.meaning ?? "",
                        example: c.exampleDe ?? ""
                    )
                }
            default:
                error = "Không tải được thẻ ôn tập (kiểm tra đăng nhập)."
            }
        } catch {
            self.error = "Lỗi tải thẻ: \(error.localizedDescription)"
        }
    }
}
