# Pulse — Workout Timer

A fast, offline-capable workout timer (installable PWA) built for the gym: readable from across the room, accurate to the millisecond, with beeps, voice and vibration cues.

## Timers
| Mode | What it does |
|---|---|
| **AMRAP** | Count-down block(s), multiple AMRAPs with rest between, tap-to-count rounds with splits |
| **EMOM / E2MOM / E1:30…** | Any interval length, rotating movements (incl. "Rest" minutes) |
| **For Time** | Count-up with optional time cap, target rounds (auto-finishes on the last), laps |
| **Tabata** | 20/10 × 8 by default, multiple sets with set rest |
| **Intervals** | Any work/rest, rounds, sets, rest between sets, rotating movements |
| **Death By** | Rep target grows each interval; tracks rounds survived |
| **Custom** | Build any sequence of timed or untimed ("tap when done") steps, repeated N rounds |
| **Countdown** | Simple timer with ±10s / +1:00 adjustments |
| **Stopwatch** | Count-up with laps, splits, fastest/slowest |

## Highlights
- **Drift-free engine** — time comes from a monotonic clock, not summed ticks; catches up correctly after backgrounding; every cue fires exactly once.
- **Cues** — 3-2-1 beeps, "go"/rest tones, halfway / 10-second / minute marks, spoken announcements, vibration, full-screen colour flash.
- **Get-ready lead-in**, pause/resume, skip/back, hold-to-reset/end, keyboard shortcuts (Space, ←/→, L, R, F, Esc).
- **Screen wake lock**, fullscreen, portrait + landscape layouts, light/dark themes.
- **Saved workouts, benchmarks (Cindy, Fran, FGB…), history** with weekly stats, streaks and round splits.
- Works fully offline once loaded; install to the home screen.

## Develop
```bash
npm install
npm run dev       # start dev server
npm test          # 137 unit tests (engine timing, cues, storage, run screen)
npm run build     # production build in dist/
```
Stack: Vite, React 19, TypeScript, plain CSS. No runtime dependencies beyond React.
