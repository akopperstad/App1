# Releasing Pulse to the App Store and Google Play

Pulse ships as one web bundle (Vite → `dist/`) wrapped by Capacitor 8 into
native projects in `ios/` and `android/`. The PWA keeps working as before; the
native apps add keep-awake, haptics, native text-to-speech, **background cues
via local notifications**, mixing with music, status-bar theming, a splash
screen and the Android back button.

```bash
npm ci
npm run cap:sync        # web build + copy into ios/ and android/ + plugin sync
npm run android:build   # debug APK -> android/app/build/outputs/apk/debug/app-debug.apk
npm run android:release # signed AAB -> android/app/build/outputs/bundle/release/app-release.aab
npm run ios:open        # sync, then open the Xcode project (Mac only)
```

Run `npm run cap:sync` after **every** web change before building natively.

### Share links in native builds — `VITE_SHARE_ORIGIN`

Inside the apps the page origin is `capacitor://localhost` (iOS) /
`https://localhost` (Android), so "Share workout" links need the **public URL of
the hosted PWA**. Set it at build time, e.g. in `.env.production`:

```bash
VITE_SHARE_ORIGIN=https://pulse.example.com/w/
```

Point it at the `w/` folder of the hosted `site/` (the share-link landing page,
which previews the workout and has an "Open in Pulse" button), or at the hosted
PWA if you host that instead — both understand `#w=<code>`. Without it, links
created in the apps point at `localhost` and won't open for anyone else. The
PWA build doesn't need it (it uses its own address).

---

## 0. One-time decisions

### Change the app id (do this before the first upload — it is permanent)

`com.pulsetimer.app` is a placeholder. Pick a reverse-DNS id for a domain you
control, e.g. `com.yourstudio.pulse`, then change it in **all** of:

| File | Field |
|---|---|
| `capacitor.config.ts` | `APP_ID` (single source of truth for JS/CLI) |
| `android/app/build.gradle` | `namespace` and `applicationId` |
| `android/app/src/main/res/values/strings.xml` | `package_name`, `custom_url_scheme` |
| `android/app/src/main/java/com/pulsetimer/app/MainActivity.java` | `package` line — and move the file to the matching folder |
| `ios/App/App.xcodeproj/project.pbxproj` | both `PRODUCT_BUNDLE_IDENTIFIER` lines (or Xcode → target App → Signing & Capabilities) |
| `site/.well-known/assetlinks.json`, `site/.well-known/apple-app-site-association` | `package_name` / `appIDs` (only if you enable App Links / Universal Links, section 5) |
| `store/metadata.md` | "Bundle / application id" row |

Then `npm run cap:sync`, and `grep -rn "com\.pulsetimer\.app" android/app/src android/app/build.gradle ios/App/App ios/App/App.xcodeproj capacitor.config.ts site store`
should print nothing. (The **URL scheme** `pulsetimer://` is independent of the app id; keep it.)

### Accounts

- **Apple Developer Program** — USD 99/year, enrol at developer.apple.com (organisations need a D-U-N-S number; allow a few days).
- **Google Play Console** — USD 25 once, play.google.com/console. Identity verification is required.
  **New personal accounts** must run a **closed test with at least 12 testers opted in for 14 consecutive days** before they can apply for production access. Organisation accounts are exempt. Start this early.

### Versioning

- `package.json` → `"version"` is the user-visible version on Android (`versionName`).
- Android `versionCode` (integer) **must increase for every upload**: edit `versionCode` default in `android/app/build.gradle`, or pass `./gradlew bundleRelease -PversionCode=42` (CI uses the run number).
- iOS: Xcode → target App → General → *Version* (`MARKETING_VERSION`, keep equal to package.json) and *Build* (`CURRENT_PROJECT_VERSION`, increase for every upload).

---

## 1. Google Play

### 1.1 Upload key (once)

```bash
mkdir -p ~/keys     # keep the keystore OUTSIDE the repository
keytool -genkeypair -v -keystore ~/keys/pulse-upload.jks -alias pulse-upload \
  -keyalg RSA -keysize 4096 -validity 10000
cp android/keystore.properties.example android/keystore.properties   # gitignored
# edit storeFile / storePassword / keyAlias / keyPassword
```

Back the keystore and passwords up somewhere safe (password manager). With
**Play App Signing** (default for new apps) Google holds the real app-signing
key; this is only the *upload* key and can be reset through Play support if lost.

CI alternative: set `PULSE_KEYSTORE_FILE`, `PULSE_KEYSTORE_PASSWORD`,
`PULSE_KEY_ALIAS`, `PULSE_KEY_PASSWORD` (decode the .jks from a base64 secret first).
Without a keystore `bundleRelease` still builds, just unsigned.

### 1.2 Build

```bash
npm run android:release
# -> android/app/build/outputs/bundle/release/app-release.aab
```

SDK levels (in `android/variables.gradle`): minSdk 24, compile/target SDK 36.
Play requires new apps and updates to target a recent API level (35+ since
Aug 2025) — check the current rule each year and bump `targetSdkVersion`.

### 1.3 Play Console setup

1. **Create app** → name "Pulse", app (not game), free.
2. **App content**:
   - Privacy policy URL (required; a page stating no data is collected is enough — see "Data safety").
   - Ads: *No ads*. App access: *All functionality available without special access*.
   - Content rating questionnaire (fitness utility → Everyone/PEGI 3).
   - Target audience: 18+ (or 13+; avoid "children" to skip Families policy).
   - **Data safety**: *No data collected, no data shared.* All data stays on the device (localStorage); no network calls.
   - Health apps declaration: it's a workout timer; it does not read health data — declare accordingly if asked.
   - **Exact alarm permission declaration** (see 1.5).
3. **Store listing**: short + full description, 512×512 icon (`android/store-assets/play-icon-512.png`), 1024×500 feature graphic, ≥ 2 phone screenshots (portrait + landscape timer look great), category *Health & Fitness*.
4. **Testing → Closed testing**: create a track, upload the AAB, add testers (email list or Google Group). For new personal accounts: ≥ 12 testers opted in, 14 days continuous, then *Apply for production*.
5. **Production** → create release → upload AAB → release notes → *Send for review*.

### 1.4 Notification permission

Android 13+ asks for notification permission the first time a workout starts in
the app (not at launch). The "Workout cues" notification channel explains the
purpose in system settings.

### 1.5 Exact alarms — why `USE_EXACT_ALARM`

Background cues must fire at the exact second a work/rest interval changes.
Pulse declares:

- `USE_EXACT_ALARM` (Android 13+). Google Play restricts it to apps whose
  **core function is an alarm clock or a timer**. Pulse is an interval/workout
  **timer**, so it qualifies. In Play Console → App content → *Exact alarm
  permission*, choose "Timer" and explain:
  > Pulse is a workout interval timer. While the phone is locked it schedules a
  > notification at each work/rest boundary (e.g. every 20 s / 10 s in a Tabata),
  > which must fire on time to be useful.
- `SCHEDULE_EXACT_ALARM` with `maxSdkVersion=32` (Android 12/12L only, where it
  is granted at install).

If Play ever rejects the declaration, remove the `USE_EXACT_ALARM` line from
`android/app/src/main/AndroidManifest.xml` and drop `maxSdkVersion` from
`SCHEDULE_EXACT_ALARM`. The app already checks the exact-alarm state before
scheduling and falls back to inexact alarms (it never opens the special-access
settings screen from the background); cues may then arrive a few seconds late.

---

## 2. App Store (iOS)

Requires a Mac with the current Xcode (or CI — `.github/workflows/mobile.yml`
already compiles the app unsigned on `macos-15`).

### 2.1 Project

```bash
npm ci
npm run ios:open      # builds web, syncs, opens ios/App/App.xcodeproj
```

Plugins are linked with **Swift Package Manager** (`ios/App/CapApp-SPM`), no
CocoaPods. Xcode resolves packages on first open.

In Xcode → target **App** → *Signing & Capabilities*: select your Team, check
the bundle id. No extra capabilities are needed (no Background Modes — see 2.4).

### 2.2 App Store Connect

1. Certificates are managed automatically by Xcode ("Automatically manage signing").
2. App Store Connect → *Apps* → **+** → New App: platform iOS, name "Pulse"
   (must be unique on the store — have alternatives like "Pulse Workout Timer"),
   primary language, bundle id, SKU.
3. **App Privacy**: *Data Not Collected*. The privacy manifest
   (`ios/App/App/PrivacyInfo.xcprivacy`) declares no tracking/no collection and
   the required-reason APIs (UserDefaults CA92.1, file timestamps C617.1,
   system boot time 35F9.1).
4. Export compliance is pre-answered: `ITSAppUsesNonExemptEncryption = false`.
5. Category *Health & Fitness*; age rating 4+; screenshots for 6.9" and 6.5"
   iPhone (+ 13" iPad, since the app supports iPad).

### 2.3 Upload & TestFlight

1. Set *Version* / bump *Build* (see Versioning).
2. Scheme **App**, destination *Any iOS Device (arm64)* → **Product → Archive**.
3. Organizer → **Distribute App** → *App Store Connect* → Upload.
4. After processing (~15 min) the build appears in **TestFlight**. Add internal
   testers immediately; external testers need a short Beta App Review.
5. When happy: App Store tab → select the build → fill "What's New" → **Add for Review** → Submit.

### 2.4 Background behaviour (and why there is no `UIBackgroundModes`)

iOS suspends the web view shortly after the app leaves the foreground, so
in-app beeps stop. Instead, Pulse schedules **local notifications** (with
sound) at every upcoming segment boundary when the app is backgrounded, and
cancels them when it returns. That needs no background mode. We deliberately
do **not** declare `audio`: the app does not play continuous background audio,
and Apple rejects apps that claim it without doing so (Guideline 2.5.4).

### 2.5 Review notes (paste into "Notes" in App Review Information)

> Pulse is a workout interval timer (AMRAP, EMOM, Tabata, intervals, For Time,
> custom). It is built with web technologies inside a native shell, and uses
> native iOS features that a website cannot:
>
> • Local notifications: when you lock the phone mid-workout, Pulse schedules a
>   notification with sound at every work/rest change ("Rest — 0:10",
>   "Work — Round 4/8", "Time! Workout complete") so you keep getting cues with
>   the screen off. To test: start a Tabata (Home → Tabata → Start), allow
>   notifications, lock the phone.
> • Native haptics (Taptic Engine) on every countdown beep and interval change.
> • Native text-to-speech announcements ("Round 3 of 8", "Ten seconds").
> • Audio session configured to play cues over your music instead of stopping it.
> • Keeps the screen awake while a timer runs; adapts status bar to light/dark theme.
>
> Fully offline; no account, no sign-in, no data collection. All features are
> available immediately — no demo account needed.

This addresses Guideline 4.2 (Minimum Functionality) by spelling out the
native functionality up front.

---


## 3. Host the website (`site/`)

`site/` is plain static HTML (no build step): landing page, `privacy.html`,
`terms.html`, `support.html`, the share-link page `w/index.html` and the
`.well-known/` deep-link templates. Both stores require a public **privacy
policy URL** and a **support URL**, so this must be online before you submit.

1. Fill in the TODOs: `grep -rn TODO site/` (developer legal name, contact /
   privacy email, postal address, hosting provider + log retention, store URLs
   and badges once the apps are live, Smart App Banner `app-id`).
2. Deploy the folder as-is to any static host — GitHub Pages, Netlify,
   Cloudflare Pages, S3 + CloudFront… — on HTTPS, ideally on your own domain.
   `site/.nojekyll` keeps GitHub Pages from hiding `.well-known/`.
3. Build the native apps with `VITE_SHARE_ORIGIN=https://<your-domain>/w/`
   (see the top of this file) and open one share link from the app on a phone
   that does **not** have Pulse installed: you should see the workout preview.
4. Put `https://<your-domain>/privacy.html` into **App Store Connect → App
   Privacy → Privacy Policy URL** and **Play Console → App content → Privacy
   policy**; `https://<your-domain>/support.html` into the App Store "Support
   URL" (and the Play store listing "Website").

---

## 4. Pre-release checklist

Do these in order; the first three are permanent or slow, start them first.

- [ ] **App id** chosen and changed everywhere (section 0, table) → `npm run cap:sync`; the grep in section 0 prints nothing.
- [ ] **Display name collision check.** App Store names are unique: search App Store Connect (create the app record early — it reserves the name) and the stores for "Pulse"; there are many. The listing title "Pulse: WOD & Interval Timer" is what users see, but the *home-screen name* (`CFBundleDisplayName` in `ios/App/App/Info.plist`, `app_name` in `android/app/src/main/res/values/strings.xml`, `appName` in `capacitor.config.ts`) is "Pulse". If you rename, also update `store/listing/*.md` and run `npm run store:check`.
- [ ] **Accounts** exist; Play **closed test with 12 testers × 14 days** started if you are a new personal account (section 0).
- [ ] **Contact details / TODOs** filled: `grep -rn TODO site/ store/metadata.md` — support email, privacy email, developer / seller name, address, copyright line, marketing / support / privacy URLs, share-link host.
- [ ] **Website hosted** (section 3) and reachable over HTTPS; `VITE_SHARE_ORIGIN` set for native builds.
- [ ] **Privacy policy URL** entered in both consoles; App Privacy = *Data Not Collected*, Play Data safety = *No data collected / shared*.
- [ ] **Screenshots** captured per `store/screenshots/PLAN.md` and saved in `store/screenshots/` (iPhone 6.9" + 6.5", iPad 13", Android phone; optionally per language). Feature graphic: `store/graphics/feature-graphic.png`; Play icon: `android/store-assets/play-icon-512.png`.
- [ ] **Listing copy** pasted from `store/listing/<locale>.md` for all 5 locales; `npm run store:check` passes.
- [ ] **Version** bumped: `package.json` `version`, Android `versionCode`, iOS *Build* (section 0).
- [ ] **Signing**: Android upload keystore made and backed up (1.1); Xcode Team selected (2.1).
- [ ] **Exact alarm declaration** in Play Console (1.5); review notes pasted in App Store Connect (2.5).
- [ ] **Deep links**: scheme works on both platforms (section 5); App Links / Universal Links only if you set them up.
- [ ] `npx tsc -p . && npx vitest run && npm run build && npm run store:check` pass; CI green.
- [ ] **Real-device test checklist** (section 6) done on at least one iPhone and one Android 14+ phone, from a TestFlight / Play internal-testing build (not just a debug build).

---

## 5. Deep links

Share links look like `https://<share host>/w/#w=<code>` (`src/features/share.ts`).
Three ways a link reaches the app — all end in `normalizeDeepLink()`
(`src/native/deepLinks.ts`, tested in `src/native/nativeUi.test.ts`), which
turns them into `#w=<code>` for `openShared()`; anything else is ignored.

### 5.1 Custom URL scheme `pulsetimer://` (on by default)

- `pulsetimer://import?w=<code>` — the form the "Open in Pulse" button on
  `site/w/` uses (query, because some launchers and in-app browsers drop `#…`).
  `pulsetimer://import#w=<code>` and percent-encoded codes work too.
- iOS: `CFBundleURLTypes` in `ios/App/App/Info.plist`; `SceneDelegate.swift`
  forwards `openURLContexts` to Capacitor → `App` `appUrlOpen`.
- Android: `VIEW` / `BROWSABLE` / `DEFAULT` intent-filter
  (`scheme="pulsetimer" host="import"`) on `MainActivity`, which is
  `launchMode="singleTask"`, so a link opened while the app runs reuses it.
- Cold start: `App.getLaunchUrl()`; while running: `appUrlOpen`
  (`src/native/app.ts` `onDeepLink`, deduplicated).

Test without a website:

```bash
# Android (device/emulator with the app installed)
adb shell am start -a android.intent.action.VIEW -d "pulsetimer://import?w=<code>"
# iOS simulator
xcrun simctl openurl booted "pulsetimer://import?w=<code>"
```

Get a `<code>` from "Share workout" in the app (the part after `#w=`).

### 5.2 Android App Links (opt-in)

Lets `https://<share host>/w/…` open the app directly, without the landing page.

1. Build with the host (no scheme, no path):
   ```bash
   cd android && ./gradlew bundleRelease -PpulseShareHost=pulse.example.com
   # or: PULSE_SHARE_HOST=pulse.example.com, or pulseShareHost=… in android/gradle.properties
   ```
   This merges `android/app/src/applinks/AndroidManifest.xml` — an
   `autoVerify="true"` intent-filter for `https://<host>` with path prefix
   `/w`. Without the property, no https filter is added at all (so the app
   never offers itself for links it can't verify).
2. Edit `site/.well-known/assetlinks.json`: your package name, and the
   **Play App Signing** SHA-256 (Play Console → Test and release → Setup → App
   signing → "App signing key certificate"; that page also shows a ready-made
   assetlinks.json). Add the upload key's SHA-256 too if you sideload release builds.
3. Deploy; check `https://<host>/.well-known/assetlinks.json` is served as
   `application/json` with no redirect. Verify on a device:
   `adb shell pm get-app-links <your.app.id>` → `verified`.

### 5.3 iOS Universal Links (opt-in, documented only)

Not enabled in the project on purpose: an Associated Domains entitlement makes
signing fail until the App ID has that capability, which would break a
first-time "just archive it" release.

1. Apple Developer → Identifiers → your App ID → enable **Associated Domains**
   (with automatic signing Xcode does this when you add the capability).
2. Xcode → target App → Signing & Capabilities → **+ Capability → Associated
   Domains** → `applinks:pulse.example.com`. Xcode creates
   `ios/App/App/App.entitlements` and sets `CODE_SIGN_ENTITLEMENTS`; commit both.
   (The unsigned CI build is unaffected: `CODE_SIGNING_ALLOWED=NO`.)
3. Edit `site/.well-known/apple-app-site-association`: replace
   `TODO_TEAMID` with your Team ID (developer.apple.com → Membership) and the
   bundle id. Serve it at `https://<host>/.well-known/apple-app-site-association`
   — no extension, `Content-Type: application/json`, HTTPS, no redirects.
   Apple's CDN caches it; changes can take a day.
4. Test from Notes or Messages (typing the URL into Safari's address bar does
   not trigger Universal Links). Long-press the link → "Open in Pulse".

The `#w=` fragment is never sent to the server; the app receives the full URL.

---

## 6. Real-device test checklist

Use release-like builds (TestFlight, Play internal testing). Test on at least
one iPhone (iOS 17+) and one Android 14+ phone; an older Android (10–12) and an
iPad if you can.

**Audio**
- [ ] iPhone: start Spotify / Apple Music, then a Tabata: beeps **and** voice play over the music without pausing or ducking it ("Play over music" on).
- [ ] Turn "Play over music" off mid-session (Settings): next workout, starting the timer takes over audio (music pauses). Turn it back on: mixing returns without restarting the app.
- [ ] iPhone **silent switch** on: in-app beeps still play (Pulse uses the playback category, like a timer app should). Background notification sounds are silenced by the switch (they vibrate) — expected; note it for support.
- [ ] Bluetooth headphones / AirPods: cues come through the headphones.
- [ ] Android: beeps over Spotify/YouTube Music; volume buttons change media volume.

**Background / locked screen**
- [ ] iPhone: start a Tabata, lock the phone: a notification with sound at every work/rest change, "Time!" at the end. Unlock mid-workout: pending alerts are cancelled, no double beeps, the timer shows the right time.
- [ ] Same on Android with the screen locked; also with the app swiped to the background (Home).
- [ ] First workout start asks for notification permission once (Android 13+ / iOS); denying it does not break the timer.
- [ ] "Background alerts" off in Settings → locking the phone schedules nothing.
- [ ] Pause, then lock: nothing fires. Long workout (> 64 changes, e.g. 40 × 20/10) locked: alerts keep coming for the first 64 changes (iOS limit; documented).
- [ ] **Android 14+ exact alarms**: cues arrive on the second (compare with a stopwatch over a 20/10 Tabata). `adb shell dumpsys alarm | grep -A3 <your.app.id>` shows exact `RTC_WAKEUP` alarms. Pulse uses `USE_EXACT_ALARM` (granted at install on 13+); if you removed it per 1.5, check Settings → Apps → Pulse → *Alarms & reminders* and that cues arrive only seconds late when it's off.
- [ ] **Doze**: lock the phone, then `adb shell dumpsys deviceidle force-idle` and keep the workout running: cues still fire (alarms are `allowWhileIdle`). Afterwards `adb shell dumpsys deviceidle unforce`. Also try a vendor with aggressive battery management (Samsung, Xiaomi) with battery saver on, and note any delays.
- [ ] Kill the app mid-workout (swipe away): no stray notifications keep firing after the next launch.

**Voice & language**
- [ ] Switch the app to **Norsk** and **Deutsch** (and es / fr): spoken cues use a voice of that language, not an English voice reading Norwegian. If the phone lacks the voice, install it (iOS: Settings → Accessibility → Spoken Content → Voices; Android: Settings → System → Text-to-speech → install voice data) and note the fallback behaviour.
- [ ] Background-cue notifications (titles like "Rest — 0:10", the "Workout cues" Android channel) — **currently English-only** (`src/native/schedule.ts`, `background.ts`); check they read acceptably, or localise them before launch.

**System UI & navigation**
- [ ] Light and dark theme: status bar and Android navigation bar icons are readable on every screen, including the Run screen filled with the phase colour in light theme (white icons there), and they switch back after leaving Run.
- [ ] Android back: one screen back; on Home it backgrounds the app.
- [ ] Rotation on phone and tablet; nothing under the notch / Dynamic Island / home indicator / gesture bar.
- [ ] Splash colour matches the theme; no white flash at launch.
- [ ] Screen stays on while a timer runs; haptics on countdown / work / rest / finish.

**Sharing & data**
- [ ] Share a workout from the app: the link contains your domain (not `localhost`), opens the landing page on a phone without Pulse, and "Open in Pulse" imports it on a phone with Pulse (both platforms, from Messages / WhatsApp / Mail).
- [ ] `adb shell am start … pulsetimer://import?w=…` / `xcrun simctl openurl …` with the app closed (cold start) and open.
- [ ] Backup export → delete app → reinstall → restore: workouts and history come back.

---

## 7. What you must do yourself

Things no code change can do for you, with rough time estimates.

| Task | Where | Time |
|---|---|---|
| Choose the final app id and display name; change it (section 0) | repo | 30 min |
| Enrol in the Apple Developer Program (organisations: D-U-N-S first) | developer.apple.com | 1 h of work, 1–7 days waiting |
| Create the Google Play developer account + identity verification | play.google.com/console | 1 h, 1–3 days waiting |
| New personal Play account: recruit 12 testers, run the closed test | Play Console | 30 min setup, **14 days** waiting |
| Domain + static hosting for `site/`, fill its TODOs, deploy | your host / registrar | 1–2 h |
| Fill `store/metadata.md` TODOs (seller name, address, emails, URLs) | repo | 20 min |
| Generate and back up the Android upload keystore | your machine + password manager | 15 min |
| App Store Connect app record, App Privacy, age rating, pricing, review notes | App Store Connect | 1–2 h |
| Play Console app, App content forms (privacy, data safety, rating, audience, exact-alarm declaration) | Play Console | 1–2 h |
| Screenshots for each device class (and per language, optional) | simulators / phones | 2–4 h (+1–2 h per extra language) |
| Paste listing copy for 5 locales, check with `npm run store:check` | both consoles | 1–2 h |
| Real-device test checklist (section 6) on iPhone + Android | phones | 2–3 h |
| Archive + upload iOS build, TestFlight, submit | Mac with Xcode | 1 h + review 1–3 days |
| Build + upload AAB, internal → closed → production | Play Console | 1 h + review 1–7 days |
| Optional: App Links / Universal Links (section 5.2 / 5.3) | consoles + host | 1–2 h |
| Optional: record a 15–30 s app preview video | phone | 2 h |

Total hands-on time is roughly **2–3 working days**, spread over **2–3 weeks**
of calendar time (account verification, the Play closed-test requirement and
store review dominate).
