import { Component, computed, inject, output } from '@angular/core';
import { Store } from './store';
import { ageMonths, ageText, dur, today } from './models';
import { AVOID, CHECKUPS, FOODS_TO_TRY, foodPhase, isAllergen, MILESTONES, norm, sleepTip } from './tips';

@Component({
  selector: 'app-tips',
  template: `
    @if (months() === null) {
      <div class="card center">
        <p class="big">🎂 Cadastre a data de nascimento</p>
        <p class="muted">As sugestões são calculadas pela idade do bebê.</p>
        <button class="btn primary" (click)="goProfile.emit()">Ir para o cadastro</button>
      </div>
    } @else {
      <p class="muted center">Sugestões para <b>{{ age() }}</b></p>

      <div class="card">
        <h3>😴 Sono · {{ sleep().label }}</h3>
        <div class="kv"><span>Janela de vigília</span><b>{{ sleep().window }}</b></div>
        <div class="kv"><span>Sonecas por dia</span><b>{{ sleep().naps }}</b></div>
        <div class="kv"><span>Sono total (24h)</span><b>{{ sleep().total }}</b></div>
        <p class="muted small">Janelas sugeridas (a última é a do sono noturno):</p>
        <div class="chips">
          @for (w of sleep().windows; track $index) {
            <span class="chip">{{ $index + 1 }}· {{ dur(w) }}{{ $index === sleep().windows.length - 1 ? ' 🌙' : '' }}</span>
          }
        </div>
        @if (sameWindows()) {
          <p class="ok small">✓ As janelas atuais já seguem esta sugestão.</p>
        } @else {
          <p class="muted small">Atuais: {{ current() }}</p>
          <button class="btn block" (click)="applyWindows()">Usar janelas sugeridas</button>
        }
      </div>

      <div class="card">
        <h3>🥕 Alimentação · {{ food().title }}</h3>
        <ul>
          @for (t of food().tips; track t) { <li>{{ t }}</li> }
        </ul>
        @if (months()! >= 6) {
          <p class="muted small">Experimentados: {{ triedCount() }} de {{ total }}</p>
          <div class="progress"><i [style.width.%]="(triedCount() / total) * 100"></i></div>
          @for (g of groups(); track g.group) {
            <p class="sub">{{ g.group }}</p>
            <div class="chips">
              @for (f of g.items; track f.name) {
                <span class="chip" [class.done]="f.tried" [class.warn]="f.allergen && !f.tried">
                  {{ f.tried ? '✓ ' : '' }}{{ f.name }}
                </span>
              }
            </div>
          }
          <p class="muted small">⚠ alergênicos: oferecer de manhã, sozinhos, e observar.</p>
        }
        <p class="sub">Evitar</p>
        <ul class="avoid">
          @for (a of avoid; track a) { <li>{{ a }}</li> }
        </ul>
      </div>

      <div class="card">
        <h3>🧸 Desenvolvimento</h3>
        @for (m of milestones(); track m.at) {
          <p class="sub">{{ m.at <= months()! ? 'Esperado até' : 'Próximo:' }} {{ m.at }} meses</p>
          <ul>
            @for (i of m.items; track i) { <li>{{ i }}</li> }
          </ul>
        }
        @if (nextCheckup(); as c) {
          <p class="muted small">🩺 Próxima consulta de rotina sugerida: {{ c }}.</p>
        }
      </div>

      <p class="muted small center">Referências gerais (SBP, Ministério da Saúde, CDC). Cada bebê tem seu ritmo: siga sempre a orientação do pediatra.</p>
    }
  `,
})
export class TipsPage {
  private store = inject(Store);
  readonly goProfile = output();
  readonly dur = dur;
  readonly avoid = AVOID;
  readonly total = FOODS_TO_TRY.flatMap((g) => g.items).length;

  private baby = computed(() => this.store.data().baby);
  months = computed(() => (this.baby().birth ? Math.max(0, ageMonths(this.baby().birth, today())) : null));
  age = computed(() => ageText(this.baby().birth));
  sleep = computed(() => sleepTip(this.months()!));
  food = computed(() => foodPhase(this.months()!));
  current = computed(() => this.baby().windows.map(dur).join(' · '));
  sameWindows = computed(() => this.baby().windows.join() === this.sleep().windows.join());

  private tried = computed(() => new Set(this.store.data().foods.map((f) => norm(f.food))));
  groups = computed(() =>
    FOODS_TO_TRY.map((g) => ({
      group: g.group,
      items: g.items.map((name) => ({ name, tried: this.tried().has(norm(name)), allergen: isAllergen(name) })),
    })),
  );
  triedCount = computed(() => this.groups().reduce((s, g) => s + g.items.filter((i) => i.tried).length, 0));

  // marco atual (ou o último) e o próximo
  milestones = computed(() => {
    const m = this.months()!;
    const i = MILESTONES.findIndex((x) => x.at > m);
    return i === -1 ? MILESTONES.slice(-1) : MILESTONES.slice(Math.max(0, i - 1), i + 1);
  });

  nextCheckup = computed(() => {
    const c = CHECKUPS.find((x) => x > this.months()!);
    if (c === undefined) return '';
    return c < 1 ? '1ª semana' : c === 1 ? '1 mês' : `${c} meses`;
  });

  applyWindows() {
    const w = [...this.sleep().windows];
    this.store.mutate((d) => (d.baby.windows = w));
  }
}
