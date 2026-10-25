import { effect, inject, Injectable, signal } from '@angular/core';
import { Store } from './store';
import { Data, today } from './models';

const KEEP = 7;

// IndexedDB mínimo (chave/valor)
const idb = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) =>
  new Promise<T>((resolve, reject) => {
    const open = indexedDB.open('gcb', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = fn(open.result.transaction('kv', mode).objectStore('kv'));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    };
  });
const get = <T>(k: string) => idb<T>('readonly', (s) => s.get(k));
const put = (k: string, v: unknown) => idb('readwrite', (s) => s.put(v, k));
const del = (k: string) => idb('readwrite', (s) => s.delete(k));
const keys = () => idb<string[]>('readonly', (s) => s.getAllKeys());

type Handle = FileSystemFileHandle & {
  queryPermission(o: object): Promise<PermissionState>;
  requestPermission(o: object): Promise<PermissionState>;
};

/** Cópias diárias no aparelho, arquivo de backup automático (PC) e compartilhamento (celular). */
@Injectable({ providedIn: 'root' })
export class Backup {
  private store = inject(Store);
  private handle?: Handle;
  private timer?: ReturnType<typeof setTimeout>;

  readonly snapshots = signal<string[]>([]);
  readonly fileName = signal('');
  readonly fileState = signal<'none' | 'ok' | 'prompt'>('none');
  readonly canFile = 'showSaveFilePicker' in window;
  readonly canShare = !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });

  constructor() {
    this.init();
    effect(() => {
      const d = this.store.data();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.onChange(d), 3000);
    });
  }

  private async init() {
    try {
      await this.refresh();
      this.handle = await get<Handle>('file');
      if (!this.handle) return;
      this.fileName.set(this.handle.name);
      const perm = await this.handle.queryPermission({ mode: 'readwrite' });
      this.fileState.set(perm === 'granted' ? 'ok' : 'prompt');
    } catch {}
  }

  private async refresh() {
    const list = (await keys()).filter((k) => k.startsWith('snap:')).map((k) => k.slice(5)).sort().reverse();
    for (const old of list.slice(KEEP)) await del('snap:' + old);
    this.snapshots.set(list.slice(0, KEEP));
  }

  private async onChange(d: Data) {
    try {
      if (!d.baby.name && !Object.keys(d.days).length) return;
      await put('snap:' + today(), JSON.stringify(d));
      await this.refresh();
      if (this.fileState() === 'ok') await this.writeFile();
    } catch {}
  }

  private json() {
    return JSON.stringify(this.store.data(), null, 2);
  }

  private async writeFile() {
    const w = await this.handle!.createWritable();
    await w.write(this.json());
    await w.close();
    this.store.markBackup();
  }

  async chooseFile() {
    try {
      const pick = (window as unknown as { showSaveFilePicker: (o: object) => Promise<Handle> }).showSaveFilePicker;
      this.handle = await pick({
        suggestedName: 'gcb-backup.json',
        types: [{ description: 'Backup GCB', accept: { 'application/json': ['.json'] } }],
      });
      await put('file', this.handle);
      this.fileName.set(this.handle.name);
      this.fileState.set('ok');
      await this.writeFile();
      this.store.notify('💾 Backup automático ativado');
    } catch {}
  }

  async reconnect() {
    if (!this.handle) return;
    if ((await this.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
    this.fileState.set('ok');
    await this.writeFile();
    this.store.notify('💾 Backup automático reconectado');
  }

  async stopFile() {
    await del('file');
    this.handle = undefined;
    this.fileName.set('');
    this.fileState.set('none');
    this.store.notify('Backup automático em arquivo desligado');
  }

  async share() {
    const file = new File([this.json()], `gcb-backup-${today()}.json`, { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: 'Backup GCB' });
      this.store.markBackup();
    } catch {}
  }

  async restore(date: string) {
    const raw = await get<string>('snap:' + date);
    if (!raw || !confirm(`Restaurar a cópia de ${date.split('-').reverse().join('/')}? Os dados atuais serão substituídos.`)) return;
    const d = JSON.parse(raw) as Data;
    this.store.mutate((cur) => Object.assign(cur, d), '↺ Cópia restaurada');
  }
}
