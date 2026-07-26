import { describe, it, expect } from "vitest"
import { mergeTranscriptIntoDraft } from "@/lib/speakingDraft"

/**
 * R-W8, nửa còn lại: transcript về muộn từng `setInputText(text)` ĐÈ THẲNG lên câu người dùng vừa
 * gõ. Nguyên tắc §8.1.4 của báo cáo — draft của user là tài sản — nên ghép, không đè.
 */
describe("mergeTranscriptIntoDraft", () => {
  it("ô nhập rỗng → transcript là nội dung mới", () => {
    expect(mergeTranscriptIntoDraft("", "Guten Tag")).toBe("Guten Tag")
    expect(mergeTranscriptIntoDraft("   ", "Guten Tag")).toBe("Guten Tag")
  })

  it("người dùng đã gõ dở → GHÉP vào cuối, không mất chữ nào", () => {
    expect(mergeTranscriptIntoDraft("Ich möchte", "einen Termin buchen")).toBe(
      "Ich möchte einen Termin buchen",
    )
  })

  it("transcript rỗng → giữ nguyên ô nhập, không xoá của người dùng", () => {
    expect(mergeTranscriptIntoDraft("Ich möchte", "")).toBe("Ich möchte")
    expect(mergeTranscriptIntoDraft("Ich möchte", "   ")).toBe("Ich möchte")
  })

  it("không đẻ khoảng trắng thừa ở hai đầu", () => {
    expect(mergeTranscriptIntoDraft("  Hallo  ", "  Welt  ")).toBe("Hallo Welt")
  })
})
