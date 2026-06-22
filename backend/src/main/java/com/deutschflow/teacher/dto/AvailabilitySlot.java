package com.deutschflow.teacher.dto;

/**
 * One weekly-recurring availability block for a teacher's schedule ("Lịch dạy").
 *
 * @param day   day of week, 0 = Monday … 6 = Sunday
 * @param start start time, "HH:mm" (24h)
 * @param end   end time, "HH:mm" (24h); must be strictly after {@code start}
 */
public record AvailabilitySlot(int day, String start, String end) {}
