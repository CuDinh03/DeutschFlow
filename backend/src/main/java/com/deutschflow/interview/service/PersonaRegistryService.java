package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
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

    private final InterviewPersonaRepository personaRepository;

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
}
