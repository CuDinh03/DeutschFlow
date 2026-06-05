package com.deutschflow.user.mentor;

import java.util.Locale;

/**
 * Coarse industry grouping used to map a learner's free-text {@code industry}
 * to a family of mentor personas (SRS §59.3).
 *
 * <p>{@link #EDUCATION} is the universal fallback — it maps to the BEGINNER
 * generalist mentor (ANNA), which is always unlockable on the FREE tier.
 */
public enum IndustryFamily {
    IT,
    BUSINESS,
    HEALTHCARE,
    GASTRONOMY,
    RETAIL,
    OPERATIONS,
    SERVICE,
    MEDIA,
    EDUCATION;

    /**
     * Best-effort keyword match of a free-text industry string (vi / de / en) to a
     * family. Returns {@link #EDUCATION} when the input is blank or unrecognized.
     *
     * <p>Keyword lists are intentionally kept disjoint so match order does not change
     * the result. This is a heuristic default — the learner can override their mentor
     * in the Speaking module afterwards.
     */
    public static IndustryFamily fromText(String industry) {
        if (industry == null || industry.isBlank()) {
            return EDUCATION;
        }
        String s = industry.toLowerCase(Locale.ROOT);
        String[] tokens = s.split("[^\\p{L}]+");

        // Short, ambiguous codes are matched as whole tokens so they don't false-match
        // substrings ("it" inside "edit", "mc" inside "comcast").
        if (hasToken(tokens, "it", "ict", "edv")) {
            return IT;
        }
        if (hasToken(tokens, "mc")) {
            return MEDIA;
        }

        // Longer, distinctive keywords are matched as substrings.
        if (containsAny(s, "informatik", "software", "developer", "entwickler", "lập trình", "công nghệ", "programm", "tech")) {
            return IT;
        }
        if (containsAny(s, "health", "mediz", "medic", "doctor", "arzt", "nurse", "pflege", "y tế", "y khoa", "bác sĩ", "điều dưỡng", "clinic", "klinik", "krankenhaus", "hautarzt", "augenarzt")) {
            return HEALTHCARE;
        }
        if (containsAny(s, "gastro", "koch", "küche", "kuche", "chef", "kitchen", "bếp", "đầu bếp", "nhà hàng", "cook", "restaurant")) {
            return GASTRONOMY;
        }
        if (containsAny(s, "bäcker", "baecker", "metzger", "verkauf", "retail", "einzelhandel", "supermarkt", "laden", "bán lẻ", "cửa hàng", "tạp hóa", "siêu thị", "bakery", "bäckerei")) {
            return RETAIL;
        }
        if (containsAny(s, "maschin", "cnc", "fräs", "fras", "mechanic", "cơ khí", "vận hành máy", "operator", "operations", "produktion", "fabrik", "industrie")) {
            return OPERATIONS;
        }
        if (containsAny(s, "hotel", "kellner", "rezeption", "phục vụ", "lễ tân", "khách sạn", "waiter", "reception", "hospitality")) {
            return SERVICE;
        }
        if (containsAny(s, "media", "medien", "moderator", "truyền thông", "journalis", "rundfunk", "entertainment")) {
            return MEDIA;
        }
        if (containsAny(s, "business", "office", "büro", "buro", "manage", "kinh doanh", "văn phòng", "marketing", "consult", "vertrieb", "sales")) {
            return BUSINESS;
        }
        return EDUCATION;
    }

    private static boolean hasToken(String[] tokens, String... codes) {
        for (String token : tokens) {
            for (String code : codes) {
                if (token.equals(code)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) {
                return true;
            }
        }
        return false;
    }
}
