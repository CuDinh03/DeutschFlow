package com.deutschflow.quiz.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class QuizJoinService {
    private final JdbcTemplate jdbcTemplate;
    private final JwtService jwtService;

    @Transactional(readOnly = true)
    public Map<String, Object> joinByPin(String pinCode, String nickname, User user) {
        if (pinCode == null || pinCode.isBlank()) throw new BadRequestException("pinCode is required");
        if (nickname == null || nickname.isBlank()) throw new BadRequestException("nickname is required");

        Map<String, Object> quiz = jdbcTemplate.query("""
                SELECT id, title, status, pin_code AS pinCode, quiz_type AS quizType
                FROM quizzes
                WHERE pin_code = ?
                """, rs -> {
            if (!rs.next()) return null;
            return Map.<String, Object>of(
                    "id", rs.getLong("id"),
                    "title", rs.getString("title"),
                    "status", rs.getString("status"),
                    "pinCode", rs.getString("pinCode"),
                    "quizType", rs.getString("quizType")
            );
        }, pinCode.trim());
        if (quiz == null) throw new NotFoundException("Quiz not found");

        String status = String.valueOf(quiz.get("status"));
        if (!"WAITING".equals(status) && !"ACTIVE".equals(status)) {
            throw new BadRequestException("Quiz is not joinable");
        }

        Long quizId = ((Number) quiz.get("id")).longValue();
        Long userId = user != null ? user.getId() : null;
        String participant = nickname.trim();

        // PostgreSQL: (user_id = ?) treats NULL binds as UNKNOWN; use NOT DISTINCT FROM for nullable FK + guest joins.
        Integer existingCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM quiz_sessions
                WHERE quiz_id = ? AND participant = ? AND user_id IS NOT DISTINCT FROM ?
                """, Integer.class, quizId, participant, userId);
        if (existingCount == null || existingCount == 0) {
            jdbcTemplate.update("""
                    INSERT INTO quiz_sessions (quiz_id, participant, user_id, total_score, joined_at, finished_at)
                    VALUES (?, ?, ?, 0, ?, ?)
                    """, quizId, participant, userId, Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now()));
        }

        String guestToken = null;
        if (user == null) {
            guestToken = jwtService.generateGuestToken(participant, pinCode.trim(), 2 * 60 * 60 * 1000L);
        }

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("quizId", quizId);
        out.put("title", quiz.get("title"));
        out.put("status", status);
        out.put("quizType", quiz.get("quizType"));
        out.put("pinCode", pinCode.trim());
        out.put("guestAccessToken", guestToken);
        return out;
    }

    /**
     * Score updates are bound to authentication: logged-in users may only update their own quiz_sessions row;
     * guests must present a JWT whose subject/participant matches and whose pin matches the quiz (validated via token claim).
     */
    @Transactional
    public void submitScore(Authentication authentication,
                            Long quizId,
                            String participant,
                            Integer totalScore,
                            String guestPinFromRequestAttribute) {
        if (quizId == null) throw new BadRequestException("quizId is required");
        if (participant == null || participant.isBlank()) throw new BadRequestException("participant is required");
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new BadRequestException("Authentication required");
        }

        Object principal = authentication.getPrincipal();
        String p = participant.trim();

        if (principal instanceof User user) {
            Integer ok = jdbcTemplate.queryForObject("""
                    SELECT COUNT(*)
                    FROM quiz_sessions
                    WHERE quiz_id = ? AND participant = ? AND user_id = ?
                    """, Integer.class, quizId, p, user.getId());
            if (ok == null || ok == 0) {
                throw new NotFoundException("Quiz session not found");
            }
        } else if (principal instanceof String sub && sub.startsWith("guest:")) {
            String nick = sub.substring("guest:".length());
            if (!nick.equals(p)) {
                throw new BadRequestException("Participant must match guest token");
            }
            String pin = guestPinFromRequestAttribute;
            if (pin == null || pin.isBlank()) {
                throw new BadRequestException("Guest session is missing pin context");
            }
            String quizPin = jdbcTemplate.query(
                    "SELECT pin_code FROM quizzes WHERE id = ?",
                    rs -> rs.next() ? rs.getString(1) : null,
                    quizId);
            if (quizPin == null) {
                throw new NotFoundException("Quiz not found");
            }
            if (!pinEquals(quizPin, pin)) {
                throw new NotFoundException("Quiz session not found");
            }
            Integer ok = jdbcTemplate.queryForObject("""
                    SELECT COUNT(*)
                    FROM quiz_sessions
                    WHERE quiz_id = ? AND participant = ? AND user_id IS NULL
                    """, Integer.class, quizId, p);
            if (ok == null || ok == 0) {
                throw new NotFoundException("Quiz session not found");
            }
        } else {
            throw new BadRequestException("Unsupported authentication for score submit");
        }

        int normalizedScore = totalScore == null ? 0 : Math.max(0, totalScore);
        int updated = jdbcTemplate.update("""
                UPDATE quiz_sessions
                SET total_score = ?, finished_at = ?
                WHERE quiz_id = ? AND participant = ?
                """, normalizedScore, Timestamp.valueOf(LocalDateTime.now()), quizId, p);
        if (updated == 0) {
            throw new NotFoundException("Quiz session not found");
        }
    }

    private static boolean pinEquals(String a, String b) {
        byte[] x = (a == null ? "" : a).getBytes(StandardCharsets.UTF_8);
        byte[] y = (b == null ? "" : b).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(x, y);
    }
}
