/**
 * UI glue for workout sharing: share sheet / clipboard, the <ShareButton />,
 * and opening "#w=…" links (on launch and while the app is open).
 */
import { useEffect } from 'react';
import type { WorkoutConfig } from '../engine/types';
import { getT, useT } from '../i18n';
import type { Route } from '../nav';
import { parseShared, shareUrl, SHARE_PARAM } from './share';
import { toast } from './toast';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share a workout link via the system share sheet, falling back to the
 * clipboard. Shows a toast for copy / failure. Call from a click handler.
 */
export async function shareWorkout(config: WorkoutConfig): Promise<ShareResult> {
  const { t } = getT();
  const url = shareUrl(config);
  const name = config.name?.trim() || t(`mode.${config.mode}`);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: name, text: t('share.text', { name }), url });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    // Other errors (NotAllowed, unsupported data): fall back to copying.
  }
  if (await copyText(url)) {
    toast(t('share.copied'), { tone: 'success' });
    return 'copied';
  }
  toast(t('share.failed'), { tone: 'error' });
  return 'failed';
}

function ShareGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M12 3v12" />
      <path d="M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
    </svg>
  );
}

export interface ShareButtonProps {
  config: WorkoutConfig;
  /** 'icon' = top-bar icon button (default); 'button' = labelled secondary button. */
  variant?: 'icon' | 'button';
  className?: string;
}

/** Share button for the Configure top bar or a preset menu. */
export function ShareButton({ config, variant = 'icon', className }: ShareButtonProps) {
  const { t } = useT();
  const label = t('share.button');
  const onClick = () => void shareWorkout(config);
  if (variant === 'button') {
    return (
      <button type="button" className={['ui-btn ui-btn--secondary ui-btn--md', className].filter(Boolean).join(' ')} onClick={onClick}>
        <ShareGlyph size={18} />
        <span>{t('common.share')}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={['ui-iconbtn ui-iconbtn--plain', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <ShareGlyph size={22} />
    </button>
  );
}

// ------------------------------------------------------------------ opening links

/** Route for an imported workout. */
export function importRoute(config: WorkoutConfig): Route {
  return { name: 'configure', mode: config.mode, initial: config, imported: true };
}

function readHashCode(): string | null {
  try {
    const h = location.hash;
    if (!h || !h.includes(`${SHARE_PARAM}=`)) return null;
    return h;
  } catch {
    return null;
  }
}

function clearHash(): void {
  try {
    history.replaceState(history.state, '', location.pathname + location.search);
  } catch {
    /* ignore */
  }
}

let launch: { route: Route | null } | null = null;

/**
 * Read a share link from the launch URL once per page load (idempotent, so
 * StrictMode's double state initialisation is safe). Strips the hash and
 * queues the "Imported workout" toast.
 */
export function consumeLaunchImport(): Route | null {
  if (launch) return launch.route;
  const hash = readHashCode();
  const config = hash ? parseShared(hash) : null;
  launch = { route: config ? importRoute(config) : null };
  if (hash) clearHash();
  if (config) toast(getT().t('share.imported'), { ms: 5000 });
  return launch.route;
}

/** Append the launch import (if any) to an initial screen stack. */
export function withLaunchImport(stack: Route[]): Route[] {
  const r = consumeLaunchImport();
  return r ? [...stack, r] : stack;
}

/**
 * Open a shared workout from any URL/code (deep links, pasted links).
 * Returns false (and does nothing) when the input isn't a valid workout.
 */
export function openShared(go: (r: Route) => void, input: string): boolean {
  const config = parseShared(input);
  if (!config) return false;
  go(importRoute(config));
  toast(getT().t('share.imported'), { ms: 5000 });
  return true;
}

/** Handle "#w=…" links opened while the app is already running (web). */
export function useShareLinks(go: (r: Route) => void): void {
  useEffect(() => {
    const onHash = () => {
      const hash = readHashCode();
      if (!hash) return;
      clearHash();
      openShared(go, hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [go]);
}
