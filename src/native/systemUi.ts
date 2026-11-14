import { useEffect } from 'react';
import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative, platform, quietly } from './platform';

/**
 * Status bar / navigation bar icon colour.
 *
 * The web view is edge-to-edge (overlaysWebView + SystemBars insetsHandling),
 * so both bars are transparent and the page's own background shows through
 * (that *is* the bar colour, on Android too); safe areas come from
 * env(safe-area-inset-*) in CSS. All we pick is the icon colour:
 *
 * - by default it follows the app theme (<html data-theme>, see bootstrap.ts);
 * - a screen that paints its own full-bleed background (the Run screen fills
 *   with the phase colour in light theme) can override it with
 *   setStatusBarOverride / useStatusBarOverride.
 */

/** Icon colour on the bars: 'light' = white icons (dark/coloured background), 'dark' = dark icons. */
export type BarIcons = 'light' | 'dark';

let themeIcons: BarIcons = 'light'; // app starts dark
let override: BarIcons | null = null;
let applied: BarIcons | null = null;

function apply(): void {
  if (!isNative()) return;
  const icons = override ?? themeIcons;
  if (icons === applied) return;
  applied = icons;
  // StatusBar Style.Dark = light icons for a dark background (and vice versa).
  quietly(() => StatusBar.setStyle({ style: icons === 'light' ? Style.Dark : Style.Light }));
  if (platform() === 'android') {
    quietly(() =>
      SystemBars.setStyle({
        style: icons === 'light' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        bar: SystemBarType.NavigationBar,
      }),
    );
  }
}

/** Bars follow the resolved app theme (called by bootstrap.ts on every data-theme change). */
export function setSystemBarsTheme(theme: 'light' | 'dark'): void {
  themeIcons = theme === 'light' ? 'dark' : 'light';
  apply();
}

/**
 * Force the bar icon colour while a screen paints its own background, e.g.
 * the Run screen filled with the phase colour: setStatusBarOverride('light')
 * for white icons. null hands control back to the theme. Native only; no-op on the web.
 */
export function setStatusBarOverride(icons: BarIcons | null): void {
  override = icons;
  apply();
}

/** React form: override while mounted / while `icons` is non-null; restores the theme on unmount. */
export function useStatusBarOverride(icons: BarIcons | null): void {
  useEffect(() => {
    setStatusBarOverride(icons);
    return () => setStatusBarOverride(null);
  }, [icons]);
}

/** Test hook. */
export function __resetSystemUiForTests(): void {
  themeIcons = 'light';
  override = null;
  applied = null;
  splashHidden = false;
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
