import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native app configuration (iOS + Android via Capacitor).
 *
 * APP ID — CHANGE BEFORE RELEASE.
 * `com.pulsetimer.app` is a placeholder. Bundle identifiers are permanent once
 * an app is published, so pick the reverse-DNS id of a domain you control and
 * change it here AND in the native projects (see docs/RELEASE.md, "Changing
 * the app id"). This constant is the single source of truth for JS/CLI; the
 * native projects were generated from it.
 */
export const APP_ID = 'com.pulsetimer.app';

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: 'Pulse',
  webDir: 'dist',
  // The web app is bundled into the binary (works offline, no remote URL).
  backgroundColor: '#0a0b0d',
  ios: {
    // Let the web view extend under the status bar / home indicator;
    // safe-area insets are handled in CSS via viewport-fit=cover.
    contentInset: 'never',
    backgroundColor: '#0a0b0d',
  },
  plugins: {
    SplashScreen: {
      // Hidden from JS once the first screen has rendered (src/native/bootstrap.ts).
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: '#0a0b0d',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    SystemBars: {
      // Edge-to-edge on Android: the web view draws under the system bars and
      // honours viewport-fit=cover, so env(safe-area-inset-*) carries the real
      // insets (older WebViews additionally get --safe-area-inset-* CSS vars).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_pulse',
      iconColor: '#ff5a1f',
    },
  },
};

export default config;
