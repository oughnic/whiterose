// The contract between the build-time pipeline and the runtime renderer.
// The pipeline (pipeline/src/buildConceptGraph.ts) produces a ConceptGraph;
// the renderer consumes it. This file is the single source of truth for its shape.

/** An association this concept owns, pointing at another concept (→ RIGHT-wall door). */
export interface OutwardAssoc {
  elementId: string;
  elementLabel: string;
  targetId: string;
  min: number;
  max: number; // -1 = unbounded (*)
  oppositeMin: number;
  oppositeMax: number;
}

/** An association owned by another concept that points at this one (→ LEFT-wall door). */
export interface InwardAssoc {
  elementId: string;
  elementLabel: string;
  sourceId: string;
  min: number;
  max: number;
  oppositeMin: number;
  oppositeMax: number;
}

/** A self-reference (the "pig's ear", → door at the corridor end). */
export interface SelfAssoc {
  elementId: string;
  elementLabel: string;
  min: number;
  max: number;
}

/** One concept = one area of the hospital. */
export interface ConceptNode {
  id: string;
  label: string;
  description: string; // end-wall poster text
  notes: string[]; // side-wall panels, ordered by their note index
  examples: string[]; // side-wall panels, ordered by their example index
  /** Other directive metadata (synonym, plural, source, clause, …), key → values. */
  extra: Record<string, string[]>;
  parents: string[]; // direct supertypes
  children: string[]; // direct subtypes
  ancestors: string[]; // ALL transitive supertypes (UP-stairs board), deduped
  descendants: string[]; // ALL transitive subtypes (DOWN-stairs board), deduped
  depth: number; // longest path from a root; orders inheritance boards
  outward: OutwardAssoc[];
  inward: InwardAssoc[];
  self: SelfAssoc[];
  /** Real x/y from MauroDataMapper's own class diagram, if present (seeds the 2D map). */
  layoutHint: { x: number; y: number } | null;
}

export interface ConceptGraphStats {
  classCount: number;
  associationCount: number; // reference elements owned (outward + self) across all nodes
  selfRefCount: number;
  rootCount: number;
  maxDepth: number;
}

export interface ConceptGraphMeta {
  modelLabel: string;
  modelDescription: string;
  schemaVersion: string;
  stats: ConceptGraphStats;
}

export interface ConceptGraph {
  meta: ConceptGraphMeta;
  nodes: ConceptNode[];
  /** Convenience lookup: concept id → index into `nodes`. */
  index: { byId: Record<string, number> };
}
