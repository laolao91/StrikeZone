import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
  RebuildPageContainer,
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
import { renderZoneCanvas } from './glasses/zone'
import { setupInput } from './glasses/input'
import { initSettingsPage } from './settings/settings-mount'

// ── Container IDs ────────────────────────────────────────────────────────────

// Standard layout (game list, loading, error states):
//   HDR (full-width title) + BODY (full-width scrollable body, event capture)
const HDR_ID   = 1,  HDR_NAME   = 'hdr'
const BODY_ID  = 2,  BODY_NAME  = 'body'

// Pitch layout (live pitch / contact views):
//   HDR2 (two-line header) + ZONE (image) + INFO (pitch details, event capture) + SPLITS (matchup stats)
const HDR2_ID   = 10, HDR2_NAME   = 'hdr2'
const ZONE_ID   = 11, ZONE_NAME   = 'zone'
const INFO_ID   = 12, INFO_NAME   = 'info'
const SPLITS_ID = 13, SPLITS_NAME = 'splits'

// Zone image dimensions (SDK limits: width 20–288, height 20–144)
const ZONE_W   = 120
const ZONE_H   = 144

// Vertical start of the zone/info area (pixels below the top of screen)
const PITCH_HEADER_H = 36  // header tall enough for 2 lines

let bridge: EvenAppBridge | null = null

// Track which layout is currently rendered so we can skip full rebuilds.
type LayoutMode = 'none' | 'standard' | 'pitch'
let currentLayout: LayoutMode = 'none'

// ── Layout builders ──────────────────────────────────────────────────────────

function makeStandardTextProps(header: string, body: string): TextContainerProperty[] {
  return [
    new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: 576, height: 28,
      borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
      containerID: HDR_ID, containerName: HDR_NAME,
      content: header, isEventCapture: 0,
    }),
    new TextContainerProperty({
      xPosition: 0, yPosition: 28, width: 576, height: 260,
      borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
      containerID: BODY_ID, containerName: BODY_NAME,
      content: body, isEventCapture: 1,
    }),
  ]
}

function makePitchTextProps(header: string, info: string, splits: string): TextContainerProperty[] {
  const infoX   = ZONE_W + 2
  const infoW   = Math.floor((576 - infoX - 2) / 2)
  const splitsX = infoX + infoW + 2
  const splitsW = 576 - splitsX
  return [
    new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: 576, height: PITCH_HEADER_H,
      borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
      containerID: HDR2_ID, containerName: HDR2_NAME,
      content: header, isEventCapture: 0,
    }),
    new TextContainerProperty({
      xPosition: infoX, yPosition: PITCH_HEADER_H,
      width: infoW, height: 288 - PITCH_HEADER_H,
      borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
      containerID: INFO_ID, containerName: INFO_NAME,
      content: info, isEventCapture: 1,
    }),
    new TextContainerProperty({
      xPosition: splitsX, yPosition: PITCH_HEADER_H,
      width: splitsW, height: 288 - PITCH_HEADER_H,
      borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
      containerID: SPLITS_ID, containerName: SPLITS_NAME,
      content: splits, isEventCapture: 0,
    }),
  ]
}

async function renderStandard(header: string, body: string): Promise<void> {
  if (!bridge) return

  if (currentLayout === 'standard') {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: HDR_ID, containerName: HDR_NAME,
      content: header, contentOffset: 0, contentLength: 0,
    }))
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: BODY_ID, containerName: BODY_NAME,
      content: body, contentOffset: 0, contentLength: 0,
    }))
    return
  }

  currentLayout = 'standard'
  await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: makeStandardTextProps(header, body),
  }))
}

async function renderPitch(header: string, info: string, splits: string, imageData: Uint8Array): Promise<void> {
  if (!bridge) return

  if (currentLayout !== 'pitch') {
    currentLayout = 'pitch'
    await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: 4,
      textObject: makePitchTextProps(header, info, splits),
      imageObject: [
        new ImageContainerProperty({
          xPosition: 0, yPosition: PITCH_HEADER_H,
          width: ZONE_W, height: ZONE_H,
          containerID: ZONE_ID, containerName: ZONE_NAME,
        }),
      ],
    }))
  } else {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: HDR2_ID, containerName: HDR2_NAME,
      content: header, contentOffset: 0, contentLength: 0,
    }))
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: INFO_ID, containerName: INFO_NAME,
      content: info, contentOffset: 0, contentLength: 0,
    }))
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: SPLITS_ID, containerName: SPLITS_NAME,
      content: splits, contentOffset: 0, contentLength: 0,
    }))
  }

  await bridge.updateImageRawData(new ImageRawDataUpdate({
    containerID: ZONE_ID, containerName: ZONE_NAME, imageData,
  }))
}

// ── Display logic ────────────────────────────────────────────────────────────

async function refreshDisplay(): Promise<void> {
  if (!bridge) return
  const s = getState()

  // ── Game list ──────────────────────────────────────────────────────────────
  if (s.mode === 'game-list') {
    await renderStandard('StrikeZone', renderGameList(s.games, s.gameListIndex, s.gameListViewport))
    return
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (s.mode === 'loading') {
    await renderStandard('StrikeZone', renderStateScreen('loading'))
    return
  }
  if (s.mode === 'error') {
    await renderStandard('StrikeZone', renderStateScreen('error'))
    return
  }

  // ── Pitch-view mode ────────────────────────────────────────────────────────
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

  const total = atBat.pitches.length
  const pitchIndex = s.pitchHistoryIndex !== null ? s.pitchHistoryIndex + 1 : null
  const header = renderPitchHeader(game, atBat)
  const imageData = renderZoneCanvas(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot, ZONE_W, ZONE_H)

  const splits = renderSplitsInfo(atBat, game, s.matchupStats)
  if (pitch.isContact) {
    await renderPitch(header, renderContactInfo(atBat, pitch), splits, imageData)
  } else {
    await renderPitch(header, renderPitchInfo(atBat, pitch, pitchIndex, total), splits, imageData)
  }
}

// ── Startup ──────────────────────────────────────────────────────────────────

async function startGlassesMode(b: EvenAppBridge): Promise<void> {
  bridge = b
  initStorage(b)

  currentLayout = 'standard'
  await b.createStartUpPageContainer(new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: makeStandardTextProps('StrikeZone', renderStateScreen('loading')),
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
