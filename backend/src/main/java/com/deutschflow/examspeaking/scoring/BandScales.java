package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.RubricDefinition;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Thứ tự band + chuẩn hóa đầu vào (A* → A, "voll" → VOLL…). */
public final class BandScales {

    public static final List<String> A_E = List.of("A", "B", "C", "D", "E");
    public static final List<String> A_D = List.of("A", "B", "C", "D");
    public static final List<String> VHN = List.of("VOLL", "HALB", "NULL");

    /** Mặc định cho A_D khi tiêu chí không khai bandPoints (telc luôn khai, đây là lưới an toàn). */
    static final Map<String, Double> A_D_DEFAULT_FRACTIONS = Map.of("A", 1.0, "B", 2.0 / 3, "C", 1.0 / 3, "D", 0.0);
    static final Map<String, Double> A_E_DEFAULT_FRACTIONS = Map.of("A", 1.0, "B", 0.75, "C", 0.5, "D", 0.25, "E", 0.0);
    static final Map<String, Double> VHN_FRACTIONS = Map.of("VOLL", 1.0, "HALB", 0.5, "NULL", 0.0);

    private BandScales() {}

    public static List<String> bands(RubricDefinition.BandScale scale) {
        return switch (scale) {
            case A_E -> A_E;
            case A_D -> A_D;
            case VHN -> VHN;
        };
    }

    /** Chuẩn hóa band do LLM trả: "A*"→A, "b"→B, "voll"/"volle"→VOLL, "halbe"→HALB, "0"/"nicht"→NULL. */
    public static String normalize(RubricDefinition.BandScale scale, String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim().toUpperCase(Locale.ROOT).replace("*", "");
        if (scale == RubricDefinition.BandScale.VHN) {
            if (s.startsWith("VOLL") || s.equals("FULL") || s.equals("1") || s.equals("ERFUELLT") || s.equals("ERFÜLLT")) {
                return "VOLL";
            }
            if (s.startsWith("HALB") || s.equals("HALF") || s.equals("TEILWEISE") || s.equals("0.5")) {
                return "HALB";
            }
            return "NULL";
        }
        List<String> allowed = bands(scale);
        return allowed.contains(s) ? s : null;
    }

    public static int index(RubricDefinition.BandScale scale, String band) {
        return bands(scale).indexOf(band);
    }

    public static String lowest(RubricDefinition.BandScale scale) {
        List<String> b = bands(scale);
        return b.get(b.size() - 1);
    }

    public static Map<String, Double> defaultFractions(RubricDefinition.BandScale scale) {
        return switch (scale) {
            case A_E -> A_E_DEFAULT_FRACTIONS;
            case A_D -> A_D_DEFAULT_FRACTIONS;
            case VHN -> VHN_FRACTIONS;
        };
    }
}
