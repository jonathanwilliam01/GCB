import { Directive, ElementRef, forwardRef, inject, input, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type Kind = 'time' | 'date' | 'dur' | 'int' | 'decimal';

const PLACEHOLDER: Partial<Record<Kind, string>> = { time: '00:00', date: 'dd/mm/aaaa', dur: '0h00' };
const pad = (n: number) => String(n).padStart(2, '0');

/** Máscara para input texto. Modelo: time "HH:MM", date "AAAA-MM-DD", dur minutos, int/decimal número. */
@Directive({
  selector: 'input[mask]',
  host: { autocomplete: 'off', '(input)': 'onInput()', '(blur)': 'onBlur()' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Mask), multi: true }],
})
export class Mask implements ControlValueAccessor, OnInit {
  mask = input.required<Kind>();
  decimals = input(1);

  private el: HTMLInputElement = inject(ElementRef).nativeElement;
  private value: unknown = null;
  private onChange = (_: unknown) => {};
  private onTouched = () => {};

  ngOnInit() {
    const k = this.mask();
    this.el.type = 'text';
    this.el.inputMode = k === 'decimal' ? 'decimal' : 'numeric';
    if (!this.el.placeholder && PLACEHOLDER[k]) this.el.placeholder = PLACEHOLDER[k]!;
  }

  writeValue(v: unknown) {
    this.value = v;
    this.el.value = this.format(v);
  }

  registerOnChange(fn: (v: unknown) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(d: boolean) {
    this.el.disabled = d;
  }

  onInput() {
    const { text, value, done } = this.parse(this.el.value);
    this.el.value = text;
    if (done) this.emit(value);
  }

  onBlur() {
    const { value, done } = this.parse(this.el.value, true);
    if (done) this.emit(value);
    this.el.value = this.format(this.value);
    this.onTouched();
  }

  private emit(v: unknown) {
    if (v === this.value) return;
    this.value = v;
    this.onChange(v);
  }

  private format(v: unknown): string {
    if (v === null || v === undefined || v === '') return '';
    switch (this.mask()) {
      case 'date': {
        const [y, m, d] = String(v).split('-');
        return `${d}/${m}/${y}`;
      }
      case 'dur':
        return `${Math.floor(+v / 60)}h${pad(+v % 60)}`;
      case 'decimal':
        return String(v).replace('.', ',');
      default:
        return String(v);
    }
  }

  // text: valor exibido; done: valor completo e válido para o modelo
  private parse(raw: string, blur = false): { text: string; value: unknown; done: boolean } {
    const k = this.mask();
    let d = raw.replace(/\D/g, '');
    const empty = { text: '', value: k === 'time' || k === 'date' ? '' : null, done: blur };

    switch (k) {
      case 'time': {
        if (d.length === 1 && +d > 2) d = '0' + d;
        d = d.slice(0, 4);
        if (!d) return empty;
        const text = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
        const h = +d.slice(0, 2), m = +d.slice(2);
        return { text, value: `${d.slice(0, 2)}:${d.slice(2)}`, done: d.length === 4 && h < 24 && m < 60 };
      }
      case 'date': {
        d = d.slice(0, 8);
        if (!d) return empty;
        const text = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
        const iso = `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
        const dt = new Date(iso + 'T12:00');
        const ok = d.length === 8 && !isNaN(+dt) && dt.getDate() === +d.slice(0, 2);
        return { text, value: iso, done: ok };
      }
      case 'dur': {
        d = d.slice(0, 3);
        if (!d) return empty;
        const text = d.length > 1 ? `${d[0]}h${d.slice(1)}` : d;
        const m = +d.slice(1).padEnd(2, '0');
        return { text, value: +d[0] * 60 + m, done: (d.length === 3 || blur) && m < 60 };
      }
      case 'int': {
        d = d.slice(0, 4);
        return d ? { text: d, value: +d, done: true } : empty;
      }
      case 'decimal': {
        const s = raw.replace('.', ',').replace(/[^\d,]/g, '');
        const [i = '', ...rest] = s.split(',');
        const text = rest.length ? `${i.slice(0, 3)},${rest.join('').slice(0, this.decimals())}` : i.slice(0, 3);
        if (!text || text === ',') return { ...empty, text };
        return { text, value: parseFloat(text.replace(',', '.')), done: !text.endsWith(',') || blur };
      }
    }
  }
}
