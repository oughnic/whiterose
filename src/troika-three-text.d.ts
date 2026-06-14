// Minimal typings for troika-three-text (no official @types package).
declare module 'troika-three-text' {
  import { Mesh, Material } from 'three';
  export class Text extends Mesh {
    text: string;
    fontSize: number;
    color: number | string;
    anchorX: number | 'left' | 'center' | 'right' | string;
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | string;
    maxWidth: number;
    lineHeight: number | 'normal';
    textAlign: 'left' | 'right' | 'center' | 'justify';
    whiteSpace: 'normal' | 'nowrap';
    overflowWrap: 'normal' | 'break-word';
    font: string | null;
    fontWeight: number | 'normal' | 'bold';
    material: Material;
    outlineWidth: number | string;
    outlineColor: number | string;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
