package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CurriculumServiceUnitTest {

    @Test
    void getNetzwerkNeuA1_readsBundledJson() {
        CurriculumService svc = new CurriculumService(new ObjectMapper());
        var course = svc.getNetzwerkNeuA1();
        assertNotNull(course.courseId());
        assertNotNull(course.units());
        assertFalse(course.units().isEmpty());
    }
}
