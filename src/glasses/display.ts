import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import { formatPitchType } from '../data/pitch-types'
import { getDotPosition, renderZoneGrid } from './zone'

const DIVIDER = '━'.repeat(38)
const CHARS_PER_LINE = 38

function center(text: string): string {
  const pad = Math.max(0, Math.floor((CHARS_PER_LINE - text.length) / 2))
  return ' '.repeat(pad) + text
}

export function renderHeader(game: Game, atBat: AtBat | null): string {
  if (game.gameState === 'Final') {
    return center(`${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}  Final`)
  }
  const score = `${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`
  const inning = `${game.inningHalf} ${game.inning}`
  if (!atBat) return center(`${score} | ${inning}`)
  const count = `B:${atBat.balls} S:${atBat.strikes} O:${atBat.outs}`
  return center(`${score} | ${inning} | ${count}`)
}

function buildDetailLines(pitch: Pitch): string[] {
  const horizArrow = pitch.breakHorizontal < 0 ? '←' : '→'
  const horizAbs = Math.abs(Math.round(pitch.breakHorizontal))
  return [
    formatPitchType(pitch.pitchCode, pitch.pitchDescription),
    `${Math.round(pitch.endSpeed)} mph`,
    pitch.result,
    `${Math.round(pitch.spinRate)} rpm`,
    `Drop ↓${Math.round(pitch.breakVertical)}"`,
    `Move ${horizArrow}${horizAbs}"`,
    `${Math.round(pitch.startSpeed)}→${Math.round(pitch.endSpeed)}`,
  ]
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

  const extraAbove = gridRows.length === 8 && !gridRows[0].startsWith('┌')
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
  lines.push(DIVIDER)

  const zoneLabel = pitchIndex !== null
    ? `Pitch ${pitchIndex} / ${totalPitches}`
    : "Catcher's view"

  const dotPos = getDotPosition(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot)
  const gridRows = renderZoneGrid(dotPos)
  const detailItems = buildDetailLines(pitch)

  const twoColLines = buildTwoColumnLines(gridRows, detailItems, zoneLabel, detailItems[0])
  lines.push(...twoColLines)

  lines.push(DIVIDER)
  if (stats) {
    lines.push(center(`${atBat.batterLastName} vs ${atBat.pitcherLastName}: ${stats.avg}  ${stats.hr} HR  ${stats.ab} AB`))
  }

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
  lines.push(DIVIDER)
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

  lines.push(DIVIDER)
  if (stats) {
    lines.push(center(`${atBat.batterLastName} vs ${atBat.pitcherLastName}: ${stats.avg}  ${stats.hr} HR  ${stats.ab} AB`))
  }

  return lines.join('\n')
}

export function renderGameList(games: Game[], selectedIndex: number): string {
  const lines: string[] = []
  lines.push(center('Select a Game'))
  lines.push(DIVIDER)

  games.forEach((g, i) => {
    const selected = i === selectedIndex
    let label: string
    if (g.gameState === 'Preview') {
      label = `${g.awayTeam} vs ${g.homeTeam}`
    } else if (g.gameState === 'Final') {
      label = `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  Final`
    } else {
      label = `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  ${g.inningHalf[0]}${g.inning}`
    }
    lines.push(selected ? `▶ ${label}` : `  ${label}`)
  })

  lines.push(DIVIDER)
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
      if (game) lines.push(center(`${game.awayTeam} vs ${game.homeTeam}`))
      lines.push(center('Game Starting Soon'))
      break
    case 'delayed':
      if (game) lines.push(center(`${game.awayTeam} vs ${game.homeTeam}`))
      lines.push(center('Rain Delay'))
      break
    case 'final':
      if (game) lines.push(center(`${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`))
      lines.push(center('Final'))
      break
  }
  return lines.join('\n')
}
