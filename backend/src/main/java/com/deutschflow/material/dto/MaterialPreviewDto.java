package com.deutschflow.material.dto;

/**
 * How the client should render a material in-browser, plus the URL to render.
 *
 * <p>{@code mode} tells the client which element to use — it does NOT repeat {@code kind}, because a
 * Word file is served as a converted PDF ({@code kind=DOCX}, {@code mode=PDF}). {@code url} is a
 * short-lived presigned GET (or the raw link for {@code kind=LINK}); it is null for the two terminal
 * modes so the client falls back to a download.
 */
public record MaterialPreviewDto(Mode mode, String url) {

    public enum Mode {
        /** Render in an {@code <iframe>} — native PDFs and Office files converted to PDF. */
        PDF,
        IMAGE,
        AUDIO,
        VIDEO,
        /** {@code kind=LINK} — open the external URL in a new tab; do not embed. */
        LINK,
        /** The format has no in-browser preview at all (e.g. a .zip). Offer the download. */
        UNSUPPORTED,
        /** Previewable in principle, but this conversion attempt failed or the converter was busy. Retryable. */
        FAILED,
    }

    public static MaterialPreviewDto of(Mode mode, String url) {
        return new MaterialPreviewDto(mode, url);
    }

    public static MaterialPreviewDto unsupported() {
        return new MaterialPreviewDto(Mode.UNSUPPORTED, null);
    }

    public static MaterialPreviewDto failed() {
        return new MaterialPreviewDto(Mode.FAILED, null);
    }
}
