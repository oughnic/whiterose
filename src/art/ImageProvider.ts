import type { Texture } from 'three';
import type { ConceptNode } from '../graph/types';

export interface ImageRef {
  texture: Texture;
  /** Attribution string to show on an in-world plaque, or null if not required. */
  attribution: string | null;
}

/**
 * Source of poster art, empty-wall pictures and window views. The renderer depends
 * only on this interface, so the imagery decision (procedural / curated PD+CC / …)
 * can change without touching world-generation. The default ProceduralProvider
 * synthesises everything and ships zero third-party images — legally safe.
 */
export interface ImageProvider {
  /** Optional illustrative image for a concept poster (null → text-only poster). */
  getPoster(node: ConceptNode): ImageRef | null;
  /** A picture for an otherwise-empty wall slot. */
  getWallArt(node: ConceptNode, slotSeed: string): ImageRef;
  /** A view seen through a window (courtyard / Yorkshire dale). */
  getWindowScene(node: ConceptNode, slotSeed: string): ImageRef;
}
