package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.curriculum.dto.CurriculumCourse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
@RequiredArgsConstructor
public class CurriculumService {

    private final ObjectMapper objectMapper;

    public CurriculumCourse getNetzwerkNeuA1() {
        return readJson("curriculum/netzwerk-neu/a1.curriculum.json");
    }

    private CurriculumCourse readJson(String classpathLocation) {
        try (InputStream in = new ClassPathResource(classpathLocation).getInputStream()) {
            return objectMapper.readValue(in, CurriculumCourse.class);
        } catch (Exception e) {
            throw new NotFoundException("Curriculum not found");
        }
    }
}

