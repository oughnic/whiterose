import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, loadExport } from '../src/buildConceptGraph';
import { checkFacts } from '../src/schema';
import type { RawExport } from '../src/schema';

const here = dirname(fileURLToPath(import.meta.url));
const dataFile = resolve(here, '..', '..', 'data', 'contsys-export.json');

// A tiny synthetic export exercising the tricky bits: a diamond (pet → mammal → animal
// AND pet → animal), an outward/inward association (thing "has" animal), a self-reference
// (mammal "self-grooms" mammal), and out-of-order note/example keys with inconsistent
// spacing/casing.
const SYNTHETIC: RawExport = {
  schemaVersion: 'test',
  model: {
    id: 'mdl',
    label: 'Test Model',
    description: 'synthetic',
    domainType: 'DataModel',
    classes: [
      { id: 't', label: 'thing', domainType: 'DataClass', extendsIds: [],
        dataElements: [{ id: 'e-has', label: 'has', domainType: 'DataElement', dataTypeId: 'rt-animal',
          minMultiplicity: 0, maxMultiplicity: -1,
          metadata: [
            { namespace: 'uk.ac.ox.softeng.maurodatamapper.xmi', key: 'oppositeMinMultiplicity', value: '1' },
            { namespace: 'uk.ac.ox.softeng.maurodatamapper.xmi', key: 'oppositeMaxMultiplicity', value: '1' },
          ] }] },
      { id: 'a', label: 'animal', domainType: 'DataClass', extendsIds: ['t'], dataElements: [] },
      { id: 'm', label: 'mammal', domainType: 'DataClass', extendsIds: ['a'],
        dataElements: [{ id: 'e-self', label: 'self-grooms', domainType: 'DataElement', dataTypeId: 'rt-mammal',
          minMultiplicity: 0, maxMultiplicity: -1 }],
        metadata: [
          { namespace: 'directives.org.iso', key: 'note 2', value: 'N2' },
          { namespace: 'directives.org.iso', key: 'note 1', value: 'N1' },
          { namespace: 'directives.org.iso', key: 'example1', value: 'E1' },
          { namespace: 'directives.org.iso', key: 'Example 2', value: 'E2' },
          { namespace: 'directives.org.iso', key: 'plural', value: 'mammals' },
          { namespace: 'directives.org.iso', key: '_profiled', value: 'Yes' },
          { namespace: 'directives.org.iso', key: 'className', value: 'mammal' },
        ] },
      { id: 'p', label: 'pet', domainType: 'DataClass', extendsIds: ['m', 'a'], dataElements: [] },
    ],
    dataTypes: [
      { id: 'rt-animal', label: 'animal', domainType: 'ReferenceType', referenceClassId: 'a' },
      { id: 'rt-mammal', label: 'mammal', domainType: 'ReferenceType', referenceClassId: 'm' },
    ],
  },
};

describe('buildGraph — synthetic', () => {
  const g = buildGraph(SYNTHETIC);
  const node = (label: string) => g.nodes.find((n) => n.label === label)!;
  const labelOf = (id: string) => g.nodes[g.index.byId[id]].label;

  it('inverts extendsIds into children', () => {
    expect(node('animal').children.map(labelOf)).toEqual(['mammal', 'pet']);
    expect(node('thing').children.map(labelOf)).toEqual(['animal']);
  });

  it('computes transitive ancestors with diamond dedupe, uppermost-first', () => {
    expect(node('pet').ancestors.map(labelOf)).toEqual(['thing', 'animal', 'mammal']);
  });

  it('computes transitive descendants', () => {
    expect(node('thing').descendants.map(labelOf)).toEqual(['animal', 'mammal', 'pet']);
  });

  it('computes depth as the longest path from a root', () => {
    expect(node('thing').depth).toBe(0);
    expect(node('animal').depth).toBe(1);
    expect(node('mammal').depth).toBe(2);
    expect(node('pet').depth).toBe(3); // 1 + max(animal=1, mammal=2)
  });

  it('classifies outward associations and mirrors them as inward', () => {
    expect(node('thing').outward.map((o) => o.elementLabel)).toEqual(['has']);
    expect(labelOf(node('thing').outward[0].targetId)).toBe('animal');
    expect(node('animal').inward.map((i) => i.elementLabel)).toEqual(['has']);
    expect(labelOf(node('animal').inward[0].sourceId)).toBe('thing');
  });

  it('carries cardinality including opposite multiplicities', () => {
    const out = node('thing').outward[0];
    expect([out.min, out.max, out.oppositeMin, out.oppositeMax]).toEqual([0, -1, 1, 1]);
  });

  it('detects self-references', () => {
    expect(node('mammal').self.map((s) => s.elementLabel)).toEqual(['self-grooms']);
    expect(node('mammal').outward).toHaveLength(0);
    expect(g.meta.stats.selfRefCount).toBe(1);
  });

  it('normalises notes/examples (order + spacing + casing) and collects extras', () => {
    expect(node('mammal').notes).toEqual(['N1', 'N2']);
    expect(node('mammal').examples).toEqual(['E1', 'E2']);
    expect(node('mammal').extra.plural).toEqual(['mammals']);
    expect(node('mammal').extra._profiled).toBeUndefined();
    expect(node('mammal').extra.className).toBeUndefined();
  });

  it('reports stats', () => {
    expect(g.meta.stats.classCount).toBe(4);
    expect(g.meta.stats.rootCount).toBe(1);
    expect(g.meta.stats.maxDepth).toBe(3);
    expect(g.meta.stats.associationCount).toBe(2); // "has" + "self-grooms"
  });

  it('is deterministic (stable output across runs)', () => {
    expect(JSON.stringify(buildGraph(SYNTHETIC))).toBe(JSON.stringify(buildGraph(SYNTHETIC)));
  });
});

const hasData = existsSync(dataFile);
describe.skipIf(!hasData)('buildGraph — real ContSys export', () => {
  it('satisfies all verified-fact checks', () => {
    const checks = checkFacts(buildGraph(loadExport(dataFile)));
    const failed = checks.filter((c) => !c.ok);
    expect(failed, JSON.stringify(failed)).toHaveLength(0);
  });

  it('produces identical output across runs (diffable in git)', () => {
    const raw = loadExport(dataFile);
    expect(JSON.stringify(buildGraph(raw))).toBe(JSON.stringify(buildGraph(raw)));
  });

  it('matches the committed concept-graph.json stats', () => {
    const committed = JSON.parse(
      readFileSync(resolve(here, '..', '..', 'public', 'concept-graph.json'), 'utf8'),
    );
    expect(committed.meta.stats).toEqual(buildGraph(loadExport(dataFile)).meta.stats);
  });
});
