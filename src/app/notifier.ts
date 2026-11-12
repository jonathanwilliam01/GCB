import { effect, Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { Store } from './store';
import { q, supabase } from './supabase';
import { Data, dur, fromMin, hh, mainNaps, nowHM, shiftDate, today, toMin } from './models';
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
  /** Aviso quando outra pessoa registra que dormiu/acordou */
  events: boolean;
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
const DEFAULTS: NotifySettings = { on: false, before: 15, end: true, late: 20, napMax: 150, meals: true, wakeBy: 0, events: true };

/** Lembretes do dia; at em minutos desde 00:00 de date (passa de 1440 depois da meia-noite) */
function reminders(data: Data, date: string, s: NotifySettings): Reminder[] {
  const day = data.days[date];
  const name = data.baby.name || 'O bebê';
  const awake = data.baby.sex === 'F' ? 'acordada' : 'acordado';
  const out: Reminder[] = [];

  if (!day) {
    if (s.wakeBy) out.push({ key: 'wake', at: s.wakeBy, grace: 180, title: '☀️ Já acordou?', body: `Registre a hora que ${name} acordou para calcular as janelas do dia.`, act: 'day' });
    return out;
  }
  if (day.night) return out;

  const wins = awakeWindows(data, date, day);
  const naps = mainNaps(day.naps);
  const last = naps.at(-1);
  if (!last || last.end) {
    const idx = naps.length;
    const end = wins[idx].end;
    const what = idx >= day.windows.length - 1 ? 'sono noturno' : `soneca ${idx + 1}`;
    if (s.before) out.push({ key: `pre-${idx}-${end}`, at: end - s.before, grace: s.before, title: `😴 ${what} em ${s.before} min`, body: `${name} deve dormir às ${hh(fromMin(end))}.` });
    if (s.end) out.push({ key: `end-${idx}-${end}`, at: end, grace: 10, title: `😴 Hora do ${what}`, body: `A janela de vigília de ${name} terminou.`, act: 'sleep' });
    if (s.late) out.push({ key: `late-${idx}-${end}`, at: end + s.late, grace: 60, title: `⏰ Janela passou ${s.late} min`, body: `${name} continua ${awake}. Cansaço demais dificulta o sono.`, act: 'sleep' });
  } else if (s.napMax) {
    const idx = naps.length - 1;
    const start = wins[idx].end;
    out.push({ key: `nap-${idx}-${start}`, at: start + s.napMax, grace: 60, title: `💤 Soneca de ${dur(s.napMax)}`, body: `${name} dorme desde ${hh(last.start)}. Avalie acordar ou registre se já acordou.`, act: 'wake' });
  }

  if (s.meals) {
    for (const m of dayMeals(data, date) ?? [])
      out.push({ key: `meal-${m.name}-${m.at}`, at: m.at, grace: 15, title: `${m.icon} Hora: ${m.name}`, body: `Previsto para ${hh(fromMin(m.at))}.` });
  }
  return out;
}

/**
 * Lembretes de sono e refeição. Com o app aberto: aviso no app e notificação local.
 * Com o app fechado: push do servidor (agenda montada aqui e enviada pela edge function push).
 */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private store = inject(Store);
  private swPush = inject(SwPush);
  readonly settings = signal<NotifySettings>(this.load());
  readonly permission = signal(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  readonly alert = signal<{ title: string; body: string; act?: Act } | null>(null);
  /** Aparelho inscrito no push do servidor */
  readonly push = signal(false);
  private fired = new Set<string>(this.loadFired());
  private agendaTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    setInterval(() => this.check(), 30000);
    setTimeout(() => this.check(), 3000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.check());

    effect(() => {
      const args = [this.settings(), this.permission(), this.store.bebeId(), this.store.uid()] as const;
      this.inscrever(...args);
    });
    // qualquer registro do dia (seu ou de quem acompanha) refaz a agenda de push do bebê
    effect(() => {
      this.store.data();
      this.store.bebeId();
      clearTimeout(this.agendaTimer);
      this.agendaTimer = setTimeout(() => this.agendar(), 2000);
    });
  }

  private async inscrever(s: NotifySettings, perm: string, bebe: string | null, uid?: string) {
    if (!this.swPush.isEnabled || !environment.vapidKey) return;
    try {
      // desligou, bloqueou ou saiu da conta: cancela no servidor e no aparelho
      if (!s.on || perm !== 'granted' || (!uid && this.push())) {
        const sub = await firstValueFrom(this.swPush.subscription);
        if (sub) {
          if (uid) await q(supabase.rpc('push_cancelar', { p_endpoint: sub.endpoint })).catch(() => {});
          await this.swPush.unsubscribe();
        }
        this.push.set(false);
        return;
      }
      if (!bebe || !uid) return;
      const sub = (await this.swPush.requestSubscription({ serverPublicKey: environment.vapidKey })).toJSON();
      await q(supabase.rpc('push_inscrever', { p_endpoint: sub.endpoint, p_p256dh: sub.keys!['p256dh'], p_auth: sub.keys!['auth'], p_bebe: bebe, p_config: s }));
      this.push.set(true);
      await this.agendar();
    } catch (e) {
      console.warn('push', e);
      this.push.set(false);
    }
  }

  /** Lembretes de hoje e o de acordar de amanhã, para cada aparelho inscrito no bebê */
  private async agendar() {
    const bebe = this.store.bebeId();
    if (!bebe || !this.store.uid()) return;
    try {
      const configs = await q<{ id: string; config: NotifySettings }[]>(supabase.rpc('push_configs', { p_bebe: bebe }));
      if (!configs.length) return;
      const data = this.store.data();
      const now = Date.now();
      const itens = configs.flatMap(({ id, config }) =>
        [today(), shiftDate(today(), 1)].flatMap((date) => {
          const zero = new Date(`${date}T00:00`).getTime();
          return reminders(data, date, { ...DEFAULTS, ...config })
            .map((r) => ({ r, em: zero + r.at * 60000 }))
            .filter(({ r, em }) => em + r.grace * 60000 > now)
            .map(({ r, em }) => ({
              inscricao_id: id,
              chave: `${date}-${r.key}`,
              em: new Date(em).toISOString(),
              ate: new Date(em + r.grace * 60000).toISOString(),
              titulo: r.title,
              corpo: r.body,
            }));
        }),
      );
      await q(supabase.rpc('push_agendar', { p_bebe: bebe, p_itens: itens }));
    } catch (e) {
      console.warn('agenda push', e);
    }
  }

  /** Push imediato para os outros aparelhos do bebê */
  async evento(title: string, body: string) {
    const bebe = this.store.bebeId();
    if (!bebe || !this.store.uid()) return;
    await q(supabase.rpc('push_evento', { p_bebe: bebe, p_titulo: title, p_corpo: body })).catch((e) => console.warn('push evento', e));
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

  private check() {
    if (!this.settings().on) return;
    const wake = toMin(this.store.data().days[today()]?.wake ?? '00:00');
    let now = toMin(nowHM());
    if (now < wake - 120) now += 1440;
    for (const r of reminders(this.store.data(), today(), this.settings())) {
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
