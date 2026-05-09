import { describe, it, expect } from 'vitest'
import { parseScheduleResponse, parseLiveFeedResponse, parseMatchupStatsResponse } from './mlb-api'

describe('parseScheduleResponse', () => {
  it('parses a live game', () => {
    const raw = {
      dates: [{
        games: [{
          gamePk: 748547,
          gameDate: '2026-05-08T23:05:00Z',
          status: { abstractGameState: 'Live', detailedState: 'In Progress' },
          teams: {
            away: { score: 5, team: { abbreviation: 'NYY' } },
            home: { score: 3, team: { abbreviation: 'BOS' } },
          },
          linescore: { currentInning: 3, inningHalf: 'Top' },
        }],
      }],
    }
    const games = parseScheduleResponse(raw)
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({
      gamePk: 748547,
      awayTeam: 'NYY',
      homeTeam: 'BOS',
      awayScore: 5,
      homeScore: 3,
      inning: 3,
      inningHalf: 'Top',
      gameState: 'Live',
    })
  })

  it('handles preview game with no score', () => {
    const raw = {
      dates: [{
        games: [{
          gamePk: 748548,
          gameDate: '2026-05-08T23:05:00Z',
          status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
          teams: {
            away: { team: { abbreviation: 'LAD' } },
            home: { team: { abbreviation: 'SF' } },
          },
        }],
      }],
    }
    const games = parseScheduleResponse(raw)
    expect(games[0].gameState).toBe('Preview')
    expect(games[0].awayScore).toBe(0)
    expect(games[0].homeScore).toBe(0)
  })

  it('returns empty array when no dates', () => {
    expect(parseScheduleResponse({ dates: [] })).toEqual([])
  })
})

describe('parseLiveFeedResponse', () => {
  const mockLiveFeed = {
    gameData: {
      teams: {
        away: { abbreviation: 'NYY' },
        home: { abbreviation: 'BOS' },
      },
      status: { abstractGameState: 'Live', detailedState: 'In Progress' },
    },
    liveData: {
      plays: {
        currentPlay: {
          matchup: {
            batter: { id: 592450, fullName: 'Aaron Judge' },
            batSide: { code: 'R' },
            pitcher: { id: 519242, fullName: 'Chris Sale' },
            pitchHand: { code: 'L' },
          },
          count: { balls: 2, strikes: 1, outs: 2 },
          result: { event: 'Strikeout', eventType: 'strikeout' },
          playEvents: [
            {
              isPitch: true,
              details: {
                type: { code: 'FF', description: 'Four-Seam Fastball' },
                description: 'Called Strike',
                isInPlay: false,
                isBall: false,
              },
              pitchData: {
                startSpeed: 96.4,
                endSpeed: 88.2,
                strikeZoneTop: 3.5,
                strikeZoneBottom: 1.5,
                coordinates: { pX: -0.12, pZ: 2.8 },
                breaks: { spinRate: 2387, breakVertical: 13.7, breakHorizontal: -3.8 },
              },
              count: { balls: 0, strikes: 1, outs: 2 },
            },
          ],
        },
      },
      linescore: {
        currentInning: 3,
        inningHalf: 'Top',
        teams: { away: { runs: 5 }, home: { runs: 3 } },
      },
      boxscore: {
        teams: {
          away: {
            players: {
              ID519242: { stats: { pitching: { pitchesThrown: 87 } } },
            },
          },
          home: { players: {} },
        },
      },
    },
  }

  it('parses batter and pitcher names and handedness', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    expect(result.atBat).not.toBeNull()
    expect(result.atBat!.batterLastName).toBe('Judge')
    expect(result.atBat!.batterHand).toBe('R')
    expect(result.atBat!.pitcherLastName).toBe('Sale')
    expect(result.atBat!.pitcherHand).toBe('L')
  })

  it('parses pitch count from boxscore', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    expect(result.atBat!.pitchCount).toBe(87)
  })

  it('parses pitch data correctly', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    const pitch = result.atBat!.pitches[0]
    expect(pitch.pitchCode).toBe('FF')
    expect(pitch.endSpeed).toBe(88.2)
    expect(pitch.pX).toBe(-0.12)
    expect(pitch.result).toBe('Called Strike')
    expect(pitch.isContact).toBe(false)
  })

  it('extracts game score and inning', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    expect(result.game.awayScore).toBe(5)
    expect(result.game.homeScore).toBe(3)
    expect(result.game.inning).toBe(3)
    expect(result.game.inningHalf).toBe('Top')
  })
})

describe('parseMatchupStatsResponse', () => {
  it('parses AVG, HR, AB', () => {
    const raw = {
      stats: [{
        splits: [{
          stat: { avg: '.250', homeRuns: 1, atBats: 12 },
        }],
      }],
    }
    const stats = parseMatchupStatsResponse(raw)
    expect(stats).toEqual({ avg: '.250', hr: 1, ab: 12 })
  })

  it('returns null when no splits', () => {
    const raw = { stats: [{ splits: [] }] }
    expect(parseMatchupStatsResponse(raw)).toBeNull()
  })

  it('returns null when no stats', () => {
    expect(parseMatchupStatsResponse({ stats: [] })).toBeNull()
  })
})
