package com.deutschflow.speaking.tts;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Incremental German sentence splitter for the streaming-TTS pipeline.
 *
 * <p>Feeds on the LLM token stream: {@link #append(String)} consumes a raw delta and returns any
 * sentences that have just become complete; {@link #flush()} surfaces the trailing fragment when the
 * stream ends. Each completed sentence is sent to XTTS as one synthesis call.
 *
 * <p>Boundary rule: cut at {@code . ! ? …} <strong>only</strong> when followed by whitespace (so a
 * decimal like {@code 3.14} or a terminator at the very end of the buffer is never cut prematurely),
 * skipping German abbreviations ({@code z.B.}, {@code d.h.}, {@code Dr.} …) and numeric ordinals
 * ({@code 3. Klasse}). Runs of terminators ({@code ?!}, {@code ...}) and trailing closing quotes are
 * kept with their sentence.
 *
 * <p>Not thread-safe: one instance per streaming turn, driven from a single worker.
 */
public final class GermanSentenceSplitter {

    /** Sentence terminators. */
    private static boolean isEndPunct(char c) {
        return c == '.' || c == '!' || c == '?' || c == '…'; // '…'
    }

    /** Closing quotes/brackets that may sit between a terminator and the whitespace boundary. */
    private static final String CLOSERS = "\"')]}“”’»«"; // " ' ) ] } “ ” ’ » «

    /** German abbreviations (lowercased, trailing dot included) that must NOT end a sentence. */
    private static final Set<String> ABBREV = Set.of(
            "z.b.", "u.a.", "d.h.", "z.t.", "u.u.", "i.d.r.", "u.v.m.", "v.a.", "u.dgl.",
            "o.ä.", "u.ä.", "usw.", "bzw.", "dr.", "prof.", "nr.", "ca.", "str.",
            "evtl.", "inkl.", "vgl.", "ggf.", "max.", "min.", "tel.", "abs.", "mind.",
            "sog.", "bzgl.", "geb.", "etc.", "z.zt.");

    private final StringBuilder buf = new StringBuilder();

    /**
     * Append a raw LLM token and return any sentences that just completed (possibly empty).
     * {@code null}/empty tokens are ignored.
     */
    public List<String> append(String token) {
        if (token == null || token.isEmpty()) {
            return List.of();
        }
        buf.append(token);
        return drain();
    }

    /**
     * Flush the remaining buffered text as the final sentence (trimmed), then clear the buffer.
     * Returns empty when nothing meaningful remains.
     */
    public Optional<String> flush() {
        String rest = buf.toString().trim();
        buf.setLength(0);
        return rest.isEmpty() ? Optional.empty() : Optional.of(rest);
    }

    private List<String> drain() {
        List<String> out = new ArrayList<>();
        int start = 0;
        int i = 0;
        final int n = buf.length();

        while (i < n) {
            if (!isEndPunct(buf.charAt(i))) {
                i++;
                continue;
            }
            // Maximal run of terminators (e.g. "?!", "...").
            int runEnd = i + 1;
            while (runEnd < n && isEndPunct(buf.charAt(runEnd))) {
                runEnd++;
            }
            // Transparent closing quotes/brackets after the run.
            int after = runEnd;
            while (after < n && CLOSERS.indexOf(buf.charAt(after)) >= 0) {
                after++;
            }
            // A boundary is confirmed only once whitespace after it is actually present.
            if (after < n && Character.isWhitespace(buf.charAt(after)) && isRealBoundary(i, runEnd)) {
                String sentence = buf.substring(start, after).trim();
                if (!sentence.isEmpty()) {
                    out.add(sentence);
                }
                int k = after;
                while (k < n && Character.isWhitespace(buf.charAt(k))) {
                    k++;
                }
                start = k;
                i = k;
                continue;
            }
            i = runEnd; // abbreviation / decimal / not yet confirmed → keep scanning
        }

        if (start > 0) {
            buf.delete(0, start);
        }
        return out;
    }

    /**
     * Whether a terminator run starting at {@code runStart} (exclusive end {@code runEnd}) is a true
     * sentence boundary. Any {@code ! ? …} is always a boundary; a pure {@code .} run is suppressed
     * for numeric ordinals/decimals and known abbreviations.
     */
    private boolean isRealBoundary(int runStart, int runEnd) {
        for (int p = runStart; p < runEnd; p++) {
            char c = buf.charAt(p);
            if (c == '!' || c == '?' || c == '…') {
                return true;
            }
        }
        // Pure period run: skip "3." (ordinal) / "3.14" edge and abbreviations.
        if (runStart > 0 && Character.isDigit(buf.charAt(runStart - 1))) {
            return false;
        }
        int wordStart = runStart;
        while (wordStart - 1 >= 0 && !Character.isWhitespace(buf.charAt(wordStart - 1))) {
            wordStart--;
        }
        String word = buf.substring(wordStart, runEnd).toLowerCase(Locale.ROOT);
        return !ABBREV.contains(word);
    }
}
