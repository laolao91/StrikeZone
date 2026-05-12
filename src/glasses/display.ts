import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import { formatPitchType } from '../data/pitch-types'

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
  const count = `B:${atBat.balls} S:${atBat.strikes} O:${atBat.outs} P:${atBat.pitchCount}`
  return center(`${score} | ${inning} | ${count}`)
}

// Returns the two-line pitch-view header: score/inning + batter/pitcher.
export function renderPitchHeader(game: Game, atBat: AtBat): string {
  const scoreLine = renderHeader(game, atBat)
  const matchup = `B: ${atBat.batterLastName} [${atBat.batterHand}]  P: ${atBat.pitcherLastName} [${atBat.pitcherHand}] ${atBat.pitchCount}p`
  return `${scoreLine}\n${matchup}`
}

// Pitch info text rendered in the center container.
export function renderPitchInfo(
  _atBat: AtBat,
  pitch: Pitch,
  pitchIndex: number | null,
  totalPitches: number
): string {
  const horizArrow = pitch.breakHorizontal < 0 ? '←' : '→'
  const horizAbs = Math.abs(Math.round(pitch.breakHorizontal))
  const zoneLabel = pitchIndex !== null ? `Pitch ${pitchIndex} / ${totalPitches}` : "Catcher's view"

  return [
    zoneLabel,
    formatPitchType(pitch.pitchCode, pitch.pitchDescription),
    `${Math.round(pitch.endSpeed)} mph`,
    pitch.result,
    `${Math.round(pitch.spinRate)} rpm`,
    `Drop ↓${Math.round(pitch.breakVertical)}"`,
    `Move ${horizArrow}${horizAbs}"`,
    `${Math.round(pitch.startSpeed)}→${Math.round(pitch.endSpeed)}`,
    '',
    'double-tap: game list',
  ].join('\n')
}

// Contact info text for the center container.
export function renderContactInfo(
  _atBat: AtBat,
  pitch: Pitch
): string {
  const lines = [
    "Catcher's view",
    pitch.contactResult ?? 'IN PLAY',
    '',
  ]

  if (pitch.exitVelocity !== undefined) lines.push(`Exit  ${Math.round(pitch.exitVelocity)} mph`)
  if (pitch.launchAngle !== undefined)  lines.push(`Angle ${Math.round(pitch.launchAngle)}°`)
  if (pitch.hitDistance !== undefined)  lines.push(`Dist  ${Math.round(pitch.hitDistance)} ft`)

  lines.push('')
  lines.push('double-tap: game list')

  return lines.join('\n')
}

// Batter vs pitcher splits for the right container.
export function renderSplitsInfo(atBat: AtBat, game: Game, stats: MatchupStats | null): string {
  const batterTeam  = game.inningHalf === 'Top' ? game.awayTeam : game.homeTeam
  const pitcherTeam = game.inningHalf === 'Top' ? game.homeTeam : game.awayTeam
  const lines = [
    `${batterTeam} B: ${atBat.batterLastName} (${atBat.batterHand})`,
    `${pitcherTeam} P: ${atBat.pitcherLastName} (${atBat.pitcherHand}HP)`,
  ]
  if (stats) {
    lines.push('', stats.avg, `${stats.hr} HR`, `${stats.ab} AB`)
  }
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
