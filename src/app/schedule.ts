import { ageMonths, Data, MealSlot, SleepDay, toMin } from './models';

export interface AwakeWindow {
  start: number;
  end: number;
  startPred: boolean;
  endPred: boolean;
}

export interface MealTime extends MealSlot {
  at: number;
  pred: boolean;
}

const after = (ref: number, m: number) => ref + ((((m - ref) % 1440) + 1440) % 1440);

const slot = (name: string, icon: string, w: number, ref: MealSlot['ref'], offset: number): MealSlot => ({
  name,
  icon,
  w,
  ref,
  offset,
});

// w: número da janela (1 = após acordar), 0 = última janela (antes do sono noturno)
export const suggestMeals = (months: number, n: number): MealSlot[] => {
  if (months < 6) {
    const list = Array.from({ length: n }, (_, i) => slot('Mamada', '🍼', i === n - 1 ? 0 : i + 1, 'start', 0));
    return [...list, slot('Mamada', '🍼', 0, 'end', 20)];
  }
  const big = months >= 12;
  const list = [
    slot(big ? 'Café da manhã' : 'Leite', big ? '🥣' : '🍼', 1, 'start', 0),
    slot('Fruta', '🍎', 1, 'start', 90),
    n <= 2 ? slot('Almoço', '🍲', 1, 'end', 60) : slot('Almoço', '🍲', 2, 'start', 20),
  ];
  for (let w = 3; w < n; w++) list.push(slot('Lanche', '🍌', w, 'start', 20));
  if (n <= 3) list.push(slot('Lanche', '🍌', 0, 'start', 20));
  list.push(months >= 7 ? slot('Jantar', '🍲', 0, 'end', 90) : slot('Fruta', '🍎', 0, 'end', 90));
  list.push(slot(big ? 'Ceia' : 'Leite', '🍼', 0, 'end', 30));
  return list;
};

// duração média da soneca i nos últimos 7 dias
const napAvg = (data: Data, date: string, i: number) => {
  const vals = Object.entries(data.days)
    .filter(([d]) => d < date)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([, d]) => d.naps[i])
    .filter((n) => n?.end)
    .map((n) => after(toMin(n.start), toMin(n.end!)) - toMin(n.start));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : i === 0 ? 60 : 45;
};

export const awakeWindows = (data: Data, date: string, day: SleepDay): AwakeWindow[] => {
  const n = Math.max(day.windows.length, day.naps.length + 1);
  const out: AwakeWindow[] = [];
  let start = toMin(day.wake);
  let startPred = false;
  for (let i = 0; i < n; i++) {
    const plan = day.windows[Math.min(i, day.windows.length - 1)];
    const nap = day.naps[i];
    let end = start + plan;
    let endPred = true;
    if (nap) [end, endPred] = [after(start, toMin(nap.start)), false];
    else if (i === n - 1 && day.night) [end, endPred] = [after(start, toMin(day.night)), false];
    out.push({ start, end, startPred, endPred });
    if (nap?.end) [start, startPred] = [after(end, toMin(nap.end)), false];
    else [start, startPred] = [end + napAvg(data, date, i), true];
  }
  return out;
};

export const mealTimes = (plan: MealSlot[], wins: AwakeWindow[]): MealTime[] => {
  const base = wins[0].start;
  return plan
    .map((m) => {
      if (m.ref === 'fixed') return { ...m, at: after(base, toMin(m.time || '12:00')), pred: false };
      const w = wins[m.w === 0 || m.w > wins.length ? wins.length - 1 : m.w - 1];
      const at = m.ref === 'start' ? Math.min(w.start + m.offset, w.end) : Math.max(w.end - m.offset, w.start);
      return { ...m, at, pred: m.ref === 'start' ? w.startPred : w.endPred };
    })
    .sort((a, b) => a.at - b.at);
};

export const mealPlan = (data: Data, date: string): MealSlot[] => {
  const b = data.baby;
  if (b.meals) return b.meals;
  return suggestMeals(b.birth ? ageMonths(b.birth, date) : 9, b.windows.length);
};

export const dayMeals = (data: Data, date: string) => {
  const day = data.days[date];
  return day ? mealTimes(mealPlan(data, date), awakeWindows(data, date, day)) : null;
};
