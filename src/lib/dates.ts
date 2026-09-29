export function parseDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw Error("日期格式应为 YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1901 || year > 2099) throw Error("本站支持公历 1901–2099 年");
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    throw Error("日期不存在");
  return { year, month, day };
}
export function zonedParts(instant: string, timezone: string) {
  const d = new Date(instant);
  if (!Number.isFinite(d.getTime())) throw Error("问卜时刻无效");
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    f.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    ...parseDate(date),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    date,
    display: `${date} ${parts.hour}:${parts.minute}:${parts.second} (${timezone})`,
  };
}
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function detectTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
