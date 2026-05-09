import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'

const BASE = 'https://statsapi.mlb.com'

export interface LiveFeedResult {
  game: Game;
  atBat: AtBat | null;
}

function lastNameFrom(fullName: string): string {
  const parts = fullName.trim().split(' ')
  return parts[parts.length - 1]
}

function getPitchCount(
  boxscore: Record<string, { players: Record<string, { stats: { pitching: { pitchesThrown: number } } }> }>,
  pitcherId: number
): number {
  for (const side of ['away', 'home'] as const) {
    const key = `ID${pitcherId}`
    const player = boxscore[side]?.players?.[key]
    if (player?.stats?.pitching?.pitchesThrown !== undefined) {
      return player.stats.pitching.pitchesThrown
    }
  }
  return 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseScheduleResponse(raw: any): Game[] {
  const dates = raw?.dates ?? []
  if (dates.length === 0) return []
  const games = dates[0]?.games ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return games.map((g: any): Game => {
    const state = g.status?.abstractGameState ?? 'Preview'
    const detailedState: string = g.status?.detailedState ?? ''
    let gameState: Game['gameState'] = 'Preview'
    if (state === 'Final') gameState = 'Final'
    else if (detailedState.toLowerCase().includes('delay')) gameState = 'Delayed'
    else if (state === 'Live') gameState = 'Live'

    const linescore = g.linescore
    return {
      gamePk: g.gamePk,
      awayTeam: g.teams.away.team.abbreviation,
      homeTeam: g.teams.home.team.abbreviation,
      awayScore: g.teams.away.score ?? 0,
      homeScore: g.teams.home.score ?? 0,
      inning: linescore?.currentInning ?? 1,
      inningHalf: linescore?.inningHalf === 'Bottom' ? 'Bot' : 'Top',
      gameState,
      startTime: g.gameDate ?? '',
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLiveFeedResponse(raw: any): LiveFeedResult {
  const gameData = raw.gameData
  const liveData = raw.liveData
  const linescore = liveData.linescore
  const currentPlay = liveData.plays.currentPlay
  const boxscore = liveData.boxscore.teams

  const stateStr: string = gameData.status.abstractGameState
  let gameState: Game['gameState'] = 'Live'
  if (stateStr === 'Final') gameState = 'Final'
  else if (gameData.status.detailedState?.toLowerCase().includes('delay')) gameState = 'Delayed'
  else if (stateStr === 'Preview') gameState = 'Preview'

  const game: Game = {
    gamePk: raw.gamePk ?? 0,
    awayTeam: gameData.teams.away.abbreviation,
    homeTeam: gameData.teams.home.abbreviation,
    awayScore: linescore.teams.away.runs ?? 0,
    homeScore: linescore.teams.home.runs ?? 0,
    inning: linescore.currentInning ?? 1,
    inningHalf: linescore.inningHalf === 'Bottom' ? 'Bot' : 'Top',
    gameState,
    startTime: '',
  }

  if (!currentPlay) return { game, atBat: null }

  const matchup = currentPlay.matchup
  const count = currentPlay.count
  const pitcherId: number = matchup.pitcher.id
  const batterId: number = matchup.batter.id
  const pitchCount = getPitchCount(boxscore, pitcherId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pitchEvents = (currentPlay.playEvents ?? []).filter((e: any) => e.isPitch === true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pitches: Pitch[] = pitchEvents.map((e: any): Pitch => {
    const pd = e.pitchData
    const hd = e.hitData
    const isContact = e.details?.isInPlay === true
    const contactResult = isContact
      ? (currentPlay.result?.event ?? '').toUpperCase()
      : undefined
    return {
      pitchCode: e.details?.type?.code ?? '',
      pitchDescription: e.details?.type?.description ?? '',
      endSpeed: pd?.endSpeed ?? 0,
      startSpeed: pd?.startSpeed ?? 0,
      spinRate: pd?.breaks?.spinRate ?? 0,
      breakVertical: pd?.breaks?.breakVertical ?? 0,
      breakHorizontal: pd?.breaks?.breakHorizontal ?? 0,
      pX: pd?.coordinates?.pX ?? 0,
      pZ: pd?.coordinates?.pZ ?? 0,
      szTop: pd?.strikeZoneTop ?? 3.5,
      szBot: pd?.strikeZoneBottom ?? 1.5,
      result: e.details?.description ?? '',
      isContact,
      exitVelocity: hd?.launchSpeed,
      launchAngle: hd?.launchAngle,
      hitDistance: hd?.totalDistance,
      contactResult,
    }
  })

  const atBat: AtBat = {
    batterId,
    batterLastName: lastNameFrom(matchup.batter.fullName),
    batterHand: matchup.batSide.code as 'L' | 'R',
    pitcherId,
    pitcherLastName: lastNameFrom(matchup.pitcher.fullName),
    pitcherHand: matchup.pitchHand.code as 'L' | 'R',
    pitchCount,
    balls: count.balls,
    strikes: count.strikes,
    outs: count.outs,
    pitches,
  }

  return { game, atBat }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMatchupStatsResponse(raw: any): MatchupStats | null {
  const splits = raw?.stats?.[0]?.splits
  if (!splits || splits.length === 0) return null
  const stat = splits[0].stat
  return {
    avg: stat.avg ?? '.000',
    hr: stat.homeRuns ?? 0,
    ab: stat.atBats ?? 0,
  }
}

export async function fetchSchedule(date: string): Promise<Game[]> {
  const url = `${BASE}/api/v1/schedule?sportId=1&date=${date}&hydrate=team`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Schedule fetch failed: ${res.status}`)
  return parseScheduleResponse(await res.json())
}

export async function fetchLiveFeed(gamePk: number): Promise<LiveFeedResult> {
  const url = `${BASE}/api/v1.1/game/${gamePk}/feed/live`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Live feed fetch failed: ${res.status}`)
  return parseLiveFeedResponse(await res.json())
}

export async function fetchMatchupStats(
  batterId: number,
  pitcherId: number
): Promise<MatchupStats | null> {
  const url = `${BASE}/api/v1/people/${batterId}/stats?stats=vsPlayer&opposingPlayerId=${pitcherId}&group=hitting&sportId=1`
  const res = await fetch(url)
  if (!res.ok) return null
  return parseMatchupStatsResponse(await res.json())
}

export function todayDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
