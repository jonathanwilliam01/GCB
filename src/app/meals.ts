import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mask } from './mask';
import { Store } from './store';
import { dur, fromMin, hh, MealSlot, nowHM, today, toMin } from './models';
import { dayMeals, mealPlan } from './schedule';

@Component({
  selector: 'app-meals',
  imports: [FormsModule, Mask],
  template: `
    @if (compact()) {
      @if (next(); as m) {
        <div class="card hint row between">
          <span>{{ m.icon }} Próxima refeição: <b>{{ m.name }}</b></span>
          <span>{{ m.pred ? '≈ ' : '' }}<b>{{ hm(m.at) }}</b>&nbsp;<small class="muted">{{ inText(m.at) }}</small></span>
        </div>
      }
    } @else {
      <div class="card">
        <div class="row between">
          <b>🍽 Horários de hoje</b>
          <button class="link" (click)="editing.set(!editing())">{{ editing() ? 'fechar' : '⚙️ ajustar' }}</button>
        </div>

        @if (!editing()) {
          @if (times(); as list) {
            @for (m of list; track $index) {
              <div class="meal" [class.past]="isPast(m.at)" [class.next]="m === next()">
                <span>{{ m.icon }} {{ m.name }}</span>
                <span>
                  <b>{{ m.pred ? '≈ ' : '' }}{{ hm(m.at) }}</b>
                  @if (m === next()) { <small class="muted"> {{ inText(m.at) }}</small> }
                </span>
              </div>
            }
            <p class="muted small" title="Calculado pela hora em que acordou, pelas sonecas registradas e pelas janelas do dia. ≈ = previsão.">
              ⓘ Calculado pelas janelas e sonecas de hoje. ≈ = previsto, ajusta sozinho ao registrar o sono.
            </p>
          } @else {
            <p class="muted small">Comece o dia na tela de Sono para ver os horários sugeridos.</p>
          }
        } @else {
          <p class="muted small">
            {{ custom() ? 'Plano personalizado.' : 'Plano automático pela idade.' }}
            Alterações salvam sozinhas.
          </p>
          @for (m of plan(); track $index; let i = $index) {
            <div class="slot">
              <input class="emoji" [ngModel]="m.icon" [ngModelOptions]="{ updateOn: 'blur' }" (ngModelChange)="edit(i, { icon: $event })" title="Ícone" />
              <input class="grow" [ngModel]="m.name" [ngModelOptions]="{ updateOn: 'blur' }" (ngModelChange)="edit(i, { name: $event })" title="Nome da refeição" />
              <button class="icon danger" title="Remover" (click)="remove(i)">×</button>
              <select [ngModel]="m.ref" (ngModelChange)="edit(i, { ref: $event })" title="Como calcular o horário">
                <option value="start">depois de acordar</option>
                <option value="end">antes de dormir</option>
                <option value="fixed">horário fixo</option>
              </select>
              @if (m.ref === 'fixed') {
                <input mask="time" [ngModel]="m.time" [ngModelOptions]="{ updateOn: 'blur' }" (ngModelChange)="edit(i, { time: $event })" />
              } @else {
                <input mask="int" class="min" [ngModel]="m.offset" [ngModelOptions]="{ updateOn: 'blur' }" (ngModelChange)="edit(i, { offset: +$event || 0 })" title="Minutos" />
                <span class="muted small">min, na</span>
                <select [ngModel]="m.w" (ngModelChange)="edit(i, { w: +$event })" title="Janela de vigília">
                  @for (n of windowOpts(); track n) { <option [ngValue]="n">{{ n }}ª janela</option> }
                  <option [ngValue]="0">última janela</option>
                </select>
              }
            </div>
          }
          <div class="row gap">
            <button class="btn ghost" (click)="add()">+ Refeição</button>
            @if (custom()) {
              <button class="btn ghost" (click)="reset()" title="Volta para a sugestão automática pela idade">↺ Sugestão da idade</button>
            }
          </div>
        }
      </div>
    }
  `,
})
export class MealsCard {
  private store = inject(Store);
  compact = input(false);
  date = input(today());
  editing = signal(false);
  now = signal(toMin(nowHM()));

  private baby = computed(() => this.store.data().baby);
  custom = computed(() => !!this.baby().meals);
  plan = computed<MealSlot[]>(() => mealPlan(this.store.data(), this.date()));
  windowOpts = computed(() => Array.from({ length: Math.max(this.baby().windows.length - 1, 1) }, (_, i) => i + 1));

  times = computed(() => dayMeals(this.store.data(), this.date()));

  // "agora" no mesmo eixo dos horários (minutos desde a meia-noite do dia, pode passar de 1440)
  private nowAt = computed(() => {
    const t = this.times();
    if (!t || this.date() !== today()) return this.date() < today() ? Infinity : -Infinity;
    const wake = t.length ? Math.min(...t.map((m) => m.at)) : 0;
    return this.now() + (this.now() < wake - 120 ? 1440 : 0);
  });
  next = computed(() => this.times()?.find((m) => m.at >= this.nowAt() - 10));

  constructor() {
    const t = setInterval(() => this.now.set(toMin(nowHM())), 20000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  hm(m: number) {
    return hh(fromMin(m));
  }

  isPast(at: number) {
    return at < this.nowAt() - 10;
  }

  inText(at: number) {
    const d = Math.round(at - this.nowAt());
    return d > 0 ? `em ${dur(d)}` : 'agora';
  }

  private save(fn: (meals: MealSlot[]) => void) {
    const meals = structuredClone(this.plan());
    fn(meals);
    this.store.mutate((d) => (d.baby.meals = meals));
  }

  edit(i: number, patch: Partial<MealSlot>) {
    this.save((m) => Object.assign(m[i], patch, patch.ref === 'fixed' && !m[i].time ? { time: '12:00' } : {}));
  }

  add() {
    this.save((m) => m.push({ name: 'Lanche', icon: '🍌', w: 1, ref: 'start', offset: 30 }));
  }

  remove(i: number) {
    this.save((m) => m.splice(i, 1));
  }

  reset() {
    this.store.mutate((d) => delete d.baby.meals, '↺ Voltou para a sugestão da idade');
  }
}
