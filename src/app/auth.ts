import { computed, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { linkRecuperacao, supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class Auth {
  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  /** Entrou pelo link de redefinição de senha */
  readonly recuperando = signal(linkRecuperacao);

  private iniciado = supabase.auth.getSession().then(({ data }) => this.session.set(data.session));

  constructor() {
    supabase.auth.onAuthStateChange((e, s) => {
      this.session.set(s);
      if (e === 'PASSWORD_RECOVERY') this.recuperando.set(true);
    });
  }

  aguardar() {
    return this.iniciado;
  }

  async entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(traduz(error.message));
  }

  /** false quando o Supabase exige confirmar o e-mail antes de entrar */
  async cadastrar(email: string, senha: string) {
    const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin } });
    if (error) throw new Error(traduz(error.message));
    return !!data.session;
  }

  async recuperar(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (error) throw new Error(traduz(error.message));
  }

  async trocarSenha(senha: string) {
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) throw new Error(traduz(error.message));
    this.recuperando.set(false);
  }

  sair() {
    return supabase.auth.signOut();
  }
}

function traduz(m: string) {
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos';
  if (/already registered/i.test(m)) return 'E-mail já cadastrado';
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar';
  if (/at least 6/i.test(m)) return 'A senha precisa ter ao menos 6 caracteres';
  if (/rate limit/i.test(m)) return 'Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.';
  if (/different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual';
  return m;
}
