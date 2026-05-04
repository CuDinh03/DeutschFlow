package com.deutschflow.notification.events;

/**
 * Published when a new student registers. Listeners should run after DB commit.
 */
public record StudentRegisteredEvent(long newStudentId, String email, String displayName) {}
