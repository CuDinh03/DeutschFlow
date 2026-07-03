package com.deutschflow.moderation.service;

import com.deutschflow.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Minimal server-side objectionable-content filter for user↔user messages (Apple Guideline 1.2:
 * "filter objectionable material"). It rejects clear slurs/sexual terms at send time; the broader
 * safety net is user reporting + block + teacher/admin moderation.
 *
 * <p>Matching is WHOLE-TOKEN and diacritics-insensitive. Whole-token (not substring) matching is
 * deliberate: DeutschFlow is a German/Vietnamese learning app, and substring matching would flag
 * legitimate vocabulary ("grape" → "rape", German "dick" = thick, Vietnamese "các" = plural). The
 * list is conservative (clear profanity only) for the same reason; extend via config if needed.
 */
@Service
public class WordFilterService {

    // Clear, unambiguous profanity/slurs that do NOT collide with common German/Vietnamese words.
    private static final Set<String> BANNED = Set.of(
            // English
            "fuck", "fucker", "motherfucker", "shit", "bitch", "cunt", "asshole",
            "nigger", "nigga", "faggot", "retard", "whore", "slut", "rape", "pedophile",
            "cock", "pussy",
            // Vietnamese — clear multi-word phrases only (single syllables collide with common words)
            "du ma", "dit me", "cai lon", "cai lozz",
            // German — clear profanity, not part of A1–B1 learning vocabulary
            "hurensohn", "fotze", "wichser", "schlampe"
    );

    private static final Pattern NON_LETTER = Pattern.compile("[^\\p{L}\\p{N}]+");

    /** True if the normalized body contains a banned term as a whole token / phrase. */
    public boolean isSevere(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String padded = " " + normalize(body) + " ";
        for (String banned : BANNED) {
            if (padded.contains(" " + banned + " ")) {
                return true;
            }
        }
        return false;
    }

    /** Rejects the send if the body is severe. */
    public void assertClean(String body) {
        if (isSevere(body)) {
            throw new BadRequestException(
                    "Tin nhắn chứa ngôn từ không phù hợp và đã bị chặn. Vui lòng giữ giao tiếp tôn trọng.");
        }
    }

    /** lowercase + strip diacritics (NFD, đ→d) + collapse punctuation to single spaces. */
    private static String normalize(String s) {
        String stripped = Normalizer.normalize(s.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd');
        return String.join(" ", Arrays.stream(NON_LETTER.split(stripped))
                .filter(t -> !t.isEmpty())
                .toList());
    }
}
