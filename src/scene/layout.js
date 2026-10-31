/* layout.js — shared world coordinates of the procedural PCB.
   Board lies in the XZ plane, top surface at y = 0. Units ≈ millimetres. */

export const BOARD = { x0: -80, x1: 80, z0: -70, z1: 82, thickness: 1.6 };

/** Main SoC in the centre of the board. */
export const CHIP = { x: 0, z: 0, pkg: 18, die: 11 };

/** One functional block per project (order = projects array in content.js). */
export const ZONES = [
  { key: 'safecross', x: -38, z: 22, half: 11, label: 'U2  SAFECROSS · AI-ACCEL' },
  { key: 'campus', x: -40, z: -30, half: 11, label: 'U3  CAMPUS-NET · OSPF' },
  { key: 'talent', x: 38, z: -30, half: 11, label: 'U4  TALENTMATCH · MEM' },
  { key: 'fpga', x: 40, z: 22, half: 11, label: 'U5  FPGA · I2C/SPI/ETH' },
];

/** Gold edge connector (contact section). */
export const CONNECTOR = { x0: -30, x1: 30, z0: 74, z1: 82, pitch: 1.6 };

/** Deterministic RNG so the board looks the same on every visit. */
export function rng(seed = 1337) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coarse occupancy grid (1 unit cells) used to keep traces & parts from overlapping. */
export class Occupancy {
  constructor() {
    this.w = BOARD.x1 - BOARD.x0;
    this.h = BOARD.z1 - BOARD.z0;
    this.cells = new Uint8Array(this.w * this.h);
  }
  idx(x, z) {
    const i = Math.floor(x - BOARD.x0), j = Math.floor(z - BOARD.z0);
    if (i < 1 || j < 1 || i >= this.w - 1 || j >= this.h - 1) return -1;
    return j * this.w + i;
  }
  isFree(x, z) { const k = this.idx(x, z); return k >= 0 && this.cells[k] === 0; }
  rectFree(x0, z0, x1, z1) {
    for (let z = Math.floor(z0); z <= Math.ceil(z1); z++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (!this.isFree(x, z)) return false;
    return true;
  }
  mark(x, z, r = 0) {
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) { const k = this.idx(x + dx, z + dz); if (k >= 0) this.cells[k] = 1; }
  }
  markRect(x0, z0, x1, z1) {
    for (let z = Math.floor(z0); z <= Math.ceil(z1); z++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) this.mark(x, z);
  }
  markPolyline(pts, r = 0) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
      for (let s = 0; s <= n; s++) this.mark(ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n, r);
    }
  }
}
