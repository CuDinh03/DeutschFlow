package com.deutschflow.srs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FsrsWeightProviderTest {

    @Mock
    private JdbcTemplate jdbc;

    private FsrsWeightProvider provider;
    private double[] defaults;

    @BeforeEach
    void setUp() {
        FsrsService fsrsService = new FsrsService();
        defaults = fsrsService.defaultWeights();
        provider = new FsrsWeightProvider(jdbc, new ObjectMapper(), fsrsService);
    }

    private void stubQuery(String json) {
        when(jdbc.queryForObject(anyString(), eq(String.class), any())).thenReturn(json);
    }

    @Test
    @DisplayName("returns parsed per-user weights when stored value is well-formed")
    void validWeights_areParsed() {
        double[] custom = new double[FsrsService.WEIGHT_COUNT];
        for (int i = 0; i < custom.length; i++) custom[i] = i + 0.5;
        stubQuery("[0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5,8.5,9.5,10.5,11.5,12.5,13.5,14.5,15.5,16.5,17.5,18.5,19.5]");

        assertThat(provider.weightsForUser(1L)).containsExactly(custom);
    }

    @Test
    @DisplayName("falls back to defaults when no row exists")
    void emptyResult_fallsBackToDefault() {
        when(jdbc.queryForObject(anyString(), eq(String.class), any()))
                .thenThrow(new EmptyResultDataAccessException(1));

        assertThat(provider.weightsForUser(1L)).containsExactly(defaults);
    }

    @Test
    @DisplayName("falls back to defaults when stored JSON is null")
    void nullJson_fallsBackToDefault() {
        stubQuery(null);
        assertThat(provider.weightsForUser(1L)).containsExactly(defaults);
    }

    @Test
    @DisplayName("falls back to defaults when stored vector has the wrong length")
    void wrongLength_fallsBackToDefault() {
        stubQuery("[0.1,0.2,0.3]");
        assertThat(provider.weightsForUser(1L)).containsExactly(defaults);
    }

    @Test
    @DisplayName("falls back to defaults when stored JSON is malformed")
    void malformedJson_fallsBackToDefault() {
        stubQuery("{not-an-array}");
        assertThat(provider.weightsForUser(1L)).containsExactly(defaults);
    }

    @Test
    @DisplayName("returns defaults without querying when userId is null")
    void nullUser_returnsDefaultWithoutQuery() {
        lenient().when(jdbc.queryForObject(anyString(), eq(String.class), any())).thenReturn("[]");
        assertThat(provider.weightsForUser(null)).containsExactly(defaults);
        verifyNoInteractions(jdbc);
    }
}
