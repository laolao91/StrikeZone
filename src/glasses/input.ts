import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { OsEventTypeList } from '@evenrealities/even_hub_sdk'

export interface InputCallbacks {
  onTap: () => void
  onDoubleTap: () => void
  onScrollUp: () => void
  onScrollDown: () => void
  onForegroundEnter?: () => void
  onForegroundExit?: () => void
}

const SCROLL_COOLDOWN_MS = 300

function resolveEventType(
  eventType: number | undefined | null
): OsEventTypeList | null {
  if (eventType === undefined || eventType === null) {
    return OsEventTypeList.CLICK_EVENT
  }
  if (
    eventType === OsEventTypeList.CLICK_EVENT ||
    eventType === OsEventTypeList.SCROLL_TOP_EVENT ||
    eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
    eventType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
    eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT ||
    eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT
  ) {
    return eventType
  }
  return null
}

export function setupInput(
  bridge: EvenAppBridge,
  callbacks: InputCallbacks
): () => void {
  let lastScrollTime = 0

  function handleEvent(eventType: OsEventTypeList | null): void {
    if (eventType === null) return
    const now = Date.now()
    switch (eventType) {
      case OsEventTypeList.SCROLL_TOP_EVENT:
        if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
        lastScrollTime = now
        callbacks.onScrollUp()
        break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
        lastScrollTime = now
        callbacks.onScrollDown()
        break
      case OsEventTypeList.CLICK_EVENT:
        callbacks.onTap()
        break
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        callbacks.onDoubleTap()
        break
      case OsEventTypeList.FOREGROUND_ENTER_EVENT:
        callbacks.onForegroundEnter?.()
        break
      case OsEventTypeList.FOREGROUND_EXIT_EVENT:
        callbacks.onForegroundExit?.()
        break
    }
  }

  const unsub = bridge.onEvenHubEvent((event) => {
    if (event.textEvent) handleEvent(resolveEventType(event.textEvent.eventType))
    if (event.sysEvent) handleEvent(resolveEventType(event.sysEvent.eventType))
    if (event.listEvent) handleEvent(resolveEventType(event.listEvent.eventType))
  })

  return unsub
}
