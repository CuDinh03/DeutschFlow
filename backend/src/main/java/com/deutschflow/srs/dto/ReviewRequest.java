package com.deutschflow.srs.dto;

/** Request payload for recording a review result */
public record ReviewRequest(
        String vocabId,
        /** SM-2 quality 0-5: 0=Quên, 2=Khó, 4=OK, 5=Dễ */
        int quality
) {}
