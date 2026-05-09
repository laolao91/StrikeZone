import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import { formatPitchType } from '../data/pitch-types'
import { getDotPosition, renderZoneGrid } from './zone'

const GRID_COLS = 7

const DIVIDER = '━'.repeat(38)
const CHARS_PER_LINE = 38

function center(text: string): string {
  const pad = Math.max(0, Math.floor((CHARS_PER_LINE - text.length) / 2))
  return ' '.repeat(pad) + text
}

export const VIEWPORT_SIZE = 8

function formatStartTime(isoString: string): string {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function gameLabel(g: Game): string {
  if (g.gameState === 'Preview') {
    const t = formatStartTime(g.startTime)
    return t ? `${g.awayTeam} vs ${g.homeTeam}    ${t}` : `${g.awayTeam} vs ${g.homeTeam}`
  }
  if (g.gameState === 'Delayed') return `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  Delayed`
  if (g.gameState === 'Final')   return `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  Final`
  return `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  ${g.inningHalf[0]}${g.inning}`
}

function centeredWithCursor(label: string, selected: boolean): string {
  const padded = center(label)
  if (!selected) return padded
  if (padded.startsWith(' ')) return '▶' + padded.slice(1)
  return '▶' + padded
}

export function renderHeader(game: Game, atBat: AtBat | null): string {
  if (game.gameState === 'Final') {
    return center(`${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}  Final`)
  }
  if (game.gameState === 'Preview') {
    return center(`${game.awayTeam} vs ${game.homeTeam}`)
  }
  const score = `${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`
  const inning = `${game.inningHalf} ${game.inning}`
  if (!atBat) return center(`${score} | ${inning}`)
  const count = `B:${atBat.balls} S:${atBat.strikes} O:${atBat.outs}`
  return center(`${score} | ${inning} | ${count}`)
}

function buildDetailLines(
  pitch: Pitch,
  stats: MatchupStats | null,
  batterLast: string,
  pitcherLast: string
): string[] {
  const horizArrow = pitch.breakHorizontal < 0 ? '←' : '→'
  const horizAbs = Math.abs(Math.round(pitch.breakHorizontal))
  const items = [
    formatPitchType(pitch.pitchCode, pitch.pitchDescription),
    `${Math.round(pitch.endSpeed)} mph`,
    pitch.result,
    `${Math.round(pitch.spinRate)} rpm`,
    `Drop ↓${Math.round(pitch.breakVertical)}"`,
    `Move ${horizArrow}${horizAbs}"`,
    `${Math.round(pitch.startSpeed)}→${Math.round(pitch.endSpeed)}`,
    '',
  ]
  if (stats) {
    items.push(`${batterLast} vs ${pitcherLast}`)
    items.push(`${stats.avg}  ${stats.hr} HR  ${stats.ab} AB`)
  }
  return items
}

function buildTwoColumnLines(
  gridRows: string[],
  detailItems: string[],
  zoneLabel: string,
  pitchType: string
): string[] {
  const COL_GAP = '         '
  const lines: string[] = []

  lines.push(`${zoneLabel}${COL_GAP}${pitchType}`)

  const extraAbove = gridRows.length === 8 && !gridRows[0].startsWith('+')
  const startGridIdx = extraAbove ? 1 : 0

  if (extraAbove) {
    lines.push(`${gridRows[0]}${COL_GAP}${detailItems[1] ?? ''}`)
  }

  const gridBody = gridRows.slice(startGridIdx)
  const detailStart = extraAbove ? 2 : 1

  gridBody.forEach((row, i) => {
    const detail = detailItems[detailStart + i] ?? ''
    lines.push(`${row}${COL_GAP}${detail}`)
  })

  const afterGrid = detailStart + gridBody.length
  for (let i = afterGrid; i < detailItems.length; i++) {
    lines.push(`${' '.repeat(GRID_COLS)}${COL_GAP}${detailItems[i]}`)
  }

  return lines
}

export function renderPitchView(
  atBat: AtBat,
  pitch: Pitch,
  stats: MatchupStats | null,
  pitchIndex: number | null,
  totalPitches: number
): string {
  const lines: string[] = []

  const batterLabel = `B: ${atBat.batterLastName} [${atBat.batterHand}]`
  const pitcherLabel = `P: ${atBat.pitcherLastName} [${atBat.pitcherHand}] ${atBat.pitchCount}p`
  lines.push(center(`${batterLabel}   ${pitcherLabel}`))

  const zoneLabel = pitchIndex !== null
    ? `Pitch ${pitchIndex} / ${totalPitches}`
    : "Catcher's view"

  const dotPos = getDotPosition(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot)
  const gridRows = renderZoneGrid(dotPos)
  const detailItems = buildDetailLines(pitch, stats, atBat.batterLastName, atBat.pitcherLastName)

  const twoColLines = buildTwoColumnLines(gridRows, detailItems, zoneLabel, detailItems[0])
  lines.push(...twoColLines)

  lines.push(center('double-tap: game list'))

  return lines.join('\n')
}

export function renderContactView(
  atBat: AtBat,
  pitch: Pitch,
  stats: MatchupStats | null
): string {
  const lines: string[] = []

  const batterLabel = `B: ${atBat.batterLastName} [${atBat.batterHand}]`
  const pitcherLabel = `P: ${atBat.pitcherLastName} [${atBat.pitcherHand}] ${atBat.pitchCount}p`
  lines.push(center(`${batterLabel}   ${pitcherLabel}`))
  lines.push(center(`⚾ ${pitch.contactResult ?? 'IN PLAY'}`))
  lines.push('')

  if (pitch.exitVelocity !== undefined) {
    lines.push(`Exit Velocity   ${Math.round(pitch.exitVelocity)} mph`)
  }
  if (pitch.launchAngle !== undefined) {
    lines.push(`Launch Angle    ${Math.round(pitch.launchAngle)}°`)
  }
  if (pitch.hitDistance !== undefined) {
    lines.push(`Distance        ${Math.round(pitch.hitDistance)} ft`)
  }

  if (stats) {
    lines.push(center(`${atBat.batterLastName} vs ${atBat.pitcherLastName}: ${stats.avg}  ${stats.hr} HR  ${stats.ab} AB`))
  }
  lines.push(center('double-tap: game list'))

  return lines.join('\n')
}

export function renderGameList(
  games: Game[],
  selectedIndex: number,
  viewportStart: number = 0
): string {
  const lines: string[] = []
  lines.push(center('Select a Game'))

  games.slice(viewportStart, viewportStart + VIEWPORT_SIZE).forEach((g, i) => {
    lines.push(centeredWithCursor(gameLabel(g), viewportStart + i === selectedIndex))
  })

  lines.push(center('scroll: navigate  tap: select'))
  return lines.join('\n')
}

export type AppScreenState = 'no-game' | 'loading' | 'error' | 'starting-soon' | 'delayed' | 'final'

export function renderStateScreen(state: AppScreenState, game?: Game): string {
  const lines: string[] = ['', '']
  switch (state) {
    case 'no-game':
      lines.push(center('Select a game in the'))
      lines.push(center('StrikeZone app on your phone'))
      break
    case 'loading':
      lines.push(center('Loading...'))
      break
    case 'error':
      lines.push(center('Unable to load game data.'))
      lines.push('')
      lines.push(center('Tap to retry.'))
      break
    case 'starting-soon':
      if (game) {
        lines.push(center(`${game.awayTeam} vs ${game.homeTeam}`))
        const t = formatStartTime(game.startTime)
        if (t) lines.push(center(t))
      }
      lines.push(center('Game Starting Soon'))
      lines.push('')
      lines.push(center('double-tap: game list'))
      break
    case 'delayed':
      if (game) lines.push(center(`${game.awayTeam} vs ${game.homeTeam}`))
      lines.push(center('Rain Delay'))
      lines.push('')
      lines.push(center('double-tap: game list'))
      break
    case 'final':
      if (game) lines.push(center(`${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`))
      lines.push(center('Final'))
      lines.push('')
      lines.push(center('double-tap: game list'))
      break
  }
  return lines.join('\n')
}
