import { Injectable, inject, signal } from '@angular/core';
import { Store } from './store';
import { fromMin, hh, nowHM, today, toMin } from './models';
import { awakeWindows, dayMeals } from './schedule';

export interface NotifySettings {
  on: boolean;
  before: number;
  meals: boolean;
}

const KEY = 'gcb:notify';

/** Lembretes locais de soneca e refeição. Funcionam com o app aberto ou em segundo plano recente. */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private store = inject(Store);
  readonly settings = signal<NotifySettings>(this.load());
  readonly permission = signal(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  private fired = new Set<string>();

  constructor() {
    setInterval(() => this.check(), 30000);
    setTimeout(() => this.check(), 3000);
  }

  private load(): NotifySettings {
    try {
      return { on: false, before: 15, meals: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return { on: false, before: 15, meals: true };
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
    this.store.notify(s.on ? '🔔 Lembretes ativados' : '🔕 Lembretes desativados');
  }

  test() {
    this.show(`🔔 Teste do ${this.store.appName()}`, 'Os lembretes estão funcionando.', 'test');
  }

  private events() {
    const data = this.store.data();
    const date = today();
    const day = data.days[date];
    if (!day || day.night) return [];
    const s = this.settings();
    const name = data.baby.name || 'O bebê';
    const out: { key: string; at: number; title: string; body: string }[] = [];
    const last = day.naps.at(-1);
    if (!last || last.end) {
      const idx = day.naps.length;
      const end = awakeWindows(data, date, day)[idx].end;
      const what = idx >= day.windows.length - 1 ? 'sono noturno' : `soneca ${idx + 1}`;
      out.push({ key: `pre-${idx}-${end}`, at: end - s.before, title: `😴 ${what} em ${s.before} min`, body: `${name} deve dormir às ${hh(fromMin(end))}.` });
      out.push({ key: `end-${idx}-${end}`, at: end, title: `😴 Hora do ${what}`, body: `A janela de vigília de ${name} terminou.` });
    }
    if (s.meals) {
      for (const m of dayMeals(data, date) ?? [])
        out.push({ key: `meal-${m.name}-${m.at}`, at: m.at, title: `${m.icon} Hora: ${m.name}`, body: `Previsto para ${hh(fromMin(m.at))}.` });
    }
    return out;
  }

  private check() {
    if (!this.settings().on) return;
    const wake = toMin(this.store.data().days[today()]?.wake ?? '00:00');
    let now = toMin(nowHM());
    if (now < wake - 120) now += 1440;
    for (const e of this.events()) {
      const key = `${today()}-${e.key}`;
      if (now >= e.at && now - e.at < 5 && !this.fired.has(key)) {
        this.fired.add(key);
        this.show(e.title, e.body, e.key);
      }
    }
  }

  private async show(title: string, body: string, tag: string) {
    this.store.notify(title);
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
