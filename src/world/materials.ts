import * as THREE from 'three';
import { THEME } from './theme';

// --- base procedural textures (created once, lazily, in the browser) ---

let _floorTex: THREE.Texture | null = null;
let _woodTex: THREE.Texture | null = null;

function baseFloorTexture(): THREE.Texture {
  if (_floorTex) return _floorTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = `#${THEME.floorColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = `#${THEME.floorAccent.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, s, s);
  _floorTex = new THREE.CanvasTexture(c);
  _floorTex.wrapS = _floorTex.wrapT = THREE.RepeatWrapping;
  _floorTex.anisotropy = 8;
  return _floorTex;
}

function baseWoodTexture(): THREE.Texture {
  if (_woodTex) return _woodTex;
  const w = 128;
  const h = 32;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = `#${THEME.woodColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = (i / 70) * w + (Math.sin(i) * 2);
    ctx.strokeStyle = `rgba(60,35,15,${0.05 + (i % 5) * 0.03})`;
    ctx.lineWidth = 0.5 + (i % 3) * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 1.5, h);
    ctx.stroke();
  }
  _woodTex = new THREE.CanvasTexture(c);
  _woodTex.wrapS = _woodTex.wrapT = THREE.RepeatWrapping;
  return _woodTex;
}

/** Shared singleton materials — never disposed (reused across every area). */
export const materials = {
  ceiling: new THREE.MeshStandardMaterial({ color: THEME.ceilingColor, roughness: 1 }),
  led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: THEME.ledColor, emissiveIntensity: 1 }),
  frame: new THREE.MeshStandardMaterial({ color: THEME.frameColor, roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb6bcc0, roughness: 0.35, metalness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xdfeefc, transparent: true, opacity: 0.18, roughness: 0.1 }),
};

/** Per-area wall material, tinted by wing. Disposed with the area. */
export function makeWallMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
}

/** Per-area floor material; texture cloned so each area tiles to its own size. */
export function makeFloorMaterial(width: number, length: number): THREE.MeshStandardMaterial {
  const tex = baseFloorTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(width)), Math.max(1, Math.round(length)));
  return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.22, metalness: 0 });
}

/** Per-area wood-band material; tiles along the run length. */
export function makeWoodMaterial(runLength: number): THREE.MeshStandardMaterial {
  const tex = baseWoodTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(runLength / 0.4)), 1);
  return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.55 });
}
