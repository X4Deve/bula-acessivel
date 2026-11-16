// Cálculo de próximas ocorrências de horários DEFINIDOS PELO USUÁRIO. Não sugere horários nem doses.
export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const TZ = "America/Sao_Paulo";

export type ScheduleLike = {
  local_times: string[];
  weekdays: number[];
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  active: boolean;
};

function nowParts(now: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, time: `${p["hour"]}:${p["minute"]}` };
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Próximas ocorrências (data local + horário) nos próximos `days` dias. */
export function nextOccurrences(
  s: ScheduleLike,
  now = new Date(),
  days = 7,
  tz = TZ,
): { date: string; time: string; weekday: number }[] {
  if (!s.active) return [];
  const { date: today, time: nowTime } = nowParts(now, tz);
  const out: { date: string; time: string; weekday: number }[] = [];
  const times = [...s.local_times].sort();
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    if (date < s.start_date) continue;
    if (s.end_date && date > s.end_date) break;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (!s.weekdays.includes(weekday)) continue;
    for (const t of times) {
      if (i === 0 && t <= nowTime) continue;
      out.push({ date, time: t, weekday });
    }
  }
  return out;
}

export function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
