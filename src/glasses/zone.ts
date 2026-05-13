const ZONE_LEFT  = -0.83
const ZONE_RIGHT =  0.83

// Fixed coordinate range for the image canvas (feet).
// Wider than the zone so out-of-zone pitches still appear.
const IMG_X_MIN = -1.5
const IMG_X_MAX =  1.5
const IMG_Z_MIN =  1.0   // raised floor so zone fills more of the canvas vertically
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

// Render the strike zone as a base64-encoded PNG using the browser Canvas API.
// Returns a base64 string (no data: prefix) suitable for updateImageRawData.
// White = bright green on glasses; black = transparent (shows through to real world).
export function renderZoneCanvas(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Black background — transparent on glasses
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle   = '#ffffff'

  const margin = 6
  const innerW = width  - 2 * margin
  const innerH = height - 2 * margin

  function toX(x: number): number {
    return margin + ((x - IMG_X_MIN) / (IMG_X_MAX - IMG_X_MIN)) * innerW
  }
  function toZ(z: number): number {
    // Z increases upward; canvas Y increases downward — invert
    return margin + ((IMG_Z_MAX - z) / (IMG_Z_MAX - IMG_Z_MIN)) * innerH
  }

  // Strike zone border rectangle (2 px line)
  ctx.lineWidth = 2
  const zx0 = toX(ZONE_LEFT),  zx1 = toX(ZONE_RIGHT)
  const zy0 = toZ(szTop),       zy1 = toZ(szBot)
  ctx.strokeRect(zx0, zy0, zx1 - zx0, zy1 - zy0)

  // 3×3 grid lines inside the zone
  ctx.lineWidth = 1
  const col1 = zx0 + (zx1 - zx0) / 3
  const col2 = zx0 + (zx1 - zx0) * 2 / 3
  const row1 = zy0 + (zy1 - zy0) / 3
  const row2 = zy0 + (zy1 - zy0) * 2 / 3
  ctx.beginPath()
  ctx.moveTo(col1, zy0); ctx.lineTo(col1, zy1)
  ctx.moveTo(col2, zy0); ctx.lineTo(col2, zy1)
  ctx.moveTo(zx0, row1); ctx.lineTo(zx1, row1)
  ctx.moveTo(zx0, row2); ctx.lineTo(zx1, row2)
  ctx.stroke()

  // Ball — filled circle at pitch location
  const bx = toX(pX)
  const bz = toZ(pZ)
  const r  = Math.max(3, Math.round(Math.min(width, height) * 0.04))
  ctx.beginPath()
  ctx.arc(bx, bz, r, 0, Math.PI * 2)
  ctx.fill()

  // Extract RGBA pixels and pack as 4-bit greyscale (2 pixels per byte,
  // high nibble first). This is the raw format the G2 firmware requires —
  // it cannot decode PNG; toDataURL was silently rejected on hardware.
  const { data } = ctx.getImageData(0, 0, width, height)
  const totalPixels = width * height
  const packed = new Uint8Array(Math.ceil(totalPixels / 2))
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4
    const grey = Math.round(((data[off] + data[off + 1] + data[off + 2]) / 3) / 255 * 15) & 0xF
    if (i % 2 === 0) packed[i >> 1]  = grey << 4
    else             packed[i >> 1] |= grey
  }
  let bin = ''
  for (let i = 0; i < packed.length; i++) bin += String.fromCharCode(packed[i])
  return btoa(bin)
}
