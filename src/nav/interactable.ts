import type { Object3D } from 'three';

export type PortalKind =
  | 'door-out' // outward association → right wall
  | 'door-in' // inward association → left wall
  | 'door-self' // self reference → corridor end
  | 'stairs-up' // ancestors
  | 'stairs-down' // descendants
  | 'lift'; // inheritance directory

export interface Destination {
  id: string;
  label: string;
  depth: number;
  /** Relationship phrasing, e.g. "supertype", "via «element»". */
  note?: string;
}

/** Something the crosshair can target and the player can activate. */
export interface Interactable {
  /** The mesh(es) the ray must hit; raycasting uses this object's subtree. */
  target: Object3D;
  kind: PortalKind;
  /** Prompt heading, e.g. the destination concept or "Up — supertypes". */
  title: string;
  /** 1 destination → activate teleports directly; >1 → opens a chooser. */
  destinations: Destination[];
}
