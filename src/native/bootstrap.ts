import { settingsStore } from '../state/store';
import { resumeAudio } from '../audio/context';
import { installBackButton, onAppResume } from './app';
import { applyAudioSession } from './audioSession';
import { clearStaleBackgroundCues } from './background';
import { isNative } from './platform';
import { hideSplashWhenPainted, setSystemBarsTheme } from './systemUi';

/**
 * One-time platform setup, called from main.tsx right after the first render.
 * Everything native is guarded, so on the web only the audio-session
 * preference is applied.
 */
export function initPlatform(): void {
  const audio = () => applyAudioSession(settingsStore.get().mixWithMusic);
  audio();
  settingsStore.subscribe(audio);

  if (!isNative()) return;

  installBackButton();
  onAppResume(resumeAudio);
  void clearStaleBackgroundCues();

  // Status/navigation bar icons follow the resolved theme, which App.tsx (and
  // the pre-paint script in index.html) write to <html data-theme>.
  const root = document.documentElement;
  const theme = () => setSystemBarsTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
  theme();
  try {
    new MutationObserver(theme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  } catch {
    /* ignore */
  }

  hideSplashWhenPainted();
}
