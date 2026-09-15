package com.deutschflow.examspeaking.session;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.examspeaking.dto.TurnResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;

/**
 * Idempotency cho lượt nói luyện thi (audit 31/08 F-06) — cùng triết lý
 * {@link com.deutschflow.speaking.service.SpeakingChatIdempotencyService}: client sinh MỘT
 * {@code clientTurnId} cho mỗi lượt logic và dùng lại khi retry (timeout 45s, rớt mạng). Trong TTL,
 * khoá trùng trả lại đúng phản hồi đầu — không STT lại, không gọi LLM lại, không trừ quota lần hai,
 * và {@code currentStep} không nhảy hai bước.
 *
 * <p>Thêm chốt "đang xử lý": request thứ hai cùng khoá tới khi request đầu CHƯA xong nhận 409 thay vì
 * chạy song song (SETNX + TTL ngắn). Redis vắng/hỏng → no-op hoàn toàn (chạy thẳng), không bao giờ ném
 * vào đường request.</p>
 */
@Service
@Slf4j
public class ExamTurnIdempotencyService {

    static final String KEY_PREFIX = "examspeaking:idem:";
    static final String LOCK_PREFIX = "examspeaking:idem-lock:";
    static final Duration TTL = Duration.ofMinutes(15);
    /** Đủ lâu cho STT + LLM khi nhà cung cấp nghẽn (backend ~30s) nhưng không khoá cả buổi nếu process chết. */
    static final Duration LOCK_TTL = Duration.ofSeconds(90);
    static final int MAX_KEY_LENGTH = 80;

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public ExamTurnIdempotencyService(@Nullable StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    /**
     * Chạy {@code work} dưới khoá idempotency (nếu client gửi khoá). Replay trả phản hồi đã nhớ nhưng
     * {@code session} được làm tươi qua {@code refresh} để đồng hồ/trạng thái không bị cũ 15 phút.
     */
    public TurnResponse execute(long userId, long sessionId, @Nullable String clientTurnId,
                                Supplier<TurnResponse> work, UnaryOperator<TurnResponse> refresh) {
        String key = normalize(clientTurnId);
        if (key == null || redis == null) {
            return work.get();
        }
        Optional<TurnResponse> cached = lookup(userId, sessionId, key);
        if (cached.isPresent()) {
            log.info("[ExamSpeaking] replay lượt nói idempotent user={} session={} key={}", userId, sessionId, key);
            return refresh.apply(cached.get());
        }
        if (!tryLock(userId, sessionId, key)) {
            throw new ConflictException("Lượt nói này đang được xử lý — chờ vài giây rồi thử lại, đừng gửi lượt mới.");
        }
        try {
            TurnResponse out = work.get();
            remember(userId, sessionId, key, out);
            return out;
        } finally {
            unlock(userId, sessionId, key);
        }
    }

    Optional<TurnResponse> lookup(long userId, long sessionId, String key) {
        try {
            String json = redis.opsForValue().get(dataKey(userId, sessionId, key));
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, TurnResponse.class));
        } catch (Exception e) {
            log.warn("[ExamSpeaking] idempotency lookup bỏ qua ({})", e.getMessage());
            return Optional.empty();
        }
    }

    void remember(long userId, long sessionId, String key, TurnResponse response) {
        try {
            redis.opsForValue().set(dataKey(userId, sessionId, key), objectMapper.writeValueAsString(response), TTL);
        } catch (Exception e) {
            log.warn("[ExamSpeaking] idempotency remember bỏ qua ({})", e.getMessage());
        }
    }

    boolean tryLock(long userId, long sessionId, String key) {
        try {
            Boolean ok = redis.opsForValue().setIfAbsent(lockKey(userId, sessionId, key), "1", LOCK_TTL);
            return !Boolean.FALSE.equals(ok);
        } catch (Exception e) {
            log.warn("[ExamSpeaking] idempotency lock bỏ qua ({})", e.getMessage());
            return true;
        }
    }

    void unlock(long userId, long sessionId, String key) {
        try {
            redis.delete(lockKey(userId, sessionId, key));
        } catch (Exception e) {
            log.warn("[ExamSpeaking] idempotency unlock bỏ qua ({})", e.getMessage());
        }
    }

    /** Khoá do client sinh: chỉ nhận ký tự an toàn, cắt độ dài — không cho chuỗi lạ chui vào key Redis. */
    static String normalize(String clientTurnId) {
        if (clientTurnId == null) {
            return null;
        }
        String t = clientTurnId.trim();
        if (t.isEmpty() || t.length() > MAX_KEY_LENGTH || !t.matches("[A-Za-z0-9_.:-]+")) {
            return null;
        }
        return t;
    }

    private static String dataKey(long userId, long sessionId, String key) {
        return KEY_PREFIX + userId + ':' + sessionId + ':' + key;
    }

    private static String lockKey(long userId, long sessionId, String key) {
        return LOCK_PREFIX + userId + ':' + sessionId + ':' + key;
    }
}
