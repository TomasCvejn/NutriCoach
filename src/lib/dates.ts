// Calendar days are "YYYY-MM-DD" strings in the client's timezone (00-overview.md). The math runs on UTC midnights, so DST can't shift a day.
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Today in the user's timezone, never the server's UTC date (en-CA formats as YYYY-MM-DD).
export function todayIn(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ISO weekday: 1 = Monday … 7 = Sunday.
export function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

// Whole days from `from` to `to` (negative when `to` is earlier).
export function diffDays(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

// Whole years from a birth date to a day; the birthday counts from its own month-day (29 Feb: from 1 March in other years).
export function ageOn(birthDate: string, today: string) {
  return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0);
}

// The time now in the user's timezone, as HH:MM (24 h).
export function nowIn(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}
