package com.deutschflow.examspeaking.metrics;

/**
 * Số liệu Flüssigkeit đo được từ word-timestamps (khách quan, tái lập). Đơn vị: giây, từ/phút.
 * Các ngưỡng quy band nằm trong {@link com.deutschflow.examspeaking.scoring.FluencyBandMapper}.
 */
public record FluencyMetrics(
        int wordCount,
        double speakingSeconds,
        double phonationSeconds,
        double wordsPerMinute,
        double articulationRate,
        int pauseCount,
        int longPauseCount,
        double pauseRatio,
        double meanLengthOfRun,
        int repetitionCount,
        Double avgLogprob
) {}
