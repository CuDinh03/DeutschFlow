package com.deutschflow.organization.dto;

import java.util.List;

/** Hoán vị đầy đủ danh sách Lektion của một phiên bản DRAFT. */
public record ReorderLektionenRequest(List<Long> orderedLektionIds) {}
