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

Then `npm run cap:sync`, and `grep -r pulsetimer android ios capacitor.config.ts` should only show your new id.

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

## 3. Pre-release checklist

- [ ] App id changed everywhere (section 0) and `npm run cap:sync` run.
- [ ] Version / versionCode / build number bumped.
- [ ] `npx tsc -p . && npx vitest run && npm run build` pass.
- [ ] On a real iPhone and Android phone:
  - [ ] Start a Tabata, lock the phone: a notification + sound arrives at each change and "Time!" at the end; unlocking cancels the rest.
  - [ ] Notification permission prompt appears on first start only.
  - [ ] Beeps and voice play over Spotify/Apple Music without stopping it ("Play over music" on); turning it off makes Pulse take over audio.
  - [ ] Haptics on countdown / work / rest / finish.
  - [ ] Screen stays on while a timer runs.
  - [ ] Android back button: goes back a screen; on Home it backgrounds the app.
  - [ ] Light and dark theme: status bar icons readable; splash colour matches.
  - [ ] Rotation works on phone and tablet; nothing under the notch / home indicator.
- [ ] Store listings, screenshots, privacy answers filled in.
