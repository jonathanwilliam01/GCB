import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mask } from './mask';
import { Store } from './store';
import { Baby } from './models';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, Mask],
  template: `
    <div class="card center">
      <label class="avatar xl">
        @if (b.photo) { <img [src]="b.photo" alt="" /> } @else { <span>📷</span> }
        <input type="file" accept="image/*" hidden (change)="photo($event)" />
      </label>
      @if (b.photo) { <button class="link danger" (click)="b.photo = ''; save()">remover foto</button> }
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
      <b>Backup dos dados</b>
      <p class="muted">Tudo fica salvo só neste aparelho. Exporte o arquivo para guardar ou passar para outro celular.</p>
      <div class="row gap">
        <button class="btn primary grow" (click)="store.exportJson()">⬇️ Exportar</button>
        <label class="btn grow">⬆️ Importar
          <input type="file" accept="application/json,.json" hidden (change)="importFile($event)" />
        </label>
      </div>
      <button class="link danger" (click)="store.clear(); reload()">apagar todos os dados</button>
    </div>
  `,
})
export class ProfilePage {
  readonly store = inject(Store);
  readonly bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  b: Baby = structuredClone(this.store.data().baby);

  save() {
    const baby = structuredClone(this.b);
    this.store.mutate((d) => (d.baby = baby));
  }

  reload() {
    this.b = structuredClone(this.store.data().baby);
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
      const max = 400;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * s;
      c.height = img.height * s;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      this.b.photo = c.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(img.src);
      this.save();
    };
    img.src = URL.createObjectURL(file);
  }
}
