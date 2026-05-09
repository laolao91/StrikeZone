import { describe, it, expect } from 'vitest'
import {
  renderHeader,
  renderPitchView,
  renderContactView,
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
  })

  it('shows Final label when game is over', () => {
    const finalGame = { ...mockGame, gameState: 'Final' as const }
    const h = renderHeader(finalGame, null)
    expect(h).toContain('Final')
  })
})

describe('renderPitchView', () => {
  it('includes B: and P: labels with handedness', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('B: Judge [R]')
    expect(body).toContain('P: Sale [L]')
  })

  it('includes pitch count after pitcher name', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('87p')
  })

  it('includes pitch type from format map', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('4-Seam FF')
  })

  it('includes velocity, result, spin, break, velocity drop', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('88 mph')
    expect(body).toContain('Called Strike')
    expect(body).toContain('2387 rpm')
    expect(body).toContain('Drop')
    expect(body).toContain('Move')
    expect(body).toContain('96→88')
  })

  it('includes historical split at bottom', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('Judge vs Sale')
    expect(body).toContain('.250')
    expect(body).toContain('1 HR')
    expect(body).toContain('12 AB')
  })

  it('shows Pitch N/M label when pitchIndex provided', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, 2, 5)
    expect(body).toContain('Pitch 2 / 5')
  })

  it('shows Catcher\'s view when pitchIndex is null (live)', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain("Catcher's view")
  })
})

describe('renderContactView', () => {
  const contactPitch: Pitch = {
    ...mockPitch,
    isContact: true,
    exitVelocity: 108,
    launchAngle: 32,
    hitDistance: 431,
    contactResult: 'HOME RUN',
  }

  it('includes result label', () => {
    const body = renderContactView(mockAtBat, contactPitch, mockStats)
    expect(body).toContain('HOME RUN')
  })

  it('includes exit velocity, launch angle, distance', () => {
    const body = renderContactView(mockAtBat, contactPitch, mockStats)
    expect(body).toContain('108 mph')
    expect(body).toContain('32°')
    expect(body).toContain('431 ft')
  })

  it('includes historical split', () => {
    const body = renderContactView(mockAtBat, contactPitch, mockStats)
    expect(body).toContain('Judge vs Sale')
  })
})

describe('renderGameList', () => {
  const games: Game[] = [
    { ...mockGame },
    { ...mockGame, gamePk: 2, awayTeam: 'LAD', homeTeam: 'SF', awayScore: 0, homeScore: 0, gameState: 'Preview' },
  ]

  it('shows all games with team names', () => {
    const body = renderGameList(games, 0)
    expect(body).toContain('NYY')
    expect(body).toContain('BOS')
    expect(body).toContain('LAD')
    expect(body).toContain('SF')
  })

  it('marks selected game with an indicator, not others', () => {
    const body = renderGameList(games, 0)
    const lines = body.split('\n')
    const nyy = lines.find(l => l.includes('NYY'))
    const lad = lines.find(l => l.includes('LAD'))
    expect(nyy).toContain('▶')
    expect(lad).not.toContain('▶')
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
