package com.deutschflow.progress.dto;

import java.util.List;

public record NextActionResponse(String currentPhase, List<String> nextActions) {}
