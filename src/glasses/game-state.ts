import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import {
  fetchSchedule,
  fetchLiveFeed,
  fetchMatchupStats,
  todayDateString,
} from '../data/mlb-api'
import type { LiveFeedResult } from '../data/mlb-api'
import { getSettings, saveSettings } from '../lib/storage'
import { VIEWPORT_SIZE } from './display'

type ScheduleFetchFn = (date: string) => Promise<Game[]>
type LiveFeedFetchFn = (gamePk: number) => Promise<LiveFeedResult>

let _fetchSchedule: ScheduleFetchFn = fetchSchedule
let _fetchLiveFeed: LiveFeedFetchFn = fetchLiveFeed

export function setFetchOverrides(
  scheduleFn: ScheduleFetchFn,
  liveFeedFn: LiveFeedFetchFn
): void {
  _fetchSchedule = scheduleFn
  _fetchLiveFeed = liveFeedFn
}

export type AppMode = 'game-list' | 'pitch-view' | 'loading' | 'error'

export interface AppState {
  mode: AppMode;
  games: Game[];
  gameListIndex: number;
  gameListViewport: number;
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
  gameListViewport: 0,
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
    state.games = await _fetchSchedule(todayDateString())
  } catch {
    state.games = []
  }

  if (state.selectedGamePk) {
    await refresh()
  } else {
    state.mode = 'game-list'
    state.gameListIndex = 0
    state.gameListViewport = 0
    notify()
  }
}

export async function refresh(): Promise<void> {
  if (!state.selectedGamePk) return
  try {
    const result = await _fetchLiveFeed(state.selectedGamePk)
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
  const n = state.games.length
  if (direction === 'down') {
    const next = (state.gameListIndex + 1) % n
    state.gameListIndex = next
    if (next === 0) {
      state.gameListViewport = 0
    } else if (next >= state.gameListViewport + VIEWPORT_SIZE) {
      state.gameListViewport = next - VIEWPORT_SIZE + 1
    }
  } else {
    const prev = (state.gameListIndex - 1 + n) % n
    state.gameListIndex = prev
    if (prev === n - 1) {
      state.gameListViewport = Math.max(0, n - VIEWPORT_SIZE)
    } else if (prev < state.gameListViewport) {
      state.gameListViewport = prev
    }
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
  const idx = state.games.findIndex(g => g.gamePk === state.selectedGamePk)
  state.gameListIndex = idx >= 0 ? idx : 0
  // Keep cursor visible: adjust viewport if cursor is outside current window
  if (state.gameListIndex < state.gameListViewport ||
      state.gameListIndex >= state.gameListViewport + VIEWPORT_SIZE) {
    state.gameListViewport = Math.max(0, state.gameListIndex - Math.floor(VIEWPORT_SIZE / 2))
  }
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
