package com.deutschflow.teacher.entity;

import java.util.Set;

/**
 * The lifecycle of a {@link StudentAssignment}, stored as a plain string column.
 *
 * <pre>
 *   PENDING ──submit──▶ SUBMITTED ──"Chấm AI"──▶ AI_GRADED ──teacher confirms──▶ EVALUATED
 *                           │                        ▲                                ▲
 *                           └──AI error──▶ GRADING_FAILED ──retry──┘                  │
 *                           └──────────────teacher grades by hand─────────────────────┘
 * </pre>
 *
 * <p><b>Why {@link #AI_GRADED} exists.</b> The AI pass used to write {@link #GRADED} directly, which
 * notified the student with the raw AI score and dropped the row out of the teacher's queue — while the
 * UI still promised "AI chấm sơ bộ · giáo viên xác nhận". A teacher who then corrected the score sent the
 * student a <i>second</i> "bài đã chấm" notification with a different number. AI_GRADED means "the AI has
 * proposed a score; nobody has confirmed it": it stays in the queue, it is not announced to the student,
 * and it is not counted as a real grade anywhere (averages, gradebook, competency ledger). Only a teacher
 * moving it to {@link #EVALUATED} does those things, exactly once.
 *
 * <p>{@link #GRADED} is kept for rows written before AI_GRADED existed — they were already announced to
 * their students, so they still read as final grades everywhere.
 */
public final class AssignmentStatus {

    /** Assigned, not yet handed in. */
    public static final String PENDING = "PENDING";
    /** Handed in, nothing done to it yet. */
    public static final String SUBMITTED = "SUBMITTED";
    /** AI proposed a score. NOT final: not shown to the student, not counted, still in the teacher queue. */
    public static final String AI_GRADED = "AI_GRADED";
    /** AI grading errored. Handed in, still needs a grade — retry or grade by hand. */
    public static final String GRADING_FAILED = "GRADING_FAILED";
    /** Legacy: an AI grade that was announced to the student before AI_GRADED existed. Final. */
    public static final String GRADED = "GRADED";
    /** A teacher confirmed the grade. Final, announced to the student exactly once. */
    public static final String EVALUATED = "EVALUATED";

    /** Statuses that count as a real, confirmed grade — the only ones that may feed an average. */
    public static final Set<String> FINAL_GRADES = Set.of(GRADED, EVALUATED);

    /** Statuses that still need a teacher: they belong in the grading queue. */
    public static final Set<String> AWAITING_TEACHER = Set.of(SUBMITTED, AI_GRADED, GRADING_FAILED);

    /** True when the row carries a confirmed grade that must not be overwritten by an AI pass. */
    public static boolean isFinal(String status) {
        return FINAL_GRADES.contains(status);
    }

    /** True when the student has handed the work in, whatever has happened to it since. */
    public static boolean isSubmitted(String status) {
        return AWAITING_TEACHER.contains(status) || isFinal(status);
    }

    private AssignmentStatus() {}
}
