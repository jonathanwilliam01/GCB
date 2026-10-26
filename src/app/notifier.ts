import { Injectable, inject, signal } from '@angular/core';
import { Store } from './store';
import { dur, fromMin, hh, nowHM, today, toMin } from './models';
import { awakeWindows, dayMeals } from './schedule';

// tempos em minutos; 0 = desligado
export interface NotifySettings {
  on: boolean;
  before: number;
  end: boolean;
  late: number;
  napMax: number;
  meals: boolean;
  wakeBy: number;
}

// grace: minutos depois de "at" em que o aviso ainda vale (app reaberto atrasado)
interface Reminder {
  key: string;
  at: number;
  grace: number;
  title: string;
  body: string;
  act?: Act;
}

export type Act = 'day' | 'sleep' | 'wake';

const KEY = 'gcb:notify';
const FIRED = 'gcb:fired';
const DEFAULTS: NotifySettings = { on: false, before: 15, end: true, late: 20, napMax: 150, meals: true, wakeBy: 0 };

/** Lembretes locais de sono e refeição. Funcionam com o app aberto ou em segundo plano recente. */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private store = inject(Store);
  readonly settings = signal<NotifySettings>(this.load());
  readonly permission = signal(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  readonly alert = signal<{ title: string; body: string; act?: Act } | null>(null);
  private fired = new Set<string>(this.loadFired());

  constructor() {
    setInterval(() => this.check(), 30000);
    setTimeout(() => this.check(), 3000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.check());
  }

  private load(): NotifySettings {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return DEFAULTS;
    }
  }

  private loadFired(): string[] {
    try {
      return (JSON.parse(localStorage.getItem(FIRED) || '[]') as string[]).filter((k) => k.startsWith(today()));
    } catch {
      return [];
    }
  }

  async update(patch: Partial<NotifySettings>) {
    const s = { ...this.settings(), ...patch };
    if (patch.on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      this.permission.set(await Notification.requestPermission());
    }
    this.settings.set(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    this.store.notify('on' in patch ? (s.on ? '🔔 Lembretes ativados' : '🔕 Lembretes desativados') : '✓ Lembretes salvos');
  }

  test() {
    this.show(`🔔 Teste do ${this.store.appName()}`, 'Os lembretes estão funcionando.', 'test');
  }

  private reminders(): Reminder[] {
    const data = this.store.data();
    const date = today();
    const day = data.days[date];
    const s = this.settings();
    const name = data.baby.name || 'O bebê';
    const awake = data.baby.sex === 'F' ? 'acordada' : 'acordado';
    const out: Reminder[] = [];

    if (!day) {
      if (s.wakeBy) out.push({ key: 'wake', at: s.wakeBy, grace: 180, title: '☀️ Já acordou?', body: `Registre a hora que ${name} acordou para calcular as janelas do dia.`, act: 'day' });
      return out;
    }
    if (day.night) return out;

    const wins = awakeWindows(data, date, day);
    const last = day.naps.at(-1);
    if (!last || last.end) {
      const idx = day.naps.length;
      const end = wins[idx].end;
      const what = idx >= day.windows.length - 1 ? 'sono noturno' : `soneca ${idx + 1}`;
      if (s.before) out.push({ key: `pre-${idx}-${end}`, at: end - s.before, grace: s.before, title: `😴 ${what} em ${s.before} min`, body: `${name} deve dormir às ${hh(fromMin(end))}.` });
      if (s.end) out.push({ key: `end-${idx}-${end}`, at: end, grace: 10, title: `😴 Hora do ${what}`, body: `A janela de vigília de ${name} terminou.`, act: 'sleep' });
      if (s.late) out.push({ key: `late-${idx}-${end}`, at: end + s.late, grace: 60, title: `⏰ Janela passou ${s.late} min`, body: `${name} continua ${awake}. Cansaço demais dificulta o sono.`, act: 'sleep' });
    } else if (s.napMax) {
      const idx = day.naps.length - 1;
      const start = wins[idx].end;
      out.push({ key: `nap-${idx}-${start}`, at: start + s.napMax, grace: 60, title: `💤 Soneca de ${dur(s.napMax)}`, body: `${name} dorme desde ${hh(last.start)}. Avalie acordar ou registre se já acordou.`, act: 'wake' });
    }

    if (s.meals) {
      for (const m of dayMeals(data, date) ?? [])
        out.push({ key: `meal-${m.name}-${m.at}`, at: m.at, grace: 15, title: `${m.icon} Hora: ${m.name}`, body: `Previsto para ${hh(fromMin(m.at))}.` });
    }
    return out;
  }

  private check() {
    if (!this.settings().on) return;
    const wake = toMin(this.store.data().days[today()]?.wake ?? '00:00');
    let now = toMin(nowHM());
    if (now < wake - 120) now += 1440;
    for (const r of this.reminders()) {
      const key = `${today()}-${r.key}`;
      if (now >= r.at && now - r.at < r.grace && !this.fired.has(key)) {
        this.fired.add(key);
        try {
          localStorage.setItem(FIRED, JSON.stringify([...this.fired]));
        } catch {}
        this.show(r.title, r.body, r.key, r.act);
      }
    }
  }

  private async show(title: string, body: string, tag: string, act?: Act) {
    this.alert.set({ title, body, act });
    if (this.permission() !== 'granted') return;
    const opts = {
      body,
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/' } } },
    } as NotificationOptions;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, opts);
    else new Notification(title, opts);
    navigator.vibrate?.([200, 100, 200]);
  }
}
