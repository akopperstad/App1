import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative, platform, quietly } from './platform';

/**
 * Status bar / navigation bar icon colour follows the app theme.
 * The web view is edge-to-edge (overlaysWebView + SystemBars insetsHandling),
 * so the bars are transparent and the page's own background shows through;
 * safe areas come from env(safe-area-inset-*) in CSS.
 */
export function setSystemBarsTheme(theme: 'light' | 'dark'): void {
  if (!isNative()) return;
  // Style.Dark = light icons for a dark background.
  quietly(() => StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark }));
  if (platform() === 'android') {
    quietly(() =>
      SystemBars.setStyle({
        style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark,
        bar: SystemBarType.NavigationBar,
      }),
    );
  }
}

let splashHidden = false;

/** Hide the launch splash once the first screen has painted (launchAutoHide is off). */
export function hideSplashWhenPainted(): void {
  if (!isNative() || splashHidden) return;
  splashHidden = true;
  const hide = () => quietly(() => SplashScreen.hide({ fadeOutDuration: 200 }));
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(hide));
  else setTimeout(hide, 0);
}
