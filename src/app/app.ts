import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { Store } from './store';
import { ageText } from './models';
import { SleepPage } from './sleep';
import { FoodPage } from './food';
import { GrowthPage } from './growth';
import { TipsPage } from './tips-page';
import { ProfilePage } from './profile';
import { PATCH_NOTES, VERSION } from './version';

type Tab = 'sleep' | 'food' | 'growth' | 'tips' | 'profile' | 'notes';
type Theme = 'auto' | 'light' | 'dark';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

@Component({
  selector: 'app-root',
  imports: [SleepPage, FoodPage, GrowthPage, TipsPage, ProfilePage],
  template: `
    <header>
      <button class="icon menu-btn" aria-label="Menu" (click)="open.set(true)">☰</button>
      <b class="grow">{{ current().icon }} {{ current().label }}</b>
      <span class="avatar sm" (click)="go('profile')">
        @if (baby().photo) { <img [src]="baby().photo" alt="" /> } @else { 👶 }
      </span>
    </header>

    <div class="backdrop" [class.show]="open()" (click)="open.set(false)"></div>

    <aside [class.open]="open()">
      <div class="side-head">
        <span class="avatar lg" (click)="go('profile')">
          @if (baby().photo) { <img [src]="baby().photo" alt="" /> } @else { 👶 }
        </span>
        <b>{{ baby().name || 'Seu bebê' }}</b>
        <small>{{ baby().birth ? age() : 'GCB · Gestão e Controle do Bebê' }}</small>
      </div>

      <div class="side-menu">
        @for (t of tabs; track t.id) {
          <button [class.on]="tab() === t.id" (click)="go(t.id)"><span>{{ t.icon }}</span>{{ t.label }}</button>
        }
      </div>

      <div class="side-foot">
        <small class="muted">Tema</small>
        <div class="seg">
          <button [class.on]="theme() === 'light'" (click)="theme.set('light')">☀️ Claro</button>
          <button [class.on]="theme() === 'dark'" (click)="theme.set('dark')">🌙 Escuro</button>
          <button [class.on]="theme() === 'auto'" (click)="theme.set('auto')">Auto</button>
        </div>
        <button class="link version" (click)="go('notes')">GCB {{ version }} · novidades</button>
      </div>
    </aside>

    <main>
      @switch (tab()) {
        @case ('sleep') { <app-sleep /> }
        @case ('food') { <app-food /> }
        @case ('growth') { <app-growth /> }
        @case ('tips') { <app-tips (goProfile)="go('profile')" /> }
        @case ('profile') { <app-profile /> }
        @case ('notes') {
          @for (n of notes; track n.version) {
            <div class="card">
              <h3>{{ n.version }} <small class="muted">· {{ n.date.split('-').reverse().join('/') }}</small></h3>
              <ul>
                @for (i of n.items; track i) { <li>{{ i }}</li> }
              </ul>
            </div>
          }
        }
      }
    </main>

    <div class="toast" [class.show]="store.toast()" role="status">{{ store.toast() }}</div>
  `,
})
export class App {
  readonly store = inject(Store);
  readonly tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'sleep', icon: '😴', label: 'Sono' },
    { id: 'food', icon: '🥕', label: 'Alimentos' },
    { id: 'growth', icon: '📏', label: 'Medidas' },
    { id: 'tips', icon: '💡', label: 'Dicas' },
    { id: 'profile', icon: '👶', label: 'Bebê' },
  ];
  baby = computed(() => this.store.data().baby);
  age = computed(() => ageText(this.baby().birth));
  tab = signal<Tab>(this.baby().name ? 'sleep' : 'profile');
  current = computed(() => this.tabs.find((t) => t.id === this.tab()) ?? { icon: '📝', label: 'Novidades' });
  readonly version = VERSION;
  readonly notes = PATCH_NOTES;
  open = signal(false);
  theme = signal<Theme>((read('gcb:theme') as Theme) || 'auto');

  constructor() {
    effect(() => {
      const t = this.theme();
      const root = document.documentElement;
      if (t === 'auto') root.removeAttribute('data-theme');
      else root.dataset['theme'] = t;
      try {
        localStorage.setItem('gcb:theme', t);
      } catch {}
      const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1f1e29' : '#ffffff');
    });
  }

  @HostListener('document:keydown.escape')
  close() {
    this.open.set(false);
  }

  go(t: Tab) {
    this.tab.set(t);
    this.open.set(false);
    scrollTo(0, 0);
  }
}
