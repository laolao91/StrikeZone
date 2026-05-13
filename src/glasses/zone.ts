const ZONE_LEFT  = -0.83
const ZONE_RIGHT =  0.83

const IMG_X_MIN = -1.5
const IMG_X_MAX =  1.5
const IMG_Z_MIN =  1.0
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

// Generate a raw RGBA pixel buffer for the strike zone — no canvas, no DOM.
// Canvas getImageData() returns zeroed data under iOS WKWebView canvas
// fingerprinting protection, producing an all-transparent image on glasses.
// Pure JS pixel generation bypasses that restriction entirely.
export function renderZoneCanvas(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  width: number,
  height: number
): Uint8Array {
  // RGBA buffer — all zeros = black/transparent background
  const rgba = new Uint8Array(width * height * 4)

  function setPixel(x: number, y: number): void {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || xi >= width || yi < 0 || yi >= height) return
    const i = (yi * width + xi) * 4
    rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 255
  }

  function hLine(x0: number, x1: number, y: number, thick = 1): void {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++)
      for (let t = 0; t < thick; t++) setPixel(x, y + t)
  }

  function vLine(x: number, y0: number, y1: number, thick = 1): void {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let t = 0; t < thick; t++) setPixel(x + t, y)
  }

  function disc(cx: number, cy: number, r: number): void {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) setPixel(cx + dx, cy + dy)
  }

  const margin = 6
  const innerW = width  - 2 * margin
  const innerH = height - 2 * margin

  function toX(x: number): number {
    return margin + ((x - IMG_X_MIN) / (IMG_X_MAX - IMG_X_MIN)) * innerW
  }
  function toZ(z: number): number {
    return margin + ((IMG_Z_MAX - z) / (IMG_Z_MAX - IMG_Z_MIN)) * innerH
  }

  const zx0 = toX(ZONE_LEFT),  zx1 = toX(ZONE_RIGHT)
  const zy0 = toZ(szTop),       zy1 = toZ(szBot)

  // Zone border (2 px)
  hLine(zx0, zx1, zy0, 2)
  hLine(zx0, zx1, zy1, 2)
  vLine(zx0, zy0, zy1, 2)
  vLine(zx1, zy0, zy1, 2)

  // 3×3 grid lines (1 px)
  const col1 = zx0 + (zx1 - zx0) / 3
  const col2 = zx0 + (zx1 - zx0) * 2 / 3
  const row1 = zy0 + (zy1 - zy0) / 3
  const row2 = zy0 + (zy1 - zy0) * 2 / 3
  vLine(col1, zy0, zy1)
  vLine(col2, zy0, zy1)
  hLine(zx0, zx1, row1)
  hLine(zx0, zx1, row2)

  // Pitch dot
  const r = Math.max(3, Math.round(Math.min(width, height) * 0.04))
  disc(toX(pX), toZ(pZ), r)

  return rgba
}
