import { Injectable, signal } from '@angular/core';
import { Data, emptyData, today } from './models';

const KEY = 'gcb:data';

@Injectable({ providedIn: 'root' })
export class Store {
  readonly data = signal<Data>(this.load());
  readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    navigator.storage?.persist?.();
  }

  private load(): Data {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...emptyData(), ...JSON.parse(raw) };
    } catch {}
    return emptyData();
  }

  notify(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 1600);
  }

  mutate(fn: (d: Data) => void, msg = '✓ Salvo automaticamente') {
    const d = structuredClone(this.data());
    fn(d);
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      alert('Sem espaço para salvar. Exporte um backup e tente uma foto menor.');
      return;
    }
    this.data.set(d);
    if (msg) this.notify(msg);
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.data(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gcb-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async importJson(file: File) {
    try {
      const d = JSON.parse(await file.text());
      if (!d || typeof d !== 'object' || !d.baby || !d.days) throw 0;
      const name = d.baby.name || 'sem nome';
      if (!confirm(`Importar dados de "${name}"? Os dados atuais deste aparelho serão substituídos.`)) return;
      this.mutate((cur) => Object.assign(cur, emptyData(), d, { baby: { ...emptyData().baby, ...d.baby } }));
      this.notify('✓ Dados importados');
    } catch {
      alert('Arquivo inválido. Use um backup exportado pelo GCB.');
    }
  }

  clear() {
    if (!confirm('Apagar TODOS os dados deste aparelho?')) return;
    this.mutate((d) => Object.assign(d, emptyData()), '🗑 Dados apagados');
  }
}
