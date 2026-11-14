export const JAKARTA_TZ = "Asia/Jakarta";

/** Format a Date as YYYY-MM-DD in Jakarta (WIB) time. */
export function toDateInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date (YYYY-MM-DD) in Jakarta (WIB) time. */
export function todayJakarta(): string {
  return toDateInputValue(new Date());
}
