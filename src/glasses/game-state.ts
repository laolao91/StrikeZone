import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import {
  fetchSchedule,
  fetchLiveFeed,
  fetchMatchupStats,
  todayDateString,
} from '../data/mlb-api'
import { getSettings, saveSettings } from '../lib/storage'

export type AppMode = 'game-list' | 'pitch-view' | 'loading' | 'error'

export interface AppState {
  mode: AppMode;
  games: Game[];
  gameListIndex: number;
  selectedGamePk: number | null;
  game: Game | null;
  atBat: AtBat | null;
  matchupStats: MatchupStats | null;
  pitchHistoryIndex: number | null;
  lastError: string | null;
}

let state: AppState = {
  mode: 'loading',
  games: [],
  gameListIndex: 0,
  selectedGamePk: null,
  game: null,
  atBat: null,
  matchupStats: null,
  pitchHistoryIndex: null,
  lastError: null,
}

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let onStateChange: (() => void) | null = null
let matchupKey = ''

export function getState(): AppState {
  return state
}

export function onUpdate(cb: () => void): void {
  onStateChange = cb
}

function notify(): void {
  onStateChange?.()
}

export async function init(): Promise<void> {
  state.mode = 'loading'
  notify()

  const settings = await getSettings()
  state.selectedGamePk = settings.selectedGamePk

  try {
    state.games = await fetchSchedule(todayDateString())
  } catch {
    state.games = []
  }

  if (state.selectedGamePk) {
    await refresh()
  } else {
    state.mode = 'game-list'
    state.gameListIndex = 0
    notify()
  }
}

export async function refresh(): Promise<void> {
  if (!state.selectedGamePk) return
  try {
    const result = await fetchLiveFeed(state.selectedGamePk)
    const prevAtBat = state.atBat

    state.game = result.game
    state.atBat = result.atBat
    state.lastError = null

    if (result.atBat) {
      const newMatchup =
        !prevAtBat ||
        prevAtBat.batterId !== result.atBat.batterId ||
        prevAtBat.pitcherId !== result.atBat.pitcherId

      if (newMatchup) {
        state.matchupStats = null
        state.pitchHistoryIndex = null
        const key = `${result.atBat.batterId}-${result.atBat.pitcherId}`
        matchupKey = key
        fetchMatchupStats(result.atBat.batterId, result.atBat.pitcherId).then(
          (stats) => {
            if (matchupKey === key) {
              state.matchupStats = stats
              notify()
            }
          }
        )
      }
    }

    state.mode = 'pitch-view'
    notify()
  } catch {
    state.lastError = 'fetch-failed'
    state.mode = 'error'
    notify()
  }
}

export function prevPitch(): void {
  if (!state.atBat || state.atBat.pitches.length === 0) return
  const total = state.atBat.pitches.length
  if (state.pitchHistoryIndex === null) {
    state.pitchHistoryIndex = total - 1
  } else if (state.pitchHistoryIndex > 0) {
    state.pitchHistoryIndex -= 1
  }
  notify()
}

export function goLive(): void {
  state.pitchHistoryIndex = null
  notify()
}

export function currentPitch(): Pitch | null {
  if (!state.atBat || state.atBat.pitches.length === 0) return null
  const idx = state.pitchHistoryIndex ?? state.atBat.pitches.length - 1
  return state.atBat.pitches[idx] ?? null
}

export function scrollGameList(direction: 'up' | 'down'): void {
  if (state.games.length === 0) return
  if (direction === 'up') {
    state.gameListIndex = (state.gameListIndex - 1 + state.games.length) % state.games.length
  } else {
    state.gameListIndex = (state.gameListIndex + 1) % state.games.length
  }
  notify()
}

export async function selectGame(gamePk: number): Promise<void> {
  state.selectedGamePk = gamePk
  state.pitchHistoryIndex = null
  state.matchupStats = null
  await saveSettings({ selectedGamePk: gamePk })
  await refresh()
}

export function openGameList(): void {
  state.mode = 'game-list'
  state.gameListIndex = state.games.findIndex(g => g.gamePk === state.selectedGamePk)
  if (state.gameListIndex < 0) state.gameListIndex = 0
  notify()
}

export function startAutoRefresh(): void {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => { refresh() }, 10_000)
}

export function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}
