import { useState, useEffect, useRef } from 'react'
import { ScreenHeader } from 'even-toolkit/web'
import { getSettings, saveSettings } from '../lib/storage'
import { fetchSchedule, fetchLiveFeed, fetchMatchupStats, todayDateString } from '../data/mlb-api'
import type { LiveFeedResult } from '../data/mlb-api'
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import { ZoneSvg } from './ZoneSvg'
import { formatPitchType } from '../data/pitch-types'

// ── helpers ──────────────────────────────────────────────────

function formatGameTime(isoString: string): string {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    }) + ' ET'
  } catch { return '' }
}

function gameListLabel(g: Game): string {
  if (g.gameState === 'Preview') {
    const t = formatGameTime(g.startTime)
    return t ? `${g.awayTeam} vs ${g.homeTeam}  ${t}` : `${g.awayTeam} vs ${g.homeTeam}`
  }
  if (g.gameState === 'Delayed') return `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}  Delayed`
  if (g.gameState === 'Final') return `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}  Final`
  return `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}  ${g.inningHalf[0]}${g.inning}`
}

// ── sub-components ────────────────────────────────────────────

function PitchDetails({ pitch }: { pitch: Pitch }) {
  const horizArrow = pitch.breakHorizontal < 0 ? '←' : '→'
  const horizAbs = Math.abs(Math.round(pitch.breakHorizontal))
  return (
    <div className="text-sm space-y-1 mt-3">
      <div className="text-base font-medium">{formatPitchType(pitch.pitchCode, pitch.pitchDescription)}</div>
      <div>{Math.round(pitch.endSpeed)} mph · {pitch.result}</div>
      <div className="text-text-dim">{Math.round(pitch.spinRate)} rpm · Drop ↓{Math.round(pitch.breakVertical)}" · Move {horizArrow}{horizAbs}"</div>
      <div className="text-text-dim">{Math.round(pitch.startSpeed)}→{Math.round(pitch.endSpeed)} mph</div>
    </div>
  )
}

function ContactDetails({ pitch }: { pitch: Pitch }) {
  return (
    <div className="text-center space-y-2 my-4">
      <div className="text-2xl font-bold">⚾ {pitch.contactResult ?? 'IN PLAY'}</div>
      {pitch.exitVelocity !== undefined && <div>Exit Velocity: {Math.round(pitch.exitVelocity)} mph</div>}
      {pitch.launchAngle !== undefined && <div>Launch Angle: {Math.round(pitch.launchAngle)}°</div>}
      {pitch.hitDistance !== undefined && <div>Distance: {Math.round(pitch.hitDistance)} ft</div>}
    </div>
  )
}

function MatchupLine({ atBat, stats }: { atBat: AtBat; stats: MatchupStats | null }) {
  if (!stats) return null
  return (
    <div className="text-xs text-text-dim text-center mt-3 pt-3 border-t border-border">
      {atBat.batterLastName} vs {atBat.pitcherLastName}: {stats.avg}  {stats.hr} HR  {stats.ab} AB
    </div>
  )
}

// ── main component ─────────────────────────────────────────────

export function SettingsApp() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedPk, setSelectedPk] = useState<number | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [liveFeed, setLiveFeed] = useState<LiveFeedResult | null>(null)
  const [matchupStats, setMatchupStats] = useState<MatchupStats | null>(null)
  const [liveError, setLiveError] = useState(false)

  const matchupKeyRef = useRef('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load schedule + saved selection on mount
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
        setListError('Failed to load today\'s schedule.')
      } finally {
        setListLoading(false)
      }
    }
    load()
  }, [])

  // Poll live feed when game is selected
  useEffect(() => {
    if (!selectedPk) {
      setLiveFeed(null)
      setMatchupStats(null)
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }

    async function fetchLive() {
      if (!selectedPk) return
      try {
        const result = await fetchLiveFeed(selectedPk)
        const newAtBat = result.atBat
        if (newAtBat) {
          const key = `${newAtBat.batterId}-${newAtBat.pitcherId}`
          if (key !== matchupKeyRef.current) {
            matchupKeyRef.current = key
            setMatchupStats(null)
            fetchMatchupStats(newAtBat.batterId, newAtBat.pitcherId).then(stats => {
              if (matchupKeyRef.current === key) setMatchupStats(stats)
            })
          }
        }
        setLiveFeed(result)
        setLiveError(false)
      } catch {
        setLiveError(true)
      }
    }

    fetchLive()
    pollRef.current = setInterval(fetchLive, 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedPk])

  async function handleSelect(gamePk: number) {
    setSelectedPk(gamePk)
    await saveSettings({ selectedGamePk: gamePk })
    window.dispatchEvent(new CustomEvent('strikezone:sync'))
  }

  function handleChangeGame() {
    setSelectedPk(null)
    setLiveFeed(null)
    setMatchupStats(null)
  }

  // ── Game view (game selected) ──────────────────────────────
  if (selectedPk) {
    const game = liveFeed?.game
    const atBat = liveFeed?.atBat ?? null
    const pitch = atBat && atBat.pitches.length > 0
      ? atBat.pitches[atBat.pitches.length - 1]
      : null

    return (
      <div className="min-h-screen bg-background text-text">
        <ScreenHeader title="StrikeZone" />
        <div className="px-4 pt-2 pb-6">
          <button onClick={handleChangeGame} className="text-xs text-text-dim mb-3">
            ← Change game
          </button>

          {liveError && (
            <p className="text-red-500 text-sm mb-2">Unable to load game data.</p>
          )}

          {!liveFeed && !liveError && (
            <p className="text-muted text-sm">Loading...</p>
          )}

          {game && (
            <>
              {/* Game header */}
              <div className="text-center mb-3">
                <div className="text-lg font-semibold">
                  {game.awayTeam} {game.gameState !== 'Preview' ? `${game.awayScore}–${game.homeScore}` : 'vs'} {game.homeTeam}
                </div>
                {game.gameState === 'Live' && atBat && (
                  <div className="text-sm text-text-dim">
                    {game.inningHalf} {game.inning}  ·  B:{atBat.balls} S:{atBat.strikes} O:{atBat.outs}
                  </div>
                )}
                {game.gameState === 'Preview' && (
                  <div className="text-sm text-text-dim">
                    {formatGameTime(game.startTime) || 'Game Starting Soon'}
                  </div>
                )}
                {game.gameState === 'Delayed' && (
                  <div className="text-sm text-text-dim">Rain Delay</div>
                )}
                {game.gameState === 'Final' && (
                  <div className="text-sm text-text-dim">Final</div>
                )}
              </div>

              {/* Pitch view — Live game with pitch data */}
              {game.gameState === 'Live' && atBat && pitch && (
                <>
                  <div className="text-xs text-center text-text-dim mb-1">Catcher's view</div>
                  <ZoneSvg pX={pitch.pX} pZ={pitch.pZ} szTop={pitch.szTop} szBot={pitch.szBot} />

                  <div className="mt-3 text-sm text-center text-text-dim">
                    B: {atBat.batterLastName} [{atBat.batterHand}]
                    &nbsp;&nbsp;&nbsp;
                    P: {atBat.pitcherLastName} [{atBat.pitcherHand}] {atBat.pitchCount}p
                  </div>

                  {pitch.isContact
                    ? <ContactDetails pitch={pitch} />
                    : <PitchDetails pitch={pitch} />
                  }

                  <MatchupLine atBat={atBat} stats={matchupStats} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Game list view (no game selected) ────────────────────────
  return (
    <div className="min-h-screen bg-background text-text">
      <ScreenHeader title="StrikeZone" />
      <div className="px-4 pt-4">
        {listLoading && <p className="text-muted text-sm">Loading today's games...</p>}
        {listError && <p className="text-red-500 text-sm">{listError}</p>}
        {!listLoading && !listError && games.length === 0 && (
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
            {gameListLabel(g)}
          </button>
        ))}
      </div>
    </div>
  )
}
