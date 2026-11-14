/**
 * Minimal app-wide toast: `toast('Link copied')` from anywhere, rendered by
 * a single <Toaster /> mounted in App. Announced politely to screen readers.
 */
import { useEffect, useSyncExternalStore } from 'react';
import './features.css';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
  ms: number;
}

let current: Toast | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, opts: { tone?: Toast['tone']; ms?: number } = {}): void {
  current = { id: ++seq, text, tone: opts.tone ?? 'info', ms: opts.ms ?? 2600 };
  emit();
}

export function dismissToast(): void {
  current = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const get = () => current;

export function Toaster() {
  const t = useSyncExternalStore(subscribe, get, get);
  useEffect(() => {
    if (!t) return;
    const timer = window.setTimeout(() => {
      if (current?.id === t.id) dismissToast();
    }, t.ms);
    return () => window.clearTimeout(timer);
  }, [t]);

  return (
    <div className="fx-toaster" role="status" aria-live="polite">
      {t && (
        <button type="button" key={t.id} className={`fx-toast is-${t.tone}`} onClick={dismissToast}>
          <span className="fx-toast__dot" aria-hidden />
          <span>{t.text}</span>
        </button>
      )}
    </div>
  );
}
