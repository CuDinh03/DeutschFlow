import { describe, it, expect } from "vitest"
import { suggestionStep } from "@/lib/speaking/suggestionVisibility"

describe("suggestionStep — gợi ý trả lời trong phiên luyện nói", () => {
  const base = { awaitingLearner: true, turnKey: "3:ai:idle", previousTurnKey: "3:ai:idle", isListening: false }

  it("AI vừa nói xong lượt mới → ẩn gợi ý cũ và bắt đầu đồng hồ", () => {
    expect(suggestionStep({ ...base, previousTurnKey: "2:user:streaming" })).toEqual({ hide: true, startTimer: true })
  })

  it("mở micro trong cùng lượt → KHÔNG ẩn gợi ý đang hiện, đồng hồ tạm dừng", () => {
    expect(suggestionStep({ ...base, isListening: true })).toEqual({ hide: false, startTimer: false })
  })

  it("đóng micro trong cùng lượt → vẫn không ẩn, đồng hồ chạy lại", () => {
    expect(suggestionStep({ ...base, isListening: false })).toEqual({ hide: false, startTimer: true })
  })

  it("AI đang trả lời hoặc lượt cuối không phải của AI → ẩn, không đếm", () => {
    expect(suggestionStep({ ...base, awaitingLearner: false })).toEqual({ hide: true, startTimer: false })
    expect(suggestionStep({ ...base, awaitingLearner: false, isListening: true })).toEqual({ hide: true, startTimer: false })
  })

  it("lượt mới tới trong lúc micro đang mở → ẩn gợi ý của lượt cũ, chưa đếm", () => {
    expect(suggestionStep({ ...base, previousTurnKey: "1:ai:idle", isListening: true })).toEqual({ hide: true, startTimer: false })
  })
})
