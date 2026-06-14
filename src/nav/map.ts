import type { Graph } from '../graph/loadGraph';
import type { ConceptNode } from '../graph/types';
import { NHS_BLUE_HEX } from '../world/theme';

interface Pt {
  id: string;
  label: string;
  nx: number; // normalised x in [0,1]
  depth: number;
  sx: number; // last drawn screen x
  sy: number; // last drawn screen y
}

/**
 * A full-graph map / fast-travel overlay. The MauroDataMapper diagram coords are too
 * sparse (3/180), so we compute a tidy inheritance-tree layout: y = depth, x from an
 * in-order walk of the primary-parent spanning forest. Click a concept to travel there.
 */
export class MapOverlay {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private title: HTMLDivElement;
  private pts = new Map<string, Pt>();
  private maxDepth = 1;
  private currentId = '';
  private hoverId: string | null = null;
  visible = false;
  onPick: (id: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(parent: HTMLElement, private graph: Graph) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      background: 'rgba(8,22,38,0.94)',
      zIndex: '50',
      pointerEvents: 'auto',
      fontFamily: 'Arial, Helvetica, sans-serif',
    } as Partial<CSSStyleDeclaration>);
    parent.appendChild(this.root);

    this.title = document.createElement('div');
    Object.assign(this.title.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      top: '12px',
      textAlign: 'center',
      color: '#fff',
      font: 'bold 16px Arial',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    this.title.innerHTML = 'MAP — click a concept to travel · <span style="opacity:.7">M or Esc to close</span>';
    this.root.appendChild(this.title);

    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', cursor: 'pointer' } as Partial<CSSStyleDeclaration>);
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.computeLayout();

    this.canvas.addEventListener('mousemove', (e) => {
      const hit = this.pick(e.clientX, e.clientY);
      const id = hit?.id ?? null;
      if (id !== this.hoverId) {
        this.hoverId = id;
        this.canvas.style.cursor = id ? 'pointer' : 'default';
        this.draw();
      }
    });
    this.canvas.addEventListener('click', (e) => {
      const hit = this.pick(e.clientX, e.clientY);
      if (hit) this.onPick(hit.id);
    });
    addEventListener('resize', () => {
      if (this.visible) this.draw();
    });
  }

  private computeLayout(): void {
    const g = this.graph;
    // primary-parent spanning forest: each node's first parent (already label-sorted)
    const kids = new Map<string, string[]>();
    for (const n of g.nodes) kids.set(n.id, []);
    const roots: ConceptNode[] = [];
    for (const n of g.nodes) {
      if (n.parents.length === 0) roots.push(n);
      else kids.get(n.parents[0])!.push(n.id);
    }
    roots.sort((a, b) => a.label.localeCompare(b.label));
    for (const arr of kids.values()) arr.sort((a, b) => g.label(a).localeCompare(g.label(b)));

    let leaf = 0;
    const xOf = new Map<string, number>();
    const visit = (id: string): number => {
      const cs = kids.get(id)!;
      let x: number;
      if (cs.length === 0) {
        x = leaf++;
      } else {
        const xs = cs.map(visit);
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      xOf.set(id, x);
      return x;
    };
    for (const r of roots) {
      visit(r.id);
      leaf += 1.5; // gap between wings
    }
    const maxX = Math.max(1, leaf - 1.5);
    this.maxDepth = Math.max(1, g.meta.stats.maxDepth);
    for (const n of g.nodes) {
      this.pts.set(n.id, { id: n.id, label: n.label, nx: (xOf.get(n.id) ?? 0) / maxX, depth: n.depth, sx: 0, sy: 0 });
    }
  }

  private pick(cx: number, cy: number): Pt | null {
    let best: Pt | null = null;
    let bestD = 12 * 12;
    for (const p of this.pts.values()) {
      const dx = p.sx - cx;
      const dy = p.sy - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  setCurrent(id: string): void {
    this.currentId = id;
    if (this.visible) this.draw();
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }
  show(): void {
    this.visible = true;
    this.root.style.display = 'block';
    this.draw();
  }
  hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
    this.onClose();
  }

  private draw(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth;
    const Hh = innerHeight;
    this.canvas.width = W * dpr;
    this.canvas.height = Hh * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${Hh}px`;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);

    const mx = 60;
    const top = 54;
    const bottom = 40;
    const sx = (nx: number) => mx + nx * (W - 2 * mx);
    const sy = (depth: number) => top + (depth / this.maxDepth) * (Hh - top - bottom);

    for (const p of this.pts.values()) {
      p.sx = sx(p.nx);
      p.sy = sy(p.depth);
    }

    // edges (to all parents; primary solid, others dashed)
    ctx.lineWidth = 1;
    for (const n of this.graph.nodes) {
      const c = this.pts.get(n.id)!;
      n.parents.forEach((pid, i) => {
        const pp = this.pts.get(pid);
        if (!pp) return;
        ctx.strokeStyle = i === 0 ? 'rgba(150,170,190,0.35)' : 'rgba(150,170,190,0.14)';
        ctx.setLineDash(i === 0 ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(c.sx, c.sy);
        ctx.lineTo(pp.sx, pp.sy);
        ctx.stroke();
      });
    }
    ctx.setLineDash([]);

    // highlight current node's neighbourhood
    const cur = this.graph.byId(this.currentId);
    const neighbours = new Set<string>();
    if (cur) {
      cur.parents.forEach((id) => neighbours.add(id));
      cur.children.forEach((id) => neighbours.add(id));
      cur.outward.forEach((a) => neighbours.add(a.targetId));
      cur.inward.forEach((a) => neighbours.add(a.sourceId));
    }

    // nodes
    for (const p of this.pts.values()) {
      const isCur = p.id === this.currentId;
      const isHover = p.id === this.hoverId;
      const isNbr = neighbours.has(p.id);
      const r = isCur ? 7 : isHover ? 6 : 3.2;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = isCur ? '#ffd34d' : isHover ? '#fff' : isNbr ? '#7fc4ff' : 'rgba(190,205,220,0.75)';
      ctx.fill();
      if (isCur) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = NHS_BLUE_HEX;
        ctx.stroke();
      }
    }

    // labels: roots, current, hovered
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    const label = (p: Pt, color: string, weight = 'normal') => {
      ctx.font = `${weight} 12px Arial`;
      const w = ctx.measureText(p.label).width;
      ctx.fillStyle = 'rgba(8,22,38,0.85)';
      ctx.fillRect(p.sx - w / 2 - 4, p.sy - 24, w + 8, 16);
      ctx.fillStyle = color;
      ctx.fillText(p.label, p.sx, p.sy - 12);
    };
    for (const n of this.graph.nodes) {
      if (n.parents.length === 0) label(this.pts.get(n.id)!, '#cfe0ff', 'bold');
    }
    if (this.hoverId) label(this.pts.get(this.hoverId)!, '#ffffff', 'bold');
    if (cur) label(this.pts.get(cur.id)!, '#ffd34d', 'bold');
  }
}
