import { computed, inject, Injectable } from '@angular/core';
import { Store } from './store';
import { Notifier } from './notifier';
import { FoodEntry, hh, nowHM, toMin, today, uid } from './models';

export type SleepState = 'noday' | 'awake' | 'nap' | 'night';

/** Ações de registro usadas pelas telas e pelo botão rápido. */
@Injectable({ providedIn: 'root' })
export class Actions {
  private store = inject(Store);
  private notifier = inject(Notifier);

  // só avisa registro do momento, não correção de horário antigo
  private avisar(date: string, t: string, emoji: string, verbo: string) {
    if (date !== today() || Math.abs(toMin(nowHM()) - toMin(t)) > 30) return;
    const m = this.store.eu();
    const quem = m ? m.apelido || m.email.split('@')[0] : '';
    this.notifier.evento(`${emoji} ${this.store.data().baby.name || 'O bebê'} ${verbo}`, `Às ${hh(t)}${quem ? ` · registrado por ${quem}` : ''}`);
  }

  state = computed<SleepState>(() => this.stateOf(today()));

  stateOf(date: string): SleepState {
    const d = this.store.data().days[date];
    if (!d) return 'noday';
    if (d.night) return 'night';
    const last = d.naps.at(-1);
    return last && !last.end ? 'nap' : 'awake';
  }

  startDay(date = today(), wake = nowHM()) {
    const windows = [...this.store.data().baby.windows];
    this.store.mutate((d) => (d.days[date] = { wake, windows, naps: [], wakeBy: this.store.uid() }), `☀️ Acordou ${hh(wake)}`);
    this.avisar(date, wake, '☀️', 'acordou');
  }

  sleep(date = today(), t = nowHM()) {
    this.store.mutate((d) => d.days[date].naps.push({ start: t, by: this.store.uid() }), `😴 Dormiu ${hh(t)}`);
    this.avisar(date, t, '😴', 'dormiu');
  }

  wake(date = today(), t = nowHM()) {
    this.store.mutate((d) => Object.assign(d.days[date].naps.at(-1)!, { end: t, endBy: this.store.uid() }), `☀️ Acordou ${hh(t)}`);
    this.avisar(date, t, '☀️', 'acordou');
  }

  night(date = today(), t = nowHM()) {
    this.store.mutate((d) => Object.assign(d.days[date], { night: t, nightBy: this.store.uid() }), `🌙 Sono noturno ${hh(t)}`);
    this.avisar(date, t, '🌙', 'dormiu (sono noturno)');
  }

  undoNight(date = today()) {
    this.store.mutate((d) => Object.assign(d.days[date], { night: undefined, nightBy: undefined }), '↺ Sono noturno desfeito');
  }

  addFood(e: Omit<FoodEntry, 'id'>) {
    this.store.mutate((d) => d.foods.push({ ...e, id: uid(), by: this.store.uid() }), `🥕 ${e.food} registrado`);
  }
}
