package com.deutschflow.aiimage.service;

public interface ImageGenerationProvider {
    GeneratedImage generate(GeneratedImageRequest request);

    record GeneratedImage(String contentType, byte[] bytes, String promptUsed) {}

    record GeneratedImageRequest(String prompt, String style, String size) {}
}
