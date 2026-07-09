package com.deutschflow.teacher.dto;

import java.util.List;

public record ReorderModulesRequest(List<Long> orderedModuleIds) {}
