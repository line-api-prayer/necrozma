const THAILAND_TIMEZONE = "Asia/Bangkok";

export function getThailandDateString(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: THAILAND_TIMEZONE });
}

export function getNextThailandDateString(date = new Date()) {
  const parts = getThailandDateString(date).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error("Unable to derive Thailand date");
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day + 1));
  return utcDate.toISOString().split("T")[0] ?? getThailandDateString(date);
}

export function formatThaiLongDate(date: string) {
  return new Date(date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatThaiShortDate(date: string) {
  return new Date(date).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
