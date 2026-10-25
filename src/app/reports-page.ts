import { Component, computed, inject, signal } from '@angular/core';
import { Store } from './store';
import { ageText, br, dur, fromMin, hh, REACTIONS } from './models';
import { DayStats, dayStats, downloadCsv, foodSummary, range, sleepSummary, windowAnalysis } from './reports';
import { DayAxis, DayBar } from './day-bar';

const W = 360, H = 170, L = 28, R = 6, T = 10, B = 22;

@Component({
  selector: 'app-reports',
  imports: [DayBar, DayAxis],
  template: `
    <div class="seg no-print">
      @for (p of periods; track p) {
        <button [class.on]="days() === p" (click)="days.set(p)">{{ p }} dias</button>
      }
    </div>
    <p class="muted center small">
      {{ name() }} · {{ br(dates()[0]) }} a {{ br(dates().at(-1)!) }}
      @if (age()) { · {{ age() }} }
    </p>

    <h2>😴 Sono</h2>
    @if (stats().length) {
      <div class="tiles">
        <div class="tile"><small>Diurno (média)</small><b>{{ d(sleep().napMin) }}</b><small>{{ n1(sleep().naps) }} sonecas/dia</small></div>
        <div class="tile"><small>Noite (média)</small><b>{{ d(sleep().nightMin) }}</b></div>
        <div class="tile"><small>Total 24h (média)</small><b>{{ d(sleep().totalMin) }}</b></div>
        <div class="tile"><small>Acorda / dorme</small><b>{{ t(sleep().wake) }} · {{ t(sleep().night) }}</b><small>média</small></div>
      </div>

      <div class="card">
        <div class="row between">
          <b>Horas de sono por dia</b>
          <small class="legend"><span><i class="sw sw-night"></i>Noite</span><span><i class="sw sw-nap"></i>Diurno</span></small>
        </div>
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="chart">
          @for (y of chart().yTicks; track y.v) {
            <line [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="y.y" [attr.y2]="y.y" class="grid" />
            <text [attr.x]="L - 4" [attr.y]="y.y + 3" text-anchor="end">{{ y.v }}h</text>
          }
          @for (b of chart().bars; track b.date) {
            @if (b.night) { <rect [attr.x]="b.x" [attr.y]="b.night.y" [attr.width]="b.w" [attr.height]="b.night.h" rx="2" class="bar-night" /> }
            @if (b.nap) { <rect [attr.x]="b.x" [attr.y]="b.nap.y" [attr.width]="b.w" [attr.height]="b.nap.h" rx="2" class="bar-nap" /> }
            <rect [attr.x]="b.x - 2" [attr.y]="T" [attr.width]="b.w + 4" [attr.height]="H - B - T" class="hit"><title>{{ b.title }}</title></rect>
            @if (b.label) { <text [attr.x]="b.x + b.w / 2" [attr.y]="H - 6" text-anchor="middle">{{ b.label }}</text> }
          }
        </svg>
      </div>

      <div class="card">
        <div class="row between">
          <b>Diário do sono</b>
          <small class="legend"><span><i class="sw sw-nap"></i>Soneca</span><span><i class="sw sw-night"></i>Noite</span></small>
        </div>
        @for (s of statsDesc(); track s.date) {
          <div class="diary-row"><small>{{ br(s.date, false) }}</small><app-day-bar [date]="s.date" /></div>
        }
        <div class="diary-row"><small></small><app-day-axis /></div>
      </div>

      <div class="card">
        <div class="row between">
          <b>Janelas: planejado x real</b>
          @if (suggestions().length > 1) { <button class="link no-print" (click)="applyAll()">aplicar todas</button> }
        </div>
        <div class="wtable head"><span>Janela</span><span>Plano</span><span>Real</span><span>Soneca</span></div>
        @for (w of windows(); track w.slot) {
          <div class="wtable">
            <span>{{ w.slot }}{{ w.night ? ' 🌙' : '' }}</span>
            <span>{{ dur(w.plan) }}</span>
            <span [class.up]="w.real !== null && w.real > w.plan + 14" [class.down]="w.real !== null && w.real < w.plan - 14">
              {{ w.real !== null ? dur(w.real) : '–' }}<small class="muted"> ({{ w.samples }}d)</small>
            </span>
            <span>{{ w.napAfter !== null ? dur(w.napAfter) : w.night ? 'noite' : '–' }}</span>
          </div>
          @if (w.note) {
            <div class="wnote">
              <small>{{ w.note }}</small>
              @if (w.suggest) {
                <button class="chip pick no-print" (click)="apply(w.slot - 1, w.suggest)">usar {{ dur(w.suggest) }}</button>
              }
            </div>
          }
        }
        <p class="muted small">ⓘ Real = média do tempo acordado antes de cada soneca no período. Sugestões só com 3 dias ou mais.</p>
      </div>

      <div class="card list">
        <div class="rtable head"><span>Dia</span><span>Acordou</span><span>Sonecas</span><span>Diurno</span><span>Noite</span></div>
        @for (s of statsDesc(); track s.date) {
          <div class="rtable">
            <span>{{ br(s.date, false) }}</span>
            <span>{{ hh(s.wake) }}</span>
            <span>{{ s.naps }}</span>
            <span>{{ dur(s.napMin) }}</span>
            <span>{{ s.nightMin !== null ? dur(s.nightMin) : '–' }}</span>
          </div>
        }
      </div>
    } @else {
      <p class="muted center">Sem registros de sono no período.</p>
    }

    <h2>🥕 Alimentação</h2>
    <div class="tiles">
      <div class="tile"><small>Registros</small><b>{{ food().total }}</b></div>
      <div class="tile"><small>Alimentos diferentes</small><b>{{ food().distinct.length }}</b></div>
      <div class="tile"><small>Novos no período</small><b>{{ food().fresh.length }}</b></div>
      <div class="tile"><small>Com reação</small><b [class.danger]="food().alerts.length">{{ food().alerts.length }}</b></div>
    </div>

    @if (food().total) {
      <div class="card">
        <b>Reações</b>
        @for (r of reactionBars(); track r.id) {
          <div class="hbar" [title]="r.label + ': ' + r.count">
            <span>{{ r.icon }} {{ r.label }}</span>
            <div><i [class]="'r-' + r.id" [style.width.%]="r.pct"></i></div>
            <b>{{ r.count }}</b>
          </div>
        }
      </div>

      @if (food().fresh.length) {
        <div class="card">
          <b>Novos alimentos</b>
          <div class="chips">@for (f of food().fresh; track f) { <span class="chip">{{ f }}</span> }</div>
        </div>
      }
      @if (food().refused.length) {
        <div class="card">
          <b>😖 Recusados</b>
          <div class="chips">@for (f of food().refused; track f) { <span class="chip">{{ f }}</span> }</div>
        </div>
      }
      @if (food().alerts.length) {
        <div class="card list">
          <p class="sub">⚠️ Reações</p>
          @for (a of food().alerts; track a.id) {
            <div class="row between item"><span><b>{{ a.food }}</b> @if (a.notes) { <small class="muted">· {{ a.notes }}</small> }</span><small>{{ br(a.date, false) }}</small></div>
          }
        </div>
      }
    }

    <div class="row gap no-print">
      <span class="muted small">Planilha (CSV):</span>
      <button class="btn ghost" (click)="csvSleep()">😴 Sono</button>
      <button class="btn ghost" (click)="csvFood()">🥕 Alimentação</button>
      <button class="btn ghost" (click)="csvMeasures()">📏 Medidas</button>
    </div>

    <div class="row gap no-print">
      <button class="btn grow" (click)="copy()">{{ copied() ? '✓ Copiado' : '📋 Copiar resumo' }}</button>
      <button class="btn grow" (click)="print()">🖨 Imprimir / PDF</button>
    </div>
  `,
})
export class ReportsPage {
  private store = inject(Store);
  readonly periods = [7, 14, 30];
  readonly br = br;
  readonly hh = hh;
  readonly dur = dur;
  readonly W = W;
  readonly H = H;
  readonly L = L;
  readonly R = R;
  readonly T = T;
  readonly B = B;

  days = signal(7);
  copied = signal(false);

  private data = computed(() => this.store.data());
  name = computed(() => this.data().baby.name || 'Bebê');
  age = computed(() => (this.data().baby.birth ? ageText(this.data().baby.birth) : ''));
  dates = computed(() => range(this.days()));
  stats = computed(() => this.dates().map((d) => dayStats(this.data(), d)).filter((s): s is DayStats => !!s));
  statsDesc = computed(() => [...this.stats()].reverse());
  sleep = computed(() => sleepSummary(this.stats()));
  food = computed(() => foodSummary(this.data(), this.dates()[0], this.dates().at(-1)!));

  windows = computed(() => windowAnalysis(this.data(), this.dates()));
  suggestions = computed(() => this.windows().filter((w) => w.suggest));

  reactionBars = computed(() => {
    const r = this.food().reactions;
    const max = Math.max(1, ...Object.values(r));
    return REACTIONS.map((x) => ({ ...x, count: r[x.id], pct: (r[x.id] / max) * 100 }));
  });

  chart = computed(() => {
    const dates = this.dates();
    const byDate = new Map(this.stats().map((s) => [s.date, s]));
    const max = Math.max(16, ...this.stats().map((s) => (s.napMin + (s.nightMin ?? 0)) / 60));
    const top = Math.ceil(max / 4) * 4;
    const sy = (h: number) => H - B - (h / top) * (H - B - T);
    const band = (W - L - R) / dates.length;
    const w = Math.max(3, band * 0.62);
    const every = Math.ceil(dates.length / 7);
    const bars = dates.map((date, i) => {
      const s = byDate.get(date);
      const x = L + i * band + (band - w) / 2;
      const nightH = (s?.nightMin ?? 0) / 60;
      const napH = (s?.napMin ?? 0) / 60;
      const gap = nightH && napH ? 2 : 0;
      return {
        date,
        x,
        w,
        label: (dates.length - 1 - i) % every === 0 ? br(date, false).slice(0, 2) : '',
        night: nightH ? { y: sy(nightH), h: sy(0) - sy(nightH) } : null,
        nap: napH ? { y: sy(nightH + napH), h: sy(nightH) - sy(nightH + napH) - gap } : null,
        title: s
          ? `${br(date, false)} · noite ${s.nightMin !== null ? dur(s.nightMin) : '–'} · diurno ${dur(s.napMin)}`
          : `${br(date, false)} · sem registro`,
      };
    });
    const yTicks = Array.from({ length: top / 4 + 1 }, (_, i) => ({ v: i * 4, y: sy(i * 4) }));
    return { bars, yTicks };
  });

  d(v: number | null) {
    return v === null ? '–' : dur(v);
  }

  t(v: number | null) {
    return v === null ? '–' : hh(fromMin(v));
  }

  n1(v: number | null) {
    return v === null ? '–' : v.toFixed(1).replace('.', ',');
  }

  copy() {
    const s = this.sleep();
    const f = this.food();
    const lines = [
      `${this.name()} · relatório de ${br(this.dates()[0])} a ${br(this.dates().at(-1)!)}`,
      '',
      'SONO (médias)',
      `Diurno: ${this.d(s.napMin)} (${this.n1(s.naps)} sonecas/dia)`,
      `Noite: ${this.d(s.nightMin)}`,
      `Total 24h: ${this.d(s.totalMin)}`,
      `Acorda ${this.t(s.wake)} · dorme ${this.t(s.night)}`,
      '',
      'ALIMENTAÇÃO',
      `${f.total} registros · ${f.distinct.length} alimentos diferentes · ${f.fresh.length} novos`,
      ...(f.fresh.length ? [`Novos: ${f.fresh.join(', ')}`] : []),
      ...(f.refused.length ? [`Recusados: ${f.refused.join(', ')}`] : []),
      ...f.alerts.map((a) => `⚠️ Reação: ${a.food} em ${br(a.date, false)}${a.notes ? ` (${a.notes})` : ''}`),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  apply(i: number, min: number) {
    this.store.mutate((d) => (d.baby.windows[i] = min), `✓ Janela ${i + 1} ajustada para ${dur(min)}`);
  }

  applyAll() {
    const s = this.suggestions();
    this.store.mutate((d) => s.forEach((w) => (d.baby.windows[w.slot - 1] = w.suggest!)), '✓ Janelas ajustadas');
  }

  private file(kind: string) {
    return `gcb-${kind}-${this.dates()[0]}_${this.dates().at(-1)}.csv`;
  }

  csvSleep() {
    const rows = this.stats().map((s) => {
      const day = this.data().days[s.date];
      return [br(s.date), s.wake, s.naps, day.naps.map((n) => `${n.start}-${n.end ?? ''}`).join(' | '), s.napMin, s.night ?? '', s.nightMin ?? '', s.nightMin !== null ? s.napMin + s.nightMin : ''];
    });
    downloadCsv(this.file('sono'), ['Data', 'Acordou', 'Sonecas', 'Horários das sonecas', 'Sono diurno (min)', 'Dormiu à noite', 'Sono noturno (min)', 'Total 24h (min)'], rows);
  }

  csvFood() {
    const [from, to] = [this.dates()[0], this.dates().at(-1)!];
    const label = (r: string) => REACTIONS.find((x) => x.id === r)?.label ?? r;
    const rows = this.data()
      .foods.filter((f) => f.date >= from && f.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((f) => [br(f.date), f.food, label(f.reaction), f.notes]);
    downloadCsv(this.file('alimentacao'), ['Data', 'Alimento', 'Reação', 'Observação'], rows);
  }

  csvMeasures() {
    const rows = [...this.data().measures]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => [br(m.date), m.weight ?? '', m.height ?? '', m.head ?? '']);
    downloadCsv(`gcb-medidas-${this.dates().at(-1)}.csv`, ['Data', 'Peso (kg)', 'Altura (cm)', 'Cabeça (cm)'], rows);
  }

  print() {
    window.print();
  }
}
