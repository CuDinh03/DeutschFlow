import { describe, expect, test } from "vitest";
import { suggestPersonasForTopic } from "./personaTopicMatch";

describe("suggestPersonasForTopic", () => {
  test("chủ đề y khoa + persona phục vụ → gợi ý nhóm y khoa", () => {
    const s = suggestPersonasForTopic("Beim Arzt", "NIKLAS");
    expect(s?.domain).toBe("medizin");
    expect(s?.personas).toEqual(["SARAH", "SCHNEIDER", "WEBER"]);
  });

  test("chủ đề tiếng Việt cũng nhận diện được ngành", () => {
    expect(suggestPersonasForTopic("Đi khám bệnh ở Đức", "LENA")?.domain).toBe("medizin");
    expect(suggestPersonasForTopic("Ẩm thực Đức", "MAX")?.domain).toBe("gastro");
  });

  test("persona đã đúng ngành → không gợi ý", () => {
    expect(suggestPersonasForTopic("Beim Arzt", "SARAH")).toBeNull();
    expect(suggestPersonasForTopic("Restaurant bestellen", "NIKLAS")).toBeNull();
  });

  test("chủ đề trung tính → không gợi ý", () => {
    expect(suggestPersonasForTopic("Familie", "NIKLAS")).toBeNull();
    expect(suggestPersonasForTopic("Reise nach Berlin", "DEFAULT")).toBeNull();
    expect(suggestPersonasForTopic("", "DEFAULT")).toBeNull();
    expect(suggestPersonasForTopic(null, "DEFAULT")).toBeNull();
  });

  test("persona đa năng (DEFAULT/EMMA) vẫn được gợi ý ngành hợp hơn", () => {
    expect(suggestPersonasForTopic("Essen", "DEFAULT")?.personas).toContain("KLAUS");
    expect(suggestPersonasForTopic("Hotel Check-in", "EMMA")?.personas).toEqual(["NINA"]);
  });

  test("gia sư Việt: không bao giờ gợi ý đổi", () => {
    expect(suggestPersonasForTopic("Beim Arzt", "TUAN")).toBeNull();
    expect(suggestPersonasForTopic("Ẩm thực", "LAN")).toBeNull();
  });

  test("topic ngành động từ nghề học viên (Arbeitsalltag) → khớp technik", () => {
    const s = suggestPersonasForTopic("Arbeitsalltag (Kỹ thuật viên điện tử)", "NIKLAS");
    expect(s?.domain).toBe("technik");
    expect(s?.personas).toEqual(["MAX", "OLIVER"]);
  });

  test("regex \\bit\\b không ăn nhầm chữ 'mit' tiếng Đức", () => {
    expect(suggestPersonasForTopic("Mit Freunden reden", "NIKLAS")).toBeNull();
  });

  test("persona hiện tại bị loại khỏi danh sách gợi ý", () => {
    // KLAUS thuộc gastro nhưng topic hotel → gợi ý NINA, không lặp lại KLAUS đâu đó
    const s = suggestPersonasForTopic("Hotel buchen", "KLAUS");
    expect(s?.personas).toEqual(["NINA"]);
  });
});
