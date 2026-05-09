import { useState, useEffect } from 'react'
import { ScreenHeader } from 'even-toolkit/web'
import { getSettings, saveSettings } from '../lib/storage'
import { fetchSchedule, todayDateString } from '../data/mlb-api'
import type { Game } from '../lib/types'

export function SettingsApp() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedPk, setSelectedPk] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [schedule, settings] = await Promise.all([
          fetchSchedule(todayDateString()),
          getSettings(),
        ])
        setGames(schedule)
        setSelectedPk(settings.selectedGamePk)
      } catch {
        setError('Failed to load today\'s schedule.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSelect(gamePk: number) {
    setSelectedPk(gamePk)
    await saveSettings({ selectedGamePk: gamePk })
    window.dispatchEvent(new CustomEvent('strikezone:sync'))
  }

  function formatGameTime(isoString: string): string {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      }) + ' ET'
    } catch {
      return ''
    }
  }

  function gameLabel(g: Game): string {
    if (g.gameState === 'Preview') {
      const t = formatGameTime(g.startTime)
      return t ? `${g.awayTeam} vs ${g.homeTeam}  ${t}` : `${g.awayTeam} vs ${g.homeTeam}`
    }
    if (g.gameState === 'Delayed') return `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}  Delayed`
    if (g.gameState === 'Final') return `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}  Final`
    return `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}  ${g.inningHalf[0]}${g.inning}`
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <ScreenHeader title="StrikeZone" />
      <div className="px-4 pt-4">
        {loading && <p className="text-muted text-sm">Loading today's games...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {!loading && !error && games.length === 0 && (
          <p className="text-muted text-sm">No games today.</p>
        )}
        {games.map((g) => (
          <button
            key={g.gamePk}
            onClick={() => handleSelect(g.gamePk)}
            className={`w-full text-left py-3 px-4 mb-2 rounded-lg border text-base ${
              selectedPk === g.gamePk
                ? 'border-accent bg-accent/10 font-medium'
                : 'border-border bg-surface'
            }`}
          >
            {gameLabel(g)}
          </button>
        ))}
      </div>
    </div>
  )
}
