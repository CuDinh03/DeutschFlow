package com.deutschflow.teacher.curriculumimport.ocr;

/**
 * Turns a rendered page image into text.
 *
 * <p>The seam exists so the OCR engine is a deployment choice, not an architectural one. The default
 * implementation is {@link LocalTesseractOcrProvider}: it runs in our own container, needs no API
 * key, and never sends a centre's coursebook to a third party — which is the property that lets this
 * feature read copyrighted material at all.
 */
public interface OcrProvider {

    /** Short identifier for logs and the preview's provenance line. */
    String name();

    /**
     * Whether this provider can actually run right now. Callers must check first: a missing engine is
     * a normal state (the binary is not installed everywhere) and must degrade to a clear message,
     * never to a stack trace.
     */
    boolean isAvailable();

    /**
     * Recognise text in one page image.
     *
     * @param imageBytes  PNG bytes of a single rendered page
     * @param languageTag ISO 639-2 language hint for the engine (e.g. {@code deu})
     * @return recognised text, empty when the page holds none
     */
    String ocrPage(byte[] imageBytes, String languageTag) throws OcrException;

    /** Thrown when the engine is present but this page could not be processed. */
    class OcrException extends RuntimeException {
        public OcrException(String message, Throwable cause) {
            super(message, cause);
        }

        public OcrException(String message) {
            super(message);
        }
    }
}
