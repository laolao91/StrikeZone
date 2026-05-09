const ZONE_LEFT = -0.83
const ZONE_RIGHT = 0.83

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

// Border-only strike zone: outer rectangle, dot inside at the zone position.
// All rows are 11 chars wide: +---------+ or |         |
const GRID_INNER = 9
const BORDER_ROW = '+' + '-'.repeat(GRID_INNER) + '+'
const EMPTY_ROW  = '|' + ' '.repeat(GRID_INNER) + '|'

// Interior positions for columns 0, 1, 2 within the 9-char interior.
const COL_POS = [1, 4, 7] as const

function innerRow(dotCol: 0 | 1 | 2 | 'left' | 'right' | null): string {
  const cells = Array<string>(GRID_INNER).fill(' ')
  if (dotCol !== null) {
    const pos = dotCol === 'left' ? 0
              : dotCol === 'right' ? GRID_INNER - 1
              : COL_POS[dotCol]
    cells[pos] = '●'
  }
  return '|' + cells.join('') + '|'
}

// Dot above or below the grid, aligned to the horizontal column position.
function dotOutsideLine(hPos: 'left' | 'right' | 0 | 1 | 2): string {
  // Overall offset = 1 (for '+' border char) + COL_POS[col]
  const offset = hPos === 'left' ? 0
               : hPos === 0 ? 2
               : hPos === 1 ? 5
               : hPos === 2 ? 8
               : GRID_INNER + 1  // 'right': just past the closing '+'
  return ' '.repeat(offset) + '●'
}

export function renderZoneGrid(pos: DotPosition): string[] {
  const rows: string[] = []

  if (!pos.inZone && pos.vPos === 'above') {
    rows.push(dotOutsideLine(pos.hPos))
  }

  rows.push(BORDER_ROW)

  for (let r = 0; r <= 2; r++) {
    if (pos.inZone && pos.row === r) {
      rows.push(innerRow(pos.col))
    } else if (!pos.inZone && typeof pos.vPos === 'number' && pos.vPos === r) {
      // vPos is a number only when hPos is 'left' or 'right'
      rows.push(innerRow(pos.hPos as 'left' | 'right'))
    } else {
      rows.push(EMPTY_ROW)
    }
  }

  rows.push(BORDER_ROW)

  if (!pos.inZone && pos.vPos === 'below') {
    rows.push(dotOutsideLine(pos.hPos))
  }

  return rows
}
