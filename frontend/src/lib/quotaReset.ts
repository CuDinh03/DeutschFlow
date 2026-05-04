/**
 * AI / free-tier quota messaging using Vietnam wall-clock (Asia/Ho_Chi_Minh, UTC+7, no DST).
 */

const VN_TZ = "Asia/Ho_Chi_Minh";

/** Instant when the given Vietnam calendar date starts at 00:00 local. */
export function vietnamMidnightUtc(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day - 1, 17, 0, 0, 0));
}

/** Next 00:00 in Vietnam strictly after `from`’s instant (next calendar-day boundary in VN). */
export function getNextVietnamMidnight(from: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(from);

  const num = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);

  const y = num("year");
  const m = num("month");
  const d = num("day");

  const todayStart = vietnamMidnightUtc(y, m, d);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  if (from.getTime() < todayStart.getTime()) return todayStart;
  return tomorrowStart;
}

/** First instant of the next calendar month in Vietnam (monthly quota narrative). */
export function getNextVietnamMonthStart(from: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);

  const num = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);

  let y = num("year");
  let m = num("month");
  const d = 1;
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return vietnamMidnightUtc(y, m, d);
}

export type QuotaMessageVariant = "daily" | "monthly" | "generic";

export function formatQuotaExceededBody(
  locale: string,
  variant: QuotaMessageVariant = "generic",
): { title: string; detail: string } {
  const tzLabel =
    locale === "vi"
      ? "Giờ Việt Nam (Asia/Ho_Chi_Minh)"
      : locale === "de"
        ? "Vietnamesische Zeit (Asia/Ho_Chi_Minh)"
        : "Vietnam time (Asia/Ho_Chi_Minh)";

  const title =
    locale === "vi"
      ? "Hết hạn ngầm (quota)"
      : locale === "de"
        ? "Kontingent erreicht"
        : "Quota exceeded";

  const fmt = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : locale === "de" ? "de-DE" : "en-GB",
    {
      timeZone: VN_TZ,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    },
  );

  if (variant === "daily") {
    const when = fmt.format(getNextVietnamMidnight());
    const detail =
      locale === "vi"
        ? `Giới hạn theo ngày sẽ làm mới lúc ${when} (${tzLabel}).`
        : locale === "de"
          ? `Tageslimit erneuert sich um ${when} (${tzLabel}).`
          : `Daily allowance resets at ${when} (${tzLabel}).`;
    return { title, detail };
  }

  if (variant === "monthly") {
    const when = fmt.format(getNextVietnamMonthStart());
    const detail =
      locale === "vi"
        ? `Hạn mức theo tháng làm mới vào ${when} (${tzLabel}).`
        : locale === "de"
          ? `Monatskontingent beginnt neu am ${when} (${tzLabel}).`
          : `Monthly quota rolls over at ${when} (${tzLabel}).`;
    return { title, detail };
  }

  const nextDay = fmt.format(getNextVietnamMidnight());
  const nextMonth = fmt.format(getNextVietnamMonthStart());
  const detail =
    locale === "vi"
      ? `Nếu là giới hạn/ngày: làm mới lúc ${nextDay}. Nếu là gói tháng: chu kỳ tiếp ~ ${nextMonth}. (${tzLabel})`
      : locale === "de"
        ? `Bei Tageslimit: Erneuerung um ${nextDay}. Bei Monatsabo: nächste Periode ~ ${nextMonth}. (${tzLabel})`
        : `If your plan uses a daily cap, it resets at ${nextDay}. For monthly bundles, the next period starts around ${nextMonth}. (${tzLabel})`;
  return { title, detail };
}
