# Implementation Plan: DeutschFlow AI Speaking Practice

## Overview

Implement the AI speaking practice feature as a new `speaking` module in the existing Spring Boot modular monolith. The implementation follows the package structure defined in the design, reuses JWT authentication, JPA, and Flyway already present in the project, and integrates with OpenAI GPT-4o via Spring's `RestClient`.

## Tasks

- [x] 1. Add OpenAI dependency and database migration
  - [x] 1.1 Add `openai-java` dependency to `backend/pom.xml`
    - Add `com.openai:openai-java:2.7.0` under the `<dependencies>` section
    - Alternatively, confirm that Spring `RestClient` (already available via `spring-boot-starter-web`) will be used instead — no new dependency needed in that case; use `RestClient` to call `https://api.openai.com/v1/chat/completions` directly
    - _Requirements: 5.1, 5.5_

  - [x] 1.2 Create Flyway migration `V27__create_ai_speaking_tables.sql`
    - Create file at `backend/src/main/resources/db/migration/V27__create_ai_speaking_tables.sql`
    - Define `ai_speaking_sessions` table with columns: `id`, `user_id` (FK → `users.id` ON DELETE CASCADE), `topic` (VARCHAR 200), `status` (ENUM `ACTIVE`/`ENDED`), `started_at`, `last_activity_at`, `ended_at`, `message_count`
    - Define `ai_speaking_messages` table with columns: `id`, `session_id` (FK → `ai_speaking_sessions.id` ON DELETE CASCADE), `role` (ENUM `USER`/`ASSISTANT`), `user_text` (TEXT), `ai_speech_de` (TEXT), `correction` (TEXT), `explanation_vi` (TEXT), `grammar_point` (VARCHAR 200), `new_word` (VARCHAR 200), `user_interest_detected` (VARCHAR 200), `created_at`
    - Add indexes: `idx_ai_session_user_status (user_id, status)`, `idx_ai_session_last_activity (last_activity_at)`, `idx_ai_message_session_created (session_id, created_at)`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 2. Create package structure, entities, and repositories
  - [x] 2.1 Create `AiSpeakingSession` JPA entity
    - Create `backend/src/main/java/com/deutschflow/speaking/entity/AiSpeakingSession.java`
    - Fields: `id` (Long, auto-increment), `userId` (Long, not null), `topic` (String, max 200), `status` (SessionStatus enum: ACTIVE/ENDED), `startedAt`, `lastActivityAt`, `endedAt` (LocalDateTime), `messageCount` (int)
    - Annotate with `@Entity`, `@Table(name = "ai_speaking_sessions")`, Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`
    - _Requirements: 1.1, 1.3, 9.1, 9.4_

  - [x] 2.2 Create `AiSpeakingMessage` JPA entity
    - Create `backend/src/main/java/com/deutschflow/speaking/entity/AiSpeakingMessage.java`
    - Fields: `id`, `sessionId` (Long, not null), `role` (MessageRole enum: USER/ASSISTANT), `userText` (String), `aiSpeechDe` (String), `correction`, `explanationVi`, `grammarPoint`, `newWord`, `userInterestDetected` (String), `createdAt` (LocalDateTime, set via `@PrePersist`)
    - _Requirements: 2.2, 9.2, 9.3_

  - [x] 2.3 Create `AiSpeakingSessionRepository` and `AiSpeakingMessageRepository`
    - Create `backend/src/main/java/com/deutschflow/speaking/repository/AiSpeakingSessionRepository.java` extending `JpaRepository<AiSpeakingSession, Long>`
    - Add method: `Page<AiSpeakingSession> findByUserId(Long userId, Pageable pageable)`
    - Create `backend/src/main/java/com/deutschflow/speaking/repository/AiSpeakingMessageRepository.java` extending `JpaRepository<AiSpeakingMessage, Long>`
    - Add methods: `List<AiSpeakingMessage> findBySessionIdOrderByCreatedAtAsc(Long sessionId)` and `List<AiSpeakingMessage> findTop10BySessionIdOrderByCreatedAtDesc(Long sessionId)`
    - _Requirements: 1.5, 3.1, 3.2, 3.4_

- [x] 3. Create DTOs and exception
  - [x] 3.1 Create request/response DTOs
    - Create `backend/src/main/java/com/deutschflow/speaking/dto/AiSpeakingChatRequest.java` as a record with `@NotBlank @Size(max = 1000) String userMessage`
    - Create `backend/src/main/java/com/deutschflow/speaking/dto/AiSpeakingChatResponse.java` as a record with fields: `messageId`, `sessionId`, `aiSpeechDe`, `correction`, `explanationVi`, `grammarPoint`, and nested `LearningStatus` record (`newWord`, `userInterestDetected`)
    - Create `backend/src/main/java/com/deutschflow/speaking/dto/AiSpeakingSessionDto.java` as a record with fields: `id`, `topic`, `status`, `startedAt`, `lastActivityAt`, `endedAt`, `messageCount`
    - Create `backend/src/main/java/com/deutschflow/speaking/dto/AiSpeakingMessageDto.java` as a record with fields: `id`, `role`, `userText`, `aiSpeechDe`, `correction`, `explanationVi`, `grammarPoint`, `newWord`, `userInterestDetected`, `createdAt`
    - Create `backend/src/main/java/com/deutschflow/speaking/dto/CreateSessionRequest.java` as a record with `@Size(max = 200) String topic`
    - _Requirements: 1.2, 2.1, 2.4, 2.7_

  - [x] 3.2 Create `AiServiceException`
    - Create `backend/src/main/java/com/deutschflow/speaking/exception/AiServiceException.java` as a `RuntimeException` subclass
    - _Requirements: 5.3_

- [x] 4. Implement `SystemPromptBuilder`
  - [x] 4.1 Create `SystemPromptBuilder` component
    - Create `backend/src/main/java/com/deutschflow/speaking/ai/SystemPromptBuilder.java` annotated with `@Component`
    - Implement `buildSystemPrompt(UserLearningProfile profile, List<String> knownInterests)`:
      - Extract `targetLevel` and `industry` from profile
      - Build interest section only when `knownInterests` is non-empty
      - Embed the full German teacher persona prompt with JSON schema instruction (as defined in the design's `buildSystemPrompt()` pseudocode)
      - Always return a non-empty String
    - Implement `buildTopicContext(String topic)` returning a topic-specific context string
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 4.2 Write unit tests for `SystemPromptBuilder`
    - Create `backend/src/test/java/com/deutschflow/speaking/ai/SystemPromptBuilderTest.java`
    - Test: prompt contains `targetLevel` for any valid profile
    - Test: prompt contains JSON schema instruction for any valid profile
    - Test: prompt contains interests when `knownInterests` is non-empty
    - Test: prompt does NOT contain interest section when `knownInterests` is empty
    - Test: result is never null or blank for any valid profile
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ]* 4.3 Write property test for `SystemPromptBuilder`
    - **Property 9: Prompt Contains Required Elements** — for any valid `UserLearningProfile` with any `targetLevel` and any list of interests (including empty), `buildSystemPrompt()` returns a non-empty String containing the JSON schema instruction and the user's `targetLevel`
    - **Property 10: Prompt Includes Interests When Present** — for any profile with a non-empty interests list, the result contains each interest
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**

- [x] 5. Implement `AiResponseParser`
  - [x] 5.1 Create `AiResponseParser` and `AiResponseDto`
    - Create `backend/src/main/java/com/deutschflow/speaking/ai/AiResponseDto.java` as a record with fields: `aiSpeechDe`, `correction`, `explanationVi`, `grammarPoint`, `newWord`, `userInterestDetected`
    - Create `backend/src/main/java/com/deutschflow/speaking/ai/AiResponseParser.java` annotated with `@Component`
    - Implement `AiResponseDto parse(String rawJson)`:
      - Strip markdown code fences (` ```json ` or ` ``` `) if present
      - Parse JSON using Jackson `ObjectMapper` (already available via Spring Boot)
      - Map `ai_speech_de`, `correction`, `explanation_vi`, `grammar_point`, `learning_status.new_word`, `learning_status.user_interest_detected`
      - On `JsonProcessingException`: log a WARN, return `AiResponseDto` with `aiSpeechDe = rawJson` and all other fields null
      - Never throw an exception for any String input
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.2 Write unit tests for `AiResponseParser`
    - Create `backend/src/test/java/com/deutschflow/speaking/ai/AiResponseParserTest.java`
    - Test: valid JSON → all fields mapped correctly
    - Test: JSON wrapped in ` ```json ``` ` → extracted and parsed correctly
    - Test: JSON wrapped in plain ` ``` ``` ` → extracted and parsed correctly
    - Test: invalid JSON → `aiSpeechDe` equals raw input, other fields null, no exception thrown
    - Test: empty string → no exception, `aiSpeechDe` is non-null
    - Test: null correction fields in JSON → mapped as null in DTO
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.3 Write property test for `AiResponseParser`
    - **Property 6: Parser Fallback Safety** — for any String input (including empty, whitespace, invalid JSON, arbitrary text), `parse()` never throws an exception and always returns an `AiResponseDto` with `aiSpeechDe` set to a non-null value
    - **Property 7: Parser Round-Trip** — for any valid `AiResponseDto`, serializing to the JSON schema format and parsing back produces an equivalent DTO with all fields preserved
    - **Validates: Requirements 6.1, 6.3, 6.4**

- [x] 6. Implement `OpenAiChatClient`
  - [x] 6.1 Create `OpenAiChatClient` interface and `ChatMessage` record
    - Create `backend/src/main/java/com/deutschflow/speaking/ai/ChatMessage.java` as a record with `String role` and `String content`
    - Create `backend/src/main/java/com/deutschflow/speaking/ai/OpenAiChatClient.java` interface with method `String chatCompletion(List<ChatMessage> messages, String model, double temperature)`
    - _Requirements: 5.1_

  - [x] 6.2 Implement `OpenAiChatClientImpl`
    - Create `backend/src/main/java/com/deutschflow/speaking/ai/OpenAiChatClientImpl.java` annotated with `@Service`
    - Inject `OPENAI_API_KEY` from `EnvConfig` or `@Value("${app.openai.api-key}")` — never hardcode
    - Use Spring `RestClient` (available via `spring-boot-starter-web`) to POST to `https://api.openai.com/v1/chat/completions`
    - Configure 30-second read timeout on the `RestClient` instance
    - Set model `gpt-4o`, temperature from parameter, `max_tokens` as appropriate
    - Extract `choices[0].message.content` from the response
    - Log token usage (`prompt_tokens`, `completion_tokens`) at DEBUG level
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 6.3 Add retry logic with exponential backoff to `OpenAiChatClientImpl`
    - Wrap the `RestClient` call in a retry loop: up to 3 attempts
    - Retry on HTTP 5xx responses and `ResourceAccessException` (timeout)
    - Backoff delays: 1s after attempt 1, 2s after attempt 2, 4s after attempt 3
    - After 3 failed attempts, throw `AiServiceException`
    - _Requirements: 5.2, 5.3_

  - [ ]* 6.4 Write unit tests for `OpenAiChatClientImpl`
    - Create `backend/src/test/java/com/deutschflow/speaking/ai/OpenAiChatClientImplTest.java`
    - Mock HTTP calls using `MockRestServiceServer` (Spring Test)
    - Test: successful call returns `choices[0].message.content`
    - Test: 5xx response triggers retry; succeeds on 3rd attempt
    - Test: 3 consecutive 5xx responses → `AiServiceException` thrown
    - Test: timeout triggers retry
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Implement `AiSpeakingService`
  - [x] 7.1 Create `AiSpeakingService` interface and `AiSpeakingServiceImpl`
    - Create `backend/src/main/java/com/deutschflow/speaking/service/AiSpeakingService.java` interface with methods: `createSession`, `chat`, `getMessages`, `getSessions`, `endSession`
    - Create `backend/src/main/java/com/deutschflow/speaking/service/AiSpeakingServiceImpl.java` annotated with `@Service @Transactional`
    - Inject: `AiSpeakingSessionRepository`, `AiSpeakingMessageRepository`, `UserLearningProfileRepository`, `OpenAiChatClient`, `SystemPromptBuilder`, `AiResponseParser`
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

  - [x] 7.2 Implement `createSession(Long userId, String topic)`
    - Build a new `AiSpeakingSession` with `status=ACTIVE`, `messageCount=0`, `startedAt=now()`, `lastActivityAt=now()`
    - Persist and return `AiSpeakingSessionDto`
    - _Requirements: 1.1, 1.2_

  - [x] 7.3 Implement `endSession(Long userId, Long sessionId)`
    - Load session; throw `NotFoundException` if not found or `session.userId ≠ userId`
    - Throw `BadRequestException` if `status=ENDED` (no backward transition)
    - Set `status=ENDED`, `endedAt=now()`, save
    - _Requirements: 1.3, 1.4, 1.6_

  - [x] 7.4 Implement `getSessions(Long userId, Pageable pageable)`
    - Delegate to `sessionRepository.findByUserId(userId, pageable)`
    - Map results to `AiSpeakingSessionDto`
    - _Requirements: 1.5_

  - [x] 7.5 Implement `getMessages(Long userId, Long sessionId)`
    - Load session; throw `NotFoundException` if not found or `session.userId ≠ userId`
    - Return `messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId)` mapped to `AiSpeakingMessageDto`
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 7.6 Implement `chat(Long userId, Long sessionId, String userMessage)`
    - Validate session ownership and `status=ACTIVE` (throw `NotFoundException` / `BadRequestException` as appropriate)
    - Load `UserLearningProfile` for `userId`; parse `interestsJson` to `List<String>`
    - Load last 10 messages via `findTop10BySessionIdOrderByCreatedAtDesc`, reverse to chronological order
    - Build `openAiMessages` list: system prompt first, then history, then current `userMessage`
    - Call `openAiClient.chatCompletion(openAiMessages, "gpt-4o", 0.7)`; on `AiServiceException` propagate as 503
    - Parse response with `aiResponseParser.parse(rawJson)`
    - Persist USER message and ASSISTANT message
    - Increment `session.messageCount` by 2, update `session.lastActivityAt=now()`, save session
    - Return `AiSpeakingChatResponse`
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.8, 3.1, 3.4_

  - [ ]* 7.7 Write unit tests for `AiSpeakingServiceImpl`
    - Create `backend/src/test/java/com/deutschflow/speaking/service/AiSpeakingServiceImplTest.java`
    - Mock all dependencies with Mockito
    - Test `chat()`: happy path — two messages persisted, messageCount incremented by 2, response has non-null `aiSpeechDe`
    - Test `chat()`: session not found → `NotFoundException`
    - Test `chat()`: session belongs to different user → `NotFoundException`
    - Test `chat()`: session `status=ENDED` → `BadRequestException`
    - Test `chat()`: `AiServiceException` from client → propagated
    - Test `chat()`: AI returns no grammar errors → `correction`, `explanationVi`, `grammarPoint` are null in response
    - Test `endSession()`: valid → status transitions to ENDED
    - Test `endSession()`: already ENDED → `BadRequestException`
    - _Requirements: 1.3, 1.4, 1.6, 2.1, 2.2, 2.3, 2.7, 2.8_

  - [ ]* 7.8 Write property test for `AiSpeakingServiceImpl`
    - **Property 2: Message Persistence After Chat** — for any successful `chat()` call, exactly two new `AiSpeakingMessage` records are persisted (one USER, one ASSISTANT)
    - **Property 3: Session Message Count Invariant** — for any session with initial `messageCount` N, after a successful `chat()` call, `session.messageCount` equals N + 2
    - **Property 8: Session State Machine** — for any session with `status=ENDED`, calling `chat()` is rejected and status remains ENDED
    - **Validates: Requirements 1.6, 2.2, 2.3, 2.5**

- [x] 8. Implement `AiSpeakingController` and rate limiting
  - [x] 8.1 Create `AiSpeakingController`
    - Create `backend/src/main/java/com/deutschflow/speaking/controller/AiSpeakingController.java`
    - Annotate with `@RestController @RequestMapping("/api/ai-speaking") @RequiredArgsConstructor`
    - Inject `AiSpeakingService`
    - Implement endpoints:
      - `POST /sessions` → `createSession`, return 201
      - `POST /sessions/{sessionId}/chat` → `chat`, return 200
      - `GET /sessions/{sessionId}/messages` → `getMessages`, return 200
      - `GET /sessions` → `getSessions` with `Pageable`, return 200
      - `PATCH /sessions/{sessionId}/end` → `endSession`, return 200
    - Extract authenticated `userId` from `SecurityContextHolder` (same pattern as other controllers)
    - Validate `@RequestBody` with `@Valid`
    - Map `AiServiceException` to 503 via `@ExceptionHandler` or `GlobalExceptionHandler`
    - Map `BadRequestException` (session ended) to 409 Conflict
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.4, 2.5, 2.6, 3.2, 3.3, 7.1_

  - [x] 8.2 Add prompt injection validation to `AiSpeakingController`
    - Before forwarding to service, check `userMessage` for prompt injection patterns (e.g., "ignore previous instructions", "you are now", "disregard")
    - Return 400 Bad Request if a pattern is detected
    - _Requirements: 7.5_

  - [x] 8.3 Implement per-user rate limiting (30 messages / 60 seconds)
    - Create `backend/src/main/java/com/deutschflow/speaking/RateLimiterService.java` using a `ConcurrentHashMap<Long, Deque<Instant>>` to track message timestamps per user
    - In `AiSpeakingController.chat()`, call `rateLimiterService.checkAndRecord(userId)` before delegating to service
    - If the user has sent ≥ 30 messages in the last 60 seconds, return 429 Too Many Requests
    - _Requirements: 8.1, 8.2_

  - [ ]* 8.4 Write MockMvc tests for `AiSpeakingController`
    - Create `backend/src/test/java/com/deutschflow/speaking/controller/AiSpeakingControllerTest.java`
    - Use `@WebMvcTest` with mocked `AiSpeakingService` and `RateLimiterService`
    - Test: unauthenticated request → 401
    - Test: `POST /sessions` with valid JWT → 201 with session DTO
    - Test: `POST /sessions/{id}/chat` with blank `userMessage` → 400
    - Test: `POST /sessions/{id}/chat` with message > 1000 chars → 400
    - Test: `POST /sessions/{id}/chat` with prompt injection pattern → 400
    - Test: service throws `BadRequestException("session ended")` → 409
    - Test: service throws `AiServiceException` → 503
    - Test: rate limit exceeded → 429
    - Test: `GET /sessions/{id}/messages` with valid JWT → 200 with message list
    - _Requirements: 2.4, 2.5, 5.3, 7.1, 7.2, 8.1_

  - [ ]* 8.5 Write property test for session isolation
    - **Property 1: Session Isolation** — for any authenticated user and any session where `session.userId ≠ authenticatedUserId`, every operation returns 403 or 404
    - **Property 12: Session List Isolation** — for any authenticated user, `GET /sessions` returns only sessions where `session.userId` equals the authenticated user's ID
    - **Validates: Requirements 1.4, 1.5, 7.3, 7.4**

- [x] 9. Checkpoint — wire everything together and verify
  - Ensure all Spring beans are correctly wired (no missing `@Autowired` / constructor injection issues)
  - Verify `SecurityConfig` covers `/api/ai-speaking/**` under `anyRequest().authenticated()` (already the case — confirm no explicit permit-all override needed)
  - Run `./mvnw test -pl backend` to confirm all unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integration test: full chat flow
  - [x] 10.1 Create integration test with H2 and mocked OpenAI
    - Create `backend/src/test/java/com/deutschflow/speaking/AiSpeakingIntegrationTest.java`
    - Use `@SpringBootTest` with H2 in-memory database (already in test scope)
    - Mock `OpenAiChatClient` with `@MockBean` to return a fixed valid JSON response
    - Test full flow: create session → send chat message → verify DB has 2 messages → get message history → end session → verify status=ENDED
    - Test cross-user access: user A cannot access user B's session (403/404)
    - Test 409 on chat to ended session
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 3.2, 7.3, 7.4_

  - [ ]* 10.2 Write property test for history truncation
    - **Property 4: History Truncation** — for any session containing N messages (N ≥ 0), the number of messages passed to `OpenAiChatClient` is `min(N, 10)`, in chronological order
    - **Property 5: Response aiSpeechDe Non-Null** — for any successful chat interaction with any valid user message, `aiSpeechDe` in the response is non-null and non-empty
    - **Property 11: Input Validation Rejects Invalid Messages** — for any blank or >1000-char string, the chat endpoint returns 400 and no messages are persisted
    - **Validates: Requirements 2.4, 2.7, 3.1, 3.4**

- [x] 11. Final checkpoint — full test suite
  - Run `./mvnw test -pl backend` and confirm all tests pass
  - Verify Flyway migration runs cleanly against a local MySQL instance (or H2 in test mode)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at natural integration points
- Property tests validate universal correctness properties (Properties 1–12 from design.md)
- Unit tests validate specific examples and edge cases
- The `SecurityConfig` already covers `/api/ai-speaking/**` via `anyRequest().authenticated()` — no changes to `SecurityConfig` are needed
- Use `RestClient` (Spring 6, already available) instead of adding the `openai-java` SDK to keep the dependency footprint minimal and consistent with the existing codebase style
