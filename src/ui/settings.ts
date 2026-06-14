import { NHS_BLUE_HEX } from '../world/theme';

export interface SettingsValues {
  sensitivity: number; // mouse-look multiplier
  fov: number; // camera field of view (deg)
  moveSpeed: number; // m/s
  reducedMotion: boolean; // skip transition fades
}

const DEFAULTS: SettingsValues = { sensitivity: 1, fov: 72, moveSpeed: 3, reducedMotion: false };
const KEY = 'whiterose.settings';

/** Persisted comfort/accessibility settings with a toggleable panel. */
export class Settings {
  values: SettingsValues;
  onChange: (v: SettingsValues) => void = () => {};
  onClose: () => void = () => {};
  private root: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement) {
    let loaded: Partial<SettingsValues> = {};
    try {
      loaded = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      loaded = {};
    }
    this.values = { ...DEFAULTS, ...loaded };

    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(8,22,38,0.6)',
      zIndex: '60',
      pointerEvents: 'auto',
      fontFamily: 'Arial, Helvetica, sans-serif',
    } as Partial<CSSStyleDeclaration>);
    parent.appendChild(this.root);
    this.buildPanel();
  }

  private buildPanel() {
    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#fff',
      color: '#1c2b2b',
      borderRadius: '10px',
      width: 'min(420px, 88vw)',
      padding: '0 0 14px',
      boxShadow: '0 12px 44px rgba(0,0,0,0.5)',
      overflow: 'hidden',
    } as Partial<CSSStyleDeclaration>);
    const head = document.createElement('div');
    Object.assign(head.style, { background: NHS_BLUE_HEX, color: '#fff', padding: '12px 16px', font: 'bold 16px Arial' });
    head.textContent = 'Settings';
    card.appendChild(head);

    const body = document.createElement('div');
    Object.assign(body.style, { padding: '12px 18px' });
    card.appendChild(body);

    const slider = (label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const row = document.createElement('label');
      Object.assign(row.style, { display: 'block', margin: '14px 0', font: '14px Arial' });
      const cap = document.createElement('div');
      Object.assign(cap.style, { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' });
      const name = document.createElement('span');
      name.textContent = label;
      const val = document.createElement('span');
      Object.assign(val.style, { opacity: '0.6' });
      val.textContent = fmt(get());
      cap.append(name, val);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(get());
      Object.assign(input.style, { width: '100%', accentColor: NHS_BLUE_HEX });
      input.addEventListener('input', () => {
        set(Number(input.value));
        val.textContent = fmt(get());
        this.commit();
      });
      row.append(cap, input);
      body.appendChild(row);
    };

    slider('Mouse sensitivity', 0.3, 2.5, 0.1, () => this.values.sensitivity, (v) => (this.values.sensitivity = v), (v) => `${v.toFixed(1)}×`);
    slider('Field of view', 60, 100, 1, () => this.values.fov, (v) => (this.values.fov = v), (v) => `${v}°`);
    slider('Move speed', 1.5, 6, 0.5, () => this.values.moveSpeed, (v) => (this.values.moveSpeed = v), (v) => `${v.toFixed(1)} m/s`);

    const rm = document.createElement('label');
    Object.assign(rm.style, { display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 4px', font: '14px Arial', cursor: 'pointer' });
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this.values.reducedMotion;
    Object.assign(cb.style, { accentColor: NHS_BLUE_HEX, width: '16px', height: '16px' });
    cb.addEventListener('change', () => {
      this.values.reducedMotion = cb.checked;
      this.commit();
    });
    const rmText = document.createElement('span');
    rmText.textContent = 'Reduced motion (instant travel, no fades)';
    rm.append(cb, rmText);
    body.appendChild(rm);

    const foot = document.createElement('div');
    Object.assign(foot.style, { display: 'flex', gap: '8px', padding: '4px 18px 0' });
    const close = document.createElement('button');
    Object.assign(close.style, { flex: '1', border: 'none', background: NHS_BLUE_HEX, color: '#fff', cursor: 'pointer', font: 'bold 14px Arial', padding: '10px', borderRadius: '6px' });
    close.textContent = 'Close (O / Esc)';
    close.addEventListener('click', () => this.hide());
    const reset = document.createElement('button');
    Object.assign(reset.style, { border: 'none', background: '#eef2f4', color: '#444', cursor: 'pointer', font: '14px Arial', padding: '10px 12px', borderRadius: '6px' });
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => {
      this.values = { ...DEFAULTS };
      this.commit();
      this.rebuild();
    });
    foot.append(close, reset);
    body.appendChild(foot);

    this.root.innerHTML = '';
    this.root.appendChild(card);
  }

  private rebuild() {
    this.buildPanel();
  }

  private commit() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      /* ignore quota / private-mode errors */
    }
    this.onChange(this.values);
  }

  /** Apply current values immediately (call once at startup). */
  apply() {
    this.onChange(this.values);
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }
  show() {
    this.visible = true;
    this.root.style.display = 'flex';
  }
  hide() {
    this.visible = false;
    this.root.style.display = 'none';
    this.onClose();
  }
}
