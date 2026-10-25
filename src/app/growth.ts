import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mask } from './mask';
import { Store } from './store';
import { ageMonths, ageText, br, Measure, today, uid, WHO_MEDIAN } from './models';

type Metric = 'weight' | 'height' | 'head';

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'weight', label: 'Peso', unit: 'kg' },
  { id: 'height', label: 'Altura', unit: 'cm' },
  { id: 'head', label: 'Cabeça', unit: 'cm' },
];

const W = 360, H = 220, L = 38, R = 10, T = 12, B = 26;

@Component({
  selector: 'app-growth',
  imports: [FormsModule, Mask],
  template: `
    <div class="card">
      <div class="grid3">
        <label>Peso (kg)<input mask="decimal" [decimals]="3" placeholder="0,000" [(ngModel)]="form.weight" /></label>
        <label>Altura (cm)<input mask="decimal" placeholder="00,0" [(ngModel)]="form.height" /></label>
        <label>Cabeça (cm)<input mask="decimal" placeholder="00,0" [(ngModel)]="form.head" /></label>
      </div>
      <div class="row gap">
        <input mask="date" class="grow" [(ngModel)]="form.date" />
        <button class="btn primary" (click)="save()">Salvar medida</button>
      </div>
    </div>

    <div class="seg">
      @for (m of metrics; track m.id) {
        <button [class.on]="metric() === m.id" (click)="metric.set(m.id)">{{ m.label }}</button>
      }
    </div>

    <div class="card">
      @if (chart(); as c) {
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="chart">
          @for (y of c.yTicks; track y.v) {
            <line [attr.x1]="L" [attr.x2]="W - R" [attr.y1]="y.y" [attr.y2]="y.y" class="grid" />
            <text [attr.x]="L - 5" [attr.y]="y.y + 3" text-anchor="end">{{ y.v }}</text>
          }
          @for (x of c.xTicks; track x.v) {
            <text [attr.x]="x.x" [attr.y]="H - 8" text-anchor="middle">{{ x.label }}</text>
          }
          @if (c.ref) { <polyline [attr.points]="c.ref" class="ref" /> }
          <polyline [attr.points]="c.line" class="line" />
          @for (p of c.points; track $index) {
            <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" class="pt"><title>{{ p.title }}</title></circle>
          }
        </svg>
        <div class="legend">
          <span><i class="sw line"></i>{{ baby().name || 'Bebê' }}</span>
          @if (c.ref) { <span><i class="sw ref"></i>Mediana OMS</span> }
          <span class="muted">eixo: {{ c.byAge ? 'idade (meses)' : 'data' }}</span>
        </div>
      } @else {
        <p class="muted center">Registre ao menos uma medida de {{ unitLabel().toLowerCase() }} para ver o gráfico.</p>
      }
    </div>

    @if (rows().length) {
      <div class="card list">
        <div class="trow head"><span>Data</span><span>Peso</span><span>Altura</span><span>Cabeça</span><span></span></div>
        @for (r of rows(); track r.id) {
          <div class="trow">
            <span>{{ br(r.date, false) }}<small class="muted">{{ r.age }}</small></span>
            <span>{{ fmt(r.weight) }}<small [class]="sign(r.dw)">{{ delta(r.dw) }}</small></span>
            <span>{{ fmt(r.height) }}<small [class]="sign(r.dh)">{{ delta(r.dh) }}</small></span>
            <span>{{ fmt(r.head) }}<small [class]="sign(r.dc)">{{ delta(r.dc) }}</small></span>
            <span>@if (r.id !== 'birth') { <button class="icon danger" (click)="remove(r.id)">×</button> }</span>
          </div>
        }
      </div>
    }
  `,
})
export class GrowthPage {
  private store = inject(Store);
  readonly metrics = METRICS;
  readonly br = br;
  readonly W = W;
  readonly H = H;
  readonly L = L;
  readonly R = R;

  form: Partial<Measure> = { date: today() };
  metric = signal<Metric>('weight');
  baby = computed(() => this.store.data().baby);
  unitLabel = computed(() => METRICS.find((m) => m.id === this.metric())!.label);

  // medidas ordenadas, incluindo a do nascimento do perfil
  all = computed(() => {
    const b = this.baby();
    const list = [...this.store.data().measures];
    if (b.birth && (b.birthWeight || b.birthHeight))
      list.push({ id: 'birth', date: b.birth, weight: b.birthWeight, height: b.birthHeight });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  });

  rows = computed(() => {
    const prev: Partial<Record<Metric, number>> = {};
    const birth = this.baby().birth;
    return this.all()
      .map((m) => {
        const d = (k: Metric) => (m[k] != null && prev[k] != null ? m[k]! - prev[k]! : undefined);
        const r = { ...m, age: birth ? ageText(birth, m.date) : '', dw: d('weight'), dh: d('height'), dc: d('head') };
        for (const k of ['weight', 'height', 'head'] as Metric[]) if (m[k] != null) prev[k] = m[k];
        return r;
      })
      .reverse();
  });

  chart = computed(() => {
    const k = this.metric();
    const b = this.baby();
    const byAge = !!b.birth;
    const pts = this.all().filter((m) => m[k] != null);
    if (!pts.length) return null;

    const first = pts[0].date;
    const xOf = (date: string) => (byAge ? ageMonths(b.birth, date) : ageMonths(first, date) * 30.4375);
    const data = pts.map((m) => ({ x: xOf(m.date), v: m[k]!, date: m.date }));

    let xMax = Math.max(...data.map((p) => p.x));
    let xMin = byAge ? 0 : Math.min(...data.map((p) => p.x));
    xMax = byAge ? Math.max(1, Math.ceil(xMax + 0.5)) : Math.max(xMax, xMin + 1);

    const table = b.sex ? WHO_MEDIAN[k][b.sex] : null;
    const ref = byAge && table ? table.map((v, i) => ({ x: i, v })).filter((p) => p.x <= Math.min(xMax, table.length - 1)) : [];

    const vals = [...data.map((p) => p.v), ...ref.map((p) => p.v)];
    let yMin = Math.min(...vals);
    let yMax = Math.max(...vals);
    const pad = Math.max((yMax - yMin) * 0.1, k === 'weight' ? 0.5 : 1);
    yMin -= pad;
    yMax += pad;

    const sx = (x: number) => L + ((x - xMin) / (xMax - xMin)) * (W - L - R);
    const sy = (v: number) => H - B - ((v - yMin) / (yMax - yMin)) * (H - B - T);
    const unit = METRICS.find((m) => m.id === k)!.unit;

    const xStep = Math.max(1, Math.ceil((xMax - xMin) / 8));
    const xTicks = [];
    for (let x = Math.ceil(xMin); x <= xMax; x += byAge ? xStep : Math.max(1, Math.ceil((xMax - xMin) / 5))) {
      const label = byAge ? `${x}m` : br(new Date(new Date(first + 'T12:00').getTime() + x * 86400000).toISOString().slice(0, 10), false);
      xTicks.push({ v: x, x: sx(x), label });
    }

    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * i) / 4;
      return { v: +v.toFixed(k === 'weight' ? 1 : 0), y: sy(v) };
    });

    return {
      byAge,
      xTicks,
      yTicks,
      line: data.map((p) => `${sx(p.x)},${sy(p.v)}`).join(' '),
      ref: ref.length > 1 ? ref.map((p) => `${sx(p.x)},${sy(p.v)}`).join(' ') : '',
      points: data.map((p) => ({ x: sx(p.x), y: sy(p.v), title: `${br(p.date)}: ${p.v} ${unit}` })),
    };
  });

  fmt(v?: number) {
    return v == null ? '–' : String(v).replace('.', ',');
  }

  delta(v?: number) {
    if (v == null) return '';
    return ` ${v >= 0 ? '+' : ''}${(+v.toFixed(2)).toString().replace('.', ',')}`;
  }

  sign(v?: number) {
    return v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : 'muted';
  }

  save() {
    const f = this.form;
    const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : +v);
    const m: Measure = { id: uid(), date: f.date || today(), weight: num(f.weight), height: num(f.height), head: num(f.head) };
    if (m.weight == null && m.height == null && m.head == null) return alert('Informe ao menos uma medida.');
    this.store.mutate((d) => d.measures.push(m));
    this.form = { date: today() };
  }

  remove(id: string) {
    if (confirm('Remover medida?')) this.store.mutate((d) => (d.measures = d.measures.filter((m) => m.id !== id)));
  }
}
