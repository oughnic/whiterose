import type { Destination } from '../nav/interactable';
import { NHS_BLUE_HEX } from '../world/theme';

// Lightweight DOM HUD: crosshair, "you are in" plate, interaction prompt,
// a back button, a start splash, and a destination chooser overlay.
export class Hud {
  private root: HTMLDivElement;
  private locationEl: HTMLDivElement;
  private backEl: HTMLButtonElement;
  private promptEl: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private start: HTMLDivElement;
  private chooser: HTMLDivElement;

  onBack: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#fff',
    });
    parent.appendChild(this.root);

    this.crosshair = el('div', {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '8px',
      height: '8px',
      marginLeft: '-4px',
      marginTop: '-4px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.55)',
      boxShadow: '0 0 0 2px rgba(0,0,0,0.35)',
      transition: 'background 0.1s',
    });
    this.root.appendChild(this.crosshair);

    const plate = el('div', {
      position: 'absolute',
      left: '16px',
      top: '14px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
    });
    this.backEl = document.createElement('button');
    style(this.backEl, {
      pointerEvents: 'auto',
      cursor: 'pointer',
      border: 'none',
      background: 'rgba(0,0,0,0.45)',
      color: '#fff',
      font: '13px Arial',
      padding: '6px 10px',
      borderRadius: '6px',
      display: 'none',
    });
    this.backEl.textContent = '← Back';
    this.backEl.addEventListener('click', () => this.onBack?.());
    this.locationEl = el('div', {
      background: NHS_BLUE_HEX,
      padding: '8px 14px',
      borderRadius: '6px',
      font: 'bold 16px Arial',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    });
    plate.appendChild(this.backEl);
    plate.appendChild(this.locationEl);
    this.root.appendChild(plate);

    this.promptEl = el('div', {
      position: 'absolute',
      left: '50%',
      bottom: '64px',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.6)',
      padding: '8px 14px',
      borderRadius: '6px',
      font: '15px Arial',
      display: 'none',
      whiteSpace: 'nowrap',
    });
    this.root.appendChild(this.promptEl);

    const help = el('div', {
      position: 'absolute',
      right: '14px',
      bottom: '12px',
      font: '12px Arial',
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'right',
      textShadow: '0 1px 2px #000',
    });
    help.innerHTML =
      'WASD / arrows — move &nbsp;·&nbsp; mouse — look &nbsp;·&nbsp; <b>M — map</b><br>E or click — use door / stairs / lift &nbsp;·&nbsp; Esc — release';
    this.root.appendChild(help);

    this.start = el('div', {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,30,60,0.78)',
      cursor: 'pointer',
      textAlign: 'center',
    });
    this.root.appendChild(this.start);

    this.chooser = el('div', {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'auto',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,20,40,0.6)',
    });
    this.root.appendChild(this.chooser);
  }

  setLocation(label: string, subtitle?: string): void {
    this.locationEl.innerHTML = subtitle
      ? `${escapeHtml(label)}<span style="font-weight:normal;font-size:12px;opacity:.85"> — ${escapeHtml(subtitle)}</span>`
      : escapeHtml(label);
  }

  setBack(show: boolean): void {
    this.backEl.style.display = show ? 'block' : 'none';
  }

  setPrompt(text: string | null): void {
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.style.display = 'block';
      this.crosshair.style.background = NHS_BLUE_HEX;
    } else {
      this.promptEl.style.display = 'none';
      this.crosshair.style.background = 'rgba(255,255,255,0.55)';
    }
  }

  showStart(title: string, subtitle: string, onStart: () => void): void {
    this.start.innerHTML = '';
    const h = el('div', { font: 'bold 30px Arial', marginBottom: '10px', textShadow: '0 2px 6px #000' });
    h.textContent = title;
    const s = el('div', { font: '16px Arial', maxWidth: '560px', lineHeight: '1.5', opacity: '0.92' });
    s.innerHTML = subtitle;
    const btn = el('div', {
      marginTop: '22px',
      background: NHS_BLUE_HEX,
      padding: '12px 22px',
      borderRadius: '8px',
      font: 'bold 16px Arial',
    });
    btn.textContent = '▶ Click to enter';
    this.start.append(h, s, btn);
    this.start.style.display = 'flex';
    this.start.onclick = () => {
      this.start.style.display = 'none';
      onStart();
    };
  }

  hideStart(): void {
    this.start.style.display = 'none';
  }

  showChooser(title: string, dests: Destination[], onPick: (d: Destination) => void, onCancel: () => void): void {
    this.chooser.innerHTML = '';
    const card = el('div', {
      background: '#fff',
      color: '#1c2b2b',
      borderRadius: '10px',
      width: 'min(440px, 86vw)',
      maxHeight: '74vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    });
    const head = el('div', { background: NHS_BLUE_HEX, color: '#fff', padding: '12px 16px', font: 'bold 16px Arial' });
    head.textContent = title;
    const list = el('div', { overflowY: 'auto', padding: '6px' });
    for (const d of dests) {
      const item = document.createElement('button');
      style(item, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        font: '15px Arial',
        padding: '9px 12px',
        borderRadius: '6px',
        color: '#1c2b2b',
      });
      item.onmouseenter = () => (item.style.background = '#eef3f7');
      item.onmouseleave = () => (item.style.background = 'transparent');
      const indent = '— '.repeat(Math.min(d.depth, 5));
      item.innerHTML = `<span style="opacity:.5">${indent}</span>${escapeHtml(d.label)}` +
        (d.note ? `<span style="opacity:.55;font-size:12px"> · ${escapeHtml(d.note)}</span>` : '');
      item.onclick = () => onPick(d);
      list.appendChild(item);
    }
    const foot = document.createElement('button');
    style(foot, { border: 'none', background: '#f0f2f4', cursor: 'pointer', font: '14px Arial', padding: '10px', color: '#444' });
    foot.textContent = 'Cancel (Esc)';
    foot.onclick = onCancel;
    card.append(head, list, foot);
    this.chooser.appendChild(card);
    this.chooser.style.display = 'flex';
  }

  hideChooser(): void {
    this.chooser.style.display = 'none';
  }
  get chooserOpen(): boolean {
    return this.chooser.style.display !== 'none';
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  style(e, css);
  return e;
}
function style(e: HTMLElement, css: Partial<CSSStyleDeclaration>): void {
  Object.assign(e.style, css);
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
