import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { THEME } from '../world/theme';

/** Pointer-lock first-person movement on the XZ plane, with a clamp callback. */
export class FirstPerson {
  readonly controls: PointerLockControls;
  private keys = new Set<string>();
  private speed = 3.0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
  ) {
    this.controls = new PointerLockControls(camera, dom);
    addEventListener('keydown', (e) => {
      // don't capture keys while typing in an overlay input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  setSpeed(v: number): void {
    this.speed = v;
  }
  setSensitivity(v: number): void {
    (this.controls as unknown as { pointerSpeed: number }).pointerSpeed = v;
  }

  get isLocked(): boolean {
    return this.controls.isLocked;
  }
  lock(): void {
    this.controls.lock();
  }
  unlock(): void {
    this.controls.unlock();
  }
  onLock(cb: () => void): void {
    this.controls.addEventListener('lock', cb);
  }
  onUnlock(cb: () => void): void {
    this.controls.addEventListener('unlock', cb);
  }

  update(dt: number, clamp: (p: THREE.Vector3) => void): void {
    if (this.controls.isLocked) {
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.8 : 1;
      const v = this.speed * sprint * dt;
      let f = 0;
      let r = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) r += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) r -= 1;
      if (f) this.controls.moveForward(f * v);
      if (r) this.controls.moveRight(r * v);
    }
    this.camera.position.y = THEME.eyeHeight;
    clamp(this.camera.position);
  }
}
