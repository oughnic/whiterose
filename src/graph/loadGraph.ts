import type { ConceptGraph, ConceptNode } from './types';

/** Thin wrapper over the generated concept-graph.json with id lookups. */
export class Graph {
  constructor(private readonly data: ConceptGraph) {}

  get meta() {
    return this.data.meta;
  }
  get nodes(): ConceptNode[] {
    return this.data.nodes;
  }

  byId(id: string): ConceptNode | undefined {
    const i = this.data.index.byId[id];
    return i === undefined ? undefined : this.data.nodes[i];
  }
  label(id: string): string {
    return this.byId(id)?.label ?? id;
  }
  depth(id: string): number {
    return this.byId(id)?.depth ?? 0;
  }

  /** The topmost root ancestor of a node (used to pick its "wing" tint). */
  rootOf(node: ConceptNode): string {
    if (node.ancestors.length === 0) return node.label;
    // ancestors are ordered uppermost-first by depth, so [0] is a root-most ancestor.
    return this.label(node.ancestors[0]);
  }

  /**
   * A sensible starting concept for the tour: prefer one that exercises EVERY feature
   * (up-stairs, down-stairs, lift, outward/inward/self doors, notes, examples), so the
   * opening area demonstrates the whole vocabulary — not just the node with the most
   * descendants (which would be a bare root like "thing").
   */
  defaultStart(): ConceptNode {
    const coverage = (n: ConceptNode) =>
      (n.ancestors.length > 0 ? 1 : 0) +
      (n.descendants.length > 0 ? 1 : 0) +
      (n.outward.length > 0 ? 1 : 0) +
      (n.inward.length > 0 ? 1 : 0) +
      (n.self.length > 0 ? 1 : 0) +
      (n.notes.length > 0 ? 1 : 0) +
      (n.examples.length > 0 ? 1 : 0);
    // Among the best-covered, prefer a manageable size (avoid the 170-descendant giant).
    const totalDoors = (n: ConceptNode) => n.outward.length + n.inward.length;
    return [...this.data.nodes].sort((a, b) => {
      const c = coverage(b) - coverage(a);
      if (c !== 0) return c;
      return Math.abs(totalDoors(a) - 12) - Math.abs(totalDoors(b) - 12);
    })[0];
  }
}

export async function loadGraph(): Promise<Graph> {
  const url = `${import.meta.env.BASE_URL}concept-graph.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  return new Graph((await res.json()) as ConceptGraph);
}
