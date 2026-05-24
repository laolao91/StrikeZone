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

// ── Pure-JS PNG encoders ──────────────────────────────────────────────────────
// No canvas, no DOM — canvas.toDataURL() on iOS WKWebView hardware returns
// corrupt/empty data, and CompressionStream hangs indefinitely in WKWebView
// blocking the displayInFlight guard.  We generate PNG entirely in JS using
// uncompressed DEFLATE stored blocks (BTYPE=00).
//
// encodePNG     — 8-bit greyscale (kept for reference; ~23 KB at 120×144)
// encodePNG1bit — 1-bit greyscale (8 pixels/byte); same 120×144 image is
//                 only ~3.1 KB base64, within the BLE send limit.
//                 The zone is pure black/white so there is no quality loss.

function adler32(data: Uint8Array): number {
  let s1 = 1, s2 = 0
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521
    s2 = (s2 + s1)     % 65521
  }
  return (s2 << 16) | s1
}

function crc32(data: Uint8Array, start = 0, end = data.length): number {
  const table = crc32.table ??= (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return t
  })()
  let crc = 0xffffffff
  for (let i = start; i < end; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
crc32.table = null as unknown as Uint32Array

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function pngChunk(type: string, data: number[]): number[] {
  const typeBytes = type.split('').map(c => c.charCodeAt(0))
  const payload   = new Uint8Array([...typeBytes, ...data])
  return [...u32be(data.length), ...typeBytes, ...data, ...u32be(crc32(payload))]
}


// 1-bit greyscale PNG: rowBytes = ceil(width/8), pixels packed MSB-first.
// Any non-zero pixel value becomes white (1); zero stays black (0).
// At 120×144: raw = 144×16 = 2,304 bytes → ~3,164 bytes base64 ≈ 3.1 KB.
function encodePNG1bit(pixels: Uint8Array, width: number, height: number): string {
  const rowBytes = Math.ceil(width / 8)
  const raw = new Uint8Array(height * (1 + rowBytes))

  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowBytes)] = 0  // filter byte = None
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x])
        raw[y * (1 + rowBytes) + 1 + Math.floor(x / 8)] |= (0x80 >> (x % 8))
    }
  }

  const blocks: number[] = []
  const BLOCK = 65535
  for (let offset = 0; offset < raw.length; offset += BLOCK) {
    const chunk = raw.subarray(offset, Math.min(offset + BLOCK, raw.length))
    const isFinal = (offset + BLOCK >= raw.length) ? 1 : 0
    const len = chunk.length
    blocks.push(isFinal, len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, (~len >> 8) & 0xff)
    for (let i = 0; i < chunk.length; i++) blocks.push(chunk[i])
  }
  const adler = adler32(raw)
  const zlib = [0x78, 0x01, ...blocks, ...u32be(adler)]

  const png = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk('IHDR', [...u32be(width), ...u32be(height), 1, 0, 0, 0, 0]),  // bit_depth=1
    ...pngChunk('IDAT', zlib),
    ...pngChunk('IEND', []),
  ]

  let bin = ''
  for (const b of png) bin += String.fromCharCode(b)
  return btoa(bin)
}

// 4-bit greyscale PNG: rowBytes = ceil(width/2), two pixels packed per byte (high << 4 | low).
// Non-zero pixel → 0xF (white); zero → 0x0 (black). IHDR bit_depth=4, colortype=0.
// At 40×48: raw = 48×21 = 1,008 bytes → ~1,436 base64 chars ≈ 1.4 KB.
export function encodePNG4bit(pixels: Uint8Array, width: number, height: number): string {
  const rowBytes = Math.ceil(width / 2)
  const raw = new Uint8Array(height * (1 + rowBytes))

  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowBytes)] = 0  // filter byte = None
    for (let x = 0; x < width; x += 2) {
      const p0 = pixels[y * width + x] ? 0xF : 0x0
      const p1 = (x + 1 < width && pixels[y * width + x + 1]) ? 0xF : 0x0
      raw[y * (1 + rowBytes) + 1 + (x >> 1)] = (p0 << 4) | p1
    }
  }

  const blocks: number[] = []
  const BLOCK = 65535
  for (let offset = 0; offset < raw.length; offset += BLOCK) {
    const chunk = raw.subarray(offset, Math.min(offset + BLOCK, raw.length))
    const isFinal = (offset + BLOCK >= raw.length) ? 1 : 0
    const len = chunk.length
    blocks.push(isFinal, len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, (~len >> 8) & 0xff)
    for (let i = 0; i < chunk.length; i++) blocks.push(chunk[i])
  }
  const adler = adler32(raw)
  const zlib = [0x78, 0x01, ...blocks, ...u32be(adler)]

  const png = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk('IHDR', [...u32be(width), ...u32be(height), 4, 0, 0, 0, 0]),
    ...pngChunk('IDAT', zlib),
    ...pngChunk('IEND', []),
  ]

  let bin = ''
  for (const b of png) bin += String.fromCharCode(b)
  return btoa(bin)
}

// ── Text-based strike zone ────────────────────────────────────────────────────
//
// 8-line output: position label + 3×3 box-drawing grid (1 row per cell).
// Label encodes vertical (Hi/Md/Lo/↑/↓) and horizontal (L/M/R/◄/►) position.
// In-zone pitches show ● in the matching cell; out-of-zone show an empty grid.

export function renderZoneText(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number
): string {
  const pos = getDotPosition(pX, pZ, szTop, szBot)

  const vStr = (v: 'above' | 'below' | 0 | 1 | 2): string =>
    v === 'above' ? '↑' : v === 'below' ? '↓' : v === 0 ? 'Hi' : v === 1 ? 'Md' : 'Lo'
  const hStr = (h: 'left' | 'right' | 0 | 1 | 2): string =>
    h === 'left' ? '◄' : h === 'right' ? '►' : h === 0 ? 'L' : h === 1 ? 'M' : 'R'

  const label = pos.inZone
    ? `${vStr(pos.row)}/${hStr(pos.col)}`
    : `${vStr(pos.vPos)}/${hStr(pos.hPos)}`

  const TOP = '┌─┬─┬─┐'
  const DIV = '├─┼─┼─┤'
  const BOT = '└─┴─┴─┘'

  const row = (r: 0 | 1 | 2): string => {
    const c = (col: 0 | 1 | 2) =>
      pos.inZone && pos.row === r && pos.col === col ? '●' : ' '
    return `│${c(0)}│${c(1)}│${c(2)}│`
  }

  return [label, TOP, row(0), DIV, row(1), DIV, row(2), BOT].join('\n')
}

// ── Strike zone PNG renderer ──────────────────────────────────────────────────
// Uses encodePNG1bit for a ~3.1 KB payload at 120×144, within the BLE limit.

// ── Shared zone drawing ───────────────────────────────────────────────────────
// Returns a Uint8Array of pixels (0=black, 255=white) for the given dimensions.

function drawZonePixels(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  width: number,
  height: number
): Uint8Array {
  const pixels = new Uint8Array(width * height)

  function set(x: number, y: number): void {
    const xi = Math.round(x), yi = Math.round(y)
    if (xi >= 0 && xi < width && yi >= 0 && yi < height)
      pixels[yi * width + xi] = 255
  }

  function hLine(x0: number, x1: number, y: number, thick = 1): void {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++)
      for (let t = 0; t < thick; t++) set(x, y + t)
  }

  function vLine(x: number, y0: number, y1: number, thick = 1): void {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let t = 0; t < thick; t++) set(x + t, y)
  }

  function disc(cx: number, cy: number, r: number): void {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) set(cx + dx, cy + dy)
  }

  const margin = 4
  const innerW = width  - 2 * margin
  const innerH = height - 2 * margin

  const toX = (x: number) => margin + ((x - IMG_X_MIN) / (IMG_X_MAX - IMG_X_MIN)) * innerW
  const toZ = (z: number) => margin + ((IMG_Z_MAX - z) / (IMG_Z_MAX - IMG_Z_MIN)) * innerH

  const zx0 = toX(ZONE_LEFT), zx1 = toX(ZONE_RIGHT)
  const zy0 = toZ(szTop),      zy1 = toZ(szBot)

  hLine(zx0, zx1, zy0, 2)
  hLine(zx0, zx1, zy1, 2)
  vLine(zx0, zy0, zy1, 2)
  vLine(zx1, zy0, zy1, 2)

  const col1 = zx0 + (zx1 - zx0) / 3
  const col2 = zx0 + (zx1 - zx0) * 2 / 3
  const row1 = zy0 + (zy1 - zy0) / 3
  const row2 = zy0 + (zy1 - zy0) * 2 / 3
  vLine(col1, zy0, zy1)
  vLine(col2, zy0, zy1)
  hLine(zx0, zx1, row1)
  hLine(zx0, zx1, row2)

  const r = Math.max(2, Math.round(Math.min(width, height) * 0.05))
  disc(toX(pX), toZ(pZ), r)

  return pixels
}

export function renderZoneBlank(width: number, height: number): string {
  return encodePNG1bit(new Uint8Array(width * height), width, height)
}

// PNG base64 variant (kept; sendFailed on current SDK/hardware).
export function renderZoneCanvas(
  pX: number, pZ: number, szTop: number, szBot: number,
  width: number, height: number
): string {
  return encodePNG1bit(drawZonePixels(pX, pZ, szTop, szBot, width, height), width, height)
}

// 4-bit greyscale number[] — values 0 (black) or 15 (white).
// Matches the format used by flappy-g2 / demo-app-g2 which successfully call
// updateImageRawData.  The SDK's base64 decode path returns sendFailed; this
// number[] path bypasses it entirely.
export function renderZoneCanvasRaw(
  pX: number, pZ: number, szTop: number, szBot: number,
  width: number, height: number
): number[] {
  return Array.from(drawZonePixels(pX, pZ, szTop, szBot, width, height), v => v ? 15 : 0)
}
