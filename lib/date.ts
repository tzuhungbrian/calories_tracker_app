const defaultTimeZone = "Asia/Tokyo";
export const visibleDataStartDate = "2026-05-20";

export function dateKey(date = new Date(), timeZone = defaultTimeZone): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function recentDateKeys(days: number, timeZone = defaultTimeZone): string[] {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - index);
    return dateKey(date, timeZone);
  });
}

export function isVisibleDataDate(date: string): boolean {
  return !date || date >= visibleDataStartDate;
}
