import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { SettingsApp } from './SettingsApp'

export function initSettingsPage(): void {
  const app = document.getElementById('app')
  if (!app) return
  createRoot(app).render(createElement(SettingsApp))
}
