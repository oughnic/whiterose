// The 1960s NHS hospital look, in one place. Tune here, not in geometry code.

export const NHS_BLUE_HEX = '#005eb8'; // Pantone 300
export const NHS_BLUE = 0x005eb8;

export const THEME = {
  // Dimensions (metres)
  corridorWidth: 3.2,
  ceilingHeight: 3.0,
  eyeHeight: 1.62,
  doorWidth: 1.1,
  doorHeight: 2.1,
  bayLength: 3.0, // wall length allotted to one door / panel bay

  // Wood protection bands — both 6 inches (0.1524 m) tall.
  woodBandHeight: 0.1524,
  skirtingCentre: 0.0762, // band centre = half its height, sitting on the floor
  trolleyBandCentre: 0.95, // ~ trolley bumper height

  // Calm palette — washable, institutional, period-appropriate.
  wallColor: 0xb9d2cc, // calm duck-egg / sage green
  ceilingColor: 0xf4f6f6, // near-white
  floorColor: 0xcfd6d8, // pale grey vinyl
  floorAccent: 0xc3cccf, // faint tile grid line
  woodColor: 0x8a5a32, // teak / oak
  frameColor: 0x2f3437, // dark sign/poster frame
  ledColor: 0xffffff,

  // Lighting
  ledIntensity: 1.6,
  ambient: 0.55,
} as const;

// A few calm wall tints, chosen by which of the 6 roots a concept descends from,
// so neighbouring areas feel related and the player gets a sense of "wing".
export const WING_TINTS: Record<string, number> = {
  'continuity of care': 0xb9d2cc, // sage
  thing: 0xc8d3dd, // cool grey-blue
  resource: 0xd7d2c2, // warm stone
  'tangible and visible entity': 0xc6d6c4, // pale green
  party: 0xd9cdd6, // muted lilac
  health: 0xbfd6d8, // duck-egg blue
};
