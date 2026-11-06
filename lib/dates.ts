export function monthValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(
  date: Date,
  month: "long" | "short" = "long",
): string {
  return new Intl.DateTimeFormat("en-US", {
    month,
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
