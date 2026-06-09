package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;

/**
 * Callback that persists a completed speaking turn and builds its response payload.
 *
 * <p>Extracted to break the cycle between {@link AiSpeakingServiceImpl} and
 * {@link SpeakingStreamService}: the facade owns {@code finalizeSpeakingChatPersistence}
 * (shared by the blocking {@code chat} path), and the stream service receives it as this
 * functional interface rather than holding a back-reference to the facade.
 *
 * <p>The implementation is expected to run inside a write transaction supplied by the
 * caller — the finalizer itself does not open one (see
 * {@link SpeakingStreamService} which wraps the call in the existing
 * {@code transactionTemplate.execute(...)}).
 *
 * <p>Parameter types mirror {@code AiSpeakingServiceImpl#finalizeSpeakingChatPersistence}
 * exactly. {@code prep} is the package-private {@link AiSpeakingServiceImpl.SpeakingChatPrep}
 * snapshot built during turn preparation; {@code purpose} is the token-ledger purpose tag
 * (e.g. {@code "SPEAKING_STREAM"}).
 */
@FunctionalInterface
public interface SpeakingTurnFinalizer {

    AiSpeakingChatResponse finalizeTurn(AiSpeakingServiceImpl.SpeakingChatPrep prep,
                                        String userMessage,
                                        AiChatCompletionResult ai,
                                        AiResponseDto parsed,
                                        String purpose);
}
