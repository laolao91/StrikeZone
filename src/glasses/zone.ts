const ZONE_LEFT  = -0.83
const ZONE_RIGHT =  0.83

// Fixed coordinate range for the image canvas (feet).
// The zone is drawn within this range so out-of-zone pitches are still visible.
const IMG_X_MIN = -1.5
const IMG_X_MAX =  1.5
const IMG_Z_MIN =  0.5
const IMG_Z_MAX =  4.5

export type DotPosition =
  | { inZone: true; row: 0 | 1 | 2; col: 0 | 1 | 2 }
  | { inZone: false; vPos: 'above' | 'below' | 0 | 1 | 2; hPos: 'left' | 'right' | 0 | 1 | 2 }

export function getDotPosition(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number
): DotPosition {
  const colWidth = (ZONE_RIGHT - ZONE_LEFT) / 3
  const rowHeight = (szTop - szBot) / 3

  const vOut = pZ > szTop ? 'above' : pZ < szBot ? 'below' : null
  const hOut = pX < ZONE_LEFT ? 'left' : pX > ZONE_RIGHT ? 'right' : null

  const vBand = vOut === null
    ? (Math.min(2, Math.floor((szTop - pZ) / rowHeight)) as 0 | 1 | 2)
    : null
  const hBand = hOut === null
    ? (Math.min(2, Math.floor((pX - ZONE_LEFT) / colWidth)) as 0 | 1 | 2)
    : null

  if (vBand !== null && hBand !== null) {
    return { inZone: true, row: vBand, col: hBand }
  }

  return {
    inZone: false,
    vPos: vOut ?? vBand!,
    hPos: hOut ?? hBand!,
  }
}

// Render the strike zone as a pixel image.
// Returns one 4-bit value (0–15) per pixel, row-major, top-to-bottom.
// 15 = white (bright green on glasses), 0 = black (transparent).
export function renderZoneImageData(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  width: number,
  height: number
): number[] {
  const pixels = new Array(width * height).fill(0)

  const margin = 6

  function toPixX(x: number): number {
    return Math.round(margin + ((x - IMG_X_MIN) / (IMG_X_MAX - IMG_X_MIN)) * (width  - 2 * margin))
  }
  function toPixZ(z: number): number {
    // Z increases upward; pixel Y increases downward — invert
    return Math.round(margin + ((IMG_Z_MAX - z) / (IMG_Z_MAX - IMG_Z_MIN)) * (height - 2 * margin))
  }

  function setPixel(x: number, y: number, v: number): void {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      pixels[y * width + x] = v
    }
  }

  // Draw strike zone border (2 px thick)
  const zx0 = toPixX(ZONE_LEFT),  zx1 = toPixX(ZONE_RIGHT)
  const zy0 = toPixZ(szTop),       zy1 = toPixZ(szBot)
  for (let t = 0; t < 2; t++) {
    for (let x = zx0; x <= zx1; x++) {
      setPixel(x, zy0 + t, 15)
      setPixel(x, zy1 - t, 15)
    }
    for (let y = zy0; y <= zy1; y++) {
      setPixel(zx0 + t, y, 15)
      setPixel(zx1 - t, y, 15)
    }
  }

  // Draw ball as a filled circle
  const bx = toPixX(pX)
  const bz = toPixZ(pZ)
  const r  = Math.max(4, Math.round(Math.min(width, height) * 0.07))
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        setPixel(bx + dx, bz + dy, 15)
      }
    }
  }

  return pixels
}
