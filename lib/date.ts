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

export function dateRangeKeys(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (current <= end) {
    dates.push(dateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function isVisibleDataDate(date: string): boolean {
  return !date || date >= visibleDataStartDate;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
