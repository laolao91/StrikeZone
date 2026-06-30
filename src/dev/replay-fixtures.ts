// PIT @ SF, May 8 2026 — Top of 9th inning (final: PIT 2, SF 5)
// Kilian (SF) pitching. Activate via ?devReplay=1 in the URL.
import type { LiveFeedResult } from '../data/mlb-api'
import type { Game, AtBat, Pitch } from '../lib/types'

const GAME: Game = {
  gamePk: 823225,
  awayTeam: 'PIT',
  homeTeam: 'SF',
  awayScore: 2,
  homeScore: 5,
  inning: 9,
  inningHalf: 'Top',
  gameState: 'Live',
  startTime: '',
}

function p(
  code: string, desc: string, end: number, start: number, spin: number,
  brkV: number, brkH: number, pX: number, pZ: number,
  szTop: number, szBot: number, result: string,
  contact = false, exitV?: number, angle?: number, dist?: number, cr?: string
): Pitch {
  return {
    pitchCode: code, pitchDescription: desc,
    endSpeed: end, startSpeed: start,
    spinRate: spin, breakVertical: brkV, breakHorizontal: brkH,
    pX, pZ, szTop, szBot, result, isContact: contact,
    exitVelocity: exitV, launchAngle: angle, hitDistance: dist, contactResult: cr,
  }
}

function ab(
  batterId: number, lastName: string, hand: 'L' | 'R',
  balls: number, strikes: number, outs: number,
  pitchCount: number, pitches: Pitch[]
): AtBat {
  return {
    batterId, batterLastName: lastName, batterHand: hand,
    pitcherId: 680694, pitcherLastName: 'Kilian', pitcherHand: 'R',
    pitchCount, balls, strikes, outs, pitches,
  }
}

const SNAPSHOTS: LiveFeedResult[] = [
  // AB 1: Ozuna [R] — Flyout (1 out)
  { game: GAME, atBat: ab(516782, 'Ozuna', 'R', 2, 1, 1, 35, [
    p('FF','Four-Seam Fastball', 89.0,96.8,2367,-12.1, 1.7,-1.173,2.979,3.256,1.643,'Ball'),
    p('FF','Four-Seam Fastball', 87.4,95.4,2380,-12.8, 1.1, 0.216,3.955,3.256,1.643,'Ball'),
    p('FF','Four-Seam Fastball', 86.8,94.6,2404,-15.8,-0.4, 0.668,2.124,3.256,1.643,'Called Strike'),
    p('FF','Four-Seam Fastball', 87.9,96.4,2439,-10.0, 3.1,-0.379,2.850,3.256,1.643,'In play, out(s)',true,93.7,49.0,272.0,'FLYOUT'),
  ]) },

  // AB 2: Cruz [L] — Walk (1 out)
  { game: GAME, atBat: ab(680757, 'Cruz', 'L', 4, 2, 1, 39, [
    p('KC','Knuckle Curve',     72.2,79.2,2602,-59.5,-13.0,-0.580,3.993,3.516,1.774,'Called Strike'),
    p('FF','Four-Seam Fastball', 87.9,96.2,2442,-15.6, -2.5, 0.713,1.576,3.516,1.774,'Ball'),
    p('SL','Slider',             79.9,86.4,2673,-42.7, -7.2, 0.769,1.028,3.516,1.774,'Ball'),
    p('FF','Four-Seam Fastball', 88.2,96.0,2413,-15.0, -1.0,-0.528,3.293,3.516,1.774,'Called Strike'),
    p('FF','Four-Seam Fastball', 89.0,96.9,2361,-14.3,  1.7, 0.376,3.713,3.516,1.774,'Foul'),
    p('KC','Knuckle Curve',      77.0,82.5,2708,-54.5, -8.0,-0.309,0.914,3.516,1.774,'Ball'),
    p('FF','Four-Seam Fastball', 89.0,97.4,2335,-12.0,  0.7,-0.574,2.968,3.516,1.774,'Foul'),
    p('KC','Knuckle Curve',      75.6,82.2,2673,-57.8, -7.0, 0.293,-0.266,3.516,1.774,'Ball In Dirt'),
  ]) },

  // AB 3: Griffin [R] — Walk (1 out)
  { game: GAME, atBat: ab(592743, 'Griffin', 'R', 4, 2, 1, 47, [
    p('SL','Slider',             79.1,85.2,2564,-42.7, -4.4,-0.721,2.469,3.335,1.683,'Called Strike'),
    p('SI','Sinker',             87.5,95.5,2296,-16.9, 10.4,-0.473,3.478,3.335,1.683,'Foul'),
    p('SL','Slider',             81.0,87.5,2624,-42.1, -6.7, 0.792,1.027,3.335,1.683,'Ball'),
    p('KC','Knuckle Curve',      75.7,81.6,2798,-54.0, -6.4,-0.243,0.537,3.335,1.683,'Ball In Dirt'),
    p('KC','Knuckle Curve',      74.2,80.9,2694,-60.0,-10.7,-1.982,2.371,3.335,1.683,'Ball'),
    p('FF','Four-Seam Fastball', 89.2,96.6,2428,-11.9,  1.7,-0.199,1.262,3.335,1.683,'Ball'),
  ]) },

  // AB 4: Horwitz [L] — Single (1 out)
  { game: GAME, atBat: ab(677800, 'Horwitz', 'L', 0, 2, 1, 53, [
    p('FF','Four-Seam Fastball', 89.0,97.5,2435,-11.0,  2.2, 0.071,2.154,3.133,1.581,'Called Strike'),
    p('FF','Four-Seam Fastball', 88.5,96.2,2364,-12.7,  1.2, 0.202,3.361,3.133,1.581,'Foul'),
    p('KC','Knuckle Curve',      73.9,80.4,2718,-60.0,-10.8,-0.659,1.814,3.133,1.581,'Foul'),
    p('FF','Four-Seam Fastball', 89.0,96.2,2378,-12.8, -0.2, 0.711,3.664,3.133,1.581,'Foul'),
    p('KC','Knuckle Curve',      75.2,81.8,2786,-55.3,-10.2,-0.213,2.460,3.133,1.581,'In play, run(s)',true,93.8,12.0,147.0,'SINGLE'),
  ]) },

  // AB 5: Lowe [L] — Flyout (2 outs)
  { game: GAME, atBat: ab(666321, 'Lowe', 'L', 3, 2, 2, 58, [
    p('KC','Knuckle Curve',      72.1,78.8,2624,-58.3,-13.6,-1.570,3.495,3.088,1.559,'Ball'),
    p('KC','Knuckle Curve',      71.9,78.7,2666,-61.6,-12.0,-0.842,2.210,3.088,1.559,'Called Strike'),
    p('FF','Four-Seam Fastball', 89.1,97.6,2368,-12.1, -1.1, 0.125,1.012,3.088,1.559,'Ball'),
    p('KC','Knuckle Curve',      70.8,78.2,2610,-63.1,-14.4,-1.336,2.267,3.088,1.559,'Ball'),
    p('FF','Four-Seam Fastball', 87.1,95.5,2451,-12.5, -2.9, 0.271,2.930,3.088,1.559,'Foul'),
    p('FF','Four-Seam Fastball', 89.7,97.8,2413,-11.8,  4.3, 0.529,2.378,3.088,1.559,'In play, out(s)',true,61.6,45.0,186.0,'FLYOUT'),
  ]) },

  // AB 6: O'Hearn [L] — Groundout (3 outs, end of inning)
  { game: GAME, atBat: ab(621446, "O'Hearn", 'L', 2, 2, 3, 64, [
    p('FF','Four-Seam Fastball', 88.0,95.9,2429,-14.3,  2.4,-0.803,3.073,3.289,1.660,'Called Strike'),
    p('KC','Knuckle Curve',      74.1,80.9,2749,-58.2,-10.0,-0.323,1.856,3.289,1.660,'Swinging Strike'),
    p('KC','Knuckle Curve',      74.1,81.1,2768,-57.4,-12.4,-0.732,2.350,3.289,1.660,'Foul'),
    p('KC','Knuckle Curve',      76.0,82.4,2747,-56.2,-13.1, 0.709,0.281,3.289,1.660,'Ball'),
    p('FF','Four-Seam Fastball', 89.6,97.1,2404,-15.7,  0.0, 1.146,2.569,3.289,1.660,'Ball'),
    p('FF','Four-Seam Fastball', 88.4,97.3,2448,-13.0,  2.4,-0.372,2.516,3.289,1.660,'In play, out(s)',true,91.9,0.0,49.0,'GROUNDOUT'),
  ]) },
]

let replayIndex = 0

export function nextReplayFrame(): LiveFeedResult {
  const snapshot = SNAPSHOTS[replayIndex % SNAPSHOTS.length]
  replayIndex++
  return snapshot
}

export function makeDevSchedule(): Game[] {
  return [{ ...GAME }]
}
