package com.deutschflow.srs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the FSRS-4.5 weight vector to use for a given user.
 *
 * <p>{@link FsrsWeightOptimizerService} persists a personalised weight vector to
 * {@code user_learning_profiles.fsrs_weights_json} once a user has accumulated
 * enough reviews. This provider loads that vector (validating it is well-formed)
 * and falls back to {@link FsrsService#defaultWeights()} when no personalised
 * vector exists or the stored value is corrupt.
 *
 * <p><b>Vector phải có đúng 17 phần tử</b> ({@link FsrsService#WEIGHT_COUNT}). Trước bản sửa
 * FSRS-4.5, job tối ưu ban đêm lưu vector 20 phần tử của một mô hình khác; các dòng đó còn nằm
 * trong DB và bị bỏ qua ở đây (dùng mặc định, log WARN một lần cho mỗi người dùng trong mỗi lần
 * chạy tiến trình — đường này được gọi mỗi lần ôn nên không log lặp).
 *
 * <p>Reads are cheap (a single indexed lookup) and reviews are infrequent, so the
 * lookup is performed per review rather than cached, keeping personalised weights
 * effective immediately after the nightly optimisation job runs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FsrsWeightProvider {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final FsrsService fsrsService;

    /** Người dùng đã được cảnh báo về vector không hợp lệ — để chỉ log WARN một lần. */
    private final Set<Long> warnedInvalid = ConcurrentHashMap.newKeySet();

    /**
     * Returns the FSRS-4.5 weight vector for {@code userId}: the user's
     * personalised weights when present and valid, otherwise the global defaults.
     */
    public double[] weightsForUser(Long userId) {
        if (userId == null) return fsrsService.defaultWeights();

        String json;
        try {
            json = jdbc.queryForObject(
                    "SELECT fsrs_weights_json FROM user_learning_profiles WHERE user_id = ?",
                    String.class, userId);
        } catch (EmptyResultDataAccessException e) {
            return fsrsService.defaultWeights(); // user has no learning profile yet
        } catch (Exception e) {
            log.warn("[FSRS] Failed to load weights for userId={}, using defaults", userId, e);
            return fsrsService.defaultWeights();
        }

        if (json == null || json.isBlank()) {
            return fsrsService.defaultWeights();
        }

        try {
            double[] weights = objectMapper.readValue(json, double[].class);
            if (weights == null || !FsrsService.isValidWeights(weights)) {
                if (warnedInvalid.add(userId)) {
                    log.warn("[FSRS] Stored weights for userId={} are not a valid FSRS-4.5 vector "
                                    + "(length {}, expected {} finite values), using defaults",
                            userId, weights == null ? "null" : weights.length, FsrsService.WEIGHT_COUNT);
                }
                return fsrsService.defaultWeights();
            }
            return weights;
        } catch (Exception e) {
            if (warnedInvalid.add(userId)) {
                log.warn("[FSRS] Failed to parse weights for userId={}, using defaults", userId, e);
            }
            return fsrsService.defaultWeights();
        }
    }
}
