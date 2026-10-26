import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mask } from './mask';
import { Store } from './store';
import { Backup } from './backup';
import { Notifier } from './notifier';
import { Pwa } from './pwa';
import { PhotoCrop } from './photo-crop';
import { Baby, Crop } from './models';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, Mask, PhotoCrop],
  template: `
    <div class="card center">
      @if (b.photo) {
        <span class="avatar xl" title="Ver foto" (click)="view.set(true)"><img [src]="b.photo" alt="" /></span>
        <div class="row center-row">
          <label class="link">trocar<input type="file" accept="image/*" hidden (change)="photo($event)" /></label>
          <button class="link" (click)="crop.set(b.photoFull || b.photo)">ajustar</button>
          <button class="link danger" (click)="removePhoto()">remover</button>
        </div>
      } @else {
        <label class="avatar xl">
          <span>📷</span>
          <input type="file" accept="image/*" hidden (change)="photo($event)" />
        </label>
      }
    </div>

    @if (crop(); as src) {
      <app-photo-crop [src]="src" [crop]="src === b.photoFull ? b.photoCrop : undefined" (save)="cropped(src, $event)" (cancel)="crop.set('')" />
    }

    @if (view()) {
      <div class="viewer" (click)="view.set(false)">
        <img [src]="b.photoFull || b.photo" alt="" />
        <button class="icon" aria-label="Fechar">×</button>
      </div>
    }

    <div class="card form">
      <label>Nome do app<input [(ngModel)]="appName" placeholder="GCB" maxlength="30" (change)="saveName()" /></label>
      <p class="muted small">Aparece no cabeçalho, no menu e no título do app. Vazio volta para GCB.</p>
    </div>

    <div class="card form">
      <label>Nome<input [(ngModel)]="b.name" (change)="save()" /></label>
      <div class="grid2">
        <label>Nascimento<input mask="date" [(ngModel)]="b.birth" (change)="save()" /></label>
        <label>Sexo
          <select [(ngModel)]="b.sex" (change)="save()">
            <option value="">–</option><option value="F">Menina</option><option value="M">Menino</option>
          </select>
        </label>
        <label>Peso ao nascer (kg)<input mask="decimal" [decimals]="3" placeholder="0,000" [(ngModel)]="b.birthWeight" (change)="save()" /></label>
        <label>Altura ao nascer (cm)<input mask="decimal" placeholder="00,0" [(ngModel)]="b.birthHeight" (change)="save()" /></label>
        <label>Tipo sanguíneo
          <select [(ngModel)]="b.blood" (change)="save()">
            <option value="">–</option>
            @for (t of bloodTypes; track t) { <option [value]="t">{{ t }}</option> }
          </select>
        </label>
      </div>
      <label>Observações (alergias, pediatra, remédios...)<textarea rows="3" [(ngModel)]="b.notes" (change)="save()"></textarea></label>
    </div>

    <div class="card">
      <b>Janelas de vigília padrão</b>
      <p class="muted">Usadas ao começar um novo dia. A última é a do sono noturno.</p>
      <div class="chips">
        @for (w of b.windows; track $index; let i = $index) {
          <span class="chip edit">
            {{ i + 1 }}·
            <input mask="dur" [ngModel]="w" [ngModelOptions]="{ updateOn: 'blur' }" (ngModelChange)="setWindow(i, $event)" />
            @if (b.windows.length > 1) { <button class="icon" (click)="b.windows.splice(i, 1); save()">×</button> }
          </span>
        }
        <button class="chip add" (click)="b.windows.push(b.windows.at(-1) ?? 150); save()">+</button>
      </div>
    </div>

    <div class="card">
      <b>🔔 Lembretes</b>
      @if (notifier.permission() === 'unsupported') {
        <p class="muted small">Este navegador não suporta notificações. Os avisos aparecem dentro do app.</p>
      }
      <label class="switch"><input type="checkbox" [checked]="notifier.settings().on" (change)="notifier.update({ on: $any($event.target).checked })" /> Avisar hora de dormir e de comer</label>
      @if (notifier.settings().on) {
        <div class="row gap">
          <span class="muted small">Avisar antes da soneca:</span>
          <select [ngModel]="notifier.settings().before" (ngModelChange)="notifier.update({ before: +$event })">
            @for (m of [5, 10, 15, 20, 30]; track m) { <option [ngValue]="m">{{ m }} min</option> }
          </select>
        </div>
        <label class="switch"><input type="checkbox" [checked]="notifier.settings().meals" (change)="notifier.update({ meals: $any($event.target).checked })" /> Avisar horários de refeição</label>
        @if (notifier.permission() === 'denied') {
          <p class="danger small">Notificações bloqueadas no navegador. Libere nas configurações do site.</p>
        }
        <button class="btn ghost" (click)="notifier.test()">Testar aviso</button>
        <p class="muted small">ⓘ Os avisos funcionam com o app aberto ou em segundo plano. Com o app fechado o sistema pode não avisar.</p>
      }
    </div>

    @if (!pwa.standalone) {
      <div class="card">
        <b>📲 Instalar o app</b>
        @if (pwa.canInstall()) {
          <p class="muted small">Abre em tela cheia, funciona sem internet e fica na tela inicial.</p>
          <button class="btn primary block" (click)="pwa.install()">Instalar {{ store.appName() }}</button>
        } @else if (pwa.ios) {
          <p class="muted small">No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
        } @else {
          <p class="muted small">No menu do navegador, escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>
        }
      </div>
    }

    <div class="card">
      <b>💾 Backup dos dados</b>
      <p class="muted small">
        Os dados ficam só neste aparelho.
        @if (store.lastBackup()) { Último backup: {{ store.lastBackup().split('-').reverse().join('/') }}. } @else { Nenhum backup feito ainda. }
      </p>
      <div class="row gap">
        <button class="btn primary grow" (click)="store.exportJson()">⬇️ Exportar</button>
        @if (backup.canShare) {
          <button class="btn grow" (click)="backup.share()" title="Enviar para Google Drive, WhatsApp, e-mail...">📤 Compartilhar</button>
        }
        <label class="btn grow">⬆️ Importar
          <input type="file" accept="application/json,.json" hidden (change)="importFile($event)" />
        </label>
      </div>

      @if (backup.canFile) {
        <p class="sub">Backup automático em arquivo</p>
        @switch (backup.fileState()) {
          @case ('ok') {
            <p class="ok small">✓ Salvando em <b>{{ backup.fileName() }}</b> a cada alteração.</p>
            <button class="link danger" (click)="backup.stopFile()">desligar</button>
          }
          @case ('prompt') {
            <p class="muted small">Arquivo <b>{{ backup.fileName() }}</b> precisa de permissão de novo.</p>
            <button class="btn" (click)="backup.reconnect()">Reconectar</button>
          }
          @default {
            <p class="muted small">Escolha um arquivo (ex.: dentro da pasta do Google Drive no PC) e o {{ store.appName() }} salva nele sozinho.</p>
            <button class="btn" (click)="backup.chooseFile()">Escolher arquivo</button>
          }
        }
      }

      <p class="sub">Cópias automáticas neste aparelho</p>
      @for (d of backup.snapshots(); track d) {
        <div class="row between item">
          <span>{{ d.split('-').reverse().join('/') }}</span>
          <button class="link" (click)="restore(d)">restaurar</button>
        </div>
      } @empty {
        <p class="muted small">A primeira cópia é criada na próxima alteração.</p>
      }
      <p class="muted small">ⓘ Uma cópia por dia, guardando os últimos 7 dias.</p>

      <button class="link danger" (click)="store.clear(); reload()">apagar todos os dados</button>
    </div>
  `,
})
export class ProfilePage {
  readonly store = inject(Store);
  readonly backup = inject(Backup);
  readonly notifier = inject(Notifier);
  readonly pwa = inject(Pwa);
  readonly bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  b: Baby = structuredClone(this.store.data().baby);
  appName = this.store.data().appName ?? '';
  readonly crop = signal('');
  readonly view = signal(false);

  @HostListener('document:keydown.escape')
  close() {
    this.view.set(false);
    this.crop.set('');
  }

  save() {
    const baby = structuredClone(this.b);
    this.store.mutate((d) => (d.baby = baby));
  }

  async restore(date: string) {
    await this.backup.restore(date);
    this.reload();
  }

  reload() {
    this.b = structuredClone(this.store.data().baby);
    this.appName = this.store.data().appName ?? '';
  }

  saveName() {
    const name = this.appName.trim();
    this.store.mutate((d) => (d.appName = name));
  }

  removePhoto() {
    if (!confirm('Remover a foto?')) return;
    this.b.photo = '';
    delete this.b.photoFull;
    delete this.b.photoCrop;
    this.save();
  }

  cropped(src: string, e: { photo: string; crop: Crop }) {
    this.b.photo = e.photo;
    this.b.photoFull = src;
    this.b.photoCrop = e.crop;
    this.crop.set('');
    this.save();
  }

  setWindow(i: number, v: number | null) {
    if (v && v > 0) {
      this.b.windows[i] = v;
      this.save();
    }
  }

  async importFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.store.importJson(file);
    this.reload();
  }

  photo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const max = 1080;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * s;
      c.height = img.height * s;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      this.crop.set(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = URL.createObjectURL(file);
  }
}
