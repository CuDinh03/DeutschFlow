package com.deutschflow.vocabulary.service;

import org.springframework.stereotype.Service;

@Service
public class GenderColorService {

    public String colorForNounGender(String gender) {
        if (gender == null) return null;
        return switch (gender) {
            case "DER" -> "#3b82f6";
            case "DIE" -> "#ef4444";
            case "DAS" -> "#22c55e";
            case "PLURAL" -> "#a855f7";
            default -> null;
        };
    }
}

