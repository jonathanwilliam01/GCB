import { computed, inject, Injectable } from '@angular/core';
import { Store } from './store';
import { FoodEntry, hh, nowHM, today, uid } from './models';

export type SleepState = 'noday' | 'awake' | 'nap' | 'night';

/** Ações de registro usadas pelas telas e pelo botão rápido. */
@Injectable({ providedIn: 'root' })
export class Actions {
  private store = inject(Store);

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
  }

  sleep(date = today()) {
    const t = nowHM();
    this.store.mutate((d) => d.days[date].naps.push({ start: t, by: this.store.uid() }), `😴 Dormiu ${hh(t)}`);
  }

  wake(date = today()) {
    const t = nowHM();
    this.store.mutate((d) => Object.assign(d.days[date].naps.at(-1)!, { end: t, endBy: this.store.uid() }), `☀️ Acordou ${hh(t)}`);
  }

  night(date = today()) {
    const t = nowHM();
    this.store.mutate((d) => Object.assign(d.days[date], { night: t, nightBy: this.store.uid() }), `🌙 Sono noturno ${hh(t)}`);
  }

  undoNight(date = today()) {
    this.store.mutate((d) => Object.assign(d.days[date], { night: undefined, nightBy: undefined }), '↺ Sono noturno desfeito');
  }

  addFood(e: Omit<FoodEntry, 'id'>) {
    this.store.mutate((d) => d.foods.push({ ...e, id: uid(), by: this.store.uid() }), `🥕 ${e.food} registrado`);
  }
}
