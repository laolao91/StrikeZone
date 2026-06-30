import { useState, useEffect, useRef, useCallback } from 'react'
import { ScreenHeader } from 'even-toolkit/web'
import { getSettings, saveSettings } from '../lib/storage'
import { fetchSchedule, fetchLiveFeed, fetchMatchupStats, todayDateString } from '../data/mlb-api'
import type { LiveFeedResult } from '../data/mlb-api'
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import { ZoneSvg } from './ZoneSvg'
import { formatPitchType } from '../data/pitch-types'
import { nearbyTeams } from '../data/stadiums'
import type { NearbyResult } from '../data/stadiums'

// ── helpers ──────────────────────────────────────────────────

function formatGameTime(isoString: string): string {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

function todayLabel(): string {
  return new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })
}

function isFavorite(g: Game, favoriteTeams: string[]): boolean {
  return favoriteTeams.includes(g.homeTeam) || favoriteTeams.includes(g.awayTeam)
}

function sortGames(games: Game[], favoriteTeams: string[], nearbyTeamSet: Set<string>): Game[] {
  return [...games].sort((a, b) => {
    const aNearby = nearbyTeamSet.has(a.homeTeam) || nearbyTeamSet.has(a.awayTeam)
    const bNearby = nearbyTeamSet.has(b.homeTeam) || nearbyTeamSet.has(b.awayTeam)
    if (aNearby !== bNearby) return aNearby ? -1 : 1
    const aFav = isFavorite(a, favoriteTeams)
    const bFav = isFavorite(b, favoriteTeams)
    if (aFav !== bFav) return aFav ? -1 : 1
    return 0
  })
}

type PitchCategory = 'fastball' | 'breaking' | 'offspeed' | 'other'

function pitchCategory(code: string): PitchCategory {
  if (['FF', 'SI', 'FC', 'FA', 'FT'].includes(code)) return 'fastball'
  if (['SL', 'CU', 'KC', 'CS', 'SV', 'ST'].includes(code)) return 'breaking'
  if (['CH', 'FS', 'FO', 'SC'].includes(code)) return 'offspeed'
  return 'other'
}

const PITCH_CATEGORY_CLASS: Record<PitchCategory, string> = {
  fastball: 'text-red-500',
  breaking: 'text-blue-400',
  offspeed:  'text-green-400',
  other:     'text-text',
}

function secondsAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

// ── sub-components ────────────────────────────────────────────

function StatusChip({ g }: { g: Game }) {
  if (g.gameState === 'Live') {
    const half = g.inningHalf === 'Top' ? 'T' : 'B'
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        LIVE · {half}{g.inning}
      </span>
    )
  }
  if (g.gameState === 'Preview') {
    return <span className="text-xs text-text-dim">{formatGameTime(g.startTime)}</span>
  }
  if (g.gameState === 'Delayed') {
    return <span className="text-xs text-yellow-400">Delayed</span>
  }
  return <span className="text-xs text-text-dim">Final</span>
}

function GameListRow({
  g,
  isSelected,
  favoriteTeams,
  onSelect,
  onToggleTeam,
}: {
  g: Game
  isSelected: boolean
  favoriteTeams: string[]
  onSelect: () => void
  onToggleTeam: (team: string) => void
}) {
  const matchup = g.gameState === 'Preview'
    ? `${g.awayTeam} vs ${g.homeTeam}`
    : `${g.awayTeam} ${g.awayScore}–${g.homeScore} ${g.homeTeam}`
  const awayFav = favoriteTeams.includes(g.awayTeam)
  const homeFav = favoriteTeams.includes(g.homeTeam)

  return (
    <div className={`flex items-center mb-2 rounded-lg border overflow-hidden ${
      isSelected ? 'border-accent bg-accent/10' : 'border-border bg-surface'
    }`}>
      <button
        onClick={onSelect}
        className="flex-1 flex items-center justify-between py-3 pl-4 pr-2 text-base"
      >
        <span className={isSelected ? 'font-medium' : ''}>{matchup}</span>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {isSelected && (
            <span className="text-xs text-accent">↑ glasses</span>
          )}
          <StatusChip g={g} />
        </div>
      </button>
      <div className="flex items-stretch self-stretch border-l border-border divide-x divide-border">
        <button
          onClick={() => onToggleTeam(g.awayTeam)}
          className="flex flex-col items-center justify-center px-3 gap-0.5 min-w-[44px]"
          aria-label={`${awayFav ? 'Unfavorite' : 'Favorite'} ${g.awayTeam}`}
        >
          <span className="text-sm leading-none">{awayFav ? '★' : '☆'}</span>
          <span className="text-[10px] text-text-dim">{g.awayTeam}</span>
        </button>
        <button
          onClick={() => onToggleTeam(g.homeTeam)}
          className="flex flex-col items-center justify-center px-3 gap-0.5 min-w-[44px]"
          aria-label={`${homeFav ? 'Unfavorite' : 'Favorite'} ${g.homeTeam}`}
        >
          <span className="text-sm leading-none">{homeFav ? '★' : '☆'}</span>
          <span className="text-[10px] text-text-dim">{g.homeTeam}</span>
        </button>
      </div>
    </div>
  )
}

function PitchDetails({ pitch }: { pitch: Pitch }) {
  const horizArrow = pitch.breakHorizontal < 0 ? '←' : '→'
  const horizAbs = Math.abs(Math.round(pitch.breakHorizontal))
  const cat = pitchCategory(pitch.pitchCode)
  return (
    <div className="text-sm space-y-1 mt-3">
      <div className={`text-base font-medium ${PITCH_CATEGORY_CLASS[cat]}`}>
        {formatPitchType(pitch.pitchCode, pitch.pitchDescription)}
      </div>
      <div>{Math.round(pitch.endSpeed)} mph · {pitch.result}</div>
      <div className="text-text-dim">
        {Math.round(pitch.spinRate)} rpm · Drop ↓{Math.round(pitch.breakVertical)}" · Move {horizArrow}{horizAbs}"
      </div>
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

function MatchupLine({ atBat, batterTeam, pitcherTeam, stats }: {
  atBat: AtBat
  batterTeam: string
  pitcherTeam: string
  stats: MatchupStats | null
}) {
  if (!stats) return null
  return (
    <div className="text-xs text-text-dim text-center mt-3 pt-3 border-t border-border">
      {batterTeam} {atBat.batterLastName} vs {pitcherTeam} {atBat.pitcherLastName}:
      {' '}{stats.avg}  {stats.hr} HR  {stats.ab} AB
    </div>
  )
}

// ── main component ─────────────────────────────────────────────

export function SettingsApp() {
  const [games, setGames] = useState<Game[]>([])
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([])
  const [selectedPk, setSelectedPk] = useState<number | null>(null)
  const [perspective, setPerspective] = useState<'catcher' | 'pitcher'>('catcher')
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [nearby, setNearby] = useState<NearbyResult[]>([])

  const [liveFeed, setLiveFeed] = useState<LiveFeedResult | null>(null)
  const [matchupStats, setMatchupStats] = useState<MatchupStats | null>(null)
  const [liveError, setLiveError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [, setTick] = useState(0)

  const matchupKeyRef = useRef('')
  const pitchCountRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick every second so "Xs ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Sync when glasses select a game
  useEffect(() => {
    function onGameChanged(e: Event) {
      const gamePk = (e as CustomEvent<{ gamePk: number }>).detail.gamePk
      setSelectedPk(gamePk)
    }
    window.addEventListener('strikezone:game-changed', onGameChanged)
    return () => window.removeEventListener('strikezone:game-changed', onGameChanged)
  }, [])

  // Geolocation — run once on mount, silently skip if denied or unavailable
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearby(nearbyTeams(pos.coords.latitude, pos.coords.longitude))
      },
      () => { /* denied or unavailable — silently skip */ },
      { timeout: 5000, maximumAge: 60_000 }
    )
  }, [])

  // Load schedule + saved settings on mount
  useEffect(() => {
    async function load() {
      try {
        const [schedule, settings] = await Promise.all([
          fetchSchedule(todayDateString()),
          getSettings(),
        ])
        setGames(schedule)
        setSelectedPk(settings.selectedGamePk)
        setFavoriteTeams(settings.favoriteTeams)
        setPerspective(settings.perspective ?? 'catcher')
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
    pitchCountRef.current = 0
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
        const newCount = result.atBat?.pitches.length ?? 0
        if (newCount > pitchCountRef.current) {
          pitchCountRef.current = newCount
          window.dispatchEvent(new CustomEvent('strikezone:refresh', { detail: result }))
        }
        setLiveFeed(result)
        setLastUpdated(new Date())
        setLiveError(false)
      } catch {
        setLiveError(true)
      }
    }

    fetchLive()
    pollRef.current = setInterval(fetchLive, 2_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedPk])

  async function handleSelect(gamePk: number) {
    setSelectedPk(gamePk)
    const settings = await getSettings()
    await saveSettings({ ...settings, selectedGamePk: gamePk })
    window.dispatchEvent(new CustomEvent('strikezone:sync'))
  }

  async function handleChangeGame() {
    setSelectedPk(null)
    setLiveFeed(null)
    setMatchupStats(null)
    setLastUpdated(null)
    const settings = await getSettings()
    await saveSettings({ ...settings, selectedGamePk: null })
    window.dispatchEvent(new CustomEvent('strikezone:sync'))
  }

  async function handleTogglePerspective() {
    const next: 'catcher' | 'pitcher' = perspective === 'catcher' ? 'pitcher' : 'catcher'
    setPerspective(next)
    const settings = await getSettings()
    await saveSettings({ ...settings, perspective: next })
    window.dispatchEvent(new CustomEvent('strikezone:sync'))
  }

  async function handleToggleTeam(team: string) {
    const teams = new Set(favoriteTeams)
    if (teams.has(team)) {
      teams.delete(team)
    } else {
      teams.add(team)
    }
    const next = [...teams]
    setFavoriteTeams(next)
    const settings = await getSettings()
    await saveSettings({ ...settings, favoriteTeams: next })
  }

  const handleManualRefresh = useCallback(async () => {
    if (!selectedPk) return
    try {
      const result = await fetchLiveFeed(selectedPk)
      setLiveFeed(result)
      setLastUpdated(new Date())
      setLiveError(false)
      window.dispatchEvent(new CustomEvent('strikezone:refresh'))
    } catch {
      setLiveError(true)
    }
  }, [selectedPk])

  const nearbyTeamSet = new Set(nearby.map(n => n.team))
  const sortedGames = sortGames(games, favoriteTeams, nearbyTeamSet)
  const liveCount = games.filter(g => g.gameState === 'Live').length

  // ── Game view (game selected) ──────────────────────────────
  if (selectedPk) {
    const game = liveFeed?.game
    const atBat = liveFeed?.atBat ?? null
    const pitch = atBat && atBat.pitches.length > 0
      ? atBat.pitches[atBat.pitches.length - 1]
      : null

    return (
      <div className="min-h-screen bg-background text-text">
        <ScreenHeader title="StrikeZone" subtitle={todayLabel()} />
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-3">
            <button onClick={handleChangeGame} className="text-sm text-text font-medium">
              ← Change game
            </button>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-xs text-text-dim">{secondsAgo(lastUpdated)}</span>
              )}
              <button
                onClick={handleManualRefresh}
                className="text-xs text-accent px-2 py-1 rounded border border-accent/40"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {liveError && (
            <p className="text-red-500 text-sm mb-2">Unable to load game data.</p>
          )}

          {!liveFeed && !liveError && (
            <p className="text-muted text-sm">Loading...</p>
          )}

          {game && (
            <>
              <div className="text-center mb-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="text-lg font-semibold">
                    {game.awayTeam} {game.gameState !== 'Preview' ? `${game.awayScore}–${game.homeScore}` : 'vs'} {game.homeTeam}
                  </div>
                  <span className="text-xs text-accent border border-accent/40 rounded px-1.5 py-0.5">
                    ↑ glasses
                  </span>
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
                  <div className="text-sm text-yellow-400">Rain Delay</div>
                )}
                {game.gameState === 'Final' && (
                  <div className="text-sm text-text-dim">Final</div>
                )}
              </div>

              {game.gameState === 'Live' && atBat && pitch && (() => {
                const batterTeam  = game.inningHalf === 'Top' ? game.awayTeam : game.homeTeam
                const pitcherTeam = game.inningHalf === 'Top' ? game.homeTeam : game.awayTeam
                return (
                  <>
                    <div className="flex items-center justify-between mb-1 px-1">
                      <span className="text-xs text-text-dim">
                        {perspective === 'pitcher' ? "Pitcher's view" : "Catcher's view"}
                      </span>
                      <button
                        onClick={handleTogglePerspective}
                        className="text-xs text-accent border border-accent/40 rounded px-2 py-0.5"
                      >
                        Switch view
                      </button>
                    </div>
                    <ZoneSvg
                      pX={perspective === 'pitcher' ? -pitch.pX : pitch.pX}
                      pZ={pitch.pZ}
                      szTop={pitch.szTop}
                      szBot={pitch.szBot}
                    />

                    <div className="mt-3 text-sm text-center text-text-dim">
                      {batterTeam} B: {atBat.batterLastName} [{atBat.batterHand}]
                      &nbsp;&nbsp;&nbsp;
                      {pitcherTeam} P: {atBat.pitcherLastName} [{atBat.pitcherHand}] {atBat.pitchCount}p
                    </div>

                    {pitch.isContact
                      ? <ContactDetails pitch={pitch} />
                      : <PitchDetails pitch={pitch} />
                    }

                    <MatchupLine atBat={atBat} batterTeam={batterTeam} pitcherTeam={pitcherTeam} stats={matchupStats} />
                  </>
                )
              })()}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Game list view (no game selected) ────────────────────────
  return (
    <div className="min-h-screen bg-background text-text">
      <ScreenHeader
        title="StrikeZone"
        subtitle={
          !listLoading && !listError
            ? `${todayLabel()}${liveCount > 0 ? `  ·  ${liveCount} game${liveCount === 1 ? '' : 's'} live` : ''}`
            : todayLabel()
        }
      />
      <div className="px-4 pt-4">
        {listLoading && <p className="text-muted text-sm">Loading today's games...</p>}
        {listError && <p className="text-red-500 text-sm">{listError}</p>}

        {nearby.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm text-accent">
            📍 You appear to be near {nearby[0].stadiumName}
          </div>
        )}

        {!listLoading && !listError && games.length === 0 && (
          <p className="text-muted text-sm">No games today.</p>
        )}

        {sortedGames.map((g, i) => {
          const isNearby = nearbyTeamSet.has(g.homeTeam) || nearbyTeamSet.has(g.awayTeam)
          const isFav = isFavorite(g, favoriteTeams)
          const prev = i > 0 ? sortedGames[i - 1] : null
          const prevNearby = prev ? nearbyTeamSet.has(prev.homeTeam) || nearbyTeamSet.has(prev.awayTeam) : false
          const prevFav = prev ? isFavorite(prev, favoriteTeams) : false
          const showDivider = prev !== null && (
            (prevNearby && !isNearby) ||
            (!prevNearby && prevFav && !isFav)
          )
          return (
            <div key={g.gamePk}>
              {showDivider && <div className="border-t border-border/50 my-2" />}
              <GameListRow
                g={g}
                isSelected={selectedPk === g.gamePk}
                favoriteTeams={favoriteTeams}
                onSelect={() => handleSelect(g.gamePk)}
                onToggleTeam={handleToggleTeam}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
