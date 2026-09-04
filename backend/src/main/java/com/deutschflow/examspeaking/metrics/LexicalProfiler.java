package com.deutschflow.examspeaking.metrics;

import com.deutschflow.examspeaking.api.model.Utterance;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Đo Wortschatz-Spektrum + connector/subordinator (Kohärenz) bằng code thuần — 0 token. */
@Component
@RequiredArgsConstructor
public class LexicalProfiler {

    static final Set<String> CONNECTORS = Set.of(
            "und", "aber", "oder", "denn", "dann", "danach", "deshalb", "deswegen", "darum", "trotzdem",
            "außerdem", "zuerst", "zum", "schließlich", "allerdings", "jedoch", "einerseits", "andererseits",
            "also", "sondern", "sowie", "zudem", "dagegen", "hingegen", "folglich", "somit");
    static final Set<String> SUBORDINATORS = Set.of(
            "weil", "dass", "wenn", "obwohl", "damit", "ob", "als", "nachdem", "bevor", "während",
            "falls", "sobald", "solange", "da", "indem", "sodass", "bis", "seit", "seitdem");
    private static final List<String> LEVEL_ORDER = List.of("A1", "A2", "B1", "B2", "C1", "C2");

    private final GoetheWordlist wordlist;

    public LexicalProfile profile(List<Utterance> candidateUtterances, String targetLevel) {
        List<String> tokens = candidateUtterances.stream()
                .flatMap(u -> tokenize(u.text()).stream())
                .toList();
        Set<String> types = new HashSet<>(tokens);
        Map<String, Integer> byLevel = new HashMap<>();
        int inList = 0;
        int aboveTarget = 0;
        int target = LEVEL_ORDER.indexOf(targetLevel == null ? "A1" : targetLevel.toUpperCase(Locale.ROOT));
        int connectors = 0;
        int subordinators = 0;
        for (String tok : tokens) {
            if (CONNECTORS.contains(tok)) {
                connectors++;
            }
            if (SUBORDINATORS.contains(tok)) {
                subordinators++;
            }
            wordlist.levelOf(tok).ifPresent(lv -> byLevel.merge(lv, 1, Integer::sum));
            if (wordlist.levelOf(tok).isPresent()) {
                inList++;
            }
        }
        for (String type : types) {
            int lv = wordlist.levelOf(type).map(LEVEL_ORDER::indexOf).orElse(-1);
            if (lv > target) {
                aboveTarget++;
            }
        }
        double ttr = tokens.isEmpty() ? 0 : (double) types.size() / tokens.size();
        double inListShare = tokens.isEmpty() ? 0 : (double) inList / tokens.size();
        return new LexicalProfile(tokens.size(), types.size(), ttr, inListShare, byLevel, aboveTarget,
                connectors, subordinators);
    }

    static List<String> tokenize(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                .filter(t -> !t.isBlank())
                .toList();
    }
}
