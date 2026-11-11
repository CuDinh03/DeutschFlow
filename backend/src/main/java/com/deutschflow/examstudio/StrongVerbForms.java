package com.deutschflow.examstudio;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Đưa dạng quá khứ / phân từ của động từ mạnh về nguyên mẫu, để bảng "từ trên cấp" không báo nhầm.
 *
 * <p>Danh sách bổ sung B2/C1 là danh sách DẠNG TỪ theo tần suất; nó chỉ loại được dạng nào bỏ đuôi là ra gốc từ
 * A1–B1. Dạng đổi nguyên âm của động từ mạnh lọt lưới: chạy thử 11/11/2026, "litten" (leiden, B1) và "traten"
 * (treten, B1) bị tính là từ C1. Bảng dưới gồm các động từ mạnh và bất quy tắc thường gặp ở A1–B1.
 */
public final class StrongVerbForms {

    private StrongVerbForms() {}

    /** gốc quá khứ hoặc phân từ II → nguyên mẫu. */
    private static final Map<String, String> BASE = new HashMap<>();

    private static void add(String infinitive, String... forms) {
        for (String f : forms) BASE.put(f, infinitive);
    }

    static {
        add("sein", "war", "gewesen");
        add("haben", "hatte", "gehabt");
        add("werden", "wurde", "geworden");
        add("gehen", "ging", "gegangen");
        add("kommen", "kam", "gekommen");
        add("sehen", "sah", "gesehen");
        add("geben", "gab", "gegeben");
        add("nehmen", "nahm", "genommen");
        add("finden", "fand", "gefunden");
        add("stehen", "stand", "gestanden");
        add("liegen", "lag", "gelegen");
        add("sitzen", "saß", "gesessen");
        add("fahren", "fuhr", "gefahren");
        add("tragen", "trug", "getragen");
        add("schlafen", "schlief", "geschlafen");
        add("laufen", "lief", "gelaufen");
        add("rufen", "rief", "gerufen");
        add("halten", "hielt", "gehalten");
        add("fallen", "fiel", "gefallen");
        add("lassen", "ließ", "gelassen");
        add("bleiben", "blieb", "geblieben");
        add("schreiben", "schrieb", "geschrieben");
        add("steigen", "stieg", "gestiegen");
        add("scheinen", "schien", "geschienen");
        add("scheiden", "schied", "geschieden");
        add("leiden", "litt", "gelitten");
        add("schneiden", "schnitt", "geschnitten");
        add("treten", "trat", "getreten");
        add("lesen", "las", "gelesen");
        add("essen", "aß", "gegessen");
        add("gessen", "gaß");
        add("helfen", "half", "geholfen");
        add("sprechen", "sprach", "gesprochen");
        add("treffen", "traf", "getroffen");
        add("sterben", "starb", "gestorben");
        add("werfen", "warf", "geworfen");
        add("brechen", "brach", "gebrochen");
        add("ginnen", "gann", "gonnen");
        add("winnen", "wann", "wonnen");
        add("schwimmen", "schwamm", "geschwommen");
        add("trinken", "trank", "getrunken");
        add("singen", "sang", "gesungen");
        add("springen", "sprang", "gesprungen");
        add("sinken", "sank", "gesunken");
        add("lieren", "lor", "loren");
        add("ziehen", "zog", "gezogen");
        add("fliegen", "flog", "geflogen");
        add("schließen", "schloss", "geschlossen");
        add("bieten", "bot", "geboten");
        add("wachsen", "wuchs", "gewachsen");
        add("waschen", "wusch", "gewaschen");
        add("laden", "lud", "geladen");
        add("schlagen", "schlug", "geschlagen");
        add("denken", "dachte", "gedacht");
        add("bringen", "brachte", "gebracht");
        add("kennen", "kannte", "gekannt");
        add("nennen", "nannte", "genannt");
        add("wissen", "wusste", "gewusst");
        add("können", "konnte", "gekonnt");
        add("müssen", "musste", "gemusst");
        add("dürfen", "durfte", "gedurft");
        add("mögen", "mochte", "gemocht");
        add("tun", "tat", "getan");
        add("bitten", "bat", "gebeten");
        add("heißen", "hieß", "geheißen");
        add("stoßen", "stieß", "gestoßen");
        add("raten", "riet", "geraten");
        add("fangen", "fing", "gefangen");
        add("hängen", "hing", "gehangen");
        add("gelten", "galt", "gegolten");
        add("binden", "band", "gebunden");
        add("zwingen", "zwang", "gezwungen");
        add("lingen", "lang", "lungen");
        add("klingen", "klang", "geklungen");
        add("messen", "maß", "gemessen");
        add("meiden", "mied", "gemieden");
        add("leihen", "lieh", "geliehen");
        add("weisen", "wies", "gewiesen");
        add("greifen", "griff", "gegriffen");
        add("streiten", "stritt", "gestritten");
        add("reiten", "ritt", "geritten");
        add("schweigen", "schwieg", "geschwiegen");
        add("treiben", "trieb", "getrieben");
        add("fließen", "floss", "geflossen");
        add("genießen", "genoss", "genossen");
        add("riechen", "roch", "gerochen");
        add("frieren", "fror", "gefroren");
        add("heben", "hob", "gehoben");
        add("lügen", "log", "gelogen");
        add("stehlen", "stahl", "gestohlen");
        add("fehlen", "fahl", "fohlen");
        add("sprießen", "spross");
        add("schieben", "schob", "geschoben");
        add("biegen", "bog", "gebogen");
        add("wiegen", "wog", "gewogen");
        add("graben", "grub", "gegraben");
        add("schaffen", "schuf", "geschaffen");
        add("backen", "buk", "gebacken");
        add("braten", "briet", "gebraten");
        add("blasen", "blies", "geblasen");
        add("stechen", "stach", "gestochen");
        add("schrecken", "schrak", "schrocken");
        add("gessen", "gessen");
    }

    private static final String[] ENDINGS = {"", "en", "est", "et", "er", "es", "em", "st", "e", "n", "t"};
    private static final String[] PREFIXES = {"zurück", "zusammen", "unter", "über", "wider", "durch", "nach",
            "statt", "teil", "fest", "fort", "her", "hin", "vor", "auf", "aus", "ein", "mit", "weg", "ver", "ent",
            "emp", "zer", "ab", "an", "be", "er", "ge", "um", "zu"};

    /**
     * Các nguyên mẫu có thể là gốc của {@code token} (rỗng khi không nhận ra). Động từ có tiền tố trả cả dạng có
     * tiền tố lẫn động từ gốc: "auftraten" → "auftreten", "treten".
     */
    public static List<String> lemmas(String token) {
        List<String> out = new ArrayList<>();
        if (token == null) return out;
        String t = token.toLowerCase(Locale.GERMAN);
        for (String ending : ENDINGS) {
            if (!t.endsWith(ending) || t.length() - ending.length() < 2) continue;
            String stem = t.substring(0, t.length() - ending.length());
            collect(stem, "", out);
            for (String prefix : PREFIXES) {
                if (stem.length() > prefix.length() + 1 && stem.startsWith(prefix)) {
                    collect(stem.substring(prefix.length()), prefix, out);
                }
            }
        }
        return out;
    }

    private static void collect(String stem, String prefix, List<String> out) {
        String inf = BASE.get(stem);
        if (inf == null) return;
        if (!prefix.isEmpty() && !out.contains(prefix + inf)) out.add(prefix + inf);
        if (!out.contains(inf)) out.add(inf);
    }
}
