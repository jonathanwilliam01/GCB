import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mask } from './mask';
import { MealsCard } from './meals';
import { Store } from './store';
import { Actions } from './actions';
import { sleepTip } from './tips';
import { ageMonths, ageText, br, diff, dur, fromMin, hh, mainNaps, Nap, nowHM, shiftDate, since, SleepDay, today, toMin } from './models';

@Component({
  selector: 'app-sleep',
  imports: [FormsModule, Mask, MealsCard],
  template: `
    <div class="datebar">
      <button class="icon" (click)="go(-1)">‹</button>
      <div>
        <b>{{ dateLabel() }}</b>
        @if (date() !== todayIso()) {
          <button class="link" (click)="date.set(todayIso())">hoje</button>
        }
      </div>
      <button class="icon" (click)="go(1)">›</button>
    </div>

    @if (!day()) {
      <div class="card center">
        <p class="big">☀️ Que horas {{ name() }} acordou?</p>
        <input mask="time" [(ngModel)]="wakeInput" class="time-xl" />
        <button class="btn primary block" (click)="start()">Começar o dia</button>
      </div>
    } @else {
      @let d = day()!;
      <div class="card">
        <div class="row between">
          <span>☀️ Acordou @if (store.quem(d.wakeBy); as q) { <small class="muted">· {{ q }}</small> }</span>
          <input mask="time" [ngModel]="d.wake" (ngModelChange)="$event && set(x => x.wake = $event)" />
        </div>
        <div class="chips">
          @for (w of d.windows; track $index) {
            <span class="chip" [class.on]="$index === cur()" [class.done]="$index < cur()">
              {{ $index + 1 }}· {{ dur(w) }}{{ $index === d.windows.length - 1 ? ' 🌙' : '' }}
            </span>
          }
        </div>
      </div>

      @if (tip(); as t) {
        <div class="card hint">
          💡 Para <b>{{ t.age }}</b>: janela {{ t.window }} · {{ t.naps }} sonecas · sono total {{ t.total }}
          @if (t.differs) {
            <button class="link" (click)="applyTip()">usar janelas sugeridas hoje</button>
          }
        </div>
      }

      <div class="card status" [class.sleeping]="sleeping()" [class.late]="!sleeping() && late() > 0">
        @if (d.night) {
          <p class="big">🌙 Sono noturno às {{ hh(d.night) }}</p>
          <p class="muted">Dia encerrado · sono diurno {{ dur(totalSleep()) }}@if (store.quem(d.nightBy); as q) { · {{ q }} }</p>
          <button class="btn" (click)="actions.undoNight(date())">Desfazer</button>
        } @else if (sleeping()) {
          <p class="big">😴 Dormindo desde {{ hh(lastNap()!.start) }}</p>
          @if (since(lastNap()!.start, now()) >= 0) { <p class="muted">há {{ dur(since(lastNap()!.start, now())) }}@if (store.quem(lastNap()!.by); as q) { · {{ q }} }</p> }
          <button class="btn primary block" (click)="wakeNow()">Acordou agora</button>
        } @else {
          <p class="muted">Próxima: {{ next().label }} · janela {{ dur(next().window) }}</p>
          <p class="huge">{{ hh(next().at) }}</p>
          <p class="muted">
            @if (late() > 0) { atrasado {{ dur(late()) }} } @else { em {{ dur(-late()) }} }
            @if (since(next().from, now()) >= 0) { · acordado há {{ dur(since(next().from, now())) }} }
          </p>
          @if (next().night) {
            <button class="btn primary block" (click)="nightNow()">🌙 Dormiu (noite)</button>
            <button class="btn ghost block" (click)="sleepNow()">Mais uma soneca</button>
          } @else {
            <button class="btn primary block" (click)="sleepNow()">😴 Dormiu agora</button>
            <button class="btn ghost block" (click)="nightNow()">🌙 Encerrar com sono noturno</button>
          }
        }
      </div>

      @if (!d.night) { <app-meals [compact]="true" [date]="date()" /> }

      <div class="card">
        <div class="row between">
          <b>Sonecas</b>
          <span class="muted">total {{ dur(totalSleep()) }}</span>
        </div>
        @for (n of d.naps; track $index; let i = $index) {
          <div class="nap">
            <button class="num" [disabled]="!i" title="Marcar/desmarcar como complementar" (click)="toggleExtra(i)">{{ n.extra ? '+' : winIdx(i) + 1 }}</button>
            <input mask="time" [ngModel]="n.start" (ngModelChange)="$event && set(x => x.naps[i].start = $event)" />
            <span>a</span>
            <input mask="time" [ngModel]="n.end" (ngModelChange)="set(x => x.naps[i].end = $event || undefined)" />
            <span class="dur">{{ n.end ? dur(diff(n.start, n.end)) : '…' }}</span>
            <button class="icon danger" (click)="removeNap(i)">×</button>
            <small class="muted full">
              @if (n.extra && i) { complementar da soneca {{ winIdx(i) + 1 }} · acordado {{ dur(awake(i)) }} }
              @else {
                acordado {{ dur(awake(i)) }} de {{ dur(winAt(winIdx(i))) }}
                @if (awake(i) - winAt(winIdx(i)); as dlt) { ({{ dlt > 0 ? '+' : '−' }}{{ dur(abs(dlt)) }}) }
              }
              @if (quemNap(n); as q) { · {{ q }} }
            </small>
          </div>
        } @empty {
          <p class="muted">Nenhuma soneca ainda.</p>
        }
        <div class="row gap">
          <button class="btn ghost" (click)="addNap()">+ Soneca manual</button>
          @if (lastNap()?.end) { <button class="btn ghost" (click)="addExtra()">+ Complementar</button> }
          @if (d.night) {
            <span class="muted">noite</span>
            <input mask="time" [ngModel]="d.night" (ngModelChange)="set(x => x.night = $event || undefined)" />
          }
        </div>
      </div>

      <div class="row gap">
        <button class="btn block" (click)="copy()">{{ copied() ? '✓ Copiado' : '📋 Copiar resumo' }}</button>
        <button class="btn ghost danger" (click)="removeDay()">Apagar dia</button>
      </div>
    }
  `,
})
export class SleepPage {
  readonly store = inject(Store);
  readonly actions = inject(Actions);
  readonly hh = hh;
  readonly dur = dur;
  readonly diff = diff;
  readonly since = since;
  readonly abs = Math.abs;

  todayIso = signal(today());
  date = signal(today());
  now = signal(nowHM());
  copied = signal(false);
  wakeInput = nowHM();

  name = computed(() => this.store.data().baby.name || 'o bebê');
  day = computed(() => this.store.data().days[this.date()]);
  dateLabel = computed(() => {
    const t = this.todayIso();
    const d = this.date();
    const label = d === t ? 'Hoje' : d === shiftDate(t, -1) ? 'Ontem' : '';
    return label ? `${label} · ${br(d, false)}` : br(d);
  });
  tip = computed(() => {
    const birth = this.store.data().baby.birth;
    if (!birth) return null;
    const t = sleepTip(Math.max(0, ageMonths(birth, this.date())));
    const differs = this.day()?.windows.join() !== t.windows.join();
    return { ...t, age: ageText(birth, this.date()), differs };
  });
  lastNap = computed(() => this.day()?.naps.at(-1));
  sleeping = computed(() => !!this.lastNap() && !this.lastNap()!.end && !this.day()!.night);
  cur = computed(() => {
    const d = this.day()!;
    return d.night ? d.windows.length : Math.min(mainNaps(d.naps).length - (this.sleeping() ? 1 : 0), d.windows.length - 1);
  });
  next = computed(() => {
    const d = this.day()!;
    const naps = mainNaps(d.naps);
    const n = naps.length;
    const from = n ? naps[n - 1].end ?? naps[n - 1].start : d.wake;
    const window = this.winAt(n);
    const night = n >= d.windows.length - 1;
    return { from, window, night, at: fromMin(toMin(from) + window), label: night ? 'sono noturno' : `soneca ${n + 1}` };
  });
  late = computed(() => since(this.next().from, this.now()) - this.next().window);
  totalSleep = computed(() =>
    (this.day()?.naps ?? []).reduce((s, n) => s + (n.end ? diff(n.start, n.end) : 0), 0),
  );

  constructor() {
    const t = setInterval(() => {
      this.now.set(nowHM());
      this.todayIso.set(today());
    }, 20000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  winAt(i: number) {
    const w = this.day()!.windows;
    return w[Math.min(i, w.length - 1)];
  }

  // janela a que a soneca i pertence (complementar conta na anterior)
  winIdx(i: number) {
    return mainNaps(this.day()!.naps.slice(0, i + 1)).length - 1;
  }

  awake(i: number) {
    const d = this.day()!;
    const from = i ? d.naps[i - 1].end ?? d.naps[i - 1].start : d.wake;
    return diff(from, d.naps[i].start);
  }

  /** Quem pôs para dormir / quem registrou o acordar */
  quemNap(n: Nap) {
    const a = this.store.quem(n.by);
    const b = this.store.quem(n.endBy);
    return !a || !b || a === b ? a || b : `${a} / ${b}`;
  }

  go(n: number) {
    this.date.set(shiftDate(this.date(), n));
  }

  set(fn: (d: SleepDay) => void) {
    this.store.mutate((data) => fn(data.days[this.date()]));
  }

  start() {
    this.actions.startDay(this.date(), this.wakeInput || nowHM());
  }

  applyTip() {
    const w = [...this.tip()!.windows];
    this.set((d) => (d.windows = w));
  }

  sleepNow() {
    this.actions.sleep(this.date());
  }

  wakeNow() {
    this.actions.wake(this.date());
  }

  nightNow() {
    this.actions.night(this.date());
  }

  addNap() {
    const at = this.next().at;
    this.set((d) => d.naps.push({ start: at, end: fromMin(toMin(at) + 30), by: this.store.uid() }));
  }

  addExtra() {
    const from = this.lastNap()!.end!;
    this.set((d) => d.naps.push({ start: from, end: fromMin(toMin(from) + 15), extra: true, by: this.store.uid() }));
  }

  toggleExtra(i: number) {
    this.set((d) => (d.naps[i].extra = !d.naps[i].extra || undefined));
  }

  removeNap(i: number) {
    if (confirm(`Remover soneca ${i + 1}?`)) this.set((d) => d.naps.splice(i, 1));
  }

  removeDay() {
    if (confirm('Apagar o registro de sono deste dia?')) this.store.mutate((d) => delete d.days[this.date()]);
  }

  copy() {
    const d = this.day()!;
    const last = d.windows.length - 1;
    const lines = [
      `${this.store.data().baby.name || 'Bebê'} ${br(this.date(), false)} acordou ${hh(d.wake)}`,
      '',
      'Janelas:',
      ...d.windows.map((w, i) => `${i + 1}- janela de ${dur(w)}${i === last ? ' (sono noturno)' : ''}`),
      '',
      ...d.naps.map((n, i) => `${n.extra && i ? '+' : this.winIdx(i) + 1}- ${hh(n.start)} a ${n.end ? `${hh(n.end)} (${dur(diff(n.start, n.end))})` : '...'}`),
    ];
    if (d.night) lines.push(`🌙 Sono noturno ${hh(d.night)}`);
    else if (!this.sleeping()) lines.push('', `Próxima: ${this.next().label} ~${hh(this.next().at)}`);
    lines.push(`Total diurno: ${dur(this.totalSleep())}`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }
}
