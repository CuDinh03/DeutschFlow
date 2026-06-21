import SwiftUI

/// Phase MVP — "Lộ trình" (M5.1): real learning tree from `GET /api/roadmap/tree` (getTree → TreeDto).
/// Option-1 for mobile: the web uses a custom SVG canvas; here we render the same data compactly as
/// levels (A0–C2) → per-skill branch progress, with node/level state colors. Read-only (lesson-player
/// is parked); completeNode/level-up come later.
struct RoadmapView: View {
    @State private var userName = ""
    @State private var currentLevel = ""
    @State private var goal = ""
    @State private var levels: [LevelVM] = []
    @State private var loading = true
    @State private var error: String?

    struct LevelVM: Identifiable { let id: String; let level: String; let status: String; let milestone: String; let milestoneState: String; let branches: [BranchVM] }
    struct BranchVM: Identifiable { let id: String; let label: String; let status: String; let total: Int; let passed: Int }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: GaSpace.lg) {
                Text("Lộ trình").font(GaFont.displayL).foregroundStyle(Color.gaInk)
                if !currentLevel.isEmpty || !goal.isEmpty {
                    Text("Cấp hiện tại: \(currentLevel.isEmpty ? "—" : currentLevel)\(goal.isEmpty ? "" : " · Mục tiêu \(goal)")")
                        .font(GaFont.body).foregroundStyle(Color.gaMuted)
                }

                if loading {
                    ProgressView().tint(.gaAccent).frame(maxWidth: .infinity).padding(.top, GaSpace.xl)
                } else if let error {
                    VStack(spacing: GaSpace.md) {
                        Text(error).font(GaFont.caption).foregroundStyle(Color.gaRed).frame(maxWidth: .infinity, alignment: .leading)
                        Button("Thử lại") { Task { await load() } }.buttonStyle(.bordered).tint(.gaAccent)
                    }
                    .padding(GaSpace.lg)
                    .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
                    .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
                } else if levels.isEmpty {
                    Text("Chưa có lộ trình. Hãy thiết lập mục tiêu học tập.").font(GaFont.body).foregroundStyle(Color.gaMuted).padding(.top, GaSpace.lg)
                } else {
                    ForEach(levels) { lvl in levelCard(lvl) }
                }
                Spacer(minLength: 0)
            }
            .padding(GaSpace.xl)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gaBg)
        .navigationTitle("Lộ trình")
        .task { await load() }
    }

    private func levelCard(_ lvl: LevelVM) -> some View {
        VStack(alignment: .leading, spacing: GaSpace.sm) {
            HStack(spacing: GaSpace.sm) {
                Text(lvl.level).font(GaFont.displayL).foregroundStyle(stateColor(lvl.status))
                if !lvl.milestone.isEmpty {
                    Text(lvl.milestone).font(GaFont.caption).foregroundStyle(Color.gaMuted)
                }
                Spacer()
                Text(statusLabel(lvl.status)).font(GaFont.caption).foregroundStyle(stateColor(lvl.status))
            }
            ForEach(lvl.branches) { br in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(br.label).font(GaFont.caption).foregroundStyle(Color.gaInk)
                        Spacer()
                        Text("\(br.passed)/\(br.total)").font(GaFont.caption).foregroundStyle(Color.gaMuted)
                    }
                    ProgressView(value: Double(br.passed), total: Double(max(br.total, 1)))
                        .tint(br.passed >= br.total && br.total > 0 ? .gaGreen : .gaAccent)
                }
            }
        }
        .padding(GaSpace.lg)
        .background(Color.gaCard, in: RoundedRectangle(cornerRadius: GaRadius.card))
        .overlay(RoundedRectangle(cornerRadius: GaRadius.card).stroke(Color.gaLine))
    }

    private func stateColor(_ s: String) -> Color {
        switch s.lowercased() {
        case "passed", "done", "completed", "mastered": return .gaGreen
        case "current", "active", "inprogress", "in_progress", "ready": return .gaBlue
        case "locked": return .gaFaint
        default: return .gaInk
        }
    }
    private func statusLabel(_ s: String) -> String {
        switch s.lowercased() {
        case "passed", "done", "completed", "mastered": return "Đã qua"
        case "current", "active", "inprogress", "in_progress", "ready": return "Đang học"
        case "locked": return "Khoá"
        default: return s
        }
    }
    private func isPassed(_ s: String?) -> Bool {
        ["passed", "done", "completed", "mastered"].contains((s ?? "").lowercased())
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let client = APIClientFactory.make()
            let output = try await client.getTree(.init())
            switch output {
            case .ok(let ok):
                let dto = try ok.body.json
                userName = dto.user?.displayName ?? ""
                currentLevel = dto.user?.currentLevel ?? ""
                goal = dto.user?.goal ?? ""
                levels = (dto.path ?? []).map { lvl in
                    let branches = (lvl.branches ?? []).map { br -> BranchVM in
                        let nodes = (br.shoots ?? []).flatMap { $0.nodes ?? [] }
                        let passed = nodes.filter { isPassed($0.state) }.count
                        return BranchVM(id: (lvl.level ?? "") + "-" + (br.skill ?? br.label ?? ""), label: br.label ?? br.skill ?? "—", status: br.status ?? "", total: nodes.count, passed: passed)
                    }
                    return LevelVM(id: lvl.level ?? UUID().uuidString, level: lvl.level ?? "—", status: lvl.status ?? "", milestone: lvl.milestone?.title ?? "", milestoneState: lvl.milestone?.state ?? "", branches: branches)
                }
            default:
                error = "Không tải được lộ trình (kiểm tra đăng nhập)."
            }
        } catch {
            self.error = "Lỗi tải lộ trình: \(error.localizedDescription)"
        }
    }
}
