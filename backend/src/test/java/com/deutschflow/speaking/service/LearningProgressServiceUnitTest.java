package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.entity.UserLearningProgress;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Real-behavior unit tests for {@link LearningProgressService}, extracted verbatim from
 * {@code AiSpeakingServiceImpl}. A real {@link ObjectMapper} is used so the JSON parse/merge
 * round-trips behave exactly as in production; only the repositories are mocked.
 */
@ExtendWith(MockitoExtension.class)
class LearningProgressServiceUnitTest {

    @Mock UserLearningProfileRepository profileRepository;
    @Mock UserLearningProgressRepository progressRepository;
    @Mock UserRepository userRepository;

    LearningProgressService service;

    private static final long USER_ID = 11L;

    @BeforeEach
    void setUp() {
        // Real ObjectMapper — exercises the actual JSON behavior the service depends on.
        service = new LearningProgressService(new ObjectMapper(), profileRepository, progressRepository, userRepository);
    }

    private static AiResponseDto response(String status, List<ErrorItem> errors, String correction) {
        return new AiResponseDto(
                "Gut.", correction, null, null, null, null,
                errors, status, null, null, null, null, null);
    }

    // ---------------------------------------------------------------------
    // extractInterests
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("extractInterests parses a JSON array of interests from the profile")
    void extractInterests_validJson_returnsList() {
        // Arrange
        UserLearningProfile profile = UserLearningProfile.builder()
                .interestsJson("[\"Fußball\",\"Kochen\"]")
                .build();

        // Act
        List<String> interests = service.extractInterests(profile);

        // Assert
        assertThat(interests).containsExactly("Fußball", "Kochen");
    }

    @Test
    @DisplayName("extractInterests returns empty list for null profile")
    void extractInterests_nullProfile_returnsEmpty() {
        assertThat(service.extractInterests(null)).isEmpty();
    }

    @Test
    @DisplayName("extractInterests returns empty list when interestsJson is null or blank")
    void extractInterests_blankJson_returnsEmpty() {
        assertThat(service.extractInterests(UserLearningProfile.builder().build())).isEmpty();
        assertThat(service.extractInterests(UserLearningProfile.builder().interestsJson("   ").build())).isEmpty();
    }

    @Test
    @DisplayName("extractInterests returns empty list (does not throw) when JSON is malformed")
    void extractInterests_malformedJson_returnsEmpty() {
        UserLearningProfile profile = UserLearningProfile.builder().interestsJson("{not-an-array").build();

        assertThatCode(() -> assertThat(service.extractInterests(profile)).isEmpty())
                .doesNotThrowAnyException();
    }

    // ---------------------------------------------------------------------
    // mergeInterest
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("mergeInterest appends a new (trimmed) interest and saves the profile")
    void mergeInterest_newInterest_appendsAndSaves() {
        // Arrange
        UserLearningProfile profile = UserLearningProfile.builder()
                .interestsJson("[\"Fußball\"]")
                .build();

        // Act
        service.mergeInterest(profile, "  Reisen  ");

        // Assert — persisted JSON contains both, the new one trimmed
        assertThat(service.extractInterests(profile)).containsExactly("Fußball", "Reisen");
        verify(profileRepository).save(profile);
    }

    @Test
    @DisplayName("mergeInterest dedups: an already-present interest is not duplicated")
    void mergeInterest_duplicateInterest_doesNotDuplicate() {
        // Arrange
        UserLearningProfile profile = UserLearningProfile.builder()
                .interestsJson("[\"Kochen\"]")
                .build();

        // Act
        service.mergeInterest(profile, "Kochen");

        // Assert
        assertThat(service.extractInterests(profile)).containsExactly("Kochen");
        verify(profileRepository).save(profile);
    }

    @Test
    @DisplayName("mergeInterest seeds the first interest when the profile had none")
    void mergeInterest_emptyProfile_seedsFirst() {
        // Arrange
        UserLearningProfile profile = UserLearningProfile.builder().build();

        // Act
        service.mergeInterest(profile, "Musik");

        // Assert
        assertThat(service.extractInterests(profile)).containsExactly("Musik");
        verify(profileRepository).save(profile);
    }

    @Test
    @DisplayName("mergeInterest does not rethrow when the new interest is null (best-effort)")
    void mergeInterest_nullInterest_swallows() {
        // Arrange — null.trim() inside throws NPE, which the service must swallow
        UserLearningProfile profile = UserLearningProfile.builder().interestsJson("[\"X\"]").build();

        // Act + Assert
        assertThatCode(() -> service.mergeInterest(profile, null)).doesNotThrowAnyException();
        // Save never reached because the merge failed before writeValueAsString
        verify(profileRepository, never()).save(any());
    }

    // ---------------------------------------------------------------------
    // updateUserLearningProgress
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("updateUserLearningProgress records OFF_TOPIC as the last error type")
    void updateProgress_offTopic_recordsOffTopic() {
        // Arrange
        UserLearningProgress existing = UserLearningProgress.builder().build();
        when(progressRepository.findByUserId(USER_ID)).thenReturn(Optional.of(existing));

        // Act
        service.updateUserLearningProgress(USER_ID, response("OFF_TOPIC", List.of(), null));

        // Assert
        verify(progressRepository).save(existing);
        assertThat(existing.getLastErrorType()).isEqualTo("OFF_TOPIC");
    }

    @Test
    @DisplayName("updateUserLearningProgress records the first structured error code")
    void updateProgress_withErrors_recordsFirstErrorCode() {
        // Arrange
        ErrorItem err = new ErrorItem("WORD_ORDER.V2_MAIN_CLAUSE", "MAJOR", 0.9, "w", "c", "r", "e");
        UserLearningProgress existing = UserLearningProgress.builder().build();
        when(progressRepository.findByUserId(USER_ID)).thenReturn(Optional.of(existing));

        // Act
        service.updateUserLearningProgress(USER_ID, response("ON_TOPIC", List.of(err), null));

        // Assert
        verify(progressRepository).save(existing);
        assertThat(existing.getLastErrorType()).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
    }

    @Test
    @DisplayName("updateUserLearningProgress records GENERAL_GRAMMAR when only a legacy correction is present")
    void updateProgress_legacyCorrection_recordsGeneralGrammar() {
        // Arrange
        UserLearningProgress existing = UserLearningProgress.builder().build();
        when(progressRepository.findByUserId(USER_ID)).thenReturn(Optional.of(existing));

        // Act
        service.updateUserLearningProgress(USER_ID, response("ON_TOPIC", List.of(), "Das ist falsch."));

        // Assert
        verify(progressRepository).save(existing);
        assertThat(existing.getLastErrorType()).isEqualTo("GENERAL_GRAMMAR");
    }

    @Test
    @DisplayName("updateUserLearningProgress creates a new progress row via getReferenceById when none exists")
    void updateProgress_noExistingRow_createsViaReference() {
        // Arrange
        when(progressRepository.findByUserId(USER_ID)).thenReturn(Optional.empty());

        // Act
        service.updateUserLearningProgress(USER_ID,
                response("ON_TOPIC", List.of(
                        new ErrorItem("ARTICLE.GENDER", "MINOR", 0.5, "w", "c", "r", "e")), null));

        // Assert
        verify(userRepository).getReferenceById(USER_ID);
        ArgumentCaptor<UserLearningProgress> captor = ArgumentCaptor.forClass(UserLearningProgress.class);
        verify(progressRepository).save(captor.capture());
        assertThat(captor.getValue().getLastErrorType()).isEqualTo("ARTICLE.GENDER");
    }

    @Test
    @DisplayName("updateUserLearningProgress is a no-op when there is no error signal")
    void updateProgress_noErrorSignal_noSave() {
        // Act — EXCELLENT, no errors, no correction → lastError stays null
        service.updateUserLearningProgress(USER_ID, response("EXCELLENT", List.of(), null));

        // Assert
        verify(progressRepository, never()).save(any());
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("updateUserLearningProgress does not rethrow when the repository save fails (best-effort)")
    void updateProgress_saveThrows_swallows() {
        // Arrange
        UserLearningProgress existing = UserLearningProgress.builder().build();
        when(progressRepository.findByUserId(USER_ID)).thenReturn(Optional.of(existing));
        when(progressRepository.save(any())).thenThrow(new RuntimeException("DB down"));

        // Act + Assert — never propagates into the live turn
        assertThatCode(() -> service.updateUserLearningProgress(USER_ID, response("OFF_TOPIC", List.of(), null)))
                .doesNotThrowAnyException();
    }
}
