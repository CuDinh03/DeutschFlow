package com.deutschflow.examstudio;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.ToIntFunction;

/**
 * Phần thuần của bộ lập kế hoạch bộ đề: bảng chủ đề đời sống (tên Đức đưa thẳng vào prompt) kèm GỐC từ khoá để
 * tìm bài trong danh mục nguồn, cách chia ma trận độ khó theo hồ sơ, và cách gán chủ đề cho các Teil sao cho
 * trong một bộ không Teil nào trùng chủ đề và chủ đề ít dùng được ưu tiên.
 */
final class ExamSetPlanner {

    private ExamSetPlanner() {}

    /** {@code stems}: gốc từ (viết thường) khớp tiêu đề bài — xem {@link SourceCatalog#score}. */
    record Theme(String name, List<String> stems) {}

    /** Chủ đề trung lập (luật cứng 09/11): không chính trị, di cư, chiến tranh, tôn giáo. */
    static final List<Theme> THEMES = List.of(
            new Theme("Wohnen", List.of("wohn", "miet", "umzug", "heiz", "haushalt", "nachbar")),
            new Theme("Arbeit", List.of("arbeit", "beruf", "ausbildung", "lehre", "erwerb", "gehalt", "lohn", "teilzeit")),
            new Theme("Gesundheit", List.of("gesund", "krank", "arzt", "schlaf", "ernähr", "pflege", "rauch", "stress", "notfall")),
            new Theme("Bildung", List.of("schul", "bildung", "studi", "lern", "kurs", "universit", "kindergarten")),
            new Theme("Verkehr", List.of("verkehr", "bahn", "auto", "fahrrad", "mobilit", "führerschein", "pendl", "fußgäng")),
            new Theme("Reisen", List.of("reise", "urlaub", "touris", "übernacht", "hotel", "ferien", "flug")),
            new Theme("Einkaufen", List.of("einkauf", "preis", "konsum", "handel", "inflation", "verbrauch", "lebensmittel")),
            new Theme("Technik im Alltag", List.of("internet", "digital", "smartphone", "computer", "online", "medien", "technik")),
            new Theme("Sport", List.of("sport", "verein", "fitness", "bewegung", "schwimm", "fußball")),
            new Theme("Essen und Trinken", List.of("essen", "ernähr", "gastro", "restaurant", "koch", "trink", "obst", "gemüse")),
            new Theme("Umwelt", List.of("umwelt", "klima", "müll", "recycl", "energie", "wetter", "natur", "wasser")),
            new Theme("Familie", List.of("famil", "kind", "eltern", "geburt", "betreu", "jugend", "senior")),
            new Theme("Freizeit", List.of("freizeit", "kultur", "museum", "ehrenamt", "hobby", "kino", "musik")));

    static Theme theme(String name) {
        return THEMES.stream().filter(t -> t.name().equalsIgnoreCase(name)).findFirst().orElse(null);
    }

    /**
     * Ma trận độ khó theo hồ sơ. {@code REAL} ("Giống đề thật"): 40 % Dễ, 40 % Vừa, phần còn lại Khó, không Siêu
     * khó — 5 câu ⇒ 2-2-1-0, 10 câu ⇒ 4-4-2-0. Teil Viết không có câu trắc nghiệm ⇒ toàn 0.
     */
    static Map<String, Integer> difficultyPlan(String profile, int itemCount) {
        Map<String, Integer> plan = new LinkedHashMap<>();
        int easy;
        int medium;
        int hard;
        int expert = 0;
        if ("SPRINT".equalsIgnoreCase(profile)) { // "Nước rút": 20 % Dễ, 20 % Vừa, 40 % Khó, 20 % Siêu khó
            easy = Math.round(itemCount * 0.2f);
            medium = Math.round(itemCount * 0.2f);
            expert = Math.round(itemCount * 0.2f);
            hard = itemCount - easy - medium - expert;
        } else {
            easy = Math.round(itemCount * 0.4f);
            medium = Math.round(itemCount * 0.4f);
            hard = itemCount - easy - medium;
        }
        plan.put("EASY", Math.max(easy, 0));
        plan.put("MEDIUM", Math.max(medium, 0));
        plan.put("HARD", Math.max(hard, 0));
        plan.put("EXPERT", Math.max(expert, 0));
        return plan;
    }

    /** Một ô cần gán chủ đề. {@code sourcesNeeded} = 0 với Teil soạn theo tình huống. */
    record Slot(String section, int teil, int sourcesNeeded) {
        String key() {
            return section + "#" + teil;
        }
    }

    /**
     * Gán chủ đề cho từng ô: không lặp trong bộ; ưu tiên chủ đề ô đó dùng ít nhất ({@code usage}); ô cần nguồn chỉ
     * nhận chủ đề đang có đủ bài trong sổ ({@code available}); hoà nhau thì xáo theo {@code seed} để các lượt
     * không ra cùng một bộ chủ đề. Không còn chủ đề hợp lệ ⇒ ô đó nhận {@code null} (người gọi cho Teil kẹt).
     *
     * @param usage     số lần chủ đề đã dùng ở ô (khoá ô → tên chủ đề → số lần)
     * @param available số bài còn dùng được cho một chủ đề
     * @param banned    chủ đề không được chọn (đã thử và hỏng ở lượt này)
     */
    static Map<String, String> assign(List<Slot> slots, Map<String, Map<String, Integer>> usage,
                                      ToIntFunction<Theme> available, Collection<String> banned, long seed) {
        Map<String, String> out = new LinkedHashMap<>();
        Set<String> taken = new java.util.HashSet<>();
        Random rnd = new Random(seed);
        Map<String, Integer> tieBreak = new LinkedHashMap<>();
        for (Theme t : THEMES) tieBreak.put(t.name(), rnd.nextInt(1_000_000));
        // Ô cần nhiều nguồn nhất chọn trước: ít lựa chọn nhất.
        List<Slot> order = new ArrayList<>(slots);
        order.sort(Comparator.comparingInt(Slot::sourcesNeeded).reversed());
        for (Slot s : order) {
            Map<String, Integer> used = usage.getOrDefault(s.key(), Map.of());
            String pick = THEMES.stream()
                    .filter(t -> !taken.contains(t.name()) && (banned == null || !banned.contains(t.name())))
                    .filter(t -> s.sourcesNeeded() == 0 || available.applyAsInt(t) >= s.sourcesNeeded())
                    .min(Comparator.<Theme>comparingInt(t -> used.getOrDefault(t.name(), 0))
                            .thenComparingInt(t -> tieBreak.get(t.name())))
                    .map(Theme::name).orElse(null);
            if (pick != null) taken.add(pick);
            out.put(s.key(), pick);
        }
        // Trả theo thứ tự ô ban đầu.
        Map<String, String> ordered = new LinkedHashMap<>();
        for (Slot s : slots) ordered.put(s.key(), out.get(s.key()));
        return ordered;
    }
}
