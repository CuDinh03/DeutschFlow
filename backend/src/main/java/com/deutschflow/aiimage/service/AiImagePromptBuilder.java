package com.deutschflow.aiimage.service;

import org.springframework.stereotype.Component;

@Component
public class AiImagePromptBuilder {

    public String build(String prompt, String preset, String style) {
        return "Create a high-quality educational image for DeutschFlow. "
                + "Preset: " + preset + ". "
                + "Style: " + style + ". "
                + "User prompt: " + prompt + ". "
                + "Keep it clean, modern, and suitable for a premium German learning platform.";
    }
}
