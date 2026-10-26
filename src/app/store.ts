import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Auth } from './auth';
import { Baby, Data, emptyData, FoodEntry, Measure, SleepDay, today } from './models';
import { q, supabase } from './supabase';

// dados de antes do Supabase, para levar ao banco
const LEGADO = 'gcb:data';
// cópia local: abre sem internet e guarda o que ainda não subiu
const CACHE = 'gcb:cache';
const COLECOES = ['days', 'foods', 'measures'] as const;
const FOTOS = ['photo', 'photoFull'] as const;
const SEM_REDE = 'Sem internet: as alterações ainda não foram enviadas. Tente de novo quando conectar.';
type Colecao = (typeof COLECOES)[number];
type Info = Pick<Data, 'baby' | 'appName'>;

export interface Bebe {
  id: string;
  codigo: string;
  nome: string | null;
}

export interface Membro {
  user_id: string;
  email: string;
  papel: 'dono' | 'membro';
}

interface Cache {
  user: string;
  bebes: Bebe[];
  bebeId: string | null;
  membros: Membro[];
  base: Data;
  data: Data | null;
}

const info = (d: Data): Info => ({ baby: d.baby, appName: d.appName });

function porChave(d: Data, c: Colecao): Map<string, unknown> {
  if (c === 'days') return new Map(Object.entries(d.days));
  const lista: { id: string }[] = c === 'foods' ? d.foods : d.measures;
  return new Map(lista.map((x) => [x.id, x]));
}

@Injectable({ providedIn: 'root' })
export class Store {
  private auth = inject(Auth);
  readonly data = signal<Data>(emptyData());
  /** false até saber se há login e qual bebê */
  readonly pronto = signal(false);
  readonly bebes = signal<Bebe[]>([]);
  readonly bebeId = signal<string | null>(null);
  readonly bebe = computed(() => this.bebes().find((b) => b.id === this.bebeId()) ?? null);
  readonly membros = signal<Membro[]>([]);
  readonly souDono = computed(() => this.membros().find((m) => m.user_id === this.auth.user()?.id)?.papel === 'dono');
  /** Alterações feitas no aparelho e ainda não enviadas */
  readonly pendente = signal(false);
  /** Tela de criar ou entrar em outro bebê */
  readonly adicionando = signal(false);
  readonly toast = signal('');
  readonly lastBackup = signal(this.read('gcb:lastBackup'));
  readonly appName = computed(() => this.data().appName?.trim() || 'GCB');
  private toastTimer?: ReturnType<typeof setTimeout>;
  private canal: RealtimeChannel | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private uid = computed(() => this.auth.user()?.id ?? null);
  /** Último estado confirmado no banco; data() diferente dele = pendente */
  private base = this.data();
  private fila = Promise.resolve(true);

  constructor() {
    effect(() => {
      this.uid();
      untracked(() => this.iniciar());
    });
    addEventListener('online', () => this.atualizar());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.atualizar());
  }

  private read(k: string) {
    try {
      return localStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  }

  legado(): Data | null {
    try {
      const d = JSON.parse(this.read(LEGADO));
      if (d?.baby && d.days) return { ...emptyData(), ...d, baby: { ...emptyData().baby, ...d.baby } };
    } catch {}
    return null;
  }

  esquecerLegado() {
    try {
      localStorage.removeItem(LEGADO);
    } catch {}
  }

  private salvarCache() {
    const user = this.auth.user()?.id;
    if (!user) return;
    const c: Cache = {
      user,
      bebes: this.bebes(),
      bebeId: this.bebeId(),
      membros: this.membros(),
      base: this.base,
      data: this.pendente() ? this.data() : null,
    };
    try {
      localStorage.setItem(CACHE, JSON.stringify(c));
    } catch {}
  }

  async iniciar() {
    this.pronto.set(false);
    await this.auth.aguardar();
    const uid = this.auth.user()?.id;
    let c: Cache | null = null;
    try {
      c = uid ? JSON.parse(this.read(CACHE) || 'null') : null;
    } catch {}
    if (c?.user !== uid) c = null;
    this.bebes.set(c?.bebes ?? []);
    this.bebeId.set(c?.bebeId ?? null);
    this.membros.set(c?.membros ?? []);
    this.base = c?.base ?? emptyData();
    this.data.set(c?.data ?? this.base);
    this.pendente.set(!!c?.data);
    this.assinar(this.bebeId());
    // com cópia local já abre; a busca no banco atualiza depois
    if (c) this.pronto.set(true);
    await this.atualizar();
    this.pronto.set(true);
  }

  /** Lista os bebês e recarrega o atual; sem internet fica com o que tem */
  async atualizar() {
    if (!this.auth.user()) return;
    try {
      if (await this.listar()) await this.carregar();
    } catch {}
  }

  /** true se o bebê aberto continua na lista; senão abre o primeiro */
  private async listar() {
    const lista = await q<Bebe[]>(supabase.from('bebes').select('id, codigo, nome:dados->baby->>name').order('criado_em'));
    this.bebes.set(lista);
    if (lista.some((b) => b.id === this.bebeId())) return true;
    await this.abrir(lista[0]?.id ?? null);
    return false;
  }

  private async abrir(id: string | null) {
    this.bebeId.set(id);
    this.base = emptyData();
    this.data.set(this.base);
    this.membros.set([]);
    this.pendente.set(false);
    this.assinar(id);
    if (id) await this.carregar();
    else this.salvarCache();
  }

  async selecionar(id: string) {
    if (!(await this.sync())) return alert(SEM_REDE);
    this.adicionando.set(false);
    await this.abrir(id).catch(() => alert(SEM_REDE));
  }

  /** Cria o bebê já com os dados (ex.: os que estavam só no aparelho); false se ficou pendente de envio */
  async criarBebe(name: string, dados = emptyData()) {
    if (!(await this.sync())) throw new Error(SEM_REDE);
    const id = await q<string>(supabase.rpc('criar_bebe', { p_dados: info(emptyData()) }));
    await this.listar();
    await this.abrir(id);
    dados.baby.name ||= name;
    this.adicionando.set(false);
    this.mutate((d) => Object.assign(d, dados), '');
    return this.sync();
  }

  async entrarBebe(codigo: string) {
    if (!(await this.sync())) throw new Error(SEM_REDE);
    const id = await q<string | null>(supabase.rpc('entrar_bebe', { p_codigo: codigo }));
    if (!id) throw new Error('Código inválido');
    await this.listar();
    this.adicionando.set(false);
    await this.abrir(id);
  }

  async novoCodigo() {
    await q(supabase.rpc('novo_codigo', { p_bebe: this.bebeId() }));
    await this.atualizar();
  }

  async removerMembro(userId: string) {
    await q(supabase.rpc('remover_membro', { p_bebe: this.bebeId(), p_user: userId }));
    await this.carregar();
  }

  /** Deixa de acompanhar (ou exclui, se dono) o bebê aberto */
  async sairBebe(excluir = false) {
    const id = this.bebeId()!;
    if (excluir || this.membros().length === 1) await supabase.storage.from('fotos').remove(FOTOS.map((k) => `${id}/${k}.jpg`));
    await q(supabase.rpc(excluir ? 'excluir_bebe' : 'sair_bebe', { p_bebe: id }));
    await this.abrir(null);
    await this.listar();
  }

  /** Sai da conta; avisa se há alterações que não subiram */
  async sair() {
    if (!(await this.sync()) && !confirm('Há alterações ainda não enviadas (sem internet). Sair e perdê-las?')) return;
    try {
      localStorage.removeItem(CACHE);
    } catch {}
    await this.auth.sair();
  }

  async carregar() {
    const id = this.bebeId();
    if (!id || !(await this.sync())) return;
    const [b, regs, membros] = await Promise.all([
      q<{ dados: Info; codigo: string }>(supabase.from('bebes').select('dados, codigo').eq('id', id).single()),
      q<{ colecao: Colecao; chave: string; dado: unknown }[]>(
        supabase.from('registros').select('colecao, chave, dado').eq('bebe_id', id).order('criado_em').order('chave'),
      ),
      q<Membro[]>(supabase.from('bebe_membros').select('user_id, email, papel').eq('bebe_id', id).order('criado_em')),
    ]);
    // trocou de bebê ou mexeu nos dados durante a busca: a recarga seguinte resolve
    if (id !== this.bebeId() || this.data() !== this.base) return;
    const d = emptyData();
    d.baby = { ...d.baby, ...b.dados.baby };
    d.appName = b.dados.appName;
    for (const r of regs) {
      if (r.colecao === 'days') d.days[r.chave] = r.dado as SleepDay;
      else if (r.colecao === 'foods') d.foods.push(r.dado as FoodEntry);
      else d.measures.push(r.dado as Measure);
    }
    this.base = d;
    this.data.set(d);
    this.membros.set(membros);
    this.bebes.update((l) => l.map((x) => (x.id === id ? { ...x, codigo: b.codigo, nome: d.baby.name } : x)));
    this.salvarCache();
  }

  /** Envia o que mudou desde a última confirmação do banco, uma de cada vez; false se não deu (ex.: sem internet) */
  sync() {
    return (this.fila = this.fila.then(async () => {
      const id = this.bebeId();
      const alvo = this.data();
      if (!id || alvo === this.base) return true;
      try {
        await this.persistir(id, this.base, alvo);
      } catch {
        return false;
      }
      if (id === this.bebeId()) {
        this.base = alvo;
        this.pendente.set(this.data() !== alvo);
        this.salvarCache();
      }
      return true;
    }));
  }

  private async persistir(id: string, antes: Data, depois: Data) {
    if (JSON.stringify(info(antes)) !== JSON.stringify(info(depois))) {
      const baby = await this.subirFotos(id, antes.baby, depois.baby);
      await q(supabase.from('bebes').update({ dados: { ...info(depois), baby } }).eq('id', id));
    }
    for (const c of COLECOES) {
      const de = porChave(antes, c);
      const para = porChave(depois, c);
      const mudou = [...para]
        .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(de.get(k)))
        .map(([chave, dado]) => ({ bebe_id: id, colecao: c, chave, dado }));
      const saiu = [...de.keys()].filter((k) => !para.has(k));
      if (mudou.length) await q(supabase.from('registros').upsert(mudou, { onConflict: 'bebe_id,colecao,chave' }));
      if (saiu.length) await q(supabase.from('registros').delete().eq('bebe_id', id).eq('colecao', c).in('chave', saiu));
    }
  }

  /** Foto nova (data URL) vai para o Storage e o cadastro guarda só a URL */
  private async subirFotos(id: string, antes: Baby, depois: Baby) {
    const b = { ...depois };
    const fotos = supabase.storage.from('fotos');
    for (const k of FOTOS) {
      if (!b[k]?.startsWith('data:')) continue;
      const blob = await (await fetch(b[k])).blob();
      await q(fotos.upload(`${id}/${k}.jpg`, blob, { upsert: true, contentType: blob.type }));
      b[k] = `${fotos.getPublicUrl(`${id}/${k}.jpg`).data.publicUrl}?v=${Date.now()}`;
    }
    if (antes.photo && !b.photo) await fotos.remove(FOTOS.map((k) => `${id}/${k}.jpg`));
    return b;
  }

  // DELETE não aceita filtro no realtime: chega só a chave, de qualquer bebê, e só dispara recarga
  private assinar(id: string | null) {
    if (this.canal) supabase.removeChannel(this.canal);
    this.canal = null;
    if (!id) return;
    const recarregar = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.atualizar(), 600);
    };
    const ch = supabase.channel(`bebe-${id}`);
    for (const [table, col] of [['bebes', 'id'], ['bebe_membros', 'bebe_id'], ['registros', 'bebe_id']]) {
      for (const event of ['INSERT', 'UPDATE'] as const) ch.on('postgres_changes', { event, schema: 'public', table, filter: `${col}=eq.${id}` }, recarregar);
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, recarregar);
    }
    this.canal = ch.subscribe();
  }

  notify(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 1600);
  }

  mutate(fn: (d: Data) => void, msg = '✓ Salvo automaticamente') {
    const d = structuredClone(this.data());
    fn(d);
    this.data.set(d);
    this.pendente.set(true);
    this.salvarCache();
    if (msg) this.notify(msg);
    this.sync().then((ok) => ok || this.notify('📴 Sem internet: salvo no aparelho, envia ao conectar'));
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.data(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gcb-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.markBackup();
  }

  markBackup() {
    try {
      localStorage.setItem('gcb:lastBackup', today());
    } catch {}
    this.lastBackup.set(today());
  }

  async importJson(file: File) {
    try {
      const d = JSON.parse(await file.text());
      if (!d || typeof d !== 'object' || !d.baby || !d.days) throw 0;
      const name = d.baby.name || 'sem nome';
      if (!confirm(`Importar dados de "${name}"? Os dados atuais do bebê serão substituídos para todos que acompanham.`)) return;
      this.mutate((cur) => Object.assign(cur, emptyData(), d, { baby: { ...emptyData().baby, ...d.baby } }));
      this.notify('✓ Dados importados');
    } catch {
      alert(`Arquivo inválido. Use um backup exportado pelo ${this.appName()}.`);
    }
  }

  clear() {
    if (!confirm('Apagar TODOS os dados do bebê para todos que acompanham?')) return;
    this.mutate((d) => Object.assign(d, emptyData()), '🗑 Dados apagados');
  }
}
