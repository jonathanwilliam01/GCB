export type Sex = 'M' | 'F' | '';
export type Reaction = 'gostou' | 'neutro' | 'recusou' | 'alergia';

export interface Baby {
  name: string;
  birth: string;
  sex: Sex;
  photo: string;
  photoFull?: string;
  photoCrop?: Crop;
  birthWeight?: number;
  birthHeight?: number;
  blood: string;
  notes: string;
  windows: number[];
  meals?: MealSlot[];
}

// centro do recorte (fração da imagem) e zoom
export interface Crop {
  x: number;
  y: number;
  z: number;
}

export interface MealSlot {
  name: string;
  icon: string;
  w: number;
  ref: 'start' | 'end' | 'fixed';
  offset: number;
  time?: string;
}

export interface Nap {
  start: string;
  end?: string;
}

export interface SleepDay {
  wake: string;
  windows: number[];
  naps: Nap[];
  night?: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  food: string;
  reaction: Reaction;
  notes: string;
}

export interface Measure {
  id: string;
  date: string;
  weight?: number;
  height?: number;
  head?: number;
}

export interface Data {
  version: 1;
  appName?: string;
  baby: Baby;
  days: Record<string, SleepDay>;
  foods: FoodEntry[];
  measures: Measure[];
}

export const REACTIONS: { id: Reaction; icon: string; label: string }[] = [
  { id: 'gostou', icon: '😋', label: 'Gostou' },
  { id: 'neutro', icon: '😐', label: 'Neutro' },
  { id: 'recusou', icon: '😖', label: 'Recusou' },
  { id: 'alergia', icon: '⚠️', label: 'Reação' },
];

export const emptyData = (): Data => ({
  version: 1,
  baby: { name: '', birth: '', sex: '', photo: '', blood: '', notes: '', windows: [135, 150, 150, 180] },
  days: {},
  foods: [],
  measures: [],
});

const pad = (n: number) => String(n).padStart(2, '0');

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const fromMin = (m: number) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

// minutos de a até b, atravessando meia-noite
export const diff = (a: string, b: string) => (toMin(b) - toMin(a) + 1440) % 1440;

// minutos decorridos de a até agora; negativo se a ainda não chegou
export const since = (a: string, now: string) => {
  const d = toMin(now) - toMin(a);
  return d < -720 ? d + 1440 : d;
};

export const hh = (t?: string) => (t ? t.replace(':', 'h') : '--');

export const dur = (min: number) => {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const r = min % 60;
  return `${Math.floor(min / 60)}h${r ? pad(r) : ''}`;
};

export const today = () => isoDate(new Date());

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const shiftDate = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

export const br = (iso: string, year = true) => {
  const [y, m, d] = iso.split('-');
  return year ? `${d}/${m}/${y}` : `${d}/${m}`;
};

export const ageMonths = (birth: string, at: string) =>
  (new Date(at + 'T12:00').getTime() - new Date(birth + 'T12:00').getTime()) / 86400000 / 30.4375;

export const ageText = (birth: string, at = today()) => {
  const b = new Date(birth + 'T12:00');
  const a = new Date(at + 'T12:00');
  let months = (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
  if (a.getDate() < b.getDate()) months--;
  const ref = new Date(b);
  ref.setMonth(b.getMonth() + months);
  const days = Math.round((a.getTime() - ref.getTime()) / 86400000);
  if (months < 0) return '';
  if (months === 0 && !days) return 'nascimento';
  if (months === 0) return `${days} dia${days === 1 ? '' : 's'}`;
  const ms = months === 1 ? '1 mês' : `${months} meses`;
  return days ? `${ms} e ${days} dia${days === 1 ? '' : 's'}` : ms;
};

// Mediana OMS (0, 1, 2... meses)
export const WHO_MEDIAN: Record<'weight' | 'height' | 'head', Record<'M' | 'F', number[]>> = {
  weight: {
    M: [3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4, 9.6, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.8, 12.0, 12.2],
    F: [3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3, 7.6, 7.9, 8.2, 8.5, 8.7, 8.9, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6, 10.9, 11.1, 11.3, 11.5],
  },
  height: {
    M: [49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 76.9, 78.0, 79.1, 80.2, 81.2, 82.3, 83.2, 84.2, 85.1, 86.0, 86.9, 87.8],
    F: [49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 75.2, 76.4, 77.5, 78.6, 79.7, 80.7, 81.7, 82.7, 83.7, 84.6, 85.5, 86.4],
  },
  head: {
    M: [34.5, 37.3, 39.1, 40.5, 41.6, 42.6, 43.3, 44.0, 44.5, 45.0, 45.4, 45.8, 46.1],
    F: [33.9, 36.5, 38.3, 39.5, 40.6, 41.5, 42.2, 42.8, 43.4, 43.8, 44.2, 44.6, 44.9],
  },
};
