# StrikeZone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a G2 smart glasses plugin that displays live MLB pitch-by-pitch data — strike zone visualization, pitch details, and batter/pitcher matchup stats — to enrich the experience of attending a game in person.

**Architecture:** TypeScript G2 plugin following SubwayLens patterns. Module structure: `lib/` (types, storage), `data/` (mlb-api, pitch-types), `glasses/` (zone, display, input, game-state), `settings/` (React phone UI). All glasses display output is plain text joined with `\n`. A central `game-state.ts` state machine tracks mode (game-list vs pitch-view) and drives all display transitions.

**Tech Stack:** TypeScript 5, Vite 6, `@evenrealities/even_hub_sdk` v0.0.10, `even-toolkit` v1.7+, React 19, Tailwind CSS v4, Vitest 2 (testing), MLB Stats API (public, no auth).

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/types.ts` | All TypeScript interfaces: Game, Pitch, AtBat, MatchupStats, AppSettings |
| `src/lib/storage.ts` | bridge.setLocalStorage / window.localStorage wrapper |
| `src/data/pitch-types.ts` | Statcast code → display label map + formatPitchType() |
| `src/data/mlb-api.ts` | fetchSchedule, fetchLiveFeed, fetchMatchupStats |
| `src/glasses/zone.ts` | getDotPosition(), renderZoneGrid() |
| `src/glasses/display.ts` | renderHeader, renderPitchView, renderContactView, renderGameList, renderStateScreen |
| `src/glasses/input.ts` | SDK event bridge (tap, double-tap, scroll, lifecycle) |
| `src/glasses/game-state.ts` | Mode enum, state object, selectGame, refresh, prevPitch, goLive |
| `src/main.ts` | SDK init, container creation/update, wires input → state → display |
| `src/settings/settings-mount.tsx` | React root mount |
| `src/settings/SettingsApp.tsx` | Phone game-selection UI using even-toolkit |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `app.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/app.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "strikezone",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "qr": "evenhub qr --http --port 5173",
    "pack": "npm run build && evenhub pack app.json dist -o strikezone.ehpk"
  },
  "dependencies": {
    "@evenrealities/even_hub_sdk": "^0.0.10",
    "even-toolkit": "^1.7.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@evenrealities/evenhub-cli": "^0.1.12",
    "@evenrealities/evenhub-simulator": "^0.7.2",
    "@tailwindcss/vite": "^4.2.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.2.0",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.9.3",
    "vite": "^6.4.1",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create app.json**

```json
{
  "package_id": "com.strikezone.app",
  "edition": "202605",
  "name": "StrikeZone",
  "version": "1.0.0",
  "min_app_version": "0.1.0",
  "min_sdk_version": "0.0.10",
  "tagline": "Live MLB pitch data on your glasses",
  "description": "See the strike zone and live pitch data for MLB games — the broadcast view you miss when you're at the park.",
  "author": "StrikeZone",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "Fetch live MLB game data from the MLB Stats API",
      "whitelist": ["https://statsapi.mlb.com"]
    }
  ],
  "supported_languages": ["en"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>StrikeZone</title>
  <link rel="stylesheet" href="/src/app.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: Create src/app.css**

```css
@import "tailwindcss";
```

- [ ] **Step 7: Install dependencies**

Run:
```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: exits with no errors (no source files yet, that's fine).

- [ ] **Step 9: Commit scaffold**

```bash
git init
echo "node_modules/\ndist/\n*.ehpk" > .gitignore
git add .
git commit -m "feat: scaffold StrikeZone G2 plugin"
```

---

## Task 2: Types and Storage

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Create src/lib/types.ts**

```typescript
export interface Game {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  inningHalf: 'Top' | 'Bot';
  inning: number;
  gameState: 'Preview' | 'Live' | 'Final' | 'Delayed';
  startTime: string;
}

export interface Pitch {
  pitchCode: string;
  pitchDescription: string;
  endSpeed: number;
  startSpeed: number;
  spinRate: number;
  breakVertical: number;
  breakHorizontal: number;
  pX: number;
  pZ: number;
  szTop: number;
  szBot: number;
  result: string;
  isContact: boolean;
  exitVelocity?: number;
  launchAngle?: number;
  hitDistance?: number;
  contactResult?: string;
}

export interface AtBat {
  batterId: number;
  batterLastName: string;
  batterHand: 'L' | 'R';
  pitcherId: number;
  pitcherLastName: string;
  pitcherHand: 'L' | 'R';
  pitchCount: number;
  balls: number;
  strikes: number;
  outs: number;
  pitches: Pitch[];
}

export interface MatchupStats {
  avg: string;
  hr: number;
  ab: number;
}

export interface AppSettings {
  selectedGamePk: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  selectedGamePk: null,
};
```

- [ ] **Step 2: Create src/lib/storage.ts**

```typescript
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppSettings } from './types'
import { DEFAULT_SETTINGS } from './types'

let bridge: EvenAppBridge | null = null

export function initStorage(b: EvenAppBridge): void {
  bridge = b
}

async function setItem(key: string, value: string): Promise<void> {
  if (bridge) {
    try { await bridge.setLocalStorage(key, value); return } catch { /* fall through */ }
  }
  try { window.localStorage.setItem(key, value) } catch { /* noop */ }
}

async function getItem(key: string): Promise<string | null> {
  if (bridge) {
    try {
      const val = await bridge.getLocalStorage(key)
      if (val !== undefined && val !== null && val !== '') return val as string
    } catch { /* fall through */ }
  }
  try { return window.localStorage.getItem(key) } catch { return null }
}

const SETTINGS_KEY = 'settings'

export async function getSettings(): Promise<AppSettings> {
  const raw = await getItem(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setItem(SETTINGS_KEY, JSON.stringify(settings))
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: exits clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/
git commit -m "feat: add types and storage module"
```

---

## Task 3: Pitch Type Map

**Files:**
- Create: `src/data/pitch-types.ts`
- Create: `src/data/pitch-types.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/data/pitch-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatPitchType } from './pitch-types'

describe('formatPitchType', () => {
  it('returns display label for known Statcast code', () => {
    expect(formatPitchType('FF', 'Four-Seam Fastball')).toBe('4-Seam FF')
    expect(formatPitchType('SL', 'Slider')).toBe('Slider SL')
    expect(formatPitchType('CU', 'Curveball')).toBe('Curve CU')
    expect(formatPitchType('ST', 'Sweeper')).toBe('Sweeper ST')
    expect(formatPitchType('SI', 'Sinker')).toBe('Sinker SI')
    expect(formatPitchType('CH', 'Changeup')).toBe('Change CH')
    expect(formatPitchType('FC', 'Cut Fastball')).toBe('Cutter FC')
  })

  it('falls back to description + code for unknown pitch', () => {
    expect(formatPitchType('XX', 'Mystery Pitch')).toBe('Mystery Pitch XX')
  })

  it('handles empty description gracefully', () => {
    expect(formatPitchType('FF', '')).toBe('4-Seam FF')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL — `Cannot find module './pitch-types'`

- [ ] **Step 3: Create src/data/pitch-types.ts**

```typescript
const PITCH_TYPE_MAP: Record<string, string> = {
  FF: '4-Seam FF',
  SI: 'Sinker SI',
  FC: 'Cutter FC',
  FS: 'Splitter FS',
  SL: 'Slider SL',
  ST: 'Sweeper ST',
  SV: 'Slurve SV',
  CH: 'Change CH',
  CU: 'Curve CU',
  KC: 'KnCurve KC',
  KN: 'Knuckle KN',
  EP: 'Eephus EP',
  FO: 'Fork FO',
}

export function formatPitchType(code: string, description: string): string {
  if (PITCH_TYPE_MAP[code]) return PITCH_TYPE_MAP[code]
  const fallbackDesc = description.trim() || code
  return `${fallbackDesc} ${code}`
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run:
```bash
npm test
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/
git commit -m "feat: add pitch type map with tests"
```

---

## Task 4: Strike Zone Calculation

**Files:**
- Create: `src/glasses/zone.ts`
- Create: `src/glasses/zone.test.ts`

The G2 display is text-based. The zone grid is 7 rows tall. `getDotPosition` maps Statcast coordinates to one of: in-zone cell (row 0-2, col 0-2), or an outside descriptor. `renderZoneGrid` produces either 7 lines (in-zone or left/right) or 8 lines (high/low, extra row for the dot).

Zone layout (catcher's perspective, left column = catcher's left):
```
Zone (0,0) | Zone (0,1) | Zone (0,2)   ← high
Zone (1,0) | Zone (1,1) | Zone (1,2)   ← middle
Zone (2,0) | Zone (2,1) | Zone (2,2)   ← low
```

Horizontal: pX negative = catcher's left (zone col 0). pX positive = catcher's right (zone col 2).
Vertical: pZ near szTop = zone row 0. pZ near szBot = zone row 2.

- [ ] **Step 1: Write failing tests**

Create `src/glasses/zone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getDotPosition, renderZoneGrid } from './zone'

const SZ_TOP = 3.5
const SZ_BOT = 1.5

describe('getDotPosition', () => {
  it('maps center zone correctly (zone 4/5, row 1, col 1)', () => {
    const pos = getDotPosition(0, 2.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: true, row: 1, col: 1 })
  })

  it('maps top-left zone (zone 1, row 0, col 0)', () => {
    const pos = getDotPosition(-0.6, 3.3, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: true, row: 0, col: 0 })
  })

  it('maps bottom-right zone (zone 9, row 2, col 2)', () => {
    const pos = getDotPosition(0.6, 1.7, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: true, row: 2, col: 2 })
  })

  it('returns dirt for pitch well below zone', () => {
    const pos = getDotPosition(0, 0.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 'below', hPos: 1 })
  })

  it('returns high for pitch above zone', () => {
    const pos = getDotPosition(0, 4.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 'above', hPos: 1 })
  })

  it('returns left for pitch outside horizontal zone', () => {
    const pos = getDotPosition(-1.5, 2.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 1, hPos: 'left' })
  })

  it('returns right for pitch outside horizontal zone', () => {
    const pos = getDotPosition(1.5, 2.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 1, hPos: 'right' })
  })
})

describe('renderZoneGrid', () => {
  it('renders 7 rows for in-zone pitch', () => {
    const pos = getDotPosition(0, 2.5, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows).toHaveLength(7)
  })

  it('places dot in center of top row for zone (0,1)', () => {
    const pos = getDotPosition(0, 3.3, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows[1]).toBe('│ │●│ │')
  })

  it('places dot in bottom-right cell for zone (2,2)', () => {
    const pos = getDotPosition(0.6, 1.7, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows[5]).toBe('│ │ │●│')
  })

  it('renders 8 rows and adds dot below for low pitch', () => {
    const pos = getDotPosition(0, 0.5, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows).toHaveLength(8)
    expect(rows[7]).toContain('●')
  })

  it('renders 8 rows and adds dot above for high pitch', () => {
    const pos = getDotPosition(0, 4.5, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toContain('●')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL — `Cannot find module './zone'`

- [ ] **Step 3: Create src/glasses/zone.ts**

```typescript
const ZONE_LEFT = -0.83
const ZONE_RIGHT = 0.83

export type DotPosition =
  | { inZone: true; row: 0 | 1 | 2; col: 0 | 1 | 2 }
  | { inZone: false; vPos: 'above' | 'below' | 0 | 1 | 2; hPos: 'left' | 'right' | 0 | 1 | 2 }

export function getDotPosition(
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number
): DotPosition {
  const colWidth = (ZONE_RIGHT - ZONE_LEFT) / 3
  const rowHeight = (szTop - szBot) / 3

  const vOut = pZ > szTop ? 'above' : pZ < szBot ? 'below' : null
  const hOut = pX < ZONE_LEFT ? 'left' : pX > ZONE_RIGHT ? 'right' : null

  const vBand = vOut === null
    ? (Math.min(2, Math.floor((szTop - pZ) / rowHeight)) as 0 | 1 | 2)
    : null
  const hBand = hOut === null
    ? (Math.min(2, Math.floor((pX - ZONE_LEFT) / colWidth)) as 0 | 1 | 2)
    : null

  if (vBand !== null && hBand !== null) {
    return { inZone: true, row: vBand, col: hBand }
  }

  return {
    inZone: false,
    vPos: vOut ?? vBand!,
    hPos: hOut ?? hBand!,
  }
}

function dotForRow(pos: DotPosition, row: 0 | 1 | 2): string {
  if (pos.inZone) {
    return pos.row === row ? pos.col === 0 ? '│●│ │ │'
                           : pos.col === 1 ? '│ │●│ │'
                           : '│ │ │●│'
                          : '│ │ │ │'
  }
  const vPos = pos.vPos
  if (typeof vPos === 'number' && vPos === row) {
    if (pos.hPos === 'left')  return '●│ │ │ │'
    if (pos.hPos === 'right') return '│ │ │ │●'
  }
  return '│ │ │ │'
}

function dotLineBelow(hPos: 'left' | 'right' | 0 | 1 | 2): string {
  if (hPos === 'left')  return '●'
  if (hPos === 0)       return ' ●'
  if (hPos === 1)       return '  ●'
  if (hPos === 2)       return '   ●'
  return '    ●'
}

export function renderZoneGrid(pos: DotPosition): string[] {
  const rows: string[] = []

  if (!pos.inZone && pos.vPos === 'above') {
    rows.push(dotLineBelow(pos.hPos))
  }

  rows.push('┌─┬─┬─┐')
  rows.push(dotForRow(pos, 0))
  rows.push('├─┼─┼─┤')
  rows.push(dotForRow(pos, 1))
  rows.push('├─┼─┼─┤')
  rows.push(dotForRow(pos, 2))
  rows.push('└─┴─┴─┘')

  if (!pos.inZone && pos.vPos === 'below') {
    rows.push(dotLineBelow(pos.hPos))
  }

  return rows
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run:
```bash
npm test
```

Expected: all zone tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/glasses/zone.ts src/glasses/zone.test.ts
git commit -m "feat: add strike zone calculation with tests"
```

---

## Task 5: MLB API Module

**Files:**
- Create: `src/data/mlb-api.ts`
- Create: `src/data/mlb-api.test.ts`

The API is public, no auth, CORS-friendly. All functions return typed data or throw on network/parse errors.

- [ ] **Step 1: Write failing tests**

Create `src/data/mlb-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseScheduleResponse, parseLiveFeedResponse, parseMatchupStatsResponse } from './mlb-api'

describe('parseScheduleResponse', () => {
  it('parses a live game', () => {
    const raw = {
      dates: [{
        games: [{
          gamePk: 748547,
          gameDate: '2026-05-08T23:05:00Z',
          status: { abstractGameState: 'Live', detailedState: 'In Progress' },
          teams: {
            away: { score: 5, team: { abbreviation: 'NYY' } },
            home: { score: 3, team: { abbreviation: 'BOS' } },
          },
          linescore: { currentInning: 3, inningHalf: 'Top' },
        }],
      }],
    }
    const games = parseScheduleResponse(raw)
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({
      gamePk: 748547,
      awayTeam: 'NYY',
      homeTeam: 'BOS',
      awayScore: 5,
      homeScore: 3,
      inning: 3,
      inningHalf: 'Top',
      gameState: 'Live',
    })
  })

  it('handles preview game with no score', () => {
    const raw = {
      dates: [{
        games: [{
          gamePk: 748548,
          gameDate: '2026-05-08T23:05:00Z',
          status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
          teams: {
            away: { team: { abbreviation: 'LAD' } },
            home: { team: { abbreviation: 'SF' } },
          },
        }],
      }],
    }
    const games = parseScheduleResponse(raw)
    expect(games[0].gameState).toBe('Preview')
    expect(games[0].awayScore).toBe(0)
    expect(games[0].homeScore).toBe(0)
  })

  it('returns empty array when no dates', () => {
    expect(parseScheduleResponse({ dates: [] })).toEqual([])
  })
})

describe('parseLiveFeedResponse', () => {
  const mockLiveFeed = {
    gameData: {
      teams: {
        away: { abbreviation: 'NYY' },
        home: { abbreviation: 'BOS' },
      },
      status: { abstractGameState: 'Live', detailedState: 'In Progress' },
    },
    liveData: {
      plays: {
        currentPlay: {
          matchup: {
            batter: { id: 592450, fullName: 'Aaron Judge' },
            batSide: { code: 'R' },
            pitcher: { id: 519242, fullName: 'Chris Sale' },
            pitchHand: { code: 'L' },
          },
          count: { balls: 2, strikes: 1, outs: 2 },
          result: { event: 'Strikeout', eventType: 'strikeout' },
          playEvents: [
            {
              isPitch: true,
              details: {
                type: { code: 'FF', description: 'Four-Seam Fastball' },
                description: 'Called Strike',
                isInPlay: false,
                isBall: false,
              },
              pitchData: {
                startSpeed: 96.4,
                endSpeed: 88.2,
                strikeZoneTop: 3.5,
                strikeZoneBottom: 1.5,
                coordinates: { pX: -0.12, pZ: 2.8 },
                breaks: { spinRate: 2387, breakVertical: 13.7, breakHorizontal: -3.8 },
              },
              count: { balls: 0, strikes: 1, outs: 2 },
            },
          ],
        },
      },
      linescore: {
        currentInning: 3,
        inningHalf: 'Top',
        teams: { away: { runs: 5 }, home: { runs: 3 } },
      },
      boxscore: {
        teams: {
          away: {
            players: {
              ID519242: { stats: { pitching: { pitchesThrown: 87 } } },
            },
          },
          home: { players: {} },
        },
      },
    },
  }

  it('parses batter and pitcher names and handedness', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    expect(result.atBat).not.toBeNull()
    expect(result.atBat!.batterLastName).toBe('Judge')
    expect(result.atBat!.batterHand).toBe('R')
    expect(result.atBat!.pitcherLastName).toBe('Sale')
    expect(result.atBat!.pitcherHand).toBe('L')
  })

  it('parses pitch count from boxscore', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    expect(result.atBat!.pitchCount).toBe(87)
  })

  it('parses pitch data correctly', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    const pitch = result.atBat!.pitches[0]
    expect(pitch.pitchCode).toBe('FF')
    expect(pitch.endSpeed).toBe(88.2)
    expect(pitch.pX).toBe(-0.12)
    expect(pitch.result).toBe('Called Strike')
    expect(pitch.isContact).toBe(false)
  })

  it('extracts game score and inning', () => {
    const result = parseLiveFeedResponse(mockLiveFeed)
    expect(result.game.awayScore).toBe(5)
    expect(result.game.homeScore).toBe(3)
    expect(result.game.inning).toBe(3)
    expect(result.game.inningHalf).toBe('Top')
  })
})

describe('parseMatchupStatsResponse', () => {
  it('parses AVG, HR, AB', () => {
    const raw = {
      stats: [{
        splits: [{
          stat: { avg: '.250', homeRuns: 1, atBats: 12 },
        }],
      }],
    }
    const stats = parseMatchupStatsResponse(raw)
    expect(stats).toEqual({ avg: '.250', hr: 1, ab: 12 })
  })

  it('returns null when no splits', () => {
    const raw = { stats: [{ splits: [] }] }
    expect(parseMatchupStatsResponse(raw)).toBeNull()
  })

  it('returns null when no stats', () => {
    expect(parseMatchupStatsResponse({ stats: [] })).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify fails**

Run:
```bash
npm test
```

Expected: FAIL — `Cannot find module './mlb-api'`

- [ ] **Step 3: Create src/data/mlb-api.ts**

```typescript
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'

const BASE = 'https://statsapi.mlb.com'

export interface LiveFeedResult {
  game: Game;
  atBat: AtBat | null;
}

function lastNameFrom(fullName: string): string {
  const parts = fullName.trim().split(' ')
  return parts[parts.length - 1]
}

function getPitchCount(
  boxscore: Record<string, { players: Record<string, { stats: { pitching: { pitchesThrown: number } } }> }>,
  pitcherId: number
): number {
  for (const side of ['away', 'home'] as const) {
    const key = `ID${pitcherId}`
    const player = boxscore[side]?.players?.[key]
    if (player?.stats?.pitching?.pitchesThrown !== undefined) {
      return player.stats.pitching.pitchesThrown
    }
  }
  return 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseScheduleResponse(raw: any): Game[] {
  const dates = raw?.dates ?? []
  if (dates.length === 0) return []
  const games = dates[0]?.games ?? []
  return games.map((g: any): Game => {
    const state = g.status?.abstractGameState ?? 'Preview'
    const detailedState: string = g.status?.detailedState ?? ''
    let gameState: Game['gameState'] = 'Preview'
    if (state === 'Final') gameState = 'Final'
    else if (detailedState.toLowerCase().includes('delay')) gameState = 'Delayed'
    else if (state === 'Live') gameState = 'Live'

    const linescore = g.linescore
    return {
      gamePk: g.gamePk,
      awayTeam: g.teams.away.team.abbreviation,
      homeTeam: g.teams.home.team.abbreviation,
      awayScore: g.teams.away.score ?? 0,
      homeScore: g.teams.home.score ?? 0,
      inning: linescore?.currentInning ?? 1,
      inningHalf: linescore?.inningHalf === 'Bottom' ? 'Bot' : 'Top',
      gameState,
      startTime: g.gameDate ?? '',
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLiveFeedResponse(raw: any): LiveFeedResult {
  const gameData = raw.gameData
  const liveData = raw.liveData
  const linescore = liveData.linescore
  const currentPlay = liveData.plays.currentPlay
  const boxscore = liveData.boxscore.teams

  const stateStr: string = gameData.status.abstractGameState
  let gameState: Game['gameState'] = 'Live'
  if (stateStr === 'Final') gameState = 'Final'
  else if (gameData.status.detailedState?.toLowerCase().includes('delay')) gameState = 'Delayed'
  else if (stateStr === 'Preview') gameState = 'Preview'

  const game: Game = {
    gamePk: raw.gamePk ?? 0,
    awayTeam: gameData.teams.away.abbreviation,
    homeTeam: gameData.teams.home.abbreviation,
    awayScore: linescore.teams.away.runs ?? 0,
    homeScore: linescore.teams.home.runs ?? 0,
    inning: linescore.currentInning,
    inningHalf: linescore.inningHalf === 'Bottom' ? 'Bot' : 'Top',
    gameState,
    startTime: '',
  }

  if (!currentPlay) return { game, atBat: null }

  const matchup = currentPlay.matchup
  const count = currentPlay.count
  const pitcherId: number = matchup.pitcher.id
  const batterId: number = matchup.batter.id
  const pitchCount = getPitchCount(boxscore, pitcherId)

  const pitchEvents = (currentPlay.playEvents ?? []).filter((e: any) => e.isPitch === true)

  const pitches: Pitch[] = pitchEvents.map((e: any): Pitch => {
    const pd = e.pitchData
    const hd = e.hitData
    const isContact = e.details?.isInPlay === true
    const contactResult = isContact
      ? (currentPlay.result?.event ?? '').toUpperCase()
      : undefined
    return {
      pitchCode: e.details?.type?.code ?? '',
      pitchDescription: e.details?.type?.description ?? '',
      endSpeed: pd?.endSpeed ?? 0,
      startSpeed: pd?.startSpeed ?? 0,
      spinRate: pd?.breaks?.spinRate ?? 0,
      breakVertical: pd?.breaks?.breakVertical ?? 0,
      breakHorizontal: pd?.breaks?.breakHorizontal ?? 0,
      pX: pd?.coordinates?.pX ?? 0,
      pZ: pd?.coordinates?.pZ ?? 0,
      szTop: pd?.strikeZoneTop ?? 3.5,
      szBot: pd?.strikeZoneBottom ?? 1.5,
      result: e.details?.description ?? '',
      isContact,
      exitVelocity: hd?.launchSpeed,
      launchAngle: hd?.launchAngle,
      hitDistance: hd?.totalDistance,
      contactResult,
    }
  })

  const atBat: AtBat = {
    batterId,
    batterLastName: lastNameFrom(matchup.batter.fullName),
    batterHand: matchup.batSide.code as 'L' | 'R',
    pitcherId,
    pitcherLastName: lastNameFrom(matchup.pitcher.fullName),
    pitcherHand: matchup.pitchHand.code as 'L' | 'R',
    pitchCount,
    balls: count.balls,
    strikes: count.strikes,
    outs: count.outs,
    pitches,
  }

  return { game, atBat }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMatchupStatsResponse(raw: any): MatchupStats | null {
  const splits = raw?.stats?.[0]?.splits
  if (!splits || splits.length === 0) return null
  const stat = splits[0].stat
  return {
    avg: stat.avg ?? '.000',
    hr: stat.homeRuns ?? 0,
    ab: stat.atBats ?? 0,
  }
}

export async function fetchSchedule(date: string): Promise<Game[]> {
  const url = `${BASE}/api/v1/schedule?sportId=1&date=${date}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Schedule fetch failed: ${res.status}`)
  return parseScheduleResponse(await res.json())
}

export async function fetchLiveFeed(gamePk: number): Promise<LiveFeedResult> {
  const url = `${BASE}/api/v1.1/game/${gamePk}/feed/live`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Live feed fetch failed: ${res.status}`)
  return parseLiveFeedResponse(await res.json())
}

export async function fetchMatchupStats(
  batterId: number,
  pitcherId: number
): Promise<MatchupStats | null> {
  const url = `${BASE}/api/v1/people/${batterId}/stats?stats=vsPlayer&opposingPlayerId=${pitcherId}&group=hitting&sportId=1`
  const res = await fetch(url)
  if (!res.ok) return null
  return parseMatchupStatsResponse(await res.json())
}

export function todayDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run:
```bash
npm test
```

Expected: all mlb-api tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/
git commit -m "feat: add MLB API module with parse tests"
```

---

## Task 6: Display Rendering

**Files:**
- Create: `src/glasses/display.ts`
- Create: `src/glasses/display.test.ts`

All render functions return plain strings. They do not call the SDK — that's main.ts's job.

- [ ] **Step 1: Write failing tests**

Create `src/glasses/display.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  renderHeader,
  renderPitchView,
  renderContactView,
  renderGameList,
  renderStateScreen,
} from './display'
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'

const mockGame: Game = {
  gamePk: 748547,
  awayTeam: 'NYY',
  homeTeam: 'BOS',
  awayScore: 5,
  homeScore: 3,
  inningHalf: 'Top',
  inning: 3,
  gameState: 'Live',
  startTime: '',
}

const mockAtBat: AtBat = {
  batterId: 592450,
  batterLastName: 'Judge',
  batterHand: 'R',
  pitcherId: 519242,
  pitcherLastName: 'Sale',
  pitcherHand: 'L',
  pitchCount: 87,
  balls: 2,
  strikes: 1,
  outs: 2,
  pitches: [],
}

const mockPitch: Pitch = {
  pitchCode: 'FF',
  pitchDescription: 'Four-Seam Fastball',
  endSpeed: 88,
  startSpeed: 96,
  spinRate: 2387,
  breakVertical: 14,
  breakHorizontal: -4,
  pX: 0,
  pZ: 2.5,
  szTop: 3.5,
  szBot: 1.5,
  result: 'Called Strike',
  isContact: false,
}

const mockStats: MatchupStats = { avg: '.250', hr: 1, ab: 12 }

describe('renderHeader', () => {
  it('includes teams, score, inning, and count', () => {
    const h = renderHeader(mockGame, mockAtBat)
    expect(h).toContain('NYY')
    expect(h).toContain('BOS')
    expect(h).toContain('5')
    expect(h).toContain('3')
    expect(h).toContain('Top 3')
    expect(h).toContain('B:2')
    expect(h).toContain('S:1')
    expect(h).toContain('O:2')
  })

  it('shows Final label when game is over', () => {
    const finalGame = { ...mockGame, gameState: 'Final' as const }
    const h = renderHeader(finalGame, null)
    expect(h).toContain('Final')
  })
})

describe('renderPitchView', () => {
  it('includes B: and P: labels with handedness', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('B: Judge [R]')
    expect(body).toContain('P: Sale [L]')
  })

  it('includes pitch count after pitcher name', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('87p')
  })

  it('includes pitch type from format map', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('4-Seam FF')
  })

  it('includes velocity, result, spin, break, velocity drop', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('88 mph')
    expect(body).toContain('Called Strike')
    expect(body).toContain('2387 rpm')
    expect(body).toContain('Drop')
    expect(body).toContain('Move')
    expect(body).toContain('96→88')
  })

  it('includes historical split at bottom', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain('Judge vs Sale')
    expect(body).toContain('.250')
    expect(body).toContain('1 HR')
    expect(body).toContain('12 AB')
  })

  it('shows Pitch N/M label when pitchIndex provided', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, 2, 5)
    expect(body).toContain('Pitch 2 / 5')
  })

  it('shows Catcher\'s view when pitchIndex is null (live)', () => {
    const body = renderPitchView(mockAtBat, mockPitch, mockStats, null, 1)
    expect(body).toContain("Catcher's view")
  })
})

describe('renderContactView', () => {
  const contactPitch: Pitch = {
    ...mockPitch,
    isContact: true,
    exitVelocity: 108,
    launchAngle: 32,
    hitDistance: 431,
    contactResult: 'HOME RUN',
  }

  it('includes result label', () => {
    const body = renderContactView(mockAtBat, contactPitch, mockStats)
    expect(body).toContain('HOME RUN')
  })

  it('includes exit velocity, launch angle, distance', () => {
    const body = renderContactView(mockAtBat, contactPitch, mockStats)
    expect(body).toContain('108 mph')
    expect(body).toContain('32°')
    expect(body).toContain('431 ft')
  })

  it('includes historical split', () => {
    const body = renderContactView(mockAtBat, contactPitch, mockStats)
    expect(body).toContain('Judge vs Sale')
  })
})

describe('renderGameList', () => {
  const games: Game[] = [
    { ...mockGame },
    { ...mockGame, gamePk: 2, awayTeam: 'LAD', homeTeam: 'SF', awayScore: 0, homeScore: 0, gameState: 'Preview' },
  ]

  it('shows all games with team names', () => {
    const body = renderGameList(games, 0)
    expect(body).toContain('NYY')
    expect(body).toContain('BOS')
    expect(body).toContain('LAD')
    expect(body).toContain('SF')
  })

  it('marks selected game with an indicator', () => {
    const body = renderGameList(games, 0)
    expect(body).toContain('▶')
  })
})

describe('renderStateScreen', () => {
  it('renders no-game-selected state', () => {
    const body = renderStateScreen('no-game')
    expect(body).toContain('Select a game')
    expect(body).toContain('phone')
  })

  it('renders loading state', () => {
    const body = renderStateScreen('loading')
    expect(body).toContain('Loading')
  })

  it('renders error state', () => {
    const body = renderStateScreen('error')
    expect(body).toContain('Unable to load')
    expect(body).toContain('Tap to retry')
  })
})
```

- [ ] **Step 2: Run to verify fails**

Run:
```bash
npm test
```

Expected: FAIL — `Cannot find module './display'`

- [ ] **Step 3: Create src/glasses/display.ts**

```typescript
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import { formatPitchType } from '../data/pitch-types'
import { getDotPosition, renderZoneGrid } from './zone'

const DIVIDER = '━'.repeat(38)
const CHARS_PER_LINE = 38

function center(text: string): string {
  const pad = Math.max(0, Math.floor((CHARS_PER_LINE - text.length) / 2))
  return ' '.repeat(pad) + text
}

export function renderHeader(game: Game, atBat: AtBat | null): string {
  if (game.gameState === 'Final') {
    return center(`${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}  Final`)
  }
  const score = `${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`
  const inning = `${game.inningHalf} ${game.inning}`
  if (!atBat) return center(`${score} | ${inning}`)
  const count = `B:${atBat.balls} S:${atBat.strikes} O:${atBat.outs}`
  return center(`${score} | ${inning} | ${count}`)
}

function buildDetailLines(pitch: Pitch): string[] {
  const horizArrow = pitch.breakHorizontal < 0 ? '←' : '→'
  const horizAbs = Math.abs(Math.round(pitch.breakHorizontal))
  return [
    formatPitchType(pitch.pitchCode, pitch.pitchDescription),
    `${Math.round(pitch.endSpeed)} mph`,
    pitch.result,
    `${Math.round(pitch.spinRate)} rpm`,
    `Drop ↓${Math.round(pitch.breakVertical)}"`,
    `Move ${horizArrow}${horizAbs}"`,
    `${Math.round(pitch.startSpeed)}→${Math.round(pitch.endSpeed)}`,
  ]
}

function buildTwoColumnLines(
  gridRows: string[],
  detailItems: string[],
  zoneLabel: string,
  pitchType: string
): string[] {
  const COL_GAP = '         '
  const lines: string[] = []

  lines.push(`${zoneLabel}${COL_GAP}${pitchType}`)

  const extraAbove = gridRows.length === 8 && !gridRows[0].startsWith('┌')
  const startGridIdx = extraAbove ? 1 : 0

  if (extraAbove) {
    lines.push(`${gridRows[0]}${COL_GAP}${detailItems[1] ?? ''}`)
  }

  const gridBody = gridRows.slice(startGridIdx)
  const detailStart = extraAbove ? 2 : 1

  gridBody.forEach((row, i) => {
    const detail = detailItems[detailStart + i] ?? ''
    lines.push(`${row}${COL_GAP}${detail}`)
  })

  return lines
}

function splitLine(game: Game, atBat: MatchupStats | null, batterLast: string, pitcherLast: string): string {
  if (!atBat) return ''
  return center(`${batterLast} vs ${pitcherLast}: ${atBat.avg}  ${atBat.hr} HR  ${atBat.ab} AB`)
}

export function renderPitchView(
  atBat: AtBat,
  pitch: Pitch,
  stats: MatchupStats | null,
  pitchIndex: number | null,
  totalPitches: number
): string {
  const lines: string[] = []

  const batterLabel = `B: ${atBat.batterLastName} [${atBat.batterHand}]`
  const pitcherLabel = `P: ${atBat.pitcherLastName} [${atBat.pitcherHand}] ${atBat.pitchCount}p`
  lines.push(center(`${batterLabel}   ${pitcherLabel}`))
  lines.push(DIVIDER)

  const zoneLabel = pitchIndex !== null
    ? `Pitch ${pitchIndex} / ${totalPitches}`
    : "Catcher's view"

  const dotPos = getDotPosition(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot)
  const gridRows = renderZoneGrid(dotPos)
  const detailItems = buildDetailLines(pitch)

  const twoColLines = buildTwoColumnLines(gridRows, detailItems, zoneLabel, detailItems[0])
  lines.push(...twoColLines)

  lines.push(DIVIDER)
  if (stats) {
    lines.push(center(`${atBat.batterLastName} vs ${atBat.pitcherLastName}: ${stats.avg}  ${stats.hr} HR  ${stats.ab} AB`))
  }

  return lines.join('\n')
}

export function renderContactView(
  atBat: AtBat,
  pitch: Pitch,
  stats: MatchupStats | null
): string {
  const lines: string[] = []

  const batterLabel = `B: ${atBat.batterLastName} [${atBat.batterHand}]`
  const pitcherLabel = `P: ${atBat.pitcherLastName} [${atBat.pitcherHand}] ${atBat.pitchCount}p`
  lines.push(center(`${batterLabel}   ${pitcherLabel}`))
  lines.push(DIVIDER)
  lines.push(center(`⚾ ${pitch.contactResult ?? 'IN PLAY'}`))
  lines.push('')

  if (pitch.exitVelocity !== undefined) {
    lines.push(`Exit Velocity   ${Math.round(pitch.exitVelocity)} mph`)
  }
  if (pitch.launchAngle !== undefined) {
    lines.push(`Launch Angle    ${Math.round(pitch.launchAngle)}°`)
  }
  if (pitch.hitDistance !== undefined) {
    lines.push(`Distance        ${Math.round(pitch.hitDistance)} ft`)
  }

  lines.push(DIVIDER)
  if (stats) {
    lines.push(center(`${atBat.batterLastName} vs ${atBat.pitcherLastName}: ${stats.avg}  ${stats.hr} HR  ${stats.ab} AB`))
  }

  return lines.join('\n')
}

export function renderGameList(games: Game[], selectedIndex: number): string {
  const lines: string[] = []
  lines.push(center("Select a Game"))
  lines.push(DIVIDER)

  games.forEach((g, i) => {
    const selected = i === selectedIndex
    let label: string
    if (g.gameState === 'Preview') {
      label = `${g.awayTeam} vs ${g.homeTeam}`
    } else if (g.gameState === 'Final') {
      label = `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  Final`
    } else {
      label = `${g.awayTeam} ${g.awayScore}-${g.homeScore} ${g.homeTeam}  ${g.inningHalf[0]}${g.inning}`
    }
    lines.push(selected ? `▶ ${label}` : `  ${label}`)
  })

  lines.push(DIVIDER)
  lines.push(center('scroll: navigate  tap: select'))
  return lines.join('\n')
}

export type AppScreenState = 'no-game' | 'loading' | 'error' | 'starting-soon' | 'delayed' | 'final'

export function renderStateScreen(state: AppScreenState, game?: Game): string {
  const lines: string[] = ['', '']
  switch (state) {
    case 'no-game':
      lines.push(center('Select a game in the'))
      lines.push(center('StrikeZone app on your phone'))
      break
    case 'loading':
      lines.push(center('Loading...'))
      break
    case 'error':
      lines.push(center('Unable to load game data.'))
      lines.push('')
      lines.push(center('Tap to retry.'))
      break
    case 'starting-soon':
      if (game) lines.push(center(`${game.awayTeam} vs ${game.homeTeam}`))
      lines.push(center('Game Starting Soon'))
      break
    case 'delayed':
      if (game) lines.push(center(`${game.awayTeam} vs ${game.homeTeam}`))
      lines.push(center('Rain Delay'))
      break
    case 'final':
      if (game) lines.push(center(`${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam}`))
      lines.push(center('Final'))
      break
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run:
```bash
npm test
```

Expected: all display tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/glasses/display.ts src/glasses/display.test.ts
git commit -m "feat: add display rendering with tests"
```

---

## Task 7: Input Handling

**Files:**
- Create: `src/glasses/input.ts`

Copied from SubwayLens `input.ts` with the same CLICK_EVENT=0 quirk fix. No unit tests needed — SDK-dependent.

- [ ] **Step 1: Create src/glasses/input.ts**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/glasses/input.ts
git commit -m "feat: add input event bridge"
```

---

## Task 8: Game State Manager

**Files:**
- Create: `src/glasses/game-state.ts`

Holds all runtime state. `main.ts` calls these functions and reads the returned state to decide what to display.

- [ ] **Step 1: Create src/glasses/game-state.ts**

```typescript
import type { Game, AtBat, Pitch, MatchupStats } from '../lib/types'
import {
  fetchSchedule,
  fetchLiveFeed,
  fetchMatchupStats,
  todayDateString,
} from '../data/mlb-api'
import { getSettings, saveSettings } from '../lib/storage'

export type AppMode = 'game-list' | 'pitch-view' | 'loading' | 'error'

export interface AppState {
  mode: AppMode;
  games: Game[];
  gameListIndex: number;
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
  selectedGamePk: null,
  game: null,
  atBat: null,
  matchupStats: null,
  pitchHistoryIndex: null,
  lastError: null,
}

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let onStateChange: (() => void) | null = null

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
    state.games = await fetchSchedule(todayDateString())
  } catch {
    state.games = []
  }

  if (state.selectedGamePk) {
    await refresh()
  } else {
    state.mode = 'game-list'
    state.gameListIndex = 0
    notify()
  }
}

export async function refresh(): Promise<void> {
  if (!state.selectedGamePk) return
  try {
    const result = await fetchLiveFeed(state.selectedGamePk)
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
        fetchMatchupStats(result.atBat.batterId, result.atBat.pitcherId).then(
          (stats) => {
            state.matchupStats = stats
            notify()
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
  if (direction === 'up') {
    state.gameListIndex = (state.gameListIndex - 1 + state.games.length) % state.games.length
  } else {
    state.gameListIndex = (state.gameListIndex + 1) % state.games.length
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
  state.gameListIndex = state.games.findIndex(g => g.gamePk === state.selectedGamePk)
  if (state.gameListIndex < 0) state.gameListIndex = 0
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: exits clean.

- [ ] **Step 3: Commit**

```bash
git add src/glasses/game-state.ts
git commit -m "feat: add game state manager"
```

---

## Task 9: Main Entry Point

**Files:**
- Create: `src/main.ts`

Wires SDK bridge → input callbacks → state → display. Follows SubwayLens container setup exactly.

- [ ] **Step 1: Create src/main.ts**

```typescript
import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
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

async function updateBody(text: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: BODY_ID, containerName: BODY_NAME,
      contentOffset: 0, contentLength: 2000, content: text,
    })
  )
}

async function updateHeader(text: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: HEADER_ID, containerName: HEADER_NAME,
      contentOffset: 0, contentLength: 1000, content: text,
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors. (Will fail if settings-mount.tsx doesn't exist yet — create a stub first.)

- [ ] **Step 3: Create stub settings-mount.tsx to unblock compile**

Create `src/settings/settings-mount.tsx`:

```typescript
export function initSettingsPage(): void {
  // Implemented in Task 10
}
```

- [ ] **Step 4: Verify compile passes**

Run:
```bash
npx tsc --noEmit
```

Expected: exits clean.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/settings/settings-mount.tsx
git commit -m "feat: add main entry point and glasses mode wiring"
```

---

## Task 10: Phone Settings UI

**Files:**
- Modify: `src/settings/settings-mount.tsx`
- Create: `src/settings/SettingsApp.tsx`

Phone UI shows today's games and lets the user tap to select. Selection is saved to storage and signals the glasses to reload via a custom event.

- [ ] **Step 1: Replace settings-mount.tsx with full implementation**

```typescript
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { SettingsApp } from './SettingsApp'

export function initSettingsPage(): void {
  const app = document.getElementById('app')
  if (!app) return
  createRoot(app).render(createElement(SettingsApp))
}
```

- [ ] **Step 2: Create src/settings/SettingsApp.tsx**

```typescript
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

  function gameLabel(g: Game): string {
    if (g.gameState === 'Preview') return `${g.awayTeam} vs ${g.homeTeam}`
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: exits clean.

- [ ] **Step 4: Run all tests to confirm nothing broke**

Run:
```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings/
git commit -m "feat: add phone game selection settings page"
```

---

## Task 11: Build and Simulator Verification

- [ ] **Step 1: Build the app**

Run:
```bash
npm run build
```

Expected: `dist/` created with no TypeScript errors.

- [ ] **Step 2: Start dev server and open in browser**

Run:
```bash
npm run dev
```

Open `http://localhost:5173` in browser.

Expected: Phone settings page renders showing today's games list (or "No games today" if off-season). No console errors.

- [ ] **Step 3: Start the EvenHub simulator**

Run (in a new terminal):
```bash
npx evenhub-simulator
```

Open the simulator URL shown in the terminal.

- [ ] **Step 4: Connect app to simulator via QR**

Run:
```bash
npm run qr
```

Scan the QR code in the simulator. The app should load and show either a game list or "Loading..." on the glasses display.

- [ ] **Step 5: Verify glasses display layout**

With a live game selected (or use a past `gamePk` for testing):

Check:
- Header shows `NYY 5-3 BOS | Top 3 | B:2 S:1 O:2` format
- Body shows `B: LastName [R]   P: LastName [L] NNp`
- Strike zone grid renders with ● in correct position
- Pitch detail column shows all 7 items
- Historical split shows at the bottom

- [ ] **Step 6: Verify interaction**

In the simulator:
- Click once → should trigger refresh (live feed re-fetched)
- Double-click → should switch to game list
- Scroll up → previous pitch in at-bat (or game list navigation)
- Scroll down → return to live (or game list navigation)

- [ ] **Step 7: Pack for distribution**

Run:
```bash
npm run pack
```

Expected: `strikezone.ehpk` created in project root.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: complete StrikeZone v1.0"
```

---

## Post-Build Notes

**MLB API field paths to verify with live data:**
- `pitchData.strikeZoneTop` / `pitchData.strikeZoneBottom` — confirm these are directly on `pitchData`, not nested
- `pitchData.breaks.breakVertical` — confirm sign convention (positive = drop for a 4-seam)
- `liveData.boxscore.teams.{side}.players.ID{id}.stats.pitching.pitchesThrown` — confirm this path for pitch count
- Contact result from `currentPlay.result.event` — some play types have different event names than expected

**Known limitations in v1:**
- Zone grid column alignment is approximate (G2 font is variable-width, spaces may not align perfectly)
- Historical split endpoint may return empty splits for new matchups or first career facing
- `even-toolkit` component class names (`border-accent`, `bg-surface`, etc.) depend on the toolkit's Tailwind theme — check installed version's docs if styles look wrong
