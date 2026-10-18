export const DEFAULT_SCHEDULE_TIMEZONE = "Asia/Tashkent";

export function resolveScheduleTimezone(timezone: string | null | undefined): string {
  if (!timezone) return DEFAULT_SCHEDULE_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_SCHEDULE_TIMEZONE;
  }
}

export function formatScheduleLocalTime(airingAt: Date, timezone: string | null | undefined): string {
  const resolvedTimezone = resolveScheduleTimezone(timezone);
  const dateTime = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: resolvedTimezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(airingAt);
  return `${dateTime} (${resolvedTimezone})`;
}
