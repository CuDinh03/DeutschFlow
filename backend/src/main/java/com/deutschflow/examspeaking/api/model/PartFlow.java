package com.deutschflow.examspeaking.api.model;

/** Kịch bản lượt của một Teil — quyết định ai nói tiếp và thí sinh phải làm gì ở mỗi bước. */
public enum PartFlow {
    /** Giám khảo hỏi, thí sinh trả lời (A1 T1 sich vorstellen). */
    EXAMINER_LED,
    /** Hỏi–đáp luân phiên theo thẻ: thí sinh hỏi → partner đáp + hỏi lại → thí sinh đáp … */
    ALTERNATING_QA,
    /** Thí sinh độc thoại (Präsentation/Von sich erzählen), sau đó hỏi đáp. */
    MONOLOGUE,
    /** Hội thoại tự do với partner (planen, Diskussion). */
    DIALOGUE,
    /** Partner trình bày trước, thí sinh cho Rückmeldung + đặt câu hỏi. */
    FEEDBACK
}
