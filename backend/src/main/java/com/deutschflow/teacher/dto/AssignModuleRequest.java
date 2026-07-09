package com.deutschflow.teacher.dto;

/** Assign a lesson to a curriculum module; moduleId null means ungroup. */
public record AssignModuleRequest(Long moduleId) {}
