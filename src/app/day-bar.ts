import { Component, computed, inject, input } from '@angular/core';
import { Store } from './store';
import { nowHM, today, toMin } from './models';
import { axisPct, hourPct, segments } from './reports';

export const AXIS_HOURS = [6, 9, 12, 15, 18, 21, 0, 3];

/** Linha do tempo de um dia (05h às 05h): sonecas, noite, agora e marcadores. */
@Component({
  selector: 'app-day-bar',
  template: `
    <div class="daybar" [class.tall]="tall()">
      @for (h of hours; track h) { <span class="tick" [style.left.%]="hourPct(h)"></span> }
      @for (s of segs(); track $index) {
        <i [class]="'seg-' + s.kind" [style.left.%]="pct(s.from)" [style.width.%]="pct(s.to - s.from)" [title]="s.title"></i>
      }
      @for (m of marks(); track $index) {
        <span class="mark" [style.left.%]="pct(m.at)" [title]="m.title"></span>
      }
      @if (nowPct() !== null) { <b class="now" [style.left.%]="nowPct()" title="Agora"></b> }
    </div>
  `,
})
export class DayBar {
  private store = inject(Store);
  date = input.required<string>();
  marks = input<{ at: number; title: string }[]>([]);
  tall = input(false);

  readonly hours = AXIS_HOURS;
  readonly hourPct = hourPct;
  readonly pct = axisPct;

  segs = computed(() => segments(this.store.data(), this.date()));
  nowPct = computed(() => (this.date() === today() ? hourPct(toMin(nowHM()) / 60) : null));
}

@Component({
  selector: 'app-day-axis',
  template: `
    <div class="dayaxis">
      @for (h of hours; track h) { <span [style.left.%]="hourPct(h)">{{ h }}h</span> }
    </div>
  `,
})
export class DayAxis {
  readonly hours = AXIS_HOURS;
  readonly hourPct = hourPct;
}
