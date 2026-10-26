import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { Store } from './store';
import { ageText } from './models';
import { SleepPage } from './sleep';
import { FoodPage } from './food';
import { GrowthPage } from './growth';
import { TipsPage } from './tips-page';
import { ProfilePage } from './profile';
import { OverviewPage } from './overview';
import { ReportsPage } from './reports-page';
import { PATCH_NOTES, VERSION } from './version';
import { QuickActions } from './quick';
import { Backup } from './backup';
import { Notifier } from './notifier';
import { Pwa } from './pwa';

type Tab = 'overview' | 'sleep' | 'food' | 'growth' | 'reports' | 'tips' | 'profile' | 'notes';
type Theme = 'auto' | 'light' | 'dark';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const DEFAULT_TITLE = 'GCB - Gestão e Controle do Bebê';
const DEFAULT_MANIFEST = document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? '';

// título da aba, nome no iOS e manifest com o nome personalizado
const brand = (name: string, custom: boolean) => {
  document.title = custom ? name : DEFAULT_TITLE;
  document.querySelector('meta[name=apple-mobile-web-app-title]')?.setAttribute('content', name);
  try {
    localStorage.setItem('gcb:appName', custom ? name : '');
  } catch {}
  const link = document.querySelector('link[rel=manifest]');
  if (!link) return;
  if (!custom) return link.setAttribute('href', DEFAULT_MANIFEST);
  const abs = (u: string) => new URL(u, document.baseURI).href;
  fetch(DEFAULT_MANIFEST)
    .then((r) => r.json())
    .then((m) => {
      m.id = m.start_url = m.scope = abs('./');
      m.name = m.short_name = name;
      m.icons = m.icons.map((i: { src: string }) => ({ ...i, src: abs(i.src) }));
      link.setAttribute('href', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(m)));
    })
    .catch(() => {});
};

@Component({
  selector: 'app-root',
  imports: [QuickActions, OverviewPage, SleepPage, FoodPage, GrowthPage, ReportsPage, TipsPage, ProfilePage],
  template: `
    <header>
      <button class="icon menu-btn" aria-label="Menu" (click)="open.set(true)">☰</button>
      <img class="brand-mark" src="icon.svg" [alt]="store.appName()" (click)="go('overview')" />
      <b class="grow">{{ current().label }}</b>
      <span class="avatar sm" (click)="go('profile')">
        @if (baby().photo) { <img [src]="baby().photo" alt="" /> } @else { <span class="initial">{{ initial() }}</span> }
      </span>
    </header>

    <div class="backdrop" [class.show]="open()" (click)="open.set(false)"></div>

    <aside [class.open]="open()">
      <div class="brand">
        <img src="icon.svg" alt="" />
        <div><b>{{ store.appName() }}</b>@if (!store.data().appName) { <small>Gestão e Controle do Bebê</small> }</div>
      </div>

      <div class="side-head">
        <span class="avatar lg" (click)="go('profile')">
          @if (baby().photo) { <img [src]="baby().photo" alt="" /> } @else { <span class="initial">{{ initial() }}</span> }
        </span>
        <b>{{ baby().name || 'Seu bebê' }}</b>
        <small>{{ baby().birth ? age() : 'Cadastre o bebê' }}</small>
      </div>

      <div class="side-menu">
        @for (t of tabs; track t.id) {
          <button [class.on]="tab() === t.id" (click)="go(t.id)"><span>{{ t.icon }}</span>{{ t.label }}</button>
        }
      </div>

      @if (pwa.canInstall()) {
        <div class="side-menu"><button (click)="pwa.install()"><span>📲</span>Instalar app</button></div>
      }

      <div class="side-foot">
        <small class="muted">Tema</small>
        <div class="seg">
          <button [class.on]="theme() === 'light'" (click)="theme.set('light')">☀️ Claro</button>
          <button [class.on]="theme() === 'dark'" (click)="theme.set('dark')">🌙 Escuro</button>
          <button [class.on]="theme() === 'auto'" (click)="theme.set('auto')">Auto</button>
        </div>
        <button class="link version" (click)="go('notes')">{{ store.appName() }} {{ version }} · novidades</button>
      </div>
    </aside>

    <main>
      @switch (tab()) {
        @case ('overview') { <app-overview (go)="go($event)" /> }
        @case ('sleep') { <app-sleep /> }
        @case ('food') { <app-food /> }
        @case ('growth') { <app-growth /> }
        @case ('reports') { <app-reports /> }
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

    <app-quick />

    @if (pwa.updateReady()) {
      <div class="update-bar">✨ Nova versão disponível <button class="btn primary" (click)="pwa.update()">Atualizar</button></div>
    }

    <div class="toast" [class.show]="store.toast()" role="status">{{ store.toast() }}</div>
  `,
})
export class App {
  readonly store = inject(Store);
  readonly pwa = inject(Pwa);
  private services = [inject(Backup), inject(Notifier)];
  readonly tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: '🏠', label: 'Visão geral' },
    { id: 'sleep', icon: '😴', label: 'Sono' },
    { id: 'food', icon: '🥕', label: 'Alimentos' },
    { id: 'growth', icon: '📏', label: 'Medidas' },
    { id: 'reports', icon: '📊', label: 'Relatórios' },
    { id: 'tips', icon: '💡', label: 'Dicas' },
    { id: 'profile', icon: '👶', label: 'Bebê' },
  ];
  baby = computed(() => this.store.data().baby);
  age = computed(() => ageText(this.baby().birth));
  initial = computed(() => (this.baby().name.trim()[0] || '+').toUpperCase());
  tab = signal<Tab>(this.baby().name ? 'overview' : 'profile');
  current = computed(() => this.tabs.find((t) => t.id === this.tab()) ?? { icon: '📝', label: 'Novidades' });
  readonly version = VERSION;
  readonly notes = PATCH_NOTES;
  open = signal(false);
  theme = signal<Theme>((read('gcb:theme') as Theme) || 'auto');

  constructor() {
    effect(() => brand(this.store.appName(), !!this.store.data().appName));
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
