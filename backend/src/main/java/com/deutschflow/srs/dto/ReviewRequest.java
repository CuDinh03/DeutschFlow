package com.deutschflow.srs.dto;

/**
 * Request payload for recording a review result.
 *
 * <p>The {@code quality} field uses SM-2 scale (0-5) for backward compatibility.
 * It is automatically mapped to FSRS-4.5 rating (1-4) by {@code FsrsService.mapSm2ToFsrs}:
 * <pre>
 *   0-1 → Again (1)  — completely forgot
 *   2   → Hard  (2)  — remembered with difficulty
 *   3-4 → Good  (3)  — remembered normally
 *   5   → Easy  (4)  — remembered effortlessly
 * </pre>
 */
public record ReviewRequest(
        String vocabId,
        /** SM-2 quality 0-5: 0=Quên, 2=Khó, 4=OK, 5=Dễ — mapped to FSRS rating internally */
        int quality
) {}
