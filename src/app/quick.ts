import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from './store';
import { Actions } from './actions';
import { hh, Reaction, REACTIONS, today } from './models';
import { isAllergen, untried } from './tips';

/** Botão flutuante com os registros mais usados em um toque. */
@Component({
  selector: 'app-quick',
  imports: [FormsModule],
  template: `
    @if (open()) { <div class="sheet-backdrop" (click)="close()"></div> }

    @if (open()) {
      <div class="sheet" role="dialog" aria-label="Registro rápido">
        @if (mode() === 'menu') {
          <p class="sub">{{ status() }}</p>
          <div class="quick-grid">
            @switch (actions.state()) {
              @case ('noday') { <button class="qbtn primary" (click)="run(() => actions.startDay())">☀️<span>Acordou agora</span></button> }
              @case ('nap') { <button class="qbtn primary" (click)="run(() => actions.wake())">☀️<span>Acordou agora</span></button> }
              @case ('awake') {
                <button class="qbtn primary" (click)="run(() => actions.sleep())">😴<span>Dormiu agora</span></button>
                <button class="qbtn" (click)="run(() => actions.night())">🌙<span>Sono noturno</span></button>
              }
              @case ('night') { <button class="qbtn" (click)="run(() => actions.undoNight())">↺<span>Desfazer noite</span></button> }
            }
            <button class="qbtn" (click)="mode.set('food')">🥕<span>Comeu</span></button>
          </div>
        } @else {
          <p class="sub">🥕 O que comeu?</p>
          <input class="block" placeholder="Alimento" list="quick-foods" [(ngModel)]="food" />
          <datalist id="quick-foods">
            @for (f of known(); track f) { <option [value]="f"></option> }
          </datalist>
          @if (!food) {
            <div class="chips">
              @for (f of recent(); track f) { <button class="chip pick" (click)="food = f">{{ f }}</button> }
            </div>
          }
          @if (food && isAllergen(food)) { <p class="danger small">⚠ Alergênico: ofereça sozinho e observe.</p> }
          <div class="reactions">
            @for (r of reactions; track r.id) {
              <button class="react" [disabled]="!food.trim()" (click)="saveFood(r.id)"><span>{{ r.icon }}</span>{{ r.label }}</button>
            }
          </div>
          <button class="link" (click)="mode.set('menu')">‹ voltar</button>
        }
      </div>
    }

    <button class="fab no-print" [class.on]="open()" aria-label="Registro rápido" (click)="open() ? close() : open.set(true)">
      {{ open() ? '×' : '+' }}
    </button>
  `,
})
export class QuickActions {
  private store = inject(Store);
  readonly actions = inject(Actions);
  readonly reactions = REACTIONS;
  readonly isAllergen = isAllergen;

  open = signal(false);
  mode = signal<'menu' | 'food'>('menu');
  food = '';

  status = computed(() => {
    const d = this.store.data().days[today()];
    switch (this.actions.state()) {
      case 'noday': return 'Dia ainda não começou';
      case 'nap': return `Dormindo desde ${hh(d!.naps.at(-1)!.start)}`;
      case 'night': return `Sono noturno desde ${hh(d!.night)}`;
      default: return `Acordado · ${d!.naps.length} soneca(s) hoje`;
    }
  });

  known = computed(() => [...new Set(this.store.data().foods.map((f) => f.food))]);
  recent = computed(() => {
    const last = [...this.store.data().foods].sort((a, b) => b.date.localeCompare(a.date)).map((f) => f.food);
    return [...new Set(last)].slice(0, 5).concat(untried(last).slice(0, 3));
  });

  @HostListener('document:keydown.escape')
  close() {
    this.open.set(false);
    this.mode.set('menu');
    this.food = '';
  }

  run(fn: () => void) {
    fn();
    this.close();
  }

  saveFood(reaction: Reaction) {
    const food = this.food.trim();
    if (!food) return;
    this.actions.addFood({ date: today(), food, reaction, notes: '' });
    this.close();
  }
}
