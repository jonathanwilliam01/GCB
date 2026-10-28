import { Data, diff, mainNaps, nowHM, Reaction, shiftDate, today, toMin } from './models';

// eixo do diário de sono: 05:00 até 05:00 do dia seguinte
const BASE = 300;

export interface Segment {
  from: number;
  to: number;
  kind: 'nap' | 'night';
  title: string;
}

export interface DayStats {
  date: string;
  wake?: string;
  night?: string;
  naps: number;
  napMin: number;
  nightMin: number | null;
}

const pos = (t: string) => (toMin(t) - BASE + 1440) % 1440;
const hm = (t: string) => t.replace(':', 'h');

export const segments = (data: Data, date: string): Segment[] => {
  const day = data.days[date];
  if (!day) return [];
  const isToday = date === today();
  const now = pos(nowHM());
  const out: Segment[] = [];
  const wake = Math.max(0, toMin(day.wake) - BASE);
  if (wake > 0) out.push({ from: 0, to: wake, kind: 'night', title: `Noite até ${hm(day.wake)}` });
  for (const n of day.naps) {
    const end = n.end ? pos(n.end) : isToday ? now : null;
    if (end === null) continue;
    out.push({ from: pos(n.start), to: Math.max(end, pos(n.start)), kind: 'nap', title: `Soneca ${hm(n.start)}${n.end ? ' a ' + hm(n.end) : ''}` });
  }
  if (day.night) {
    const next = data.days[shiftDate(date, 1)]?.wake;
    let to = next ? Math.min(1440, toMin(next) + 1440 - BASE) : 1440;
    if (isToday) to = Math.max(pos(day.night), Math.min(to, now));
    out.push({ from: pos(day.night), to, kind: 'night', title: `Noite desde ${hm(day.night)}` });
  }
  return out;
};

export const axisPct = (min: number) => (min / 1440) * 100;
export const hourPct = (h: number) => axisPct((h * 60 - BASE + 1440) % 1440);

export const dayStats = (data: Data, date: string): DayStats | null => {
  const day = data.days[date];
  if (!day) return null;
  const next = data.days[shiftDate(date, 1)];
  const ended = day.naps.filter((n) => n.end);
  return {
    date,
    wake: day.wake,
    night: day.night,
    naps: mainNaps(day.naps).length,
    napMin: ended.reduce((s, n) => s + diff(n.start, n.end!), 0),
    nightMin: day.night && next ? diff(day.night, next.wake) : null,
  };
};

export const range = (days: number, end = today()) =>
  Array.from({ length: days }, (_, i) => shiftDate(end, i - days + 1));

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// média de horários; horários de madrugada contam como depois da meia-noite
export const avgTime = (times: string[], lateNight = false) => {
  const a = avg(times.map((t) => toMin(t) + (lateNight && toMin(t) < 720 ? 1440 : 0)));
  return a === null ? null : Math.round(a);
};

export const sleepSummary = (stats: DayStats[]) => {
  const full = stats.filter((s) => s.nightMin !== null);
  return {
    days: stats.length,
    napMin: avg(stats.map((s) => s.napMin)),
    naps: avg(stats.map((s) => s.naps)),
    nightMin: avg(full.map((s) => s.nightMin!)),
    totalMin: avg(full.map((s) => s.napMin + s.nightMin!)),
    wake: avgTime(stats.map((s) => s.wake!).filter(Boolean)),
    night: avgTime(stats.map((s) => s.night!).filter(Boolean), true),
  };
};

export const foodSummary = (data: Data, from: string, to: string) => {
  const inRange = data.foods.filter((f) => f.date >= from && f.date <= to);
  const isNew = (name: string) =>
    !data.foods.some((o) => o.food.toLowerCase() === name.toLowerCase() && o.date < from);
  const distinct = [...new Map(inRange.map((f) => [f.food.toLowerCase(), f.food])).values()];
  const count = (r: Reaction) => inRange.filter((f) => f.reaction === r).length;
  return {
    total: inRange.length,
    distinct,
    fresh: distinct.filter(isNew),
    reactions: { gostou: count('gostou'), neutro: count('neutro'), recusou: count('recusou'), alergia: count('alergia') },
    refused: [...new Set(inRange.filter((f) => f.reaction === 'recusou').map((f) => f.food))],
    alerts: inRange.filter((f) => f.reaction === 'alergia').sort((a, b) => b.date.localeCompare(a.date)),
  };
};

export interface WindowRow {
  slot: number;
  night: boolean;
  plan: number;
  real: number | null;
  samples: number;
  napAfter: number | null;
  suggest: number | null;
  note: string;
}

// compara a janela planejada (cadastro atual) com a janela real de cada dia
export const windowAnalysis = (data: Data, dates: string[]): WindowRow[] => {
  const plan = data.baby.windows;
  const last = plan.length - 1;
  const real: number[][] = plan.map(() => []);
  const naps: number[][] = plan.map(() => []);
  for (const date of dates) {
    const d = data.days[date];
    if (!d) continue;
    let start: string | undefined = d.wake;
    const main = mainNaps(d.naps);
    main.forEach((n, i) => {
      if (start && i < last) real[i].push(diff(start, n.start));
      if (n.end && i < last) naps[i].push(diff(n.start, n.end));
      start = n.end;
    });
    if (d.night && start && main.length === last) real[last].push(diff(start, d.night));
  }
  return plan.map((p, i) => {
    const r = avg(real[i]);
    const nap = avg(naps[i]);
    const enough = real[i].length >= 3;
    const off = r !== null && enough && Math.abs(r - p) >= 15;
    const suggest = off ? Math.round(r! / 15) * 15 : null;
    let note = '';
    if (off) note = r! > p ? 'Na prática fica acordado mais tempo que o planejado.' : 'Na prática dorme antes do planejado.';
    else if (nap !== null && naps[i].length >= 3 && nap < 40 && i < last) note = 'Soneca seguinte curta: observe se a janela está adequada.';
    else if (!enough) note = 'Poucos dias registrados para analisar.';
    return { slot: i + 1, night: i === last, plan: p, real: r, samples: real[i].length, napAfter: i < last ? nap : null, suggest, note };
  });
};

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadCsv = (name: string, header: string[], rows: unknown[][]) => {
  const text = '\ufeff' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
