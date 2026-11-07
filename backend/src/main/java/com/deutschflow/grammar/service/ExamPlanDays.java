package com.deutschflow.grammar.service;

import com.deutschflow.grammar.service.ExamPlanGenerator.Task;
import com.deutschflow.grammar.service.ExamPlanGenerator.Week;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Chia việc của MỘT tuần lộ trình thành từng buổi theo ngày (đợt (d) làm mới Luyện thi, 07/11/2026):
 * mỗi ngày một buổi, ngày còn lại là ngày nghỉ, ngày thi là ngày cuối của tuần cuối.
 *
 * <p>Hàm thuần, cùng đầu vào cho cùng thứ tự mặc định. Học viên đổi chỗ được buổi chưa làm; thứ tự đổi
 * lưu dạng hoán vị chỉ số của danh sách mặc định ({@link #apply}), nên tuần sinh lại vẫn đọc được.
 *
 * <p>Teil đọc/nghe/viết giờ có đường luyện riêng từng Teil (luyện đề telc, #747), nên trọng tâm của
 * tuần thành buổi luyện Teil đo được. Việc "Ôn yếu điểm" không đo được, nên thành một buổi luyện Teil
 * yếu nhất.
 */
public final class ExamPlanDays {

    public enum Kind { TEIL, FULL_EXAM, ORAL_MOCK, ORAL_DRILL, ROADMAP, REST, EXAM_DAY }

    /** Buổi luyện thường chiếm từ 10 tới 90 phút, làm tròn 5 phút. */
    static final int MIN_SESSION_MINUTES = 10;
    static final int MAX_SESSION_MINUTES = 90;
    /** Phần viết telc B1 (Lesen, Sprachbausteine, Hören, Schreiben). */
    static final int FULL_EXAM_MINUTES = 150;
    static final int ORAL_MOCK_MINUTES = 20;
    static final int ORAL_DRILL_MINUTES = 15;
    /** Ít nhất một ngày nghỉ mỗi tuần đủ bảy ngày. */
    static final int MAX_STUDY_DAYS = 6;
    static final int MIN_STUDY_DAYS = 3;

    private ExamPlanDays() {}

    /**
     * @param section {@code LESEN}… với buổi {@link Kind#TEIL}, {@code SPRECHEN} với buổi Nói
     * @param teil    Teil của buổi luyện Teil hoặc luyện Nói
     */
    public record Session(Kind kind, String section, Integer teil, int minutes) {
        static Session rest() {
            return new Session(Kind.REST, null, null, 0);
        }

        public boolean movable() {
            return kind != Kind.EXAM_DAY;
        }
    }

    /**
     * Thứ tự mặc định: buổi luyện Teil trọng tâm xen với buổi khác, đề full cuối tuần, ngày nghỉ ở cuối,
     * ngày thi (nếu rơi vào tuần này) là ngày cuối cùng.
     *
     * @param rankedTeile khoá Teil theo độ ưu tiên ({@link ExamPlanGenerator#rank}), dùng cho buổi ôn Teil yếu
     */
    public static List<Session> defaultSessions(Week week, LocalDate targetDate, int weeklyMinutes,
                                                List<String> rankedTeile) {
        int days = (int) ChronoUnit.DAYS.between(week.startDate(), week.endDate()) + 1;
        boolean examDayInside = !targetDate.isBefore(week.startDate()) && !targetDate.isAfter(week.endDate());
        int free = examDayInside ? days - 1 : days;
        int studyDays = Math.min(free, clamp(weeklyMinutes / 30, MIN_STUDY_DAYS, MAX_STUDY_DAYS));
        int teilMinutes = roundTo5(clamp(weeklyMinutes / Math.max(1, studyDays), MIN_SESSION_MINUTES, MAX_SESSION_MINUTES));

        List<Session> exam = new ArrayList<>();
        List<Session> others = new ArrayList<>();
        int reviews = 0;
        for (Task task : week.tasks()) {
            switch (task.type()) {
                case DIAGNOSTIC_EXAM, FULL_EXAM -> exam.add(new Session(Kind.FULL_EXAM, null, null, FULL_EXAM_MINUTES));
                case ORAL_MOCK -> repeat(others, new Session(Kind.ORAL_MOCK, ExamPlanBlueprints.SECTION_SPEAKING, null, ORAL_MOCK_MINUTES), task.target());
                case ORAL_DRILL -> repeat(others, new Session(Kind.ORAL_DRILL, ExamPlanBlueprints.SECTION_SPEAKING, task.teil(), ORAL_DRILL_MINUTES), task.target());
                case WEAKNESS_REVIEW -> reviews++;
                case ROADMAP_NODES -> {
                    // Tuần chỉ theo cây lộ trình thì mọi buổi là bài lộ trình; tuần khác một buổi là đủ.
                    int n = week.phase() == ExamPlanGenerator.Phase.ROADMAP ? studyDays : 1;
                    repeat(others, new Session(Kind.ROADMAP, null, null, teilMinutes), n);
                }
            }
        }

        List<String> focus = week.focus().stream()
                .filter(k -> !k.startsWith(ExamPlanBlueprints.SECTION_SPEAKING + ":"))
                .toList();
        List<Session> teil = new ArrayList<>();
        for (int i = 0; i < reviews; i++) {
            String weak = weakest(rankedTeile, focus);
            if (weak != null) teil.add(teilSession(weak, teilMinutes));
        }
        int slots = studyDays - exam.size() - others.size() - teil.size();
        for (int i = 0; i < slots && !focus.isEmpty(); i++) {
            teil.add(i, teilSession(focus.get(i % focus.size()), teilMinutes));
        }

        // Xen kẽ: Teil, việc khác, Teil, … để không dồn ba buổi Nói vào ba ngày liền.
        List<Session> mixed = new ArrayList<>();
        int a = 0;
        int b = 0;
        while (a < teil.size() || b < others.size()) {
            if (a < teil.size()) mixed.add(teil.get(a++));
            if (b < others.size()) mixed.add(others.get(b++));
        }
        // Tuần ngắn (tuần cuối): bớt từ cuối, đề full luôn giữ.
        while (mixed.size() + exam.size() > free && !mixed.isEmpty()) mixed.remove(mixed.size() - 1);
        mixed.addAll(exam);
        while (mixed.size() > free) mixed.remove(mixed.size() - 1);
        while (mixed.size() < free) mixed.add(Session.rest());
        if (examDayInside) mixed.add(new Session(Kind.EXAM_DAY, null, null, 0));
        return mixed;
    }

    /**
     * Áp thứ tự đã lưu. Thứ tự không còn khớp (tuần sinh lại khác số buổi) thì dùng mặc định.
     *
     * @param order chỉ số buổi mặc định cho từng ngày, theo thứ tự ngày
     */
    public static List<Session> apply(List<Session> defaults, List<Integer> order) {
        if (!isPermutation(order, defaults.size())) return defaults;
        List<Session> out = new ArrayList<>(defaults.size());
        for (int i = 0; i < order.size(); i++) {
            Session s = defaults.get(order.get(i));
            // Ngày thi không bao giờ đổi chỗ: thứ tự lưu đặt nó chỗ khác là thứ tự cũ, bỏ.
            if (s.kind() == Kind.EXAM_DAY && i != order.size() - 1) return defaults;
            out.add(s);
        }
        return out;
    }

    /** Hoán vị đầy đủ 0..n-1 ({@code null} hoặc thiếu ⇒ không phải). */
    public static boolean isPermutation(List<Integer> order, int n) {
        if (order == null || order.size() != n) return false;
        Set<Integer> seen = new HashSet<>();
        for (Integer i : order) {
            if (i == null || i < 0 || i >= n || !seen.add(i)) return false;
        }
        return true;
    }

    /** Đổi chỗ buổi của hai ngày trong thứ tự (mặc định là 0..n-1). */
    public static List<Integer> swap(List<Integer> order, int n, int from, int to) {
        List<Integer> base = new ArrayList<>(n);
        if (isPermutation(order, n)) base.addAll(order);
        else for (int i = 0; i < n; i++) base.add(i);
        Integer x = base.get(from);
        base.set(from, base.get(to));
        base.set(to, x);
        return base;
    }

    private static Session teilSession(String key, int minutes) {
        int colon = key.indexOf(':');
        return new Session(Kind.TEIL, key.substring(0, colon), Integer.parseInt(key.substring(colon + 1)), minutes);
    }

    /** Teil yếu nhất không thuộc phần Nói, ưu tiên Teil chưa là trọng tâm của tuần. */
    private static String weakest(List<String> ranked, List<String> focus) {
        String fallback = null;
        for (String key : ranked) {
            if (key.startsWith(ExamPlanBlueprints.SECTION_SPEAKING + ":")) continue;
            if (!focus.contains(key)) return key;
            if (fallback == null) fallback = key;
        }
        return fallback;
    }

    private static void repeat(List<Session> out, Session s, int n) {
        for (int i = 0; i < n; i++) out.add(s);
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static int roundTo5(int v) {
        return Math.max(MIN_SESSION_MINUTES, Math.round(v / 5f) * 5);
    }

    /** Ngày đầu của tuần + {@code index}. */
    public static LocalDate dateOf(Week week, int index) {
        return week.startDate().plusDays(index);
    }
}
