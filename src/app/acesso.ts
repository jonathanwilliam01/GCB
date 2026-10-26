import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from './auth';
import { Store } from './store';

/** Login/cadastro, nova senha e, logado, criar ou entrar em um bebê */
@Component({
  selector: 'app-acesso',
  imports: [FormsModule],
  template: `
    <div class="card center">
      <img src="icon.svg" width="72" height="72" alt="" />
      <h2>GCB</h2>
      <p class="muted">Gestão e Controle do Bebê</p>
    </div>

    @if (auth.recuperando() && auth.user()) {
      <form class="card form" (ngSubmit)="run(trocarSenha)">
        <b>Nova senha</b>
        <label>Senha<input type="password" name="senha" [(ngModel)]="senha" autocomplete="new-password" required /></label>
        <button class="btn primary" [disabled]="busy()">Salvar senha</button>
      </form>
    } @else if (!auth.user()) {
      <form class="card form" (ngSubmit)="run(entrar)">
        <label>E-mail<input type="email" name="email" [(ngModel)]="email" autocomplete="email" required /></label>
        <label>Senha<input type="password" name="senha" [(ngModel)]="senha" [autocomplete]="novo() ? 'new-password' : 'current-password'" required /></label>
        <button class="btn primary" [disabled]="busy()">{{ novo() ? 'Criar conta' : 'Entrar' }}</button>
        <div class="row between">
          <button type="button" class="link" (click)="novo.set(!novo())">{{ novo() ? 'Já tenho conta' : 'Criar conta' }}</button>
          @if (!novo()) { <button type="button" class="link" (click)="run(recuperar)">Esqueci minha senha</button> }
        </div>
      </form>
    } @else {
      @if (legado(); as l) {
        <div class="card form">
          <b>Dados deste aparelho</b>
          <p class="muted">Encontramos os dados de {{ l.baby.name || 'um bebê' }} salvos só neste navegador.</p>
          <button class="btn primary" [disabled]="busy()" (click)="run(levar)">Levar para minha conta</button>
        </div>
      }
      <form class="card form" (ngSubmit)="run(criar)">
        <b>Novo bebê</b>
        <label>Nome do bebê<input name="nome" [(ngModel)]="nome" required /></label>
        <button class="btn primary" [disabled]="busy() || !nome.trim()">Começar</button>
      </form>
      <form class="card form" (ngSubmit)="run(entrarCodigo)">
        <b>Acompanhar um bebê</b>
        <p class="muted">Peça o código para quem já usa (aba Bebê → Compartilhar).</p>
        <label>Código<input name="codigo" [(ngModel)]="codigo" autocapitalize="characters" required /></label>
        <button class="btn" [disabled]="busy() || !codigo.trim()">Entrar</button>
      </form>
      @if (store.bebe()) {
        <button class="link" (click)="store.adicionando.set(false)">← Voltar</button>
      } @else {
        <button class="link" (click)="store.sair()">Sair ({{ auth.user()?.email }})</button>
      }
    }

    @if (msg()) { <p class="center" [class.danger]="erro()">{{ msg() }}</p> }
  `,
})
export class Acesso {
  readonly auth = inject(Auth);
  readonly store = inject(Store);
  readonly legado = signal(this.store.legado());
  readonly novo = signal(false);
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly erro = signal(false);
  email = '';
  senha = '';
  nome = '';
  codigo = '';

  entrar = async () => {
    if (!this.novo()) return this.auth.entrar(this.email.trim(), this.senha);
    if (!(await this.auth.cadastrar(this.email.trim(), this.senha))) this.msg.set('Conta criada. Confirme pelo link enviado ao e-mail e depois entre.');
  };
  recuperar = async () => {
    if (!this.email.trim()) throw new Error('Informe o e-mail');
    await this.auth.recuperar(this.email.trim());
    this.msg.set('Enviamos um link para redefinir a senha no seu e-mail.');
  };
  trocarSenha = async () => {
    await this.auth.trocarSenha(this.senha);
    this.store.notify('✓ Senha alterada');
  };
  criar = () => this.store.criarBebe(this.nome.trim());
  levar = async () => {
    if (await this.store.criarBebe('', this.legado()!)) this.store.esquecerLegado();
  };
  entrarCodigo = () => this.store.entrarBebe(this.codigo);

  async run(fn: () => Promise<unknown>) {
    this.busy.set(true);
    this.msg.set('');
    this.erro.set(false);
    try {
      await fn();
    } catch (e) {
      this.msg.set((e as Error).message);
      this.erro.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
