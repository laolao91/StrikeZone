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

// ── Minimal pure-JS PNG encoder ───────────────────────────────────────────────
// Produces an 8-bit greyscale PNG (colour type 0) with no canvas, no DOM.
// Canvas was the original approach but canvas.toDataURL() on hardware
// (iOS WKWebView) returns a corrupt/empty result, and getImageData() may
// return zeroed data under fingerprinting protection.  Generating the PNG
// entirely in JS bypasses both restrictions.
//
// Compression: uses CompressionStream('deflate-raw') when available (iOS 16.4+,
// Chrome 80+). A mostly-black zone image compresses from ~23 KB to <1 KB,
// well within the BLE send limit.  Falls back to uncompressed DEFLATE blocks
// (BTYPE=00) on older runtimes.

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

// Wraps raw (filter-prepended) image rows in a zlib stream.
// Uses CompressionStream for real DEFLATE compression when available —
// a zone image compresses from ~17 KB raw to ~200-400 bytes.
async function buildZlib(raw: Uint8Array): Promise<number[]> {
  const adler = adler32(raw)

  // Try CompressionStream (available iOS 16.4+, Chrome 80+, Firefox 113+)
  const CS = (globalThis as Record<string, unknown>)['CompressionStream'] as
    (new (format: string) => { writable: WritableStream; readable: ReadableStream }) | undefined
  if (CS) {
    try {
      const cs = new CS('deflate-raw')
      const writer = cs.writable.getWriter()
      await writer.write(raw)
      await writer.close()
      const chunks: Uint8Array[] = []
      const reader = cs.readable.getReader()
      while (true) {
        const { done, value } = await reader.read() as { done: boolean; value: Uint8Array }
        if (done) break
        chunks.push(value)
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0)
      const compressed = new Uint8Array(totalLen)
      let off = 0
      for (const c of chunks) { compressed.set(c, off); off += c.length }
      // zlib wrap: [0x78, 0x01] header + deflate bytes + adler32
      return [0x78, 0x01, ...compressed, ...u32be(adler)]
    } catch { /* fall through */ }
  }

  // Fallback: uncompressed DEFLATE stored blocks (BTYPE=00)
  const blocks: number[] = []
  const BLOCK = 65535
  for (let offset = 0; offset < raw.length; offset += BLOCK) {
    const chunk  = raw.subarray(offset, Math.min(offset + BLOCK, raw.length))
    const isFinal = (offset + BLOCK >= raw.length) ? 1 : 0
    const len = chunk.length
    blocks.push(isFinal, len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, (~len >> 8) & 0xff)
    for (let i = 0; i < chunk.length; i++) blocks.push(chunk[i])
  }
  return [0x78, 0x01, ...blocks, ...u32be(adler)]
}

async function encodePNG(pixels: Uint8Array, width: number, height: number): Promise<string> {
  // Filter byte 0 (None) prepended to each row
  const raw = new Uint8Array(height * (1 + width))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width)] = 0
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (1 + width) + 1)
  }

  const zlib = await buildZlib(raw)

  const png = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    ...pngChunk('IHDR', [...u32be(width), ...u32be(height), 8, 0, 0, 0, 0]), // 8-bit greyscale
    ...pngChunk('IDAT', zlib),
    ...pngChunk('IEND', []),
  ]

  let bin = ''
  for (const b of png) bin += String.fromCharCode(b)
  return btoa(bin)
}

// ── Strike zone renderer ──────────────────────────────────────────────────────

export async function renderZoneCanvas(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  width: number,
  height: number
): Promise<string> {
  const pixels = new Uint8Array(width * height) // 0 = black/transparent

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

  const r = Math.max(3, Math.round(Math.min(width, height) * 0.04))
  disc(toX(pX), toZ(pZ), r)

  return encodePNG(pixels, width, height)
}
