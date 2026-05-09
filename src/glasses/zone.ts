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

function dotForRow(pos: DotPosition, row: 0 | 1 | 2): string {
  if (pos.inZone) {
    return pos.row === row ? pos.col === 0 ? '│●│ │ │'
                           : pos.col === 1 ? '│ │●│ │'
                           : '│ │ │●│'
                          : '│ │ │ │'
  }
  const vPos = pos.vPos
  if (typeof vPos === 'number' && vPos === row) {
    if (pos.hPos === 'left')  return '●│ │ │ │'
    if (pos.hPos === 'right') return '│ │ │ │●'
  }
  return '│ │ │ │'
}

function dotLineBelow(hPos: 'left' | 'right' | 0 | 1 | 2): string {
  if (hPos === 'left')  return '●'
  if (hPos === 0)       return ' ●'
  if (hPos === 1)       return '  ●'
  if (hPos === 2)       return '   ●'
  return '    ●'
}

export function renderZoneGrid(pos: DotPosition): string[] {
  const rows: string[] = []

  if (!pos.inZone && pos.vPos === 'above') {
    rows.push(dotLineBelow(pos.hPos))
  }

  rows.push('┌─┬─┬─┐')
  rows.push(dotForRow(pos, 0))
  rows.push('├─┼─┼─┤')
  rows.push(dotForRow(pos, 1))
  rows.push('├─┼─┼─┤')
  rows.push(dotForRow(pos, 2))
  rows.push('└─┴─┴─┘')

  if (!pos.inZone && pos.vPos === 'below') {
    rows.push(dotLineBelow(pos.hPos))
  }

  return rows
}
