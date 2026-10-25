import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** Instalação do app e aviso de nova versão. */
@Injectable({ providedIn: 'root' })
export class Pwa {
  private sw = inject(SwUpdate);
  private deferred?: InstallEvent;

  readonly canInstall = signal(false);
  readonly updateReady = signal(false);
  readonly standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  readonly ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  constructor() {
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as InstallEvent;
      this.canInstall.set(true);
    });
    addEventListener('appinstalled', () => this.canInstall.set(false));
    if (this.sw.isEnabled) {
      this.sw.versionUpdates.subscribe((e) => e.type === 'VERSION_READY' && this.updateReady.set(true));
      setInterval(() => this.sw.checkForUpdate(), 30 * 60000);
    }
  }

  async install() {
    if (!this.deferred) return;
    await this.deferred.prompt();
    await this.deferred.userChoice;
    this.deferred = undefined;
    this.canInstall.set(false);
  }

  async update() {
    await this.sw.activateUpdate();
    location.reload();
  }
}
