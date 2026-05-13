import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { initStorage } from './lib/storage'
import {
  init,
  refresh,
  prevPitch,
  goLive,
  scrollGameList,
  selectGame,
  openGameList,
  startAutoRefresh,
  stopAutoRefresh,
  getState,
  onUpdate,
  currentPitch,
  setFetchOverrides,
} from './glasses/game-state'
import {
  renderHeader,
  renderPitchHeader,
  renderPitchInfo,
  renderContactInfo,
  renderSplitsInfo,
  renderGameList,
  renderStateScreen,
} from './glasses/display'
import { renderZoneText } from './glasses/zone'
import { setupInput } from './glasses/input'
import { initSettingsPage } from './settings/settings-mount'

// ── Container IDs ────────────────────────────────────────────────────────────
//
// All four containers are text — no image container.
// BLE sendFailed at every image size we tried; text updates are ~100 bytes
// and never hit the BLE limit.
//
//   HDR    (full-width 2-line header, top)
//   ZONE   (text, left column — ASCII 3×3 strike zone grid)
//   INFO   (text, centre column, event capture)
//   SPLITS (text, right column)

const HDR_ID    = 1,  HDR_NAME    = 'hdr'
const ZONE_ID   = 2,  ZONE_NAME   = 'zone'
const INFO_ID   = 3,  INFO_NAME   = 'info'
const SPLITS_ID = 4,  SPLITS_NAME = 'splits'

const ZONE_W = 120
const ZONE_H = 144

// Pixels from top of screen to the zone/info/splits row
const HEADER_H = 36

let bridge: EvenAppBridge | null = null
let displayInFlight = false

// ── Layout geometry (computed once) ─────────────────────────────────────────

const INFO_X   = ZONE_W + 2
const INFO_W   = Math.floor((576 - INFO_X - 2) / 2)
const SPLITS_X = INFO_X + INFO_W + 2
const SPLITS_W = 576 - SPLITS_X

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upgradeText(id: number, name: string, content: string): Promise<void> {
  await bridge!.textContainerUpgrade(new TextContainerUpgrade({
    containerID: id, containerName: name,
    content, contentOffset: 0, contentLength: 0,
  }))
}

// ── Display functions ─────────────────────────────────────────────────────────

async function renderStandard(header: string, body: string): Promise<void> {
  if (!bridge) return
  await upgradeText(HDR_ID,    HDR_NAME,    header)
  await upgradeText(ZONE_ID,   ZONE_NAME,   '')
  await upgradeText(INFO_ID,   INFO_NAME,   body)
  await upgradeText(SPLITS_ID, SPLITS_NAME, '')
}

async function renderPitch(
  header: string,
  zone: string,
  info: string,
  splits: string,
): Promise<void> {
  if (!bridge) return
  await upgradeText(HDR_ID,    HDR_NAME,    header)
  await upgradeText(ZONE_ID,   ZONE_NAME,   zone)
  await upgradeText(INFO_ID,   INFO_NAME,   info)
  await upgradeText(SPLITS_ID, SPLITS_NAME, splits)
}

// ── Display logic ─────────────────────────────────────────────────────────────

async function refreshDisplay(): Promise<void> {
  // SDK requires updateImageRawData calls to be serial. Guard against
  // concurrent calls from rapid notify() firings during init/refresh.
  if (displayInFlight) return
  displayInFlight = true
  try {
    await _refreshDisplay()
  } finally {
    displayInFlight = false
  }
}

async function _refreshDisplay(): Promise<void> {
  if (!bridge) return
  const s = getState()

  if (s.mode === 'game-list') {
    await renderStandard('StrikeZone', renderGameList(s.games, s.gameListIndex, s.gameListViewport))
    return
  }
  if (s.mode === 'loading') {
    await renderStandard('StrikeZone', renderStateScreen('loading'))
    return
  }
  if (s.mode === 'error') {
    await renderStandard('StrikeZone', renderStateScreen('error'))
    return
  }

  const game = s.game
  if (!game) {
    await renderStandard('StrikeZone', renderStateScreen('no-game'))
    return
  }
  if (game.gameState === 'Final') {
    await renderStandard(renderHeader(game, null), renderStateScreen('final', game))
    return
  }
  if (game.gameState === 'Delayed') {
    await renderStandard(renderHeader(game, null), renderStateScreen('delayed', game))
    return
  }
  if (game.gameState === 'Preview') {
    await renderStandard(renderHeader(game, null), renderStateScreen('starting-soon', game))
    return
  }

  const atBat = s.atBat
  if (!atBat) {
    await renderStandard(renderHeader(game, null), renderStateScreen('loading'))
    return
  }
  const pitch = currentPitch()
  if (!pitch) {
    await renderStandard(renderHeader(game, atBat), renderStateScreen('loading'))
    return
  }

  const pitchIndex = s.pitchHistoryIndex !== null ? s.pitchHistoryIndex + 1 : null
  const zone       = renderZoneText(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot)
  const splits     = renderSplitsInfo(atBat, game, s.matchupStats)

  if (pitch.isContact) {
    await renderPitch(
      renderPitchHeader(game, atBat),
      zone,
      renderContactInfo(atBat, pitch),
      splits,
    )
  } else {
    await renderPitch(
      renderPitchHeader(game, atBat),
      zone,
      renderPitchInfo(atBat, pitch, pitchIndex, atBat.pitches.length),
      splits,
    )
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function startGlassesMode(b: EvenAppBridge): Promise<void> {
  bridge = b
  initStorage(b)

  await b.createStartUpPageContainer(new CreateStartUpPageContainer({
    containerTotalNum: 4,
    textObject: [
      new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: 576, height: HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: HDR_ID, containerName: HDR_NAME,
        content: 'StrikeZone', isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 0, yPosition: HEADER_H,
        width: ZONE_W, height: ZONE_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 1,
        containerID: ZONE_ID, containerName: ZONE_NAME,
        content: '', isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: INFO_X, yPosition: HEADER_H,
        width: INFO_W, height: 288 - HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: INFO_ID, containerName: INFO_NAME,
        content: renderStateScreen('loading'), isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: SPLITS_X, yPosition: HEADER_H,
        width: SPLITS_W, height: 288 - HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: SPLITS_ID, containerName: SPLITS_NAME,
        content: '', isEventCapture: 0,
      }),
    ],
  }))

  onUpdate(() => { refreshDisplay() })

  setupInput(b, {
    onTap: () => {
      const s = getState()
      if (s.mode === 'game-list') {
        const game = s.games[s.gameListIndex]
        if (game) selectGame(game.gamePk)
      } else {
        refresh()
      }
    },

    onDoubleTap: () => {
      if (getState().mode === 'pitch-view') openGameList()
    },

    onScrollUp: () => {
      const s = getState()
      if (s.mode === 'game-list') scrollGameList('up')
      else if (s.mode === 'pitch-view') prevPitch()
    },

    onScrollDown: () => {
      const s = getState()
      if (s.mode === 'game-list') scrollGameList('down')
      else if (s.mode === 'pitch-view') goLive()
    },

    onForegroundEnter: () => { init().then(() => startAutoRefresh()) },
    onForegroundExit:  () => { stopAutoRefresh() },
  })

  await init()
  startAutoRefresh()

  window.addEventListener('strikezone:sync', () => { init() })
  window.addEventListener('strikezone:refresh', () => { refresh() })
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    const hasFlutter =
      !!(window as any).flutter_inappwebview ||
      !!(window as any).webkit?.messageHandlers?.callHandler

    initSettingsPage()

    if (new URLSearchParams(window.location.search).has('devReplay')) {
      const { makeDevSchedule, nextReplayFrame } = await import('./dev/replay-fixtures')
      setFetchOverrides(
        (_date) => Promise.resolve(makeDevSchedule()),
        (_pk)   => Promise.resolve(nextReplayFrame()),
      )
    }

    if (hasFlutter) {
      const b = await waitForEvenAppBridge()
      await startGlassesMode(b)
    }
  } catch {
    console.warn('Glasses mode failed, settings page still available')
  }
}

main()
