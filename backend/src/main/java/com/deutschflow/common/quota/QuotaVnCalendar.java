package com.deutschflow.common.quota;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Asia/Ho_Chi_Minh calendar bounds for quota windows. */
public final class QuotaVnCalendar {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private QuotaVnCalendar() {}

    public static LocalDate localDateOf(Instant instant) {
        return instant.atZone(ZONE).toLocalDate();
    }

    /** Inclusive UTC instant of midnight VN start of {@code date}. */
    public static Instant startOfVnDay(LocalDate date) {
        return date.atStartOfDay(ZONE).toInstant();
    }

    /** Exclusive UTC instant: start of next VN day after {@code date}. */
    public static Instant endOfVnDayExclusive(LocalDate date) {
        return date.plusDays(1).atStartOfDay(ZONE).toInstant();
    }

    /** VN local calendar day boundaries that contain {@code instant}. */
    public static Instant[] vnDayBoundsInclusiveExclusive(Instant instant) {
        LocalDate d = localDateOf(instant);
        return new Instant[]{startOfVnDay(d), endOfVnDayExclusive(d)};
    }

    /** {@code truncatedToDay} midnight VN of {@code instant}. */
    public static Instant truncatedToStartOfLocalDayUtc(Instant instant) {
        return startOfVnDay(localDateOf(instant));
    }

    public static Instant addCalendarDaysUtc(Instant instantAtZoneAware, long daysToAdd) {
        ZonedDateTime zdt = instantAtZoneAware.atZone(ZONE).toLocalDate().plusDays(daysToAdd).atStartOfDay(ZONE);
        return zdt.toInstant();
    }
}
