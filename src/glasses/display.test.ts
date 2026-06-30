import { describe, it, expect } from 'vitest'
import {
  renderHeader,
  renderPitchInfo,
  renderContactInfo,
  renderSplitsInfo,
  renderGameList,
  renderStateScreen,
} from './display'
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'

const mockGame: Game = {
  gamePk: 748547,
  awayTeam: 'NYY',
  homeTeam: 'BOS',
  awayScore: 5,
  homeScore: 3,
  inningHalf: 'Top',
  inning: 3,
  gameState: 'Live',
  startTime: '',
}

const mockAtBat: AtBat = {
  batterId: 592450,
  batterLastName: 'Judge',
  batterHand: 'R',
  pitcherId: 519242,
  pitcherLastName: 'Sale',
  pitcherHand: 'L',
  pitchCount: 87,
  balls: 2,
  strikes: 1,
  outs: 2,
  pitches: [],
}

const mockPitch: Pitch = {
  pitchCode: 'FF',
  pitchDescription: 'Four-Seam Fastball',
  endSpeed: 88,
  startSpeed: 96,
  spinRate: 2387,
  breakVertical: 14,
  breakHorizontal: -4,
  pX: 0,
  pZ: 2.5,
  szTop: 3.5,
  szBot: 1.5,
  result: 'Called Strike',
  isContact: false,
}

const mockStats: MatchupStats = { avg: '.250', hr: 1, ab: 12 }

describe('renderHeader', () => {
  it('includes teams, score, inning, and count', () => {
    const h = renderHeader(mockGame, mockAtBat)
    expect(h).toContain('NYY')
    expect(h).toContain('BOS')
    expect(h).toContain('5')
    expect(h).toContain('3')
    expect(h).toContain('Top 3')
    expect(h).toContain('B:2')
    expect(h).toContain('S:1')
    expect(h).toContain('O:2')
    expect(h).toContain('P:87')
  })

  it('shows Final label when game is over', () => {
    const finalGame = { ...mockGame, gameState: 'Final' as const }
    const h = renderHeader(finalGame, null)
    expect(h).toContain('Final')
  })
})

describe('renderPitchInfo', () => {
  it('includes zone label', () => {
    const info = renderPitchInfo(mockAtBat, mockPitch, null, 1)
    expect(info).toContain("Catcher's view")
  })

  it('shows Pitch N/M label when pitchIndex provided', () => {
    const info = renderPitchInfo(mockAtBat, mockPitch, 2, 5)
    expect(info).toContain('Pitch 2 / 5')
  })

  it('includes pitch type from format map', () => {
    const info = renderPitchInfo(mockAtBat, mockPitch, null, 1)
    expect(info).toContain('4-Seam FF')
  })

  it('includes velocity, result, spin, break', () => {
    const info = renderPitchInfo(mockAtBat, mockPitch, null, 1)
    expect(info).toContain('88 mph')
    expect(info).toContain('Called Strike')
    expect(info).toContain('2387 rpm')
    expect(info).toContain('Drop')
    expect(info).toContain('Move')
    expect(info).toContain('96→88')
  })
})

describe('renderContactInfo', () => {
  const contactPitch: Pitch = {
    ...mockPitch,
    isContact: true,
    exitVelocity: 108,
    launchAngle: 32,
    hitDistance: 431,
    contactResult: 'HOME RUN',
  }

  it('includes result label', () => {
    const info = renderContactInfo(mockAtBat, contactPitch)
    expect(info).toContain('HOME RUN')
  })

  it('includes exit velocity, launch angle, distance', () => {
    const info = renderContactInfo(mockAtBat, contactPitch)
    expect(info).toContain('108 mph')
    expect(info).toContain('32°')
    expect(info).toContain('431 ft')
  })
})

describe('renderSplitsInfo', () => {
  it('shows batter and pitcher lines even when stats are null', () => {
    const splits = renderSplitsInfo(mockAtBat, mockGame, null)
    expect(splits).toContain('B:')
    expect(splits).toContain('Judge')
    expect(splits).not.toContain('.000')
  })

  it('includes batter team prefix from inning half (Top → away bats)', () => {
    // mockGame is Top inning, away=NYY, home=BOS → batter=NYY, pitcher=BOS
    const splits = renderSplitsInfo(mockAtBat, mockGame, mockStats)
    expect(splits).toContain('NYY B:')
    expect(splits).toContain('Judge')
    expect(splits).toContain('(R)')
  })

  it('includes pitcher team prefix from inning half (Top → home pitches)', () => {
    const splits = renderSplitsInfo(mockAtBat, mockGame, mockStats)
    expect(splits).toContain('BOS P:')
    expect(splits).toContain('Sale')
    expect(splits).toContain('(L)')
  })

  it('swaps teams in bottom half inning', () => {
    const botGame = { ...mockGame, inningHalf: 'Bot' as const }
    const splits = renderSplitsInfo(mockAtBat, botGame, mockStats)
    expect(splits).toContain('BOS B:')
    expect(splits).toContain('NYY P:')
  })

  it('includes stats when present', () => {
    const splits = renderSplitsInfo(mockAtBat, mockGame, mockStats)
    expect(splits).toContain('.250')
    expect(splits).toContain('1 HR')
    expect(splits).toContain('12 AB')
  })
})

describe('renderGameList', () => {
  const games: Game[] = [
    { ...mockGame },
    { ...mockGame, gamePk: 2, awayTeam: 'LAD', homeTeam: 'SF', awayScore: 0, homeScore: 0, gameState: 'Preview' },
  ]

  it('shows only the selected game with position indicator', () => {
    const body = renderGameList(games, 0)
    expect(body).toContain('NYY')
    expect(body).toContain('BOS')
    expect(body).not.toContain('LAD')
    expect(body).toContain('(1/2)')
  })

  it('marks selected game with ▶ and advances position on index change', () => {
    const body0 = renderGameList(games, 0)
    const body1 = renderGameList(games, 1)
    expect(body0).toContain('▶')
    expect(body0).toContain('(1/2)')
    expect(body1).toContain('LAD')
    expect(body1).toContain('(2/2)')
  })
})

describe('renderStateScreen', () => {
  it('renders no-game-selected state', () => {
    const body = renderStateScreen('no-game')
    expect(body).toContain('Select a game')
    expect(body).toContain('phone')
  })

  it('renders loading state', () => {
    const body = renderStateScreen('loading')
    expect(body).toContain('Loading')
  })

  it('renders error state', () => {
    const body = renderStateScreen('error')
    expect(body).toContain('Unable to load')
    expect(body).toContain('Tap to retry')
  })

  it('renders starting-soon state with team names', () => {
    const body = renderStateScreen('starting-soon', mockGame)
    expect(body).toContain('NYY')
    expect(body).toContain('BOS')
    expect(body).toContain('Game Starting Soon')
  })

  it('renders delayed state with team names', () => {
    const body = renderStateScreen('delayed', mockGame)
    expect(body).toContain('NYY')
    expect(body).toContain('BOS')
    expect(body).toContain('Rain Delay')
  })

  it('renders final state with score', () => {
    const body = renderStateScreen('final', mockGame)
    expect(body).toContain('NYY')
    expect(body).toContain('BOS')
    expect(body).toContain('Final')
  })
})
