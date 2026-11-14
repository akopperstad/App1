/**
 * <meta name="theme-color"> — the browser / PWA status-bar colour.
 * Defaults match the app backgrounds (--bg in tokens.css); the Run screen
 * overrides it with the phase colour while that colour fills the screen.
 */
export const THEME_COLORS = { dark: '#050506', light: '#f3f3ef' } as const;

export function setThemeColor(color: string): void {
  try {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  } catch {
    /* ignore */
  }
}

/** Back to the plain background of the current theme (<html data-theme>). */
export function resetThemeColor(): void {
  try {
    setThemeColor(document.documentElement.dataset.theme === 'light' ? THEME_COLORS.light : THEME_COLORS.dark);
  } catch {
    /* ignore */
  }
}
