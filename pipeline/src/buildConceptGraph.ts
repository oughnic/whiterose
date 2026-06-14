// Build-time pipeline: MauroDataMapper export  →  concept-graph.json
//
// Pure functions (loadExport / buildGraph) are unit-tested; main() is the CLI
// that writes public/concept-graph.json and asserts the verified facts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ConceptGraph,
  ConceptNode,
  InwardAssoc,
  OutwardAssoc,
  SelfAssoc,
} from '../../src/graph/types';
import type { RawDataClass, RawExport, RawMetadata } from './schema';
import { checkFacts } from './schema';

const ISO_NS = 'directives.org.iso';
const XMI_NS = 'uk.ac.ox.softeng.maurodatamapper.xmi';
const DIAGRAM_NS = 'uk.ac.ox.softeng.maurodatamapper.diagram';

const NOTE_KEY = /^note\s*\d+$/i;
const EXAMPLE_KEY = /^example\s*\d+$/i;
const INDEX_IN_KEY = /(\d+)\s*$/;

/** Directive keys we don't surface as "extra" panels. */
const EXTRA_SKIP = new Set(['_profiled', 'classname']);

export function loadExport(path: string): RawExport {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RawExport;
  if (!raw.model || !Array.isArray(raw.model.classes)) {
    throw new Error(`${path} is not a MauroDataMapper export (missing model.classes)`);
  }
  return raw;
}

function metaIndex(key: string): number {
  const m = key.match(INDEX_IN_KEY);
  return m ? Number(m[1]) : 0;
}

/** note 1.. / example 1.. (tolerant of casing + the "example1" no-space variant). */
function collectNotesExamples(cls: RawDataClass): {
  notes: string[];
  examples: string[];
  extra: Record<string, string[]>;
} {
  const notes: { n: number; value: string }[] = [];
  const examples: { n: number; value: string }[] = [];
  const extra: Record<string, string[]> = {};
  for (const m of cls.metadata ?? []) {
    if (m.namespace !== ISO_NS) continue;
    if (NOTE_KEY.test(m.key)) {
      notes.push({ n: metaIndex(m.key), value: m.value });
    } else if (EXAMPLE_KEY.test(m.key)) {
      examples.push({ n: metaIndex(m.key), value: m.value });
    } else if (!EXTRA_SKIP.has(m.key.toLowerCase())) {
      (extra[m.key] ??= []).push(m.value);
    }
  }
  notes.sort((a, b) => a.n - b.n);
  examples.sort((a, b) => a.n - b.n);
  return { notes: notes.map((x) => x.value), examples: examples.map((x) => x.value), extra };
}

function layoutHint(cls: RawDataClass): { x: number; y: number } | null {
  let x: number | undefined;
  let y: number | undefined;
  for (const m of cls.metadata ?? []) {
    if (m.namespace !== DIAGRAM_NS) continue;
    if (m.key === 'layoutX') x = Number(m.value);
    else if (m.key === 'layoutY') y = Number(m.value);
  }
  return x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : null;
}

function metaNumber(metadata: RawMetadata[] | undefined, ns: string, key: string, fallback: number): number {
  const hit = metadata?.find((m) => m.namespace === ns && m.key === key);
  if (!hit) return fallback;
  const n = Number(hit.value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildGraph(raw: RawExport): ConceptGraph {
  const classes = raw.model.classes;
  const classById = new Map<string, RawDataClass>();
  for (const c of classes) classById.set(c.id, c);

  const dataTypeById = new Map(raw.model.dataTypes?.map((d) => [d.id, d]) ?? []);

  // --- inheritance: parents (given) + children (inverted) ---
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const c of classes) {
    children.set(c.id, children.get(c.id) ?? []);
    parents.set(c.id, []);
  }
  for (const c of classes) {
    for (const pid of c.extendsIds ?? []) {
      if (!classById.has(pid)) continue; // skip dangling parent ref
      parents.get(c.id)!.push(pid);
      children.get(pid)!.push(c.id); // initialised for every class id above
    }
  }

  // --- transitive closures (memoised, diamond-deduped, cycle-guarded) ---
  const closure = (start: string, edges: Map<string, string[]>, memo: Map<string, Set<string>>): Set<string> => {
    const cached = memo.get(start);
    if (cached) return cached;
    const acc = new Set<string>();
    const stack = new Set<string>(); // recursion guard
    const visit = (id: string) => {
      if (stack.has(id)) return; // cycle — stop
      stack.add(id);
      for (const next of edges.get(id) ?? []) {
        if (!acc.has(next)) {
          acc.add(next);
          visit(next);
        }
      }
      stack.delete(id);
    };
    visit(start);
    memo.set(start, acc);
    return acc;
  };
  const ancMemo = new Map<string, Set<string>>();
  const descMemo = new Map<string, Set<string>>();

  // --- depth: longest path from a root (cycle-safe) ---
  const depthMemo = new Map<string, number>();
  const depthStack = new Set<string>();
  const depthOf = (id: string): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    if (depthStack.has(id)) return 0; // cycle
    depthStack.add(id);
    const ps = parents.get(id) ?? [];
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(depthOf));
    depthStack.delete(id);
    depthMemo.set(id, d);
    return d;
  };

  // --- associations (single pass builds outward + self, mirrors into inward) ---
  const outward = new Map<string, OutwardAssoc[]>();
  const inward = new Map<string, InwardAssoc[]>();
  const self = new Map<string, SelfAssoc[]>();
  for (const c of classes) {
    outward.set(c.id, []);
    inward.set(c.id, []);
    self.set(c.id, []);
  }
  let referenceElementCount = 0;
  let selfRefCount = 0;
  for (const c of classes) {
    for (const el of c.dataElements ?? []) {
      if (!el.dataTypeId) continue;
      const dt = dataTypeById.get(el.dataTypeId);
      if (!dt || dt.domainType !== 'ReferenceType' || !dt.referenceClassId) continue;
      const targetId = dt.referenceClassId;
      if (!classById.has(targetId)) continue; // dangling reference
      referenceElementCount++;
      const min = el.minMultiplicity ?? 0;
      const max = el.maxMultiplicity ?? -1;
      const oppositeMin = metaNumber(el.metadata, XMI_NS, 'oppositeMinMultiplicity', 0);
      const oppositeMax = metaNumber(el.metadata, XMI_NS, 'oppositeMaxMultiplicity', -1);
      if (targetId === c.id) {
        self.get(c.id)!.push({ elementId: el.id, elementLabel: el.label, min, max });
        selfRefCount++;
      } else {
        outward.get(c.id)!.push({ elementId: el.id, elementLabel: el.label, targetId, min, max, oppositeMin, oppositeMax });
        inward.get(targetId)!.push({ elementId: el.id, elementLabel: el.label, sourceId: c.id, min, max, oppositeMin, oppositeMax });
      }
    }
  }

  // --- assemble nodes (deterministic ordering throughout) ---
  const labelOf = (id: string) => classById.get(id)?.label ?? id;
  const byLabelThenId = (a: string, b: string) =>
    labelOf(a).localeCompare(labelOf(b)) || a.localeCompare(b);
  const byDepthThenLabel = (a: string, b: string) =>
    depthOf(a) - depthOf(b) || labelOf(a).localeCompare(labelOf(b));

  const sortedClasses = [...classes].sort((a, b) => byLabelThenId(a.id, b.id));
  let maxDepth = 0;
  let rootCount = 0;

  const nodes: ConceptNode[] = sortedClasses.map((c) => {
    const { notes, examples, extra } = collectNotesExamples(c);
    const anc = [...closure(c.id, parents, ancMemo)].sort(byDepthThenLabel);
    const desc = [...closure(c.id, children, descMemo)].sort(byDepthThenLabel);
    const d = depthOf(c.id);
    maxDepth = Math.max(maxDepth, d);
    const directParents = [...(parents.get(c.id) ?? [])].sort(byLabelThenId);
    if (directParents.length === 0) rootCount++;
    return {
      id: c.id,
      label: c.label,
      description: c.description ?? '',
      notes,
      examples,
      extra,
      parents: directParents,
      children: [...(children.get(c.id) ?? [])].sort(byLabelThenId),
      ancestors: anc,
      descendants: desc,
      depth: d,
      outward: [...outward.get(c.id)!].sort((x, y) => x.elementLabel.localeCompare(y.elementLabel) || labelOf(x.targetId).localeCompare(labelOf(y.targetId))),
      inward: [...inward.get(c.id)!].sort((x, y) => labelOf(x.sourceId).localeCompare(labelOf(y.sourceId)) || x.elementLabel.localeCompare(y.elementLabel)),
      self: [...self.get(c.id)!].sort((x, y) => x.elementLabel.localeCompare(y.elementLabel)),
      layoutHint: layoutHint(c),
    };
  });

  const byId: Record<string, number> = {};
  nodes.forEach((n, i) => (byId[n.id] = i));

  return {
    meta: {
      modelLabel: raw.model.label,
      modelDescription: raw.model.description ?? '',
      schemaVersion: raw.schemaVersion,
      stats: {
        classCount: classes.length,
        associationCount: referenceElementCount,
        selfRefCount,
        rootCount,
        maxDepth,
      },
    },
    nodes,
    index: { byId },
  };
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
function resolveInputPath(): string {
  const fromArg = process.argv[2];
  const fromEnv = process.env.CONTSYS_EXPORT;
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..', '..');
  return fromArg ?? fromEnv ?? resolve(repoRoot, 'data', 'contsys-export.json');
}

function main(): void {
  const inputPath = resolveInputPath();
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..', '..');
  const outPath = resolve(repoRoot, 'public', 'concept-graph.json');

  console.log(`whiterose pipeline\n  input : ${inputPath}\n  output: ${outPath}\n`);
  const raw = loadExport(inputPath);
  const graph = buildGraph(raw);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(graph, null, 2) + '\n', 'utf8');

  const s = graph.meta.stats;
  const meanDepth = (graph.nodes.reduce((a, n) => a + n.depth, 0) / graph.nodes.length).toFixed(2);
  console.log(
    `model: "${graph.meta.modelLabel}"  (schema ${graph.meta.schemaVersion})\n` +
      `  classes ............ ${s.classCount}\n` +
      `  roots .............. ${s.rootCount}\n` +
      `  max depth .......... ${s.maxDepth}  (mean ${meanDepth})\n` +
      `  reference elements . ${s.associationCount}\n` +
      `  self-references .... ${s.selfRefCount}\n`,
  );

  const checks = checkFacts(graph);
  let failed = 0;
  console.log('verified-fact checks:');
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}: expected ${c.expected}, got ${c.actual}`);
    if (!c.ok) failed++;
  }
  if (failed > 0) {
    console.error(`\n${failed} fact check(s) FAILED — the export has drifted from expectations.`);
    process.exit(1);
  }
  console.log('\nAll checks passed. concept-graph.json written.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
