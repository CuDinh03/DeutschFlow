package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * DB-backed persona registry. Replaces scattered switch statements in
 * {@link com.deutschflow.speaking.interview.PersonaInterviewRegistry}.
 *
 * <p>The in-memory {@code PersonaInterviewRegistry} remains authoritative for topic-focus
 * and question-bank selection during the transition period. This service adds the DB layer
 * needed for versioning, analytics, and the interview domain API.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PersonaRegistryService {

    private static final String NON_INTERVIEW_FALLBACK = "DEFAULT";

    private static final TypeReference<List<List<String>>> TOPIC_POOLS_TYPE =
            new TypeReference<>() {};

    private final InterviewPersonaRepository personaRepository;
    private final ObjectMapper objectMapper;

    public Optional<InterviewPersonaEntity> findByCode(String personaCode) {
        if (personaCode == null || personaCode.isBlank()) {
            return personaRepository.findByCodeAndActiveTrue(NON_INTERVIEW_FALLBACK);
        }
        Optional<InterviewPersonaEntity> found = personaRepository.findByCodeAndActiveTrue(personaCode.toUpperCase());
        if (found.isEmpty()) {
            log.debug("Persona '{}' not found in interview registry, falling back to DEFAULT", personaCode);
            return personaRepository.findByCodeAndActiveTrue(NON_INTERVIEW_FALLBACK);
        }
        return found;
    }

    public List<InterviewPersonaEntity> listActive() {
        return personaRepository.findAllByActiveTrue();
    }

    public boolean isInterviewCapable(String personaCode) {
        if (personaCode == null) return false;
        return personaRepository.findByCodeAndActiveTrue(personaCode.toUpperCase()).isPresent();
    }

    public String industryFor(String personaCode) {
        return findByCode(personaCode)
                .map(InterviewPersonaEntity::getIndustry)
                .orElse("Allgemein");
    }

    /**
     * Decoded session topic-focus pools for the exact persona code, or empty when the persona
     * is not registered as interview-capable or has no {@code topic_pools_json} seeded.
     *
     * <p>Uses an exact (non-fallback) lookup so non-interview personas (DEFAULT/TUAN/LAN/MINH)
     * return empty and the caller keeps using its in-memory fallback during the transition.
     */
    public Optional<List<List<String>>> topicPoolsFor(String personaCode) {
        if (personaCode == null || personaCode.isBlank()) {
            return Optional.empty();
        }
        return personaRepository.findByCodeAndActiveTrue(personaCode.toUpperCase())
                .map(InterviewPersonaEntity::getTopicPoolsJson)
                .filter(json -> json != null && !json.isBlank())
                .flatMap(this::parseTopicPools);
    }

    private Optional<List<List<String>>> parseTopicPools(String json) {
        try {
            List<List<String>> pools = objectMapper.readValue(json, TOPIC_POOLS_TYPE);
            return (pools == null || pools.isEmpty()) ? Optional.empty() : Optional.of(pools);
        } catch (Exception e) {
            log.warn("Failed to parse topic_pools_json, falling back to in-memory pools: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
