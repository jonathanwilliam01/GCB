import { Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { Store } from './store';
import { ageMonths, br, dur, fromMin, hh, nowHM, REACTIONS, shiftDate, today, toMin } from './models';
import { awakeWindows, dayMeals } from './schedule';
import { dayStats } from './reports';
import { sleepTip } from './tips';
import { DayAxis, DayBar } from './day-bar';
import { MealsCard } from './meals';

type Go = 'sleep' | 'food' | 'growth' | 'tips' | 'profile';

@Component({
  selector: 'app-overview',
  imports: [DayBar, DayAxis, MealsCard],
  template: `
    <p class="muted greet">{{ greeting() }} · {{ br(date, false) }}</p>

    @if (!day()) {
      <div class="card center">
        <p class="big">☀️ O dia ainda não começou</p>
        <p class="muted">Registre a hora em que {{ name() }} acordou.</p>
        <button class="btn primary" (click)="go.emit('sleep')">Registrar</button>
      </div>
    } @else {
      <div class="card status" [class.sleeping]="status().sleeping" (click)="go.emit('sleep')">
        <p class="big">{{ status().title }}</p>
        <p class="muted">{{ status().sub }}</p>
      </div>

      <div class="tiles">
        <div class="tile"><small>Acordou</small><b>{{ hh(day()!.wake) }}</b></div>
        <div class="tile"><small>Sono diurno</small><b>{{ dur(stats()!.napMin) }}</b><small>{{ stats()!.naps }} soneca(s)</small></div>
        <div class="tile"><small>Noite passada</small><b>{{ lastNight() !== null ? dur(lastNight()!) : '–' }}</b>
          @if (tip()) { <small>ideal 24h: {{ tip()!.total }}</small> }
        </div>
        <div class="tile" (click)="go.emit('food')"><small>Refeições</small><b>{{ mealsDone() }}/{{ meals().length }}</b><small>previstas até agora</small></div>
      </div>

      <div class="card">
        <b>Linha do dia</b>
        <app-day-bar [date]="date" [marks]="mealMarks()" [tall]="true" />
        <app-day-axis />
        <div class="legend below">
          <span><i class="sw sw-nap"></i>Soneca</span><span><i class="sw sw-night"></i>Noite</span><span><i class="sw sw-meal"></i>Refeição</span>
        </div>
      </div>

      <app-meals [compact]="true" />
    }

    <div class="card" (click)="go.emit('food')">
      <div class="row between"><b>🥕 Alimentos hoje</b><small class="muted">{{ foods().length }}</small></div>
      @for (f of foods(); track f.id) {
        <div class="row between item"><span>{{ icon(f.reaction) }} {{ f.food }}</span><small class="muted">{{ f.notes }}</small></div>
      } @empty {
        <p class="muted small">Nenhum registro hoje.</p>
      }
    </div>

    <div class="card" (click)="go.emit('growth')">
      <div class="row between"><b>📏 Última medida</b><small class="muted">{{ lastMeasure() ? br(lastMeasure()!.date) : '' }}</small></div>
      @if (lastMeasure(); as m) {
        <p class="measures">
          @if (m.weight) { <span><b>{{ num(m.weight) }}</b> kg</span> }
          @if (m.height) { <span><b>{{ num(m.height) }}</b> cm</span> }
          @if (m.head) { <span><b>{{ num(m.head) }}</b> cm cabeça</span> }
        </p>
      } @else {
        <p class="muted small">Nenhuma medida registrada.</p>
      }
    </div>

    @if (alerts().length) {
      <div class="card">
        <b>🔔 Atenção</b>
        @for (a of alerts(); track a.text) {
          <div class="alert-row" (click)="go.emit(a.go)">{{ a.text }}</div>
        }
      </div>
    }
  `,
})
export class OverviewPage {
  private store = inject(Store);
  readonly go = output<Go>();
  readonly br = br;
  readonly hh = hh;
  readonly dur = dur;
  readonly date = today();
  now = signal(nowHM());

  private data = computed(() => this.store.data());
  name = computed(() => this.data().baby.name || 'o bebê');
  day = computed(() => this.data().days[this.date]);
  stats = computed(() => dayStats(this.data(), this.date));
  lastNight = computed(() => dayStats(this.data(), shiftDate(this.date, -1))?.nightMin ?? null);
  tip = computed(() => (this.data().baby.birth ? sleepTip(ageMonths(this.data().baby.birth, this.date)) : null));
  meals = computed(() => dayMeals(this.data(), this.date) ?? []);
  mealsDone = computed(() => this.meals().filter((m) => m.at <= this.nowMin()).length);
  mealMarks = computed(() =>
    this.meals().map((m) => ({ at: (((m.at % 1440) - 300 + 1440) % 1440), title: `${m.name} ${m.pred ? '≈ ' : ''}${hh(fromMin(m.at))}` })),
  );
  foods = computed(() => this.data().foods.filter((f) => f.date === this.date));
  lastMeasure = computed(() => [...this.data().measures].sort((a, b) => b.date.localeCompare(a.date))[0]);

  private nowMin = computed(() => {
    const n = toMin(this.now());
    return n < toMin(this.day()?.wake ?? '00:00') - 120 ? n + 1440 : n;
  });

  greeting = computed(() => {
    const h = +this.now().slice(0, 2);
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  });

  status = computed(() => {
    const d = this.day()!;
    const last = d.naps.at(-1);
    const since = (t: string) => dur(Math.max(0, this.nowMin() - toMin(t)));
    if (d.night) return { sleeping: true, title: `🌙 Sono noturno desde ${hh(d.night)}`, sub: `Sono diurno total ${dur(this.stats()!.napMin)}` };
    if (last && !last.end) return { sleeping: true, title: `😴 Dormindo há ${since(last.start)}`, sub: `Soneca ${d.naps.length} desde ${hh(last.start)}` };
    const wins = awakeWindows(this.data(), this.date, d);
    const idx = d.naps.length;
    const next = wins[idx];
    const night = idx >= d.windows.length - 1;
    const left = Math.round(next.end - this.nowMin());
    return {
      sleeping: false,
      title: `☀️ Acordado há ${since(fromMin(next.start))}`,
      sub: `${night ? 'Sono noturno' : `Soneca ${idx + 1}`} às ${hh(fromMin(next.end))} · ${left >= 0 ? `em ${dur(left)}` : `atrasado ${dur(-left)}`}`,
    };
  });

  alerts = computed(() => {
    const out: { text: string; go: Go }[] = [];
    const d = this.data();
    const recent = shiftDate(this.date, -3);
    for (const f of d.foods.filter((f) => f.reaction === 'alergia' && f.date >= recent))
      out.push({ text: `⚠️ ${f.food} teve reação em ${br(f.date, false)}`, go: 'food' });
    const lm = this.lastMeasure();
    const age = (iso: string) => Math.round((Date.parse(this.date) - Date.parse(iso)) / 86400000);
    if (!lm) out.push({ text: '📏 Registre a primeira medida', go: 'growth' });
    else if (age(lm.date) > 30) out.push({ text: `📏 Última medida há ${age(lm.date)} dias`, go: 'growth' });
    const t = this.tip();
    if (t && d.baby.windows.join() !== t.windows.join())
      out.push({ text: '💡 Há janelas de vigília sugeridas para a idade atual', go: 'tips' });
    if (!d.baby.birth) out.push({ text: '🎂 Cadastre a data de nascimento para ver sugestões', go: 'profile' });
    const backup = this.store.lastBackup();
    if (!backup || age(backup) > 7)
      out.push({ text: backup ? `💾 Último backup há ${age(backup)} dias` : '💾 Faça um backup dos dados', go: 'profile' });
    return out;
  });

  constructor() {
    const t = setInterval(() => this.now.set(nowHM()), 20000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  icon(r: string) {
    return REACTIONS.find((x) => x.id === r)?.icon;
  }

  num(v: number) {
    return String(v).replace('.', ',');
  }
}
