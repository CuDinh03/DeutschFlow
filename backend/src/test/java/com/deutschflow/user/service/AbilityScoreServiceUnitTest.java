package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.AbilityScoreRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AbilityScoreServiceUnitTest {

    private final AbilityScoreService service = new AbilityScoreService();

    @Test
    void compute_returnsWeightedSumPerTime() {
        var req = new AbilityScoreRequest(
                List.of(new AbilityScoreRequest.Item(2.0, 3.0), new AbilityScoreRequest.Item(1.0, 4.0)),
                10.0
        );
        assertEquals((2 * 3 + 1 * 4) / 10.0, service.compute(req), 1e-9);
    }

    @Test
    void compute_rejectsEmptyItems() {
        assertThrows(BadRequestException.class,
                () -> service.compute(new AbilityScoreRequest(List.of(), 1.0)));
    }

    @Test
    void compute_rejectsNonPositiveTime() {
        assertThrows(BadRequestException.class, () ->
                service.compute(new AbilityScoreRequest(List.of(new AbilityScoreRequest.Item(1.0, 1.0)), 0.0)));
    }
}
