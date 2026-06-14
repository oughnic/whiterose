import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { NHS_BLUE_HEX } from './theme';

// --- NHS wayfinding signs: white Arial on NHS blue, drawn to a canvas texture ---

const PX_PER_M = 256; // canvas resolution
const signTexCache = new Map<string, THREE.CanvasTexture>();

export interface SignOptions {
  widthM: number;
  heightM: number;
  fontM?: number; // cap height of body text, in metres
  title?: string; // optional larger heading line
  align?: 'left' | 'center';
  pad?: number; // padding in metres
}

/** A CanvasTexture of white Arial text on an NHS-blue field. Cached by content. */
export function makeSignTexture(lines: string[], opts: SignOptions): THREE.CanvasTexture {
  const key = JSON.stringify([lines, opts]);
  const cached = signTexCache.get(key);
  if (cached) return cached;

  const W = Math.max(64, Math.round(opts.widthM * PX_PER_M));
  const H = Math.max(64, Math.round(opts.heightM * PX_PER_M));
  const pad = Math.round((opts.pad ?? 0.12) * PX_PER_M);
  const bodyPx = Math.round((opts.fontM ?? 0.16) * PX_PER_M);
  const titlePx = Math.round(bodyPx * 1.35);
  const align = opts.align ?? 'center';

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = NHS_BLUE_HEX;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';

  const x = align === 'center' ? W / 2 : pad;
  ctx.textAlign = align === 'center' ? 'center' : 'left';

  let y = pad;
  if (opts.title) {
    ctx.font = `bold ${titlePx}px Arial, Helvetica, sans-serif`;
    y = drawWrapped(ctx, opts.title, x, y, W - pad * 2, titlePx * 1.18);
    y += titlePx * 0.35;
  }
  ctx.font = `${bodyPx}px Arial, Helvetica, sans-serif`;
  for (const line of lines) {
    y = drawWrapped(ctx, line, x, y, W - pad * 2, bodyPx * 1.22);
    if (y > H - pad) break;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  signTexCache.set(key, tex);
  return tex;
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  const words = text.split(/\s+/);
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}

/** A flat sign mesh (NHS blue plate with white Arial text). */
export function makeSign(lines: string[], opts: SignOptions): THREE.Mesh {
  const tex = makeSignTexture(lines, opts);
  const geo = new THREE.PlaneGeometry(opts.widthM, opts.heightM);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  return new THREE.Mesh(geo, mat);
}

// --- SDF text (troika) for long, crisp body text: posters & note/example panels ---

export interface TextBlockOptions {
  maxWidthM: number;
  fontM?: number;
  color?: number | string;
  align?: 'left' | 'center';
  anchorY?: 'top' | 'middle';
}

export function makeTextBlock(text: string, opts: TextBlockOptions): Text {
  const t = new Text();
  t.text = text;
  t.fontSize = opts.fontM ?? 0.075;
  t.maxWidth = opts.maxWidthM;
  t.color = opts.color ?? 0x1c2b2b;
  t.lineHeight = 1.3;
  t.textAlign = opts.align ?? 'left';
  t.anchorX = opts.align === 'center' ? 'center' : 'left';
  t.anchorY = opts.anchorY ?? 'top';
  t.overflowWrap = 'break-word';
  t.sync();
  return t;
}
