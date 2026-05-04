package com.deutschflow.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIResponse {
    private String response;

    @JsonProperty("tokens_used")
    private int tokensUsed;
}
