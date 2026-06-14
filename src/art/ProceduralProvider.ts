import * as THREE from 'three';
import type { ConceptNode } from '../graph/types';
import { seededRng } from '../util/rng';
import type { ImageProvider, ImageRef } from './ImageProvider';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A rolling Yorkshire-dale view: graded sky, layered hills, dry-stone-wall hints. */
function paintDale(seed: string): THREE.Texture {
  const rnd = seededRng(seed + ':dale');
  const W = 512;
  const H = 384;
  const [c, ctx] = canvas(W, H);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, '#aacbe6');
  sky.addColorStop(1, '#eef3f0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // A soft sun/cloud
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(W * (0.2 + rnd() * 0.6), H * 0.22, 26 + rnd() * 20, 0, Math.PI * 2);
  ctx.fill();

  // Layered hills, back (hazy green-blue) to front (greener)
  const layers = ['#9fb6a3', '#88a884', '#6f9468', '#5c8553'];
  layers.forEach((col, i) => {
    const baseY = H * (0.45 + i * 0.13);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    let y = baseY;
    for (let x = 0; x <= W; x += 32) {
      y = baseY + Math.sin(x * 0.01 + i + rnd() * 2) * (12 + i * 6) + (rnd() - 0.5) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  });

  // Dry-stone field walls on the nearest hill
  ctx.strokeStyle = 'rgba(80,80,75,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const y0 = H * (0.82 + i * 0.04);
    ctx.moveTo(rnd() * W * 0.3, y0);
    ctx.lineTo(W * (0.4 + rnd() * 0.5), y0 - 20 - rnd() * 30);
    ctx.stroke();
  }
  return toTexture(c);
}

/** A calm internal courtyard view: grass, a bench, sky above. */
function paintCourtyard(seed: string): THREE.Texture {
  const rnd = seededRng(seed + ':court');
  const W = 512;
  const H = 384;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#dfe7e9';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7fa86b';
  ctx.fillRect(0, H * 0.62, W, H * 0.38);
  // paving border
  ctx.fillStyle = '#c9ccc8';
  ctx.fillRect(0, H * 0.58, W, H * 0.06);
  // a tree
  const tx = W * (0.25 + rnd() * 0.5);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(tx - 4, H * 0.45, 8, H * 0.2);
  ctx.fillStyle = '#5f8f4e';
  ctx.beginPath();
  ctx.arc(tx, H * 0.42, 40 + rnd() * 18, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

/** Abstract, calm generative art for empty walls — bands & soft shapes. */
function paintAbstract(seed: string): THREE.Texture {
  const rnd = seededRng(seed + ':art');
  const W = 384;
  const H = 512;
  const [c, ctx] = canvas(W, H);
  const palettes = [
    ['#cfe0dc', '#8fb3ab', '#5d8a82', '#34625b'],
    ['#e3dccb', '#c9b79a', '#9c8463', '#6d5740'],
    ['#d6dde6', '#9fb1c6', '#6e87a6', '#43607f'],
  ];
  const pal = palettes[Math.floor(rnd() * palettes.length)];
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = pal[1 + Math.floor(rnd() * 3)];
    ctx.globalAlpha = 0.6 + rnd() * 0.4;
    if (rnd() < 0.5) {
      const y = rnd() * H;
      ctx.fillRect(0, y, W, 20 + rnd() * 80);
    } else {
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H, 30 + rnd() * 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

export class ProceduralProvider implements ImageProvider {
  getPoster(): ImageRef | null {
    return null; // posters are text-only in the slice
  }

  getWallArt(node: ConceptNode, slotSeed: string): ImageRef {
    return { texture: paintAbstract(node.id + slotSeed), attribution: 'Procedurally generated' };
  }

  getWindowScene(node: ConceptNode, slotSeed: string): ImageRef {
    // Alternate dale / courtyard deterministically per slot.
    const rnd = seededRng(node.id + slotSeed + ':win');
    const tex = rnd() < 0.6 ? paintDale(node.id + slotSeed) : paintCourtyard(node.id + slotSeed);
    return { texture: tex, attribution: null };
  }
}
