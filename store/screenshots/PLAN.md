# Pulse: screenshot storyboard and specs

Status: **produced** (see "Regenerating" at the end). Re-render after any UI change.
The Play feature graphic is already done: `store/graphics/feature-graphic.png`
(source `store/graphics/src/feature-graphic.html`, render with
`node store/graphics/render.cjs`).

## Visual system (all frames)
- Canvas: brand background. Dark frames use near-black `#050506` with a soft coral
  radial glow behind the device. Light frames use warm paper `#f3f3ef`.
- Caption at the top, 2 lines max: headline in heavy system font (SF Pro Display
  Heavy / Roboto Black), ~7% of canvas width. One key word in coral `#ff5b3a`.
  Optional sub-caption in 60% opacity.
- Device: real app screenshot inside a thin, generic device frame (no Apple/Google
  hardware marketing renders needed; a rounded-rect bezel is fine). Device occupies
  ~75% of height and may bleed off the bottom edge.
- Status bar: 9:41, full battery, full signal, no notifications.
- Data must look real but neutral: workout names like "Morning Tabata",
  "Engine Builder", "Hill Sprints". **Do not** use "CrossFit" or the named
  benchmark "Girls"/"Hero" workouts in captions or visible UI text.
- No price or promotional claims in Play images ("free", "no ads", "#1", "best").
  "No account · Works offline" is fine.
- Language: each locale gets its own set, with the app UI switched to that language
  (Settings › Language) and captions from the table below.

## Storyboard: iPhone and Android phone (8 frames, same order on both)

| # | Caption (en) | Screen / state | Theme |
|---|---|---|---|
| 1 | Every timer your **training** needs | Home: grid of all 9 modes (AMRAP, EMOM, For Time, Tabata, Intervals, Death By, Custom, Countdown, Stopwatch) with a couple of saved workouts visible | Dark |
| 2 | Hear every **interval** | Run screen, Tabata, WORK phase, 0:07 left, "Round 3 of 8", ring ~35% full, next "Rest 0:10" | Dark |
| 3 | Cues even with the phone **locked** | iOS lock screen / Android shade with Pulse notifications ("Rest – 0:10", "Work – Round 4/8") over a dimmed wallpaper; small inset of the run screen | Dark |
| 4 | Read it from **across the gym** | Landscape run screen, AMRAP 12:00 at 7:42, round counter "5 rounds" with last split; device rotated in frame | Dark |
| 5 | EMOM, E2MOM, **any interval** | EMOM setup: every 1:00 × 20, rotating movements (Strength, Burpees, Rest, Core), total time chip | Light |
| 6 | Build **any** workout | Custom builder: steps "Run 400 m · Tap when done", "Rest 1:30", "Kettlebell swings 1:00", rounds × 3 | Light |
| 7 | Rounds, splits & **PRs** | History: weekly chart (8 weeks), streak, a PR badge on a For Time entry; detail sheet showing round splits | Light |
| 8 | Your sound. **Your language.** | Settings › Sound: the 5 sound styles (Classic selected), voice announcements on, language row | Dark |

Optional 9th/10th (App Store allows 10): "Share a workout with **one link**" (share
sheet over a setup screen, light), "Private. **Offline.** Yours." (settings › Your data with
backup/restore/CSV, light).

## Storyboard: iPad and Android tablets (6 frames)
Tablets get **landscape** shots (Pulse is often propped up across the room):
1. Every timer your training needs: Home grid, landscape, dark
2. Hear every interval: Tabata run screen, landscape, dark
3. Built for the big screen: AMRAP run with round splits panel, landscape, dark
4. Build any workout: Custom builder, light
5. Rounds, splits & PRs: History with chart, light
6. Your sound. Your language.: Settings, dark

## Captions per locale

| # | en-US | nb-NO | de-DE | es-ES | fr-FR |
|---|---|---|---|---|---|
| 1 | Every timer your training needs | Alle timerne treningen din trenger | Jeder Timer, den dein Training braucht | Todos los temporizadores para tu entreno | Tous les minuteurs pour ton entraînement |
| 2 | Hear every interval | Hør hvert intervall | Hör jedes Intervall | Oye cada intervalo | Entends chaque intervalle |
| 3 | Cues even with the phone locked | Varsler selv når mobilen er låst | Signale auch bei gesperrtem Handy | Avisos incluso con el móvil bloqueado | Des signaux même téléphone verrouillé |
| 4 | Read it from across the gym | Lett å lese fra andre siden av gymmet | Lesbar quer durch die Halle | Se lee desde el otro lado del box | Lisible à l'autre bout de la salle |
| 5 | EMOM, E2MOM, any interval | EMOM, E2MOM, alle intervaller | EMOM, E2MOM, jedes Intervall | EMOM, E2MOM, cualquier intervalo | EMOM, E2MOM, tous les intervalles |
| 6 | Build any workout | Bygg din egen økt | Bau dein eigenes Workout | Crea cualquier entrenamiento | Crée n'importe quelle séance |
| 7 | Rounds, splits & PRs | Runder, mellomtider og rekorder | Runden, Zwischenzeiten & Bestzeiten | Rondas, parciales y récords | Tours, temps et records |
| 8 | Your sound. Your language. | Din lyd. Ditt språk. | Dein Sound. Deine Sprache. | Tu sonido. Tu idioma. | Ton son. Ta langue. |

## Required sizes

### App Store (PNG or JPEG, RGB, no transparency, 1–10 per size, portrait or landscape)
| Display | Portrait px | Notes |
|---|---|---|
| iPhone 6.9" | **1320 × 2868** (or 1290 × 2796 / 1260 × 2736) | Primary set. Required unless 6.5" is supplied |
| iPhone 6.5" | **1284 × 2778** or 1242 × 2688 | Required only if no 6.9" set; supply anyway for older-device storefront fidelity |
| iPad 13" | **2064 × 2752** (or 2048 × 2732) | Required because Pulse runs on iPad. Landscape: 2752 × 2064 |
Smaller iPhone/iPad sizes are scaled down automatically from these.
App preview videos (optional): 886 × 1920 portrait for 6.9", 15–30 s, recorded audio
allowed. The beeps are a strong hook; consider a 20 s Tabata preview later.

### Google Play
| Asset | Size | Notes |
|---|---|---|
| App icon | 512 × 512, 32-bit PNG | Exists: `android/store-assets/play-icon-512.png` |
| Feature graphic | **1024 × 500**, JPEG or 24-bit PNG (no alpha) | Done: `store/graphics/feature-graphic.png` |
| Phone screenshots | 2–8, 16:9 or 9:16, each side 320–3840 px | Use **1080 × 1920** (or 1440 × 2560). ≥ 4 at ≥ 1080 px are needed for promotional placements |
| 7" tablet screenshots | up to 8 | **1200 × 1920** portrait or 1920 × 1200 landscape |
| 10" tablet screenshots | up to 8 | **1600 × 2560** portrait or 2560 × 1600 landscape. Needed for "Designed for tablets" visibility |
| Chromebook (optional) | up to 8 | 1920 × 1080 landscape |

## Production notes
- Capture raw screens at native resolution (iOS Simulator: iPhone 16/17 Pro Max for
  6.9", iPad Pro 13" (M4); Android emulator: Pixel 8 Pro, Pixel Tablet).
- Compose captions + frames with an HTML template rendered by Playwright (same
  approach as the feature graphic), one template, one JSON of captions per locale.
- Keep captions inside the top 22% and away from the outer 4% (store UIs round corners
  and crop slightly in some placements).
- Export without alpha (`page.screenshot({ omitBackground: false })`, JPEG 92 or PNG).

## Regenerating

The images are rendered from the real app (Vite dev server) with Playwright, seeded
data and a frozen clock, then composed into marketing frames:

```sh
npx vite --port 5230 --strictPort &          # serve the app
node store/screenshots/render.cjs            # all platforms × locales (~10 min)
node store/screenshots/check.cjs             # sizes, RGB/no alpha, counts
kill %1
```

Options: `--locales en-US,nb-NO`, `--platforms ios-6.9,play-phone`, `--only home,tabata`
(raw shot ids or frame slugs), `--reuse-raw` (skip app captures, recompose frames only),
`--raw-only`.

- `src/data.cjs`: seed history/presets/settings, localized workout names, **captions**
  (`**word**` = coral highlight), and "now" (Thu 12 Nov 2026 18:40, Europe/Oslo).
- `render.cjs`: platforms (canvas px, device CSS viewport, status-bar inset, scale),
  storyboards, capture recipes (`SHOTS`), lock-screen texts (taken from the app's own
  notification planner, `src/native/schedule.ts`), composition and contact sheets.
- `src/frame.html`: the frame template (background, auto-fitting caption, generic device
  bezel, neutral 9:41 status bar, lock screen).
- Raw app captures land in `store/screenshots/.raw/` (scratch, not for the stores).
- Output: `<platform>/<locale>/<NN>-<slug>.png` and `overview-<locale>.png` (review only).

What was produced vs. the storyboard above:
- Phones: frames 1–8 as planned; iOS also gets a 9th, "Every finish, every split"
  (finish summary with confetti). Play phone gets 8 (Play's maximum).
- Frame 4 shows the landscape run screen on a phone turned 90° so the clock fills the frame.
- Frame 3 (locked) is a composed lock screen: blurred run screen + two notifications whose
  texts come from the app's notification planner in each language.
- Frame 7 uses the History "For Time" filter: PR card, yesterday's PR entry, and an earlier
  attempt expanded with its round splits (the 8-week chart is shown on tablets).
- Frame 8 is scrolled so the "Play over music" hint (which names a third-party app) is out of frame.
- Tablets (iPad 13", Play 7" and 10"): 6 landscape frames as planned.
- Tablets show the tablet layouts (Nov 2026): Home is a dashboard (quick start + week, 3×3 timer
  grid with taglines, saved-workouts rail; the 7" frame is scrolled to the grid), Custom builder is
  two-pane (form + sticky summary with Save/Start), History has a stats/chart/records side column
  next to the list, Settings is two columns with Sound on the left. On tablets the Settings frame is
  unscrolled, so the recipe swaps the web build's "Play over music" hint (which names the other
  platform) for the hint the iOS/Android app shows (`settings.mix.hint`).
