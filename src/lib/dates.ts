// Calendar days are "YYYY-MM-DD" strings in the client's timezone (00-overview.md). The math runs on UTC midnights, so DST can't shift a day.
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
