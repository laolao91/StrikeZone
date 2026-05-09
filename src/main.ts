import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  RebuildPageContainer,
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
} from './glasses/game-state'
import {
  renderHeader,
  renderPitchView,
  renderContactView,
  renderGameList,
  renderStateScreen,
} from './glasses/display'
import { setupInput } from './glasses/input'
import { initSettingsPage } from './settings/settings-mount'

const HEADER_ID = 1
const HEADER_NAME = 'hdr'
const BODY_ID = 2
const BODY_NAME = 'body'

let bridge: EvenAppBridge | null = null

async function createInitialPage(header: string, body: string): Promise<void> {
  if (!bridge) return
  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0, yPosition: 0, width: 576, height: 28,
          borderWidth: 0, borderColor: 0, borderRadius: 0,
          paddingLength: 4,
          containerID: HEADER_ID, containerName: HEADER_NAME,
          content: header, isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0, yPosition: 28, width: 576, height: 260,
          borderWidth: 0, borderColor: 0, borderRadius: 0,
          paddingLength: 4,
          containerID: BODY_ID, containerName: BODY_NAME,
          content: body, isEventCapture: 1,
        }),
      ],
    })
  )
}

async function rebuildPage(header: string, body: string): Promise<void> {
  if (!bridge) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0, yPosition: 0, width: 576, height: 28,
          borderWidth: 0, borderColor: 0, borderRadius: 0,
          paddingLength: 4,
          containerID: HEADER_ID, containerName: HEADER_NAME,
          content: header, isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0, yPosition: 28, width: 576, height: 260,
          borderWidth: 0, borderColor: 0, borderRadius: 0,
          paddingLength: 4,
          containerID: BODY_ID, containerName: BODY_NAME,
          content: body, isEventCapture: 1,
        }),
      ],
    })
  )
}

function buildDisplay(): { header: string; body: string } {
  const s = getState()

  if (s.mode === 'game-list') {
    return {
      header: 'StrikeZone',
      body: renderGameList(s.games, s.gameListIndex),
    }
  }

  if (s.mode === 'loading') {
    return {
      header: 'StrikeZone',
      body: renderStateScreen('loading'),
    }
  }

  if (s.mode === 'error') {
    return {
      header: 'StrikeZone',
      body: renderStateScreen('error'),
    }
  }

  // pitch-view mode
  const game = s.game
  const atBat = s.atBat

  if (!game || !atBat) {
    return {
      header: 'StrikeZone',
      body: renderStateScreen('no-game'),
    }
  }

  if (game.gameState === 'Final') {
    return {
      header: renderHeader(game, null),
      body: renderStateScreen('final', game),
    }
  }

  if (game.gameState === 'Delayed') {
    return {
      header: renderHeader(game, null),
      body: renderStateScreen('delayed', game),
    }
  }

  if (game.gameState === 'Preview') {
    return {
      header: renderHeader(game, null),
      body: renderStateScreen('starting-soon', game),
    }
  }

  const pitch = currentPitch()
  if (!pitch) {
    return {
      header: renderHeader(game, atBat),
      body: renderStateScreen('loading'),
    }
  }

  const total = atBat.pitches.length
  const pitchIndex = s.pitchHistoryIndex !== null ? s.pitchHistoryIndex + 1 : null

  if (pitch.isContact) {
    return {
      header: renderHeader(game, atBat),
      body: renderContactView(atBat, pitch, s.matchupStats),
    }
  }

  return {
    header: renderHeader(game, atBat),
    body: renderPitchView(atBat, pitch, s.matchupStats, pitchIndex, total),
  }
}

async function startGlassesMode(b: EvenAppBridge): Promise<void> {
  bridge = b
  initStorage(b)

  await createInitialPage('StrikeZone', renderStateScreen('loading'))

  onUpdate(async () => {
    const { header, body } = buildDisplay()
    await rebuildPage(header, body)
  })

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
      const s = getState()
      if (s.mode === 'pitch-view') {
        openGameList()
      }
    },

    onScrollUp: () => {
      const s = getState()
      if (s.mode === 'game-list') {
        scrollGameList('up')
      } else if (s.mode === 'pitch-view') {
        prevPitch()
      }
    },

    onScrollDown: () => {
      const s = getState()
      if (s.mode === 'game-list') {
        scrollGameList('down')
      } else if (s.mode === 'pitch-view') {
        goLive()
      }
    },

    onForegroundEnter: () => {
      init().then(() => startAutoRefresh())
    },

    onForegroundExit: () => {
      stopAutoRefresh()
    },
  })

  await init()
  startAutoRefresh()

  window.addEventListener('strikezone:sync', () => {
    init()
  })
}

async function main(): Promise<void> {
  try {
    const hasFlutter =
      !!(window as any).flutter_inappwebview ||
      !!(window as any).webkit?.messageHandlers?.callHandler

    initSettingsPage()

    if (hasFlutter) {
      const b = await waitForEvenAppBridge()
      await startGlassesMode(b)
    }
  } catch {
    console.warn('Glasses mode failed, settings page still available')
  }
}

main()
