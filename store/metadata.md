# Pulse: store metadata, questionnaires and review notes

Everything the store consoles ask for beyond the listing copy (that's in
`store/listing/<locale>.md`). Items marked **TODO** need a real value before
submission.

| | |
|---|---|
| App name (on device) | Pulse |
| Store name | Pulse: WOD & Interval Timer (27/30), localised per `store/listing/` |
| Bundle / application id | `com.pulsetimer.app`. **TODO: placeholder, choose the final id before the first upload (permanent), see docs/RELEASE.md** |
| Version | 1.0.0 |
| Price | Free, no in-app purchases, no subscriptions |
| Primary category | **Health & Fitness** (App Store and Google Play) |
| Secondary category (App Store) | Sports (optional), or leave empty |
| Play tags | Fitness timer, Workout, HIIT (pick from Play's tag list) |
| Support URL | **TODO** `https://<your-domain>/support.html` (from `site/`) |
| Marketing URL | **TODO** `https://<your-domain>/` |
| Privacy policy URL | **TODO** `https://<your-domain>/privacy.html` (required by both stores) |
| Support / contact email | **TODO** `support@<your-domain>` (Play shows it publicly, Apple needs it for review) |
| Developer / seller name | **TODO** |
| Developer address (Play, for organisations / monetised apps) | **TODO** |
| Copyright (App Store) | **TODO** `© 2026 <Your name or company>` |
| Share-link host | **TODO** the domain that serves `site/w/` (set `VITE_SHARE_ORIGIN=https://<your-domain>/w/` for native builds) |

Locales: en-US (primary), nb-NO (App Store Connect calls it "Norwegian", code
`no`; Play `no-NO`), de-DE, es-ES, fr-FR.

---

## App Store Connect

### Age rating: **4+**
Answer the questionnaire like this:

| Question | Answer |
|---|---|
| Cartoon or fantasy violence / realistic violence / prolonged graphic or sadistic violence | None |
| Profanity or crude humour | None |
| Mature or suggestive themes | None |
| Horror or fear themes | None |
| Sexual content or nudity / graphic sexual content | None |
| Alcohol, tobacco or drug use or references | None |
| Simulated gambling / contests | None |
| Medical or treatment information | None (Pulse is a timer and gives no medical or training advice) |
| Health or wellness topics (if asked) | None / No. It times workouts the user designs and gives no health guidance |
| Guns or other weapons | None |
| Unrestricted web access | No |
| User-generated content / messaging / social features | No (workouts are shared through the system share sheet as a link; there is no in-app chat, feed or user profile) |
| Advertising | No |
| Parental controls / age assurance | Not applicable |
| Made for Kids | No |

### App Privacy: **Data Not Collected**
- "Do you or your third-party partners collect data from this app?" → **No, we do not collect data from this app.**
- This matches `ios/App/App/PrivacyInfo.xcprivacy` (no tracking, no collected data types).
- Tracking: **No**. No App Tracking Transparency prompt. No IDFA.
- Why this holds: the app makes no network requests at runtime. Settings, saved
  workouts and history live in the app's local storage on the device. Backups
  and CSV exports are files the user saves or shares through the system sheet.
  Apple's definition of "collect" means data leaving the device to the
  developer or third parties, which never happens.

### Export compliance
`ITSAppUsesNonExemptEncryption = NO` is already in Info.plist, so no
encryption documentation is needed.

### Sign-in / demo account
Not needed: there is no account. Leave "Sign-in required" unchecked.

### App Review notes (paste into App Review Information › Notes)

```text
Pulse is a workout timer for interval training (AMRAP, EMOM, For Time, Tabata, intervals, Death By, custom sequences, countdown and stopwatch). The interface is built with web technologies inside a native shell, and it relies on native iOS capabilities a website cannot provide:

• Local notifications for background cues. When you lock the phone or switch apps mid-workout, Pulse schedules a local notification with a sound at every upcoming work/rest change (for example "Rest – 0:10", "Work – Round 4/8", "Time! Workout complete") so athletes keep getting cues with the screen off. These are cancelled as soon as you return to the app. Notification permission is requested only the first time a timer starts, and is used only for these workout cues: no marketing or remote push.
• Native haptics (Taptic Engine) on every 3-2-1 countdown beep and interval change.
• Native text-to-speech announcements in five languages ("Round 3 of 8", "Halfway", "Ten seconds").
• An audio session configured so beeps play over the user's music (Settings › "Play over music") instead of interrupting it.
• Keeps the screen awake while a timer runs, and adapts the status bar to the light/dark theme.

The app does not declare any background modes: it does not play continuous background audio, it uses scheduled local notifications instead.

How to test background cues: Home › Tabata › Start › allow notifications › lock the phone. You will get a notification with sound at each work/rest change.

Fully offline. No account, no sign-in, no ads, no analytics, no data collection. Every feature is available immediately; no demo account is needed.
```

This addresses Guideline 4.2 (Minimum Functionality) and 2.5.4 (background
modes) up front.

---

## Google Play Console › App content

### Privacy policy
URL of `site/privacy.html` (**TODO** domain).

### Ads
"Does your app contain ads?" → **No**.

### App access
"All functionality is available without special access" (no login).

### Content rating (IARC questionnaire) → expected **Everyone / PEGI 3 / USK 0**
- Category: **Utility, Productivity, Communication or Other** (not a game).
- Violence, fear, sexuality, nudity, profanity, drugs, alcohol, tobacco, crude humour, discrimination: **No** to all.
- Gambling / simulated gambling: **No**.
- Do users interact or exchange content with other users? **No**. (A workout link
  is shared with the OS share sheet; Pulse has no in-app communication.)
- Does the app share the user's current physical location with others? **No**.
- Does the app allow users to purchase digital goods? **No**.
- Does the app contain unrestricted internet access (browser/search)? **No**.
- Is it primarily a news or educational product? **No**.

### Target audience and content
- Target age groups: **18 and over** (you may add **13–15** and **16–17**). Do **not**
  tick under-13 groups: that brings in the Families policy and teacher-approved rules
  without any benefit for a gym timer.
- "Could your store listing unintentionally appeal to children?" → **No**.

### Data safety
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| (Section on security practices: encryption in transit, deletion request) | Skipped automatically when nothing is collected. No encryption-in-transit claim needed. |
| Account creation | The app does not let users create an account |

Result on the listing: "No data shared with third parties" and "No data collected".

Why: Play counts data as *collected* only when it is sent off the device. Pulse
keeps everything in on-device storage and makes no network requests;
user-initiated exports (backup file, CSV, share link) go through the system
share/save sheet to a destination the user picks, and Play's guidance excludes
that from "sharing".

Note: `android:allowBackup="true"` lets Android's own system backup copy app data
to the user's Google account. That is Google's OS-level backup, not data the
developer collects, so the Data safety answer stays "No". The privacy policy
mentions it for transparency.

### Health apps declaration
Play now asks every Health & Fitness app for this form. Pick **"Activity and
fitness"** (workout timing). Answer **No** to: health data / Health Connect
access, medical device or clinical claims, human-subjects research, disease
management, government health services.

### Exact alarm permission (`USE_EXACT_ALARM`)
Declare the core use case **"Alarm / timer app"**: "Pulse is a workout interval
timer. Its core function is cueing work/rest changes to the second while the
screen is off (for example in a 20 s/10 s Tabata), which needs exact alarms;
inexact alarms would deliver cues seconds late and make the timer unusable."
If Play rejects it, see docs/RELEASE.md §1.5 (fallback to `SCHEDULE_EXACT_ALARM`).

### Notifications (POST_NOTIFICATIONS)
No declaration form, but the in-app use is: one-off runtime request when the
first timer starts; used only for workout cues while the app is in the
background.

### Other declarations
- Government app: No. Financial features: None. News app: No.
- COVID-19 contact tracing/status: No.
- Foreground service: none used.
- Advertising ID: the app does not use the advertising ID (answer **No**; the
  manifest declares no `AD_ID` permission).

---

## Trademark and wording rules applied to the listings
- No "CrossFit" anywhere in metadata or keywords (registered trademark of
  CrossFit, LLC; Apple 2.3.7 / 5.2.1 and Play's impersonation/IP policy). "WOD",
  "AMRAP", "EMOM", "Tabata", "HIIT" and "functional fitness" are used as
  generic terms.
- Named benchmark workouts (the "Girls"/"Hero" names) are not mentioned in the
  listing; the copy says "classic benchmark workouts".
- No competitor or music-service names (Spotify, Apple Music) in store metadata;
  the copy says "plays over your music". (The site FAQ names them only to explain
  compatibility, which is nominative use.)
- No "free", "best", "#1", "no ads" in titles, subtitles, short descriptions or
  graphics (Play metadata policy). "No ads" appears only in long descriptions as a
  factual statement.
- No emoji, ALL-CAPS names or keyword stuffing in names/titles.
