package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.AbilityScoreRequest;
import org.springframework.stereotype.Service;

@Service
public class AbilityScoreService {

    /**
     * S = sum(Q_i * W_i) / T
     * - Q_i: achieved score for item i
     * - W_i: difficulty weight (1..10)
     * - T: total completion time in seconds
     */
    public double compute(AbilityScoreRequest request) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new BadRequestException("items must not be empty");
        }
        if (request.timeSeconds() == null || request.timeSeconds() <= 0) {
            throw new BadRequestException("timeSeconds must be > 0");
        }

        double sum = 0.0;
        for (var item : request.items()) {
            if (item == null || item.q() == null || item.w() == null) {
                throw new BadRequestException("Invalid items");
            }
            sum += item.q() * item.w();
        }
        return sum / request.timeSeconds();
    }
}

