import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Crop } from './models';

const V = 260;
const OUT = 400;

/** Ajuste de enquadramento da foto: arrastar e zoom. */
@Component({
  selector: 'app-photo-crop',
  imports: [FormsModule],
  template: `
    <div class="sheet-backdrop modal-bg" (click)="cancel.emit()"></div>
    <div class="modal" role="dialog" aria-label="Ajustar foto">
      <b>Ajustar foto</b>
      <p class="muted small">Arraste para posicionar e use o zoom.</p>
      <div class="crop" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="drag = undefined" (pointercancel)="drag = undefined" (wheel)="wheel($event)">
        @if (size(); as s) {
          <img [src]="src()" alt="" draggable="false"
            [style.width.px]="s.w" [style.height.px]="s.h"
            [style.left.px]="half - c().x * s.w" [style.top.px]="half - c().y * s.h" />
        }
      </div>
      <label class="zoom">🔍<input type="range" min="1" max="4" step="0.01" [ngModel]="c().z" (ngModelChange)="zoom(+$event)" /></label>
      <div class="row gap">
        <button class="btn grow" (click)="cancel.emit()">Cancelar</button>
        <button class="btn primary grow" [disabled]="!img" (click)="done()">Salvar</button>
      </div>
    </div>
  `,
})
export class PhotoCrop {
  readonly src = input.required<string>();
  readonly crop = input<Crop>();
  readonly save = output<{ photo: string; crop: Crop }>();
  readonly cancel = output();

  readonly half = V / 2;
  readonly c = signal<Crop>({ x: 0.5, y: 0.5, z: 1 });
  readonly size = signal<{ w: number; h: number } | undefined>(undefined);
  img?: HTMLImageElement;
  drag?: { px: number; py: number };

  ngOnInit() {
    const img = new Image();
    // foto do Storage: sem isso o canvas fica bloqueado para exportar
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.img = img;
      this.set(this.crop() ?? { x: 0.5, y: 0.5, z: 1 });
    };
    img.src = this.src();
  }

  // ajusta o centro para a imagem sempre cobrir o círculo
  private set({ x, y, z }: Crop) {
    const { width: w, height: h } = this.img!;
    z = Math.min(4, Math.max(1, z));
    const k = (V / Math.min(w, h)) * z;
    const s = { w: w * k, h: h * k };
    const cx = V / 2 / s.w;
    const cy = V / 2 / s.h;
    this.size.set(s);
    this.c.set({ x: Math.min(1 - cx, Math.max(cx, x)), y: Math.min(1 - cy, Math.max(cy, y)), z });
  }

  zoom(z: number) {
    if (this.img) this.set({ ...this.c(), z });
  }

  wheel(e: WheelEvent) {
    e.preventDefault();
    this.zoom(this.c().z - e.deltaY / 500);
  }

  down(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { px: e.clientX, py: e.clientY };
  }

  move(e: PointerEvent) {
    const s = this.size();
    if (!this.drag || !s) return;
    const c = this.c();
    this.set({ x: c.x - (e.clientX - this.drag.px) / s.w, y: c.y - (e.clientY - this.drag.py) / s.h, z: c.z });
    this.drag = { px: e.clientX, py: e.clientY };
  }

  done() {
    const img = this.img!;
    const { x, y, z } = this.c();
    const side = Math.min(img.width, img.height) / z;
    const cv = document.createElement('canvas');
    cv.width = cv.height = OUT;
    cv.getContext('2d')!.drawImage(img, x * img.width - side / 2, y * img.height - side / 2, side, side, 0, 0, OUT, OUT);
    this.save.emit({ photo: cv.toDataURL('image/jpeg', 0.85), crop: this.c() });
  }
}
