import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mask } from './mask';
import { MealsCard } from './meals';
import { Store } from './store';
import { ageMonths, br, Reaction, REACTIONS, today, uid } from './models';
import { isAllergen, untried } from './tips';

@Component({
  selector: 'app-food',
  imports: [FormsModule, Mask, MealsCard],
  template: `
    <app-meals />

    <div class="card">
      <div class="row gap">
        <input class="grow" placeholder="Alimento (ex.: banana)" list="foods" [(ngModel)]="food" (keyup.enter)="save()" />
        <input mask="date" [(ngModel)]="date" />
      </div>
      <datalist id="foods">
        @for (f of summary(); track f.name) { <option [value]="f.name"></option> }
      </datalist>
      @if (food && isAllergen(food)) {
        <p class="danger small">⚠ Alimento alergênico: ofereça de manhã, sozinho, e observe por 2 a 3 dias.</p>
      }
      @if (months() !== null && months()! < 6) {
        <p class="muted small">💡 Até 6 meses o indicado é só leite materno ou fórmula.</p>
      } @else if (suggest().length && !food) {
        <p class="sub">💡 Ainda não experimentou</p>
        <div class="chips">
          @for (s of suggest(); track s) {
            <button class="chip pick" (click)="food = s">{{ s }}</button>
          }
        </div>
      }
      <div class="reactions">
        @for (r of reactions; track r.id) {
          <button class="react" [class.on]="reaction === r.id" (click)="reaction = r.id">
            <span>{{ r.icon }}</span>{{ r.label }}
          </button>
        }
      </div>
      <input class="block" placeholder="Observação (opcional)" [(ngModel)]="notes" (keyup.enter)="save()" />
      <button class="btn primary block" [disabled]="!food.trim()" (click)="save()">Salvar</button>
    </div>

    <div class="seg">
      <button [class.on]="view() === 'hist'" (click)="view.set('hist')">Histórico</button>
      <button [class.on]="view() === 'food'" (click)="view.set('food')">Por alimento</button>
    </div>
    <input class="block" placeholder="🔎 Buscar" [ngModel]="q()" (ngModelChange)="q.set($event)" />

    @if (view() === 'hist') {
      @for (g of history(); track g.date) {
        <p class="group">{{ br(g.date) }}</p>
        <div class="card list">
          @for (e of g.items; track e.id) {
            <div class="row between item">
              <span>{{ icon(e.reaction) }} <b>{{ e.food }}</b> @if (e.notes) { <small class="muted">· {{ e.notes }}</small> }</span>
              <button class="icon danger" (click)="remove(e.id)">×</button>
            </div>
          }
        </div>
      } @empty {
        <p class="muted center">Nenhum alimento registrado.</p>
      }
    } @else {
      <div class="card list">
        @for (f of summaryFiltered(); track f.name) {
          <div class="row between item" [class.alert]="f.allergy">
            <span>{{ icon(f.last) }} <b>{{ f.name }}</b>
              @if (f.allergy) { <small class="danger">· teve reação</small> }
            </span>
            <small class="muted">{{ f.count }}x · {{ br(f.lastDate, false) }}</small>
          </div>
        } @empty {
          <p class="muted center">Nada por aqui.</p>
        }
      </div>
    }
  `,
})
export class FoodPage {
  private store = inject(Store);
  readonly reactions = REACTIONS;
  readonly br = br;

  food = '';
  date = today();
  reaction: Reaction = 'gostou';
  notes = '';
  view = signal<'hist' | 'food'>('hist');
  q = signal('');

  readonly isAllergen = isAllergen;
  months = computed(() => {
    const b = this.store.data().baby.birth;
    return b ? ageMonths(b, today()) : null;
  });
  suggest = computed(() => untried(this.store.data().foods.map((f) => f.food)).slice(0, 8));

  private match = (s: string) => s.toLowerCase().includes(this.q().trim().toLowerCase());

  history = computed(() => {
    const items = this.store
      .data()
      .foods.filter((f) => this.match(f.food + ' ' + f.notes))
      .sort((a, b) => b.date.localeCompare(a.date));
    const groups = new Map<string, typeof items>();
    for (const f of items) groups.set(f.date, [...(groups.get(f.date) ?? []), f]);
    return [...groups].map(([date, items]) => ({ date, items }));
  });

  summary = computed(() => {
    const map = new Map<string, { name: string; count: number; last: Reaction; lastDate: string; allergy: boolean }>();
    const sorted = [...this.store.data().foods].sort((a, b) => a.date.localeCompare(b.date));
    for (const f of sorted) {
      const k = f.food.toLowerCase();
      const cur = map.get(k);
      map.set(k, {
        name: f.food,
        count: (cur?.count ?? 0) + 1,
        last: f.reaction,
        lastDate: f.date,
        allergy: !!cur?.allergy || f.reaction === 'alergia',
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  summaryFiltered = computed(() => this.summary().filter((f) => this.match(f.name)));

  icon(r: Reaction) {
    return REACTIONS.find((x) => x.id === r)?.icon;
  }

  save() {
    const food = this.food.trim();
    if (!food) return;
    const e = { id: uid(), date: this.date || today(), food, reaction: this.reaction, notes: this.notes.trim() };
    this.store.mutate((d) => d.foods.push(e));
    this.food = '';
    this.notes = '';
    this.reaction = 'gostou';
  }

  remove(id: string) {
    if (confirm('Remover registro?')) this.store.mutate((d) => (d.foods = d.foods.filter((f) => f.id !== id)));
  }
}
