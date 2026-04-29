# Requirements Document

## Introduction

DeutschFlow AI Speaking Practice là tính năng hội thoại AI tương tác cho phép người dùng luyện nói tiếng Đức với giáo viên ảo "DeutschFlow AI". Hệ thống nhận đầu vào văn bản từ người dùng, gửi đến OpenAI GPT-4o với system prompt được cá nhân hóa, và trả về phản hồi có cấu trúc JSON bao gồm câu trả lời tiếng Đức, bản sửa lỗi ngữ pháp, giải thích bằng tiếng Việt, và thông tin học tập. Tính năng tích hợp vào backend Spring Boot hiện có, tận dụng JWT authentication và UserLearningProfile.

## Glossary

- **AiSpeakingController**: REST controller xử lý các HTTP request cho tính năng luyện nói AI.
- **AiSpeakingService**: Service chứa business logic chính: quản lý session, xây dựng prompt, gọi OpenAI, lưu lịch sử.
- **SystemPromptBuilder**: Component xây dựng system prompt động dựa trên profile người dùng.
- **OpenAiChatClient**: HTTP client wrapper cho OpenAI Chat Completions API.
- **Session**: Một phiên hội thoại luyện nói, có trạng thái ACTIVE hoặc ENDED.
- **AiSpeakingMessage**: Một tin nhắn trong phiên hội thoại, có role USER hoặc ASSISTANT.
- **UserLearningProfile**: Profile học tập của người dùng, chứa targetLevel, industry, và interests.
- **AiResponseParser**: Logic phân tích cú pháp JSON response từ OpenAI.
- **JwtAuthFilter**: Filter xác thực JWT token hiện có trong hệ thống.

---

## Requirements

### Requirement 1: Session Management

**User Story:** As a language learner, I want to create and manage speaking practice sessions, so that I can organize my practice conversations by topic and track my progress over time.

#### Acceptance Criteria

1. WHEN a user sends a POST request to `/api/ai-speaking/sessions` with a valid JWT token, THE AiSpeakingController SHALL create a new session with `status=ACTIVE`, `messageCount=0`, and `startedAt` set to the current timestamp.
2. WHERE a topic is provided in the session creation request, THE AiSpeakingController SHALL store the topic (maximum 200 characters) on the session.
3. WHEN a user sends a PATCH request to `/api/ai-speaking/sessions/{sessionId}/end`, THE AiSpeakingService SHALL transition the session status from `ACTIVE` to `ENDED` and set `endedAt` to the current timestamp.
4. IF a session with the given `sessionId` does not exist or does not belong to the authenticated user, THEN THE AiSpeakingController SHALL return a 404 Not Found response.
5. WHEN a user sends a GET request to `/api/ai-speaking/sessions`, THE AiSpeakingController SHALL return a paginated list of sessions belonging to the authenticated user.
6. THE AiSpeakingService SHALL ensure a session can only transition from `ACTIVE` to `ENDED` and never from `ENDED` to `ACTIVE`.

---

### Requirement 2: Chat Interaction

**User Story:** As a language learner, I want to send German text messages and receive structured AI feedback, so that I can practice speaking and get immediate grammar corrections.

#### Acceptance Criteria

1. WHEN a user sends a POST request to `/api/ai-speaking/sessions/{sessionId}/chat` with a non-blank `userMessage` (maximum 1000 characters), THE AiSpeakingService SHALL call the OpenAI GPT-4o API and return a structured `AiSpeakingChatResponse`.
2. WHEN the chat request is processed successfully, THE AiSpeakingService SHALL persist exactly one `AiSpeakingMessage` with `role=USER` and one `AiSpeakingMessage` with `role=ASSISTANT` to the database.
3. WHEN the chat request is processed successfully, THE AiSpeakingService SHALL increment `session.messageCount` by 2 and update `session.lastActivityAt` to the current timestamp.
4. IF the `userMessage` field is blank or exceeds 1000 characters, THEN THE AiSpeakingController SHALL return a 400 Bad Request response.
5. IF the session has `status=ENDED`, THEN THE AiSpeakingController SHALL return a 409 Conflict response with the message "This session has already ended."
6. IF the session does not belong to the authenticated user, THEN THE AiSpeakingController SHALL return a 403 Forbidden response.
7. THE AiSpeakingChatResponse SHALL contain a non-null, non-empty `aiSpeechDe` field in every successful response.
8. WHEN the AI detects no grammar errors in the user's message, THE AiSpeakingService SHALL set `correction`, `explanationVi`, and `grammarPoint` to null in the response.

---

### Requirement 3: Conversation History

**User Story:** As a language learner, I want the AI to remember the context of our conversation, so that the practice session feels natural and coherent.

#### Acceptance Criteria

1. WHEN building the OpenAI API request, THE AiSpeakingService SHALL include at most the 10 most recent messages from the session in chronological order (excluding the system prompt).
2. WHEN a user sends a GET request to `/api/ai-speaking/sessions/{sessionId}/messages`, THE AiSpeakingController SHALL return all messages belonging to that session in chronological order.
3. IF the session does not belong to the authenticated user, THEN THE AiSpeakingController SHALL return a 404 Not Found response when retrieving messages.
4. THE AiSpeakingService SHALL ensure all messages included in the conversation history belong to the requested `sessionId`.

---

### Requirement 4: System Prompt Personalization

**User Story:** As a language learner, I want the AI teacher to adapt to my level and interests, so that the conversation is relevant and appropriately challenging.

#### Acceptance Criteria

1. WHEN building the system prompt, THE SystemPromptBuilder SHALL include the user's `targetLevel` (e.g., B1, B2) from their `UserLearningProfile`.
2. WHERE the user has known interests in their `UserLearningProfile`, THE SystemPromptBuilder SHALL include those interests in the system prompt.
3. THE SystemPromptBuilder SHALL always include the JSON response schema instruction in the generated system prompt.
4. WHEN building the system prompt, THE SystemPromptBuilder SHALL instruct the AI to respond in German and provide error explanations in Vietnamese.
5. THE SystemPromptBuilder SHALL always produce a non-empty String result for any valid `UserLearningProfile` input.

---

### Requirement 5: OpenAI API Integration

**User Story:** As a system operator, I want the AI speaking feature to reliably call the OpenAI API with proper error handling, so that users experience minimal disruption.

#### Acceptance Criteria

1. WHEN calling the OpenAI API, THE OpenAiChatClient SHALL use the model `gpt-4o` with a temperature of 0.7 and a timeout of 30 seconds.
2. IF the OpenAI API returns a 5xx error or times out, THEN THE OpenAiChatClient SHALL retry the request up to 3 times with exponential backoff (1s, 2s, 4s).
3. IF the OpenAI API fails after 3 retry attempts, THEN THE AiSpeakingService SHALL return a 503 Service Unavailable response with the message "AI service is temporarily unavailable. Please try again."
4. THE OpenAiChatClient SHALL log token usage at DEBUG level for every successful API call.
5. WHEN calling the OpenAI API, THE OpenAiChatClient SHALL use the `OPENAI_API_KEY` from environment configuration and never hardcode the key.

---

### Requirement 6: AI Response Parsing

**User Story:** As a language learner, I want the system to reliably extract structured feedback from the AI response, so that grammar corrections and explanations are always displayed correctly.

#### Acceptance Criteria

1. WHEN the OpenAI API returns a valid JSON response, THE AiResponseParser SHALL parse it into an `AiResponseDto` with `aiSpeechDe`, `correction`, `explanationVi`, `grammarPoint`, `newWord`, and `userInterestDetected` fields.
2. IF the OpenAI API response contains JSON wrapped in a markdown code block (` ```json ` or ` ``` `), THEN THE AiResponseParser SHALL extract and parse the JSON content from within the code block.
3. IF the OpenAI API response is not valid JSON, THEN THE AiResponseParser SHALL use the entire response text as the `aiSpeechDe` value, set all other fields to null, and log a warning — without throwing an exception.
4. THE AiResponseParser SHALL never throw an exception for any String input, always returning an `AiResponseDto` with at least `aiSpeechDe` set.

---

### Requirement 7: Security and Authorization

**User Story:** As a system administrator, I want all AI speaking endpoints to be properly secured, so that users can only access their own data.

#### Acceptance Criteria

1. THE AiSpeakingController SHALL require a valid JWT token for all endpoints under `/api/ai-speaking/**`.
2. WHEN an unauthenticated request is made to any AI speaking endpoint, THE JwtAuthFilter SHALL return a 401 Unauthorized response.
3. THE AiSpeakingService SHALL verify that `session.userId` equals the authenticated user's ID before performing any operation on a session.
4. WHEN a user attempts to access a session belonging to another user, THE AiSpeakingService SHALL return a 403 Forbidden or 404 Not Found response.
5. THE AiSpeakingController SHALL validate that `userMessage` does not contain prompt injection patterns (e.g., "Ignore previous instructions") before forwarding to the service layer.

---

### Requirement 8: Rate Limiting

**User Story:** As a system operator, I want to limit the number of messages a user can send per minute, so that I can control OpenAI API costs and prevent abuse.

#### Acceptance Criteria

1. WHEN a user sends more than 30 messages within a 60-second window, THE AiSpeakingController SHALL return a 429 Too Many Requests response.
2. THE AiSpeakingController SHALL apply rate limiting per authenticated user, not globally.

---

### Requirement 9: Database Persistence

**User Story:** As a language learner, I want my conversation history to be saved, so that I can review past sessions and track my learning progress.

#### Acceptance Criteria

1. THE AiSpeakingService SHALL persist all `AiSpeakingSession` records to the `ai_speaking_sessions` table using the Flyway migration `V27__create_ai_speaking_tables.sql`.
2. THE AiSpeakingService SHALL persist all `AiSpeakingMessage` records to the `ai_speaking_messages` table with the correct `session_id` foreign key.
3. WHEN a session is deleted, THE database SHALL cascade-delete all associated `AiSpeakingMessage` records.
4. THE AiSpeakingSession entity SHALL enforce that `userId` is not null and references a valid user in the `users` table.
