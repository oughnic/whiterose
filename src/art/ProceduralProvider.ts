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

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** A rolling Yorkshire-dale view with atmospheric depth, dry-stone walls and sheep. */
function paintDale(seed: string): THREE.Texture {
  const rnd = seededRng(seed + ':dale');
  const W = 640;
  const H = 420;
  const [c, ctx] = canvas(W, H);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
  sky.addColorStop(0, '#9fc4e6');
  sky.addColorStop(0.7, '#cfe2ee');
  sky.addColorStop(1, '#eef4ef');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // sun glow
  const sunX = W * (0.15 + rnd() * 0.7);
  const sunY = H * 0.2;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, 'rgba(255,250,235,0.95)');
  glow.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // clouds
  for (let i = 0; i < 4; i++) {
    const cx = rnd() * W;
    const cy = H * (0.1 + rnd() * 0.25);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.ellipse(cx + j * 16 - 32, cy + (rnd() - 0.5) * 8, 22 + rnd() * 14, 12 + rnd() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // hills — far (hazy blue-green) to near (green)
  const layers = ['#aebfb4', '#94ad92', '#7a9c74', '#5f8a57', '#4d7a48'];
  layers.forEach((col, i) => {
    const baseY = H * (0.42 + i * 0.115);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 16) {
      const y = baseY + Math.sin(x * 0.008 + i * 1.7 + rnd() * 0.3) * (14 + i * 5) + Math.sin(x * 0.03 + i) * 4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  });

  // dry-stone walls climbing the nearest hills
  ctx.strokeStyle = 'rgba(70,70,64,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x0 = rnd() * W;
    const y0 = H * (0.78 + rnd() * 0.15);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (rnd() - 0.5) * 120, y0 - 30 - rnd() * 50);
    ctx.stroke();
  }
  // sheep on the near pasture
  ctx.fillStyle = 'rgba(245,245,240,0.9)';
  for (let i = 0; i < 7; i++) {
    const x = rnd() * W;
    const y = H * (0.85 + rnd() * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  vignette(ctx, W, H);
  return toTexture(c);
}

/** A calm internal courtyard: lawn, paving, path, bench and a tree. */
function paintCourtyard(seed: string): THREE.Texture {
  const rnd = seededRng(seed + ':court');
  const W = 640;
  const H = 420;
  const [c, ctx] = canvas(W, H);

  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#bcd3e2');
  sky.addColorStop(1, '#e6eef0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.62);

  // far building wall (brick-ish)
  ctx.fillStyle = '#c2b3a6';
  ctx.fillRect(0, H * 0.34, W, H * 0.28);
  ctx.fillStyle = 'rgba(120,150,170,0.5)';
  for (let i = 0; i < 6; i++) ctx.fillRect(30 + i * 100, H * 0.4, 46, 60); // windows

  // lawn + paving
  ctx.fillStyle = '#7fa86b';
  ctx.fillRect(0, H * 0.62, W, H * 0.38);
  ctx.fillStyle = '#c9ccc8';
  ctx.fillRect(0, H * 0.6, W, H * 0.05);
  // a path
  ctx.fillStyle = '#c0c3bd';
  ctx.beginPath();
  ctx.moveTo(W * 0.45, H);
  ctx.lineTo(W * 0.52, H);
  ctx.lineTo(W * 0.5, H * 0.66);
  ctx.lineTo(W * 0.47, H * 0.66);
  ctx.closePath();
  ctx.fill();

  // tree
  const tx = W * (0.18 + rnd() * 0.2);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(tx - 5, H * 0.45, 10, H * 0.22);
  ctx.fillStyle = '#5f8f4e';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(tx + (rnd() - 0.5) * 40, H * 0.4 + (rnd() - 0.5) * 30, 30 + rnd() * 16, 0, Math.PI * 2);
    ctx.fill();
  }
  // bench
  ctx.fillStyle = '#6f5436';
  ctx.fillRect(W * 0.62, H * 0.7, 90, 8);
  ctx.fillRect(W * 0.62, H * 0.7, 6, 26);
  ctx.fillRect(W * 0.62 + 84, H * 0.7, 6, 26);

  vignette(ctx, W, H);
  return toTexture(c);
}

const PALETTES = [
  ['#d7e3df', '#a7c2b8', '#6f9a8d', '#3f6f63'],
  ['#e6ddcc', '#cdb89a', '#a98a64', '#6f5740'],
  ['#dbe2ea', '#a9bccf', '#6f8aa6', '#41607f'],
  ['#e7d9da', '#c9a9b3', '#9a6f80', '#5f4150'],
];

/** Calm, framed abstract art — layered translucent forms over a graded ground. */
function paintAbstract(seed: string): THREE.Texture {
  const rnd = seededRng(seed + ':art');
  const W = 420;
  const H = 560;
  const [c, ctx] = canvas(W, H);
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, pal[0]);
  bg.addColorStop(1, pal[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // a calm horizon band
  ctx.fillStyle = pal[2];
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, H * (0.5 + rnd() * 0.2), W, H * 0.18);

  // layered translucent forms
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = 0.18 + rnd() * 0.3;
    ctx.fillStyle = pal[1 + Math.floor(rnd() * 3)];
    if (rnd() < 0.5) {
      const r = 50 + rnd() * 130;
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const w = 40 + rnd() * 120;
      const h = 80 + rnd() * 220;
      ctx.save();
      ctx.translate(rnd() * W, rnd() * H);
      ctx.rotate((rnd() - 0.5) * 0.6);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  // subtle grain
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.04})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1, 1);
  }

  // inner mount border
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  vignette(ctx, W, H);
  return toTexture(c);
}

export class ProceduralProvider implements ImageProvider {
  getPoster(): ImageRef | null {
    return null; // posters are text-only
  }

  getWallArt(node: ConceptNode, slotSeed: string): ImageRef {
    return { texture: paintAbstract(node.id + slotSeed), attribution: 'Procedurally generated' };
  }

  getWindowScene(node: ConceptNode, slotSeed: string): ImageRef {
    const rnd = seededRng(node.id + slotSeed + ':win');
    const tex = rnd() < 0.62 ? paintDale(node.id + slotSeed) : paintCourtyard(node.id + slotSeed);
    return { texture: tex, attribution: null };
  }
}
