import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageContainerProperty,
  ImageRawDataUpdate,
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
import {
  renderZoneImage,
  nextCascadeStep,
  formatZoneDiagnostic,
  CASCADE_CONFIG,
} from './glasses/zone'
import type { CascadeStep, AttemptLog } from './glasses/zone'
import { setupInput } from './glasses/input'
import { initSettingsPage } from './settings/settings-mount'

// ── Container IDs ────────────────────────────────────────────────────────────
//
//   HDR    (text, full-width 2-line header, top)
//   ZONE   (image, left column — 1-bit or 4-bit PNG strike zone)
//   INFO   (text, centre column, event capture)
//   SPLITS (text, right column — shows cascade diagnostic during probe)

const HDR_ID    = 1,  HDR_NAME    = 'hdr'
const ZONE_ID   = 2,  ZONE_NAME   = 'zone'
const INFO_ID   = 3,  INFO_NAME   = 'info'
const SPLITS_ID = 4,  SPLITS_NAME = 'splits'

// Pixels from top of screen to the zone/info/splits row
const HEADER_H = 36

let bridge: EvenAppBridge | null = null
let displayInFlight = false

// ── Image cascade state ───────────────────────────────────────────────────────
// Probed once on the first pitch render; cached for the session.
let cascadeProbed    = false
let cascadeWorking: CascadeStep = 'A'
let cascadeAllFailed = false
let cascadeAttempts: AttemptLog[] = []

// Geometry depends on the zone image width; SPLITS is always pinned at x=350.
function zoneGeometry(zoneW: number) {
  const infoX   = zoneW + 2
  const splitsX = 350
  const infoW   = splitsX - infoX - 2
  const splitsW = 576 - splitsX
  return { infoX, infoW, splitsX, splitsW }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Builds the full page container payload for the given cascade step.
// Used at startup (step A) and on re-layout (step B or C).
function zoneContainerPayload(step: CascadeStep, hdrContent: string, infoContent: string, splitsContent: string) {
  const cfg = CASCADE_CONFIG[step]
  const geo = zoneGeometry(cfg.width)
  return {
    containerTotalNum: 4,
    textObject: [
      new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: 576, height: HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: HDR_ID, containerName: HDR_NAME,
        content: hdrContent, isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: geo.infoX, yPosition: HEADER_H,
        width: geo.infoW, height: 288 - HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: INFO_ID, containerName: INFO_NAME,
        content: infoContent, isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: geo.splitsX, yPosition: HEADER_H,
        width: geo.splitsW, height: 288 - HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: SPLITS_ID, containerName: SPLITS_NAME,
        content: splitsContent, isEventCapture: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        xPosition: 0, yPosition: HEADER_H,
        width: cfg.width, height: cfg.height,
        containerID: ZONE_ID, containerName: ZONE_NAME,
      }),
    ],
  }
}

async function upgradeText(id: number, name: string, content: string): Promise<void> {
  await bridge!.textContainerUpgrade(new TextContainerUpgrade({
    containerID: id, containerName: name,
    content, contentOffset: 0, contentLength: 0,
  }))
}

// SDK base64 path is broken (sendFailed even at <400 bytes). Send raw PNG bytes as
// number[] instead — the same approach Visionote uses successfully.
function pngBytes(b64: string): number[] {
  return Array.from(atob(b64), c => c.charCodeAt(0))
}

// ── Display functions ─────────────────────────────────────────────────────────

async function renderStandard(header: string, body: string): Promise<void> {
  if (!bridge) return
  await upgradeText(HDR_ID,    HDR_NAME,    header)
  // ZONE is an image container — leave it showing last pitch or blank
  await upgradeText(INFO_ID,   INFO_NAME,   body)
  await upgradeText(SPLITS_ID, SPLITS_NAME, '')
}

async function renderPitch(
  header: string,
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  info: string,
  splits: string,
): Promise<void> {
  if (!bridge) return
  await upgradeText(HDR_ID, HDR_NAME, header)

  if (cascadeAllFailed) {
    await upgradeText(INFO_ID,   INFO_NAME,   formatZoneDiagnostic(cascadeAttempts, true))
    await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, true))
    return
  }

  if (!cascadeProbed) {
    await runCascade(header, pX, pZ, szTop, szBot, info)
    return
  }

  const b64 = renderZoneImage(pX, pZ, szTop, szBot, cascadeWorking)
  await bridge.updateImageRawData(new ImageRawDataUpdate({
    containerID: ZONE_ID, containerName: ZONE_NAME, imageData: pngBytes(b64),
  }))
  await upgradeText(INFO_ID,   INFO_NAME,   info)
  await upgradeText(SPLITS_ID, SPLITS_NAME, splits)
}

async function runCascade(
  header: string,
  pX: number, pZ: number, szTop: number, szBot: number,
  info: string,
): Promise<void> {
  if (!bridge) return
  let step: CascadeStep = 'A'

  while (true) {
    const b64 = renderZoneImage(pX, pZ, szTop, szBot, step)
    const result = await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: ZONE_ID, containerName: ZONE_NAME, imageData: pngBytes(b64),
    }))

    if (result === 'imageSizeInvalid') {
      // Stale container — rebuild then retry once
      cascadeAttempts.push({ step, b64Chars: b64.length, result: 'imageSizeInvalid' })
      await upgradeText(INFO_ID,   INFO_NAME,   formatZoneDiagnostic(cascadeAttempts, false))
      await upgradeText(SPLITS_ID, SPLITS_NAME, '')
      await bridge.rebuildPageContainer(new RebuildPageContainer(
        zoneContainerPayload(step, header, '', '')
      ))
      const result2 = await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: ZONE_ID, containerName: ZONE_NAME, imageData: pngBytes(b64),
      }))
      cascadeAttempts.push({ step, b64Chars: b64.length, result: result2 })
      if (result2 === 'success') {
        cascadeWorking = step
        cascadeProbed  = true
        await upgradeText(INFO_ID,   INFO_NAME,   info)
        await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, false))
        return
      }
      await upgradeText(INFO_ID,   INFO_NAME,   formatZoneDiagnostic(cascadeAttempts, false))
      await upgradeText(SPLITS_ID, SPLITS_NAME, '')
      const next = nextCascadeStep(step, result2 === 'imageSizeInvalid' ? 'imageException' : result2)
      if (next === 'failed' || next === 'resize') break
      step = next
      continue
    }

    cascadeAttempts.push({ step, b64Chars: b64.length, result })

    if (result === 'success') {
      if (step !== 'A') {
        await bridge.rebuildPageContainer(new RebuildPageContainer(
          zoneContainerPayload(step, header, '', '')
        ))
        await bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: ZONE_ID, containerName: ZONE_NAME, imageData: pngBytes(b64),
        }))
      }
      cascadeWorking = step
      cascadeProbed  = true
      await upgradeText(INFO_ID,   INFO_NAME,   info)
      await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, false))
      return
    }

    await upgradeText(INFO_ID,   INFO_NAME,   formatZoneDiagnostic(cascadeAttempts, false))
    await upgradeText(SPLITS_ID, SPLITS_NAME, '')

    const next = nextCascadeStep(step, result)
    if (next === 'failed' || next === 'resize') break
    step = next
  }

  cascadeAllFailed = true
  cascadeProbed    = true
  await upgradeText(INFO_ID,   INFO_NAME,   formatZoneDiagnostic(cascadeAttempts, true))
  await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, true))
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

  const pitchIndex  = s.pitchHistoryIndex !== null ? s.pitchHistoryIndex + 1 : null
  const splits = renderSplitsInfo(atBat, game, s.matchupStats)

  if (pitch.isContact) {
    await renderPitch(
      renderPitchHeader(game, atBat),
      pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot,
      renderContactInfo(atBat, pitch),
      splits,
    )
  } else {
    await renderPitch(
      renderPitchHeader(game, atBat),
      pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot,
      renderPitchInfo(atBat, pitch, pitchIndex, atBat.pitches.length),
      splits,
    )
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function startGlassesMode(b: EvenAppBridge): Promise<void> {
  bridge = b
  initStorage(b)

  await b.createStartUpPageContainer(new CreateStartUpPageContainer(
    zoneContainerPayload('A', 'StrikeZone', '', '')
  ))

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
