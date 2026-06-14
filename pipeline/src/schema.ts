// Raw MauroDataMapper export shapes (only the fields we consume) and the
// verified-fact assertions that guard against a future export silently drifting.
import type { ConceptGraph } from '../../src/graph/types';

export interface RawMetadata {
  id?: string;
  namespace: string;
  key: string;
  value: string;
}

export interface RawDataElement {
  id: string;
  label: string;
  description?: string;
  domainType: string; // "DataElement"
  minMultiplicity?: number;
  maxMultiplicity?: number; // -1 = unbounded
  dataTypeId?: string;
  metadata?: RawMetadata[];
}

export interface RawDataClass {
  id: string;
  label: string;
  description?: string;
  domainType: string; // "DataClass"
  extendsIds?: string[];
  dataElements?: RawDataElement[];
  metadata?: RawMetadata[];
}

export interface RawDataType {
  id: string;
  label: string;
  domainType: string; // "ReferenceType" | "PrimitiveType" | "EnumerationType" | …
  referenceClassId?: string; // present on ReferenceType
}

export interface RawModel {
  id: string;
  label: string;
  description?: string;
  domainType: string; // "DataModel"
  classes: RawDataClass[];
  dataTypes?: RawDataType[];
}

export interface RawExport {
  schemaVersion: string;
  model: RawModel;
}

// Facts verified against ContSys-FDIS-Feb-2026. If a re-export breaks any of
// these, the pipeline fails loudly — drift should be a conscious decision.
export interface ExpectedFacts {
  classCount: number;
  rootCount: number;
  maxDepth: number;
  widestChildCount: number;
  referenceElementCount: number;
  selfRefCount: number;
}

export const EXPECTED_FACTS: ExpectedFacts = {
  classCount: 180,
  rootCount: 6,
  maxDepth: 8,
  widestChildCount: 15,
  // 247 reference *elements* (= every DataElement is an association in this model),
  // drawing on 104 distinct shared ReferenceType definitions. The doors are driven
  // by the 247 elements, not the 104 types.
  referenceElementCount: 247,
  selfRefCount: 9,
};

export interface FactCheck {
  name: string;
  expected: number;
  actual: number;
  ok: boolean;
}

/** Compare a built graph against EXPECTED_FACTS. Pure — used by CLI and tests. */
export function checkFacts(graph: ConceptGraph, expected: ExpectedFacts = EXPECTED_FACTS): FactCheck[] {
  const widestChildCount = graph.nodes.reduce((m, n) => Math.max(m, n.children.length), 0);
  const checks: FactCheck[] = [
    { name: 'classCount', expected: expected.classCount, actual: graph.meta.stats.classCount, ok: false },
    { name: 'rootCount', expected: expected.rootCount, actual: graph.meta.stats.rootCount, ok: false },
    { name: 'maxDepth', expected: expected.maxDepth, actual: graph.meta.stats.maxDepth, ok: false },
    { name: 'widestChildCount', expected: expected.widestChildCount, actual: widestChildCount, ok: false },
    {
      name: 'referenceElementCount',
      expected: expected.referenceElementCount,
      actual: graph.meta.stats.associationCount,
      ok: false,
    },
    { name: 'selfRefCount', expected: expected.selfRefCount, actual: graph.meta.stats.selfRefCount, ok: false },
  ];
  for (const c of checks) c.ok = c.expected === c.actual;
  return checks;
}
