import * as THREE from 'three';
import type { ConceptNode } from '../graph/types';
import type { Graph } from '../graph/loadGraph';
import type { ImageProvider } from '../art/ImageProvider';
import type { Destination, Interactable } from '../nav/interactable';
import { THEME, WING_TINTS } from './theme';
import { materials, makeFloorMaterial, makeWallMaterial, makeWoodMaterial } from './materials';
import { makeSign, makeTextBlock } from './signage';

// --- area geometry constants (metres) ---
const H = THEME.ceilingHeight;
const ROOM_DEPTH = 5.2; // end room: z in [0, ROOM_DEPTH]
const ROOM_HALF = 3.5; // end room half-width
const CORR_HALF = THEME.corridorWidth / 2;
const WALL_T = 0.12;
const BAND_T = 0.04;
const PLAYER_R = 0.35;

export interface Area {
  nodeId: string;
  group: THREE.Group;
  interactables: Interactable[];
  spawn: { x: number; y: number; z: number; heading: number };
  /** Clamp a position to stay inside the (L-shaped) walls; mutates in place. */
  clamp: (p: THREE.Vector3) => void;
  dispose: () => void;
}

/** Tracks per-area resources for disposal (shared `materials.*` are never disposed). */
class Bin {
  geos: THREE.BufferGeometry[] = [];
  mats: THREE.Material[] = [];
  texs: THREE.Texture[] = [];
  texts: { dispose(): void }[] = [];
  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }
  mat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }
  tex<T extends THREE.Texture>(t: T): T {
    this.texs.push(t);
    return t;
  }
  text<T extends { dispose(): void }>(t: T): T {
    this.texts.push(t);
    return t;
  }
  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose(); // leaves shared sign textures intact
    for (const t of this.texs) t.dispose();
    for (const t of this.texts) t.dispose();
  }
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const card = (min: number, max: number) => `${min}..${max === -1 ? '*' : max}`;

export function buildArea(node: ConceptNode, graph: Graph, images: ImageProvider): Area {
  const bin = new Bin();
  const group = new THREE.Group();
  group.name = `area:${node.label}`;
  const interactables: Interactable[] = [];

  const wallColor = WING_TINTS[graph.rootOf(node)] ?? THEME.wallColor;
  const wallMat = bin.mat(makeWallMaterial(wallColor));

  const perSide = Math.max(node.outward.length, node.inward.length);
  const corrLen = clampN(perSide * THEME.bayLength + 3, 8, 48);
  const zEnd = ROOM_DEPTH + corrLen; // entrance (back) wall

  // Down-staircase footprint (a hole cut in the room floor), used iff descendants exist.
  const hasDown = node.descendants.length > 0;
  const down = { cx: ROOM_HALF - 1.2, cz: ROOM_DEPTH - 1.6, fx: 1.7, fz: 1.9 };
  const hx0 = down.cx - down.fx / 2;
  const hx1 = down.cx + down.fx / 2;
  const hz0 = down.cz - down.fz / 2;
  const hz1 = down.cz + down.fz / 2;

  // ---- helpers ----
  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // A solid wall plus its two 6-inch wood bands on the inner face.
  // axis 'x' → wall spans along x at fixed z (normal ±z); 'z' → spans along z at fixed x.
  const addWall = (axis: 'x' | 'z', at: number, from: number, to: number, faceSign: 1 | -1) => {
    const len = Math.abs(to - from);
    const mid = (from + to) / 2;
    if (axis === 'x') {
      addBox(len, H, WALL_T, mid, H / 2, at, wallMat);
    } else {
      addBox(WALL_T, H, len, at, H / 2, mid, wallMat);
    }
    const woodMat = bin.mat(makeWoodMaterial(len));
    if (woodMat.map) bin.tex(woodMat.map);
    for (const cy of [THEME.skirtingCentre, THEME.trolleyBandCentre]) {
      if (axis === 'x') {
        const z = at + faceSign * (WALL_T / 2 + BAND_T / 2);
        addBox(len, THEME.woodBandHeight, BAND_T, mid, cy, z, woodMat);
      } else {
        const x = at + faceSign * (WALL_T / 2 + BAND_T / 2);
        addBox(BAND_T, THEME.woodBandHeight, len, x, cy, mid, woodMat);
      }
    }
  };

  const addFloor = (cx: number, cz: number, w: number, d: number) => {
    if (w <= 0 || d <= 0) return;
    const mat = bin.mat(makeFloorMaterial(w, d));
    if (mat.map) bin.tex(mat.map);
    const floor = new THREE.Mesh(bin.geo(new THREE.PlaneGeometry(w, d)), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    group.add(floor);
  };
  const addCeil = (cx: number, cz: number, w: number, d: number) => {
    const ceil = new THREE.Mesh(bin.geo(new THREE.PlaneGeometry(w, d)), materials.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, H, cz);
    group.add(ceil);
  };

  const addLed = (x: number, z: number, w = 0.6, d = 1.2) => {
    const led = new THREE.Mesh(bin.geo(new THREE.PlaneGeometry(w, d)), materials.led);
    led.rotation.x = Math.PI / 2;
    led.position.set(x, H - 0.02, z);
    group.add(led);
  };

  // ---- shell: end room + corridor ----
  addCeil(0, ROOM_DEPTH / 2, ROOM_HALF * 2, ROOM_DEPTH);
  addCeil(0, ROOM_DEPTH + corrLen / 2, CORR_HALF * 2, corrLen);
  addFloor(0, ROOM_DEPTH + corrLen / 2, CORR_HALF * 2, corrLen);
  if (hasDown) {
    // room floor as four strips surrounding the stairwell hole
    addFloor(0, hz0 / 2, ROOM_HALF * 2, hz0); // back
    addFloor(0, (hz1 + ROOM_DEPTH) / 2, ROOM_HALF * 2, ROOM_DEPTH - hz1); // front
    addFloor((-ROOM_HALF + hx0) / 2, down.cz, hx0 + ROOM_HALF, down.fz); // left
    addFloor((hx1 + ROOM_HALF) / 2, down.cz, ROOM_HALF - hx1, down.fz); // right
  } else {
    addFloor(0, ROOM_DEPTH / 2, ROOM_HALF * 2, ROOM_DEPTH);
  }

  addWall('x', 0, -ROOM_HALF, ROOM_HALF, +1); // end wall (poster), inner face +z
  addWall('z', -ROOM_HALF, 0, ROOM_DEPTH, +1); // room left wall, inner +x
  addWall('z', +ROOM_HALF, 0, ROOM_DEPTH, -1); // room right wall, inner -x
  addWall('x', ROOM_DEPTH, -ROOM_HALF, -CORR_HALF, -1); // left return
  addWall('x', ROOM_DEPTH, CORR_HALF, ROOM_HALF, -1); // right return
  addWall('z', -CORR_HALF, ROOM_DEPTH, zEnd, +1); // corridor left (inward doors)
  addWall('z', +CORR_HALF, ROOM_DEPTH, zEnd, -1); // corridor right (outward doors)
  addWall('x', zEnd, -CORR_HALF, CORR_HALF, -1); // entrance/back wall

  // LED ceiling panels
  addLed(0, ROOM_DEPTH * 0.35, 1.0, 1.4);
  addLed(0, ROOM_DEPTH * 0.7, 1.0, 1.4);
  for (let z = ROOM_DEPTH + 2; z < zEnd; z += 4) addLed(0, z);

  // ---- poster (description) on the end wall ----
  buildPoster(node, group, bin);

  // ---- notes (left room wall) & examples (right room wall) ----
  placeSidePanels(node, group, bin);

  // ---- nameplate on the entrance wall ("You are in …") ----
  {
    const sign = makeSign([], { widthM: 2.6, heightM: 0.6, title: node.label, fontM: 0.18 });
    bin.geo(sign.geometry as THREE.BufferGeometry);
    bin.mat(sign.material as THREE.Material);
    sign.position.set(0, 1.9, zEnd - WALL_T / 2 - 0.01);
    sign.rotation.y = Math.PI; // face back toward the room
    group.add(sign);
  }

  // ---- doors: outward (right, +x), inward (left, -x) ----
  const placeDoors = (
    list: { elementLabel: string; min: number; max: number; id: string }[],
    side: 1 | -1, // +1 right wall (+x), -1 left wall (-x)
    kind: 'door-out' | 'door-in',
  ) => {
    const wallX = side * CORR_HALF;
    const faceSign = side === 1 ? -1 : 1; // sign faces into corridor
    list.forEach((a, i) => {
      const z = ROOM_DEPTH + 1.6 + i * THEME.bayLength;
      if (z > zEnd - 1.2) return; // ran out of wall
      const targetLabel = graph.label(a.id);
      const doorGroup = makeDoorPanel(targetLabel, card(a.min, a.max), kind, bin);
      doorGroup.position.set(wallX + faceSign * (WALL_T / 2 + 0.02), 0, z);
      doorGroup.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      group.add(doorGroup);
      interactables.push({
        target: doorGroup,
        kind,
        title: targetLabel,
        destinations: [{ id: a.id, label: targetLabel, depth: graph.depth(a.id) }],
      });
    });
  };
  placeDoors(
    node.outward.map((o) => ({ elementLabel: o.elementLabel, min: o.min, max: o.max, id: o.targetId })),
    1,
    'door-out',
  );
  placeDoors(
    node.inward.map((o) => ({ elementLabel: o.elementLabel, min: o.min, max: o.max, id: o.sourceId })),
    -1,
    'door-in',
  );

  // ---- fill empty corridor bays with windows / pictures ----
  fillEmptyBays(node, images, group, bin, { corrLen, zEnd, usedRight: node.outward.length, usedLeft: node.inward.length });

  // ---- self-reference doors (pig's ear) at the very end, flanking the poster ----
  node.self.forEach((s, i) => {
    const x = i === 0 ? ROOM_HALF - 0.9 : -(ROOM_HALF - 0.9);
    const doorGroup = makeDoorPanel(node.label, card(s.min, s.max), 'door-self', bin, s.elementLabel);
    doorGroup.position.set(x, 0, 0 + WALL_T / 2 + 0.02);
    group.add(doorGroup);
    interactables.push({
      target: doorGroup,
      kind: 'door-self',
      title: `${node.label} (self: ${s.elementLabel})`,
      destinations: [{ id: node.id, label: node.label, depth: node.depth }],
    });
  });

  // ---- inheritance: up stairs (ancestors), down stairs (descendants), lift ----
  if (node.ancestors.length > 0) {
    const dests = toDestinations(node.ancestors, graph, 'supertype');
    const stair = buildUpStairs(dests, bin);
    stair.position.set(-ROOM_HALF + 1.0, 0, ROOM_DEPTH - 1.4);
    group.add(stair);
    interactables.push({ target: stair, kind: 'stairs-up', title: 'Up — supertypes', destinations: dests });
  }
  if (hasDown) {
    const dests = toDestinations(node.descendants, graph, 'subtype');
    const well = buildDownStairwell(dests, { hx0, hx1, hz0, hz1, cx: down.cx, cz: down.cz, fx: down.fx, fz: down.fz }, bin);
    group.add(well);
    interactables.push({ target: well, kind: 'stairs-down', title: 'Down — subtypes', destinations: dests });
  }
  if (node.ancestors.length > 0 || node.descendants.length > 0) {
    const up = toDestinations(node.ancestors, graph, 'supertype');
    const down = toDestinations(node.descendants, graph, 'subtype');
    const lift = buildLift([...up, ...down], bin);
    lift.position.set(ROOM_HALF - 0.6, 0, 1.0);
    lift.rotation.y = -Math.PI / 2;
    group.add(lift);
    interactables.push({ target: lift, kind: 'lift', title: 'Lift — inheritance', destinations: [...up, ...down] });
  }

  // ---- player clamp (L-shaped footprint) ----
  const clamp = (p: THREE.Vector3) => {
    p.z = clampN(p.z, 0.3, zEnd - 0.3);
    const half = p.z >= ROOM_DEPTH ? CORR_HALF : ROOM_HALF;
    p.x = clampN(p.x, -half + PLAYER_R, half - PLAYER_R);
  };

  return {
    nodeId: node.id,
    group,
    interactables,
    spawn: { x: 0, y: THEME.eyeHeight, z: zEnd - 1.6, heading: 0 },
    clamp,
    dispose: () => bin.dispose(),
  };
}

// --------------------------------------------------------------------------

function toDestinations(ids: string[], graph: Graph, note: string): Destination[] {
  return ids.map((id) => ({ id, label: graph.label(id), depth: graph.depth(id), note }));
}

function buildPoster(node: ConceptNode, group: THREE.Group, bin: Bin) {
  const wallFace = WALL_T / 2; // 0.06
  // Frame box flush against the wall, protruding 0.06 m.
  const frame = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(2.7, 1.9, 0.06)), materials.frame);
  frame.position.set(0, 1.75, wallFace + 0.03);
  group.add(frame);
  // White board sits PROUD of the frame's front face (at wallFace + 0.06).
  const boardZ = wallFace + 0.075;
  const board = new THREE.Mesh(
    bin.geo(new THREE.PlaneGeometry(2.55, 1.75)),
    bin.mat(new THREE.MeshStandardMaterial({ color: 0xfbfbf7, roughness: 0.95 })),
  );
  board.position.set(0, 1.75, boardZ);
  group.add(board);

  const title = bin.text(makeTextBlock(node.label.toUpperCase(), { maxWidthM: 2.4, fontM: 0.15, align: 'center', color: 0x005eb8 }));
  title.position.set(0, 2.5, boardZ + 0.01);
  group.add(title);

  const body = bin.text(
    makeTextBlock(node.description || '(no definition given)', { maxWidthM: 2.3, fontM: 0.082, align: 'left', color: 0x20302f }),
  );
  body.position.set(-1.15, 2.18, boardZ + 0.01);
  group.add(body);
}

function placeSidePanels(node: ConceptNode, group: THREE.Group, bin: Bin) {
  const panelWall = (items: string[], side: 1 | -1, heading: string) => {
    const wallX = side * ROOM_HALF;
    const faceSign = side === 1 ? -1 : 1;
    const rot = side === 1 ? -Math.PI / 2 : Math.PI / 2; // local +z → wall normal
    items.slice(0, 4).forEach((txt, i) => {
      const z = 1.15 + i * 1.18;
      if (z > ROOM_DEPTH - 0.6) return;
      const panel = new THREE.Group();
      const board = new THREE.Mesh(
        bin.geo(new THREE.PlaneGeometry(1.05, 0.98)),
        bin.mat(new THREE.MeshStandardMaterial({ color: 0xfbfbf7, roughness: 0.95 })),
      );
      panel.add(board);
      const hdr = makeSign([], { widthM: 1.05, heightM: 0.22, title: `${heading} ${i + 1}`, fontM: 0.12 });
      bin.geo(hdr.geometry as THREE.BufferGeometry);
      bin.mat(hdr.material as THREE.Material);
      hdr.position.set(0, 0.6, 0.012);
      panel.add(hdr);
      const t = bin.text(makeTextBlock(txt, { maxWidthM: 0.95, fontM: 0.05, align: 'left', color: 0x20302f }));
      t.position.set(-0.47, 0.4, 0.02);
      panel.add(t);
      panel.position.set(wallX + faceSign * (WALL_T / 2 + 0.02), 1.5, z);
      panel.rotation.y = rot;
      group.add(panel);
    });
  };
  panelWall(node.notes, -1, 'NOTE');
  panelWall(node.examples, 1, 'EXAMPLE');
}

function makeDoorPanel(
  label: string,
  cardText: string,
  kind: 'door-out' | 'door-in' | 'door-self',
  bin: Bin,
  via?: string,
): THREE.Group {
  const g = new THREE.Group();
  // leaf
  const leafMat = bin.mat(makeWoodMaterial(2.1));
  if (leafMat.map) bin.tex(leafMat.map);
  const leaf = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(THEME.doorWidth, THEME.doorHeight, 0.06)), leafMat);
  leaf.position.set(0, THEME.doorHeight / 2, 0);
  g.add(leaf);
  // handle
  const handle = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(0.04, 0.18, 0.05)), materials.metal);
  handle.position.set(THEME.doorWidth / 2 - 0.12, 1.0, 0.05);
  g.add(handle);
  // sign above
  const dirTag = kind === 'door-out' ? '→ ' : kind === 'door-in' ? '← ' : '↻ ';
  const sub = via ? `${via}  ${cardText}` : cardText;
  const sign = makeSign([sub], { widthM: 1.1, heightM: 0.42, title: dirTag + label, fontM: 0.1 });
  bin.geo(sign.geometry as THREE.BufferGeometry);
  bin.mat(sign.material as THREE.Material);
  sign.position.set(0, THEME.doorHeight + 0.28, 0.04);
  g.add(sign);
  return g;
}

function capList(dests: Destination[], n: number): string[] {
  const lines = dests.slice(0, n).map((d) => `${'· '.repeat(Math.min(d.depth, 4))}${d.label}`);
  if (dests.length > n) lines.push(`…and ${dests.length - n} more`);
  return lines;
}

function buildUpStairs(dests: Destination[], bin: Bin): THREE.Group {
  const g = new THREE.Group();
  const steps = 5;
  const rise = 0.18;
  const run = 0.28;
  const woodMat = bin.mat(makeWoodMaterial(2));
  if (woodMat.map) bin.tex(woodMat.map);
  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(1.6, rise, run)), woodMat);
    step.position.set(0, i * rise + rise / 2, -i * run);
    g.add(step);
  }
  const sign = makeSign(capList(dests, 7), { widthM: 1.7, heightM: 1.5, title: '▲ UP — supertypes', fontM: 0.1, align: 'left' });
  bin.geo(sign.geometry as THREE.BufferGeometry);
  bin.mat(sign.material as THREE.Material);
  sign.position.set(0, 2.0, 0.4);
  g.add(sign);
  return g;
}

interface Footprint {
  hx0: number;
  hx1: number;
  hz0: number;
  hz1: number;
  cx: number;
  cz: number;
  fx: number;
  fz: number;
}

function buildDownStairwell(dests: Destination[], fp: Footprint, bin: Bin): THREE.Group {
  const g = new THREE.Group();
  const depth = 1.2;
  // pit walls + floor (dark)
  const pitBottom = new THREE.Mesh(bin.geo(new THREE.PlaneGeometry(fp.fx, fp.fz)), materials.frame);
  pitBottom.rotation.x = -Math.PI / 2;
  pitBottom.position.set(fp.cx, -depth, fp.cz);
  g.add(pitBottom);
  const wallBox = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(w, depth, d)), materials.frame);
    m.position.set(x, -depth / 2, z);
    g.add(m);
  };
  wallBox(fp.fx + 0.02, WALL_T, fp.cx, fp.hz0); // far (low-z) wall
  wallBox(fp.fx + 0.02, WALL_T, fp.cx, fp.hz1); // near (high-z) wall
  wallBox(WALL_T, fp.fz + 0.02, fp.hx0, fp.cz); // left
  wallBox(WALL_T, fp.fz + 0.02, fp.hx1, fp.cz); // right
  // descending steps (from the near/high-z edge down toward the sign)
  const woodMat = bin.mat(makeWoodMaterial(2));
  if (woodMat.map) bin.tex(woodMat.map);
  const rise = 0.18;
  const run = 0.26;
  for (let i = 0; i < 6; i++) {
    const step = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(fp.fx - 0.3, rise, run)), woodMat);
    step.position.set(fp.cx, -i * rise - rise / 2, fp.hz1 - 0.3 - i * run);
    g.add(step);
  }
  // metal nosing around the opening so it reads as a stairwell
  const kerb = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(w, 0.08, d)), materials.metal);
    m.position.set(x, 0.04, z);
    g.add(m);
  };
  kerb(fp.fx + 0.12, 0.08, fp.cx, fp.hz0);
  kerb(fp.fx + 0.12, 0.08, fp.cx, fp.hz1);
  kerb(0.08, fp.fz, fp.hx0, fp.cz);
  kerb(0.08, fp.fz, fp.hx1, fp.cz);
  // sign board at the far end, facing the approaching player
  const sign = makeSign(capList(dests, 7), { widthM: 1.6, heightM: 1.5, title: '▼ DOWN — subtypes', fontM: 0.1, align: 'left' });
  bin.geo(sign.geometry as THREE.BufferGeometry);
  bin.mat(sign.material as THREE.Material);
  sign.position.set(fp.cx, 1.95, fp.hz0 + 0.06);
  g.add(sign);
  return g;
}

function buildLift(dests: Destination[], bin: Bin): THREE.Group {
  const g = new THREE.Group();
  // recessed metal double doors
  const doors = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(1.3, 2.3, 0.08)), materials.metal);
  doors.position.set(0, 1.15, 0);
  g.add(doors);
  const seam = new THREE.Mesh(bin.geo(new THREE.BoxGeometry(0.02, 2.3, 0.1)), materials.frame);
  seam.position.set(0, 1.15, 0.01);
  g.add(seam);
  // call-panel directory sign beside the doors
  const sign = makeSign(capList(dests, 9), { widthM: 0.9, heightM: 1.7, title: 'LIFT', fontM: 0.085, align: 'left' });
  bin.geo(sign.geometry as THREE.BufferGeometry);
  bin.mat(sign.material as THREE.Material);
  sign.position.set(0.95, 1.3, 0.05);
  g.add(sign);
  return g;
}

function fillEmptyBays(
  node: ConceptNode,
  images: ImageProvider,
  group: THREE.Group,
  bin: Bin,
  dims: { corrLen: number; zEnd: number; usedRight: number; usedLeft: number },
) {
  const totalBays = Math.floor(dims.corrLen / THEME.bayLength);
  const frame = (w: number, h: number) => bin.geo(new THREE.PlaneGeometry(w, h));
  const place = (side: 1 | -1, bayIndex: number, kind: 'window' | 'art') => {
    const z = ROOM_DEPTH + 1.6 + bayIndex * THEME.bayLength;
    if (z > dims.zEnd - 1.2) return;
    const faceSign = side === 1 ? -1 : 1;
    const x = side * CORR_HALF + faceSign * (WALL_T / 2 + 0.02);
    const ref = kind === 'window' ? images.getWindowScene(node, `${side}:${bayIndex}`) : images.getWallArt(node, `${side}:${bayIndex}`);
    bin.tex(ref.texture);
    const w = kind === 'window' ? 1.4 : 0.9;
    const h = kind === 'window' ? 1.1 : 1.2;
    const mat = bin.mat(new THREE.MeshBasicMaterial({ map: ref.texture }));
    const pic = new THREE.Mesh(frame(w, h), mat);
    pic.position.set(x, 1.55, z);
    pic.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    group.add(pic);
    // dark surround
    const fr = new THREE.Mesh(bin.geo(new THREE.PlaneGeometry(w + 0.12, h + 0.12)), materials.frame);
    fr.position.set(side * CORR_HALF + faceSign * (WALL_T / 2 + 0.015), 1.55, z);
    fr.rotation.y = pic.rotation.y;
    group.add(fr);
  };
  for (let b = 0; b < totalBays; b++) {
    if (b >= dims.usedRight) place(1, b, b % 2 === 0 ? 'window' : 'art');
    if (b >= dims.usedLeft) place(-1, b, b % 2 === 0 ? 'art' : 'window');
  }
}
