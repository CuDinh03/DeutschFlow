package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates a personalized learning roadmap based on the user's profile
 * (industry, interests, goalType, currentLevel, targetLevel).
 *
 * <p>Logic:
 * <ol>
 *   <li>Always includes core A1 nodes (Grammatik, Alltags-Vokabular)</li>
 *   <li>Maps industry → Fachvokabular category in German</li>
 *   <li>Maps interests → optional topic nodes</li>
 *   <li>Adds progression nodes from currentLevel to targetLevel</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoadmapService {

    private final UserLearningProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    // ─── Industry → German Fachvokabular mappings ─────────────────────────────

    private static final Map<String, IndustryMapping> INDUSTRY_MAP = new LinkedHashMap<>();

    static {
        // Gastronomie / Cooking
        INDUSTRY_MAP.put("đầu bếp", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));
        INDUSTRY_MAP.put("nhà hàng", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));
        INDUSTRY_MAP.put("ẩm thực", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));
        INDUSTRY_MAP.put("nấu ăn", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));
        INDUSTRY_MAP.put("gastro", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));
        INDUSTRY_MAP.put("koch", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));
        INDUSTRY_MAP.put("restaurant", new IndustryMapping("Gastronomie & Küche", "🍳", "Koch-Vokabular, Lebensmittel & Rezepte"));

        // IT / Technology
        INDUSTRY_MAP.put("it", new IndustryMapping("IT-Technologie", "💻", "Code, Software & Tech-Begriffe"));
        INDUSTRY_MAP.put("công nghệ", new IndustryMapping("IT-Technologie", "💻", "Code, Software & Tech-Begriffe"));
        INDUSTRY_MAP.put("lập trình", new IndustryMapping("IT-Technologie", "💻", "Code, Software & Tech-Begriffe"));
        INDUSTRY_MAP.put("phần mềm", new IndustryMapping("IT-Technologie", "💻", "Code, Software & Tech-Begriffe"));
        INDUSTRY_MAP.put("software", new IndustryMapping("IT-Technologie", "💻", "Code, Software & Tech-Begriffe"));
        INDUSTRY_MAP.put("developer", new IndustryMapping("IT-Technologie", "💻", "Code, Software & Tech-Begriffe"));

        // Healthcare / Medicine
        INDUSTRY_MAP.put("y tế", new IndustryMapping("Medizin & Gesundheit", "🏥", "Medizinisches Fachvokabular & Pflege"));
        INDUSTRY_MAP.put("bác sĩ", new IndustryMapping("Medizin & Gesundheit", "🏥", "Medizinisches Fachvokabular & Pflege"));
        INDUSTRY_MAP.put("điều dưỡng", new IndustryMapping("Medizin & Gesundheit", "🏥", "Medizinisches Fachvokabular & Pflege"));
        INDUSTRY_MAP.put("y khoa", new IndustryMapping("Medizin & Gesundheit", "🏥", "Medizinisches Fachvokabular & Pflege"));
        INDUSTRY_MAP.put("pflege", new IndustryMapping("Medizin & Gesundheit", "🏥", "Medizinisches Fachvokabular & Pflege"));
        INDUSTRY_MAP.put("medizin", new IndustryMapping("Medizin & Gesundheit", "🏥", "Medizinisches Fachvokabular & Pflege"));

        // Engineering / Technical
        INDUSTRY_MAP.put("kỹ thuật", new IndustryMapping("Technik & Ingenieurwesen", "⚙️", "Technisches Vokabular & Maschinenbau"));
        INDUSTRY_MAP.put("kỹ sư", new IndustryMapping("Technik & Ingenieurwesen", "⚙️", "Technisches Vokabular & Maschinenbau"));
        INDUSTRY_MAP.put("cơ khí", new IndustryMapping("Technik & Ingenieurwesen", "⚙️", "Technisches Vokabular & Maschinenbau"));
        INDUSTRY_MAP.put("ingenieur", new IndustryMapping("Technik & Ingenieurwesen", "⚙️", "Technisches Vokabular & Maschinenbau"));

        // Business / Commerce
        INDUSTRY_MAP.put("kinh doanh", new IndustryMapping("Wirtschaft & Handel", "📊", "Geschäfts-Deutsch, Verhandlung & Handel"));
        INDUSTRY_MAP.put("thương mại", new IndustryMapping("Wirtschaft & Handel", "📊", "Geschäfts-Deutsch, Verhandlung & Handel"));
        INDUSTRY_MAP.put("quản lý", new IndustryMapping("Wirtschaft & Handel", "📊", "Geschäfts-Deutsch, Verhandlung & Handel"));
        INDUSTRY_MAP.put("business", new IndustryMapping("Wirtschaft & Handel", "📊", "Geschäfts-Deutsch, Verhandlung & Handel"));

        // Hospitality / Tourism
        INDUSTRY_MAP.put("du lịch", new IndustryMapping("Tourismus & Hotel", "✈️", "Reise-Deutsch, Hotel & Gastfreundschaft"));
        INDUSTRY_MAP.put("khách sạn", new IndustryMapping("Tourismus & Hotel", "✈️", "Reise-Deutsch, Hotel & Gastfreundschaft"));
        INDUSTRY_MAP.put("hướng dẫn viên", new IndustryMapping("Tourismus & Hotel", "✈️", "Reise-Deutsch, Hotel & Gastfreundschaft"));
        INDUSTRY_MAP.put("tourismus", new IndustryMapping("Tourismus & Hotel", "✈️", "Reise-Deutsch, Hotel & Gastfreundschaft"));

        // Education
        INDUSTRY_MAP.put("giáo dục", new IndustryMapping("Bildung & Erziehung", "📚", "Pädagogik, Schule & Universität"));
        INDUSTRY_MAP.put("giáo viên", new IndustryMapping("Bildung & Erziehung", "📚", "Pädagogik, Schule & Universität"));
        INDUSTRY_MAP.put("lehrer", new IndustryMapping("Bildung & Erziehung", "📚", "Pädagogik, Schule & Universität"));
    }

    // ─── Interest → Node mappings ─────────────────────────────────────────────

    private static final Map<String, InterestMapping> INTEREST_MAP = new LinkedHashMap<>();

    static {
        INTEREST_MAP.put("sport", new InterestMapping("Sport & Fitness", "🏃", "Sport, Fitness & Gesundheit"));
        INTEREST_MAP.put("thể thao", new InterestMapping("Sport & Fitness", "🏃", "Sport, Fitness & Gesundheit"));
        INTEREST_MAP.put("badminton", new InterestMapping("Badminton & Sport", "🏸", "Sport, Fitness & Gesundheit"));
        INTEREST_MAP.put("fußball", new InterestMapping("Fußball & Sport", "⚽", "Fußball-Vokabular & Sportbegriffe"));
        INTEREST_MAP.put("musik", new InterestMapping("Musik & Kultur", "🎵", "Musikinstrumente, Genres & Konzerte"));
        INTEREST_MAP.put("âm nhạc", new InterestMapping("Musik & Kultur", "🎵", "Musikinstrumente, Genres & Konzerte"));
        INTEREST_MAP.put("reisen", new InterestMapping("Reisen & Abenteuer", "✈️", "Reise-Deutsch & Urlaubsvokabular"));
        INTEREST_MAP.put("du lịch", new InterestMapping("Reisen & Abenteuer", "✈️", "Reise-Deutsch & Urlaubsvokabular"));
        INTEREST_MAP.put("film", new InterestMapping("Film & Kino", "🎬", "Film, Kino & Unterhaltung"));
        INTEREST_MAP.put("kochen", new InterestMapping("Kochen & Rezepte", "🍳", "Kochen, Backen & Lebensmittel"));
        INTEREST_MAP.put("gaming", new InterestMapping("Gaming & E-Sport", "🎮", "Gaming-Begriffe & Online-Sprache"));
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    public List<RoadmapNodeDto> generateRoadmapForUser(Long userId) {
        Optional<UserLearningProfile> profileOpt = profileRepository.findByUserId(userId);
        if (profileOpt.isEmpty()) {
            return getDefaultRoadmap();
        }

        UserLearningProfile profile = profileOpt.get();
        List<RoadmapNodeDto> nodes = new ArrayList<>();
        int nodeId = 1;

        // ── 1. Core A1 nodes (always present) ──
        nodes.add(new RoadmapNodeDto(nodeId++,
                "Grammatik Basics", "A1 · Grammatik", "📖",
                "completed", 500, 10, 10,
                "Grammatik", "Artikel, Verben & Satzstruktur"));

        nodes.add(new RoadmapNodeDto(nodeId++,
                "Alltags-Vokabular", "A1 · Vokabular", "🗣️",
                "completed", 400, 8, 8,
                "Vokabular", "Familie, Essen, Farben & Zahlen"));

        // ── 2. Industry-specific Fachvokabular (from profile.industry) ──
        IndustryMapping industry = resolveIndustry(profile.getIndustry());
        if (industry != null) {
            String cefrForIndustry = getCefrForNodeIndex(2, profile);
            nodes.add(new RoadmapNodeDto(nodeId++,
                    industry.title, cefrForIndustry + " · Fachvokabular", industry.emoji,
                    "current", 600, 12, 0,
                    industry.title, industry.description));
        }

        // ── 3. Interest-based optional nodes ──
        List<String> interests = parseInterests(profile.getInterestsJson());
        Set<String> addedCategories = new HashSet<>();
        if (industry != null) addedCategories.add(industry.title);

        for (String interest : interests) {
            InterestMapping mapping = resolveInterest(interest);
            if (mapping != null && !addedCategories.contains(mapping.title)) {
                addedCategories.add(mapping.title);
                String cefrForInterest = getCefrForNodeIndex(nodes.size(), profile);
                nodes.add(new RoadmapNodeDto(nodeId++,
                        mapping.title, cefrForInterest + " · Hobby", mapping.emoji,
                        "locked", 400, 8, 0,
                        mapping.title, mapping.description));
            }
        }

        // ── 4. CEFR progression nodes (up to targetLevel) ──
        String[] cefrLevels = {"A2", "B1", "B2", "C1", "C2"};
        String target = profile.getTargetLevel() != null ? profile.getTargetLevel().name() : "B1";

        for (String cefr : cefrLevels) {
            if (compareCefr(cefr, target) > 0) break;
            if (cefr.equals("A2") && industry != null) continue; // Already covered by industry node

            nodes.add(new RoadmapNodeDto(nodeId++,
                    cefr + " Grammatik & Wortschatz",
                    cefr + " · Kurs",
                    cefrEmoji(cefr),
                    "locked",
                    500 + (compareCefr(cefr, "A1") * 100),
                    10 + (compareCefr(cefr, "A1") * 2),
                    0,
                    "Kurs",
                    cefr + " Grammatik, Lesen & Schreiben"));
        }

        // ── 5. Goal-specific final node ──
        if (profile.getGoalType() == UserLearningProfile.GoalType.CERT) {
            String examType = profile.getExamType() != null ? profile.getExamType() : "Goethe-Zertifikat";
            nodes.add(new RoadmapNodeDto(nodeId++,
                    "Prüfungsvorbereitung",
                    target + " · Prüfung",
                    "🎯",
                    "locked",
                    800,
                    15,
                    0,
                    "Prüfung",
                    examType + " — Prüfungssimulation & Tipps"));
        } else {
            nodes.add(new RoadmapNodeDto(nodeId++,
                    "Berufs-Deutsch Intensiv",
                    target + " · Beruf",
                    "💼",
                    "locked",
                    700,
                    12,
                    0,
                    "Beruf",
                    "Bewerbung, Vorstellungsgespräch & Arbeitsalltag"));
        }

        return nodes;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private IndustryMapping resolveIndustry(String industry) {
        if (industry == null || industry.isBlank()) return null;
        String key = industry.trim().toLowerCase(java.util.Locale.ROOT);
        // Exact match
        if (INDUSTRY_MAP.containsKey(key)) return INDUSTRY_MAP.get(key);
        // Partial match
        for (Map.Entry<String, IndustryMapping> e : INDUSTRY_MAP.entrySet()) {
            if (key.contains(e.getKey()) || e.getKey().contains(key)) {
                return e.getValue();
            }
        }
        // Fallback: use industry name directly as a generic Fachvokabular
        return new IndustryMapping(capitalize(industry) + " Fachvokabular", "📋",
                "Berufsspezifischer Wortschatz für " + industry);
    }

    private InterestMapping resolveInterest(String interest) {
        if (interest == null || interest.isBlank()) return null;
        String key = interest.trim().toLowerCase(java.util.Locale.ROOT);
        if (INTEREST_MAP.containsKey(key)) return INTEREST_MAP.get(key);
        for (Map.Entry<String, InterestMapping> e : INTEREST_MAP.entrySet()) {
            if (key.contains(e.getKey()) || e.getKey().contains(key)) {
                return e.getValue();
            }
        }
        return null;
    }

    private List<String> parseInterests(String interestsJson) {
        if (interestsJson == null || interestsJson.isBlank()) return List.of();
        try {
            return objectMapper.readValue(interestsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.debug("[Roadmap] Failed to parse interests JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private String getCefrForNodeIndex(int index, UserLearningProfile profile) {
        String[] levels = {"A1", "A2", "B1", "B2", "C1", "C2"};
        String current = profile.getCurrentLevel() != null ? profile.getCurrentLevel().name() : "A1";
        int baseIdx = 0;
        for (int i = 0; i < levels.length; i++) {
            if (levels[i].equals(current)) { baseIdx = i; break; }
        }
        int targetIdx = Math.min(baseIdx + (index / 2), levels.length - 1);
        return levels[targetIdx];
    }

    private int compareCefr(String a, String b) {
        String[] order = {"A1", "A2", "B1", "B2", "C1", "C2"};
        int ia = 0, ib = 0;
        for (int i = 0; i < order.length; i++) {
            if (order[i].equals(a)) ia = i;
            if (order[i].equals(b)) ib = i;
        }
        return ia - ib;
    }

    private String cefrEmoji(String cefr) {
        return switch (cefr) {
            case "A2" -> "📗";
            case "B1" -> "📘";
            case "B2" -> "📕";
            case "C1" -> "📙";
            case "C2" -> "🏆";
            default -> "📖";
        };
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1);
    }

    private List<RoadmapNodeDto> getDefaultRoadmap() {
        return List.of(
            new RoadmapNodeDto(1, "Grammatik Basics", "A1 · Grammatik", "📖",
                    "current", 500, 10, 0, "Grammatik", "Artikel, Verben & Satzstruktur"),
            new RoadmapNodeDto(2, "Alltags-Vokabular", "A1 · Vokabular", "🗣️",
                    "locked", 400, 8, 0, "Vokabular", "Familie, Essen, Farben & Zahlen"),
            new RoadmapNodeDto(3, "A2 Grammatik & Wortschatz", "A2 · Kurs", "📗",
                    "locked", 600, 12, 0, "Kurs", "A2 Grammatik, Lesen & Schreiben")
        );
    }

    // ─── Inner classes ────────────────────────────────────────────────────────

    private record IndustryMapping(String title, String emoji, String description) {}
    private record InterestMapping(String title, String emoji, String description) {}
}
