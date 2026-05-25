package com.deutschflow.vocabulary.service;

import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Đọc wordlist UTF-8 trên classpath (không HTTP).
 */
public final class ClasspathWordlistReader {

    private ClasspathWordlistReader() {}

    public static String readUtf8(String classpathLocation) {
        ClassPathResource res = new ClassPathResource(classpathLocation);
        try {
            return new String(res.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read classpath wordlist: " + classpathLocation, e);
        }
    }
}
