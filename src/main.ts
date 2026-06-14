import * as THREE from 'three';
import { loadGraph } from './graph/loadGraph';
import type { ConceptNode } from './graph/types';
import { buildArea, type Area } from './world/buildArea';
import { ProceduralProvider } from './art/ProceduralProvider';
import { FirstPerson } from './nav/controls';
import { Hud } from './ui/hud';
import { MapOverlay } from './nav/map';
import { Settings } from './ui/settings';
import type { Interactable } from './nav/interactable';
import { THEME } from './world/theme';

const app = document.getElementById('app')!;

// --- renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb0bb);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0, THEME.eyeHeight, 4);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7378, 1.0 * THEME.ambient + 0.5));
scene.add(new THREE.AmbientLight(0xffffff, THEME.ambient));
const key = new THREE.DirectionalLight(0xffffff, 0.35);
key.position.set(2, 6, 3);
scene.add(key);

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- area manager with a small LRU of generated areas ---
class AreaManager {
  private cache = new Map<string, Area>();
  private max = 4;
  current: Area | null = null;
  targetMap = new Map<THREE.Object3D, Interactable>();
  builtCount = 0;
  disposedCount = 0;

  constructor(
    private graph: Awaited<ReturnType<typeof loadGraph>>,
    private images: ProceduralProvider,
  ) {}

  private get(id: string): Area {
    let area = this.cache.get(id);
    if (area) {
      this.cache.delete(id);
      this.cache.set(id, area); // mark most-recently-used
      return area;
    }
    const node = this.graph.byId(id)!;
    area = buildArea(node, this.graph, this.images);
    this.builtCount++;
    this.cache.set(id, area);
    this.evict();
    return area;
  }

  private evict(): void {
    while (this.cache.size > this.max) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined || oldest === this.current?.nodeId) break;
      const a = this.cache.get(oldest)!;
      this.cache.delete(oldest);
      a.group.removeFromParent();
      a.dispose();
      this.disposedCount++;
    }
  }

  cacheSize(): number {
    return this.cache.size;
  }

  /** Dev: generate every area in turn to prove generation + LRU disposal at scale. */
  stressAll(): { visited: number; built: number; disposed: number; cacheSize: number } {
    for (const n of this.graph.nodes) this.enter(n.id);
    return { visited: this.graph.nodes.length, built: this.builtCount, disposed: this.disposedCount, cacheSize: this.cache.size };
  }

  enter(id: string): ConceptNode {
    const node = this.graph.byId(id)!;
    const area = this.get(id);
    if (this.current && this.current !== area) this.current.group.removeFromParent();
    this.current = area;
    if (!area.group.parent) scene.add(area.group);

    this.targetMap.clear();
    for (const it of area.interactables) this.targetMap.set(it.target, it);

    camera.position.set(area.spawn.x, area.spawn.y, area.spawn.z);
    camera.rotation.set(0, area.spawn.heading, 0);
    this.evict();
    return node;
  }
}

// --- bootstrap ---
async function main() {
  const graph = await loadGraph();
  const images = new ProceduralProvider();
  const hud = new Hud(app);
  const fp = new FirstPerson(camera, renderer.domElement);
  const manager = new AreaManager(graph, images);
  const map = new MapOverlay(app, graph);
  const settings = new Settings(app);
  settings.onChange = (v) => {
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    fp.setSpeed(v.moveSpeed);
    fp.setSensitivity(v.sensitivity);
  };
  settings.onClose = () => {
    if (!hud.chooserOpen && !map.visible) fp.lock();
  };
  settings.apply();

  const backStack: string[] = [];
  let current: ConceptNode = graph.defaultStart();
  let targeted: Interactable | null = null;
  let suppressClickActivate = false;

  function go(id: string, push: boolean) {
    if (push && current) backStack.push(current.id);
    current = manager.enter(id);
    hud.setLocation(current.label, `${graph.rootOf(current)} wing`);
    hud.setBack(backStack.length > 0);
    map.setCurrent(current.id);
  }

  // travel with a fade transition (instant when reduced-motion is on)
  let traveling = false;
  async function travel(id: string, push: boolean) {
    if (settings.values.reducedMotion) {
      go(id, push);
      return;
    }
    if (traveling) return;
    traveling = true;
    await hud.fadeOut(graph.label(id));
    go(id, push);
    await hud.fadeIn();
    traveling = false;
  }

  hud.onBack = () => {
    const prev = backStack.pop();
    if (prev) travel(prev, false);
  };

  // map / fast-travel: click a concept to travel, then resume
  map.onPick = (id) => {
    map.hide();
    travel(id, true);
  };
  map.onClose = () => {
    if (!hud.chooserOpen && !settings.visible) fp.lock();
  };
  function toggleMap() {
    if (map.visible) {
      map.hide();
    } else {
      fp.unlock();
      map.setCurrent(current.id);
      map.show();
    }
  }
  function toggleSettings() {
    if (settings.visible) settings.hide();
    else {
      fp.unlock();
      settings.show();
    }
  }

  function activate(it: Interactable) {
    if (it.destinations.length === 1) {
      travel(it.destinations[0].id, true);
    } else if (it.destinations.length > 1) {
      fp.unlock();
      const kindLabel =
        it.kind === 'lift' ? 'Lift — choose a floor' : it.kind === 'stairs-up' ? 'Up — supertypes' : 'Down — subtypes';
      hud.showChooser(
        kindLabel,
        it.destinations,
        (d) => {
          hud.hideChooser();
          suppressClickActivate = true; // the lock-gesture click shouldn't re-trigger
          fp.lock();
          travel(d.id, true);
        },
        () => {
          hud.hideChooser();
          fp.lock();
        },
      );
    }
  }

  // raycast from screen centre to the nearest interactable within reach
  const raycaster = new THREE.Raycaster();
  raycaster.far = 4.0;
  const centre = new THREE.Vector2(0, 0);
  function pick(): Interactable | null {
    if (!manager.current) return null;
    raycaster.setFromCamera(centre, camera);
    const hits = raycaster.intersectObjects(manager.current.group.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const it = manager.targetMap.get(o);
        if (it) return it;
        o = o.parent;
      }
    }
    return null;
  }

  // input
  renderer.domElement.addEventListener('pointerdown', () => {
    if (suppressClickActivate) {
      suppressClickActivate = false;
      return;
    }
    if (fp.isLocked && targeted) activate(targeted);
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && fp.isLocked && targeted) activate(targeted);
    if (e.code === 'KeyM' && !hud.chooserOpen && !settings.visible) toggleMap();
    if (e.code === 'KeyO' && !hud.chooserOpen && !map.visible) toggleSettings();
    if (e.code === 'Escape') {
      if (hud.chooserOpen) {
        hud.hideChooser();
        fp.lock();
      } else if (map.visible) {
        map.hide();
      } else if (settings.visible) {
        settings.hide();
      }
    }
  });
  fp.onUnlock(() => {
    if (!hud.chooserOpen) hud.setPrompt('Paused — click to resume');
  });
  fp.onLock(() => hud.setPrompt(null));

  // debug hook (dev only): drive the camera / jump areas for verification
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__whiterose = {
      camera,
      go: (id: string) => go(id, true),
      goLabel: (label: string) => {
        const n = graph.nodes.find((x) => x.label === label);
        if (n) go(n.id, true);
      },
      look: (x: number, y: number, z: number) => camera.lookAt(new THREE.Vector3(x, y, z)),
      setPos: (x: number, y: number, z: number) => camera.position.set(x, y, z),
      current: () => current.label,
      lookLimits: () => fp.pitchLimits,
      openMap: () => toggleMap(),
      info: () => ({
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        cacheSize: manager.cacheSize(),
        built: manager.builtCount,
        disposed: manager.disposedCount,
      }),
      stress: () => {
        const r = manager.stressAll();
        go(graph.defaultStart().id, false);
        renderer.render(scene, camera);
        return { ...r, memGeometries: renderer.info.memory.geometries, memTextures: renderer.info.memory.textures };
      },
    };
  }

  // first area + splash
  go(current.id, false);
  hud.showStart(
    'whiterose',
    `Walk the <b>ContSys</b> model of continuity of care as a 1960s NHS hospital.<br>` +
      `Each corridor is a concept. Stairs &amp; lift = super/sub-types; doors = associations.<br>` +
      `Starting at <b>${escapeHtml(current.label)}</b>.`,
    () => fp.lock(),
  );

  // loop
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (manager.current) fp.update(dt, manager.current.clamp);
    targeted = fp.isLocked ? pick() : null;
    if (targeted) {
      const extra = targeted.destinations.length > 1 ? ` (${targeted.destinations.length} options)` : '';
      hud.setPrompt(`E — ${targeted.title}${extra}`);
    } else if (fp.isLocked) {
      hud.setPrompt(null);
    }
    renderer.render(scene, camera);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#fff;padding:20px;font:14px monospace">Failed to start whiterose:\n${err?.stack ?? err}</pre>`;
});
