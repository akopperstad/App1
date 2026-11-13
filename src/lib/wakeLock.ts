import { useEffect } from 'react';

/*
 * Keep the screen awake while a timer runs.
 *
 * - Screen Wake Lock API where available. Locks are released by the browser
 *   whenever the page is hidden, so we re-acquire on visibilitychange.
 * - Fallback for browsers without it (older iOS Safari): a tiny muted,
 *   looping, inline <video> keeps the display on while it plays.
 */

// 2 s, 16x16 black H.264 clip used by the wake-lock fallback (generated with ffmpeg).
export const SILENT_MP4 =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAM1bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAl90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHXbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABgm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAUJzdGJsAAAAwnN0c2QAAAAAAAAAAQAAALJhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAOGF2Y0MBZAAK/+EAGWdkAAqscgRewEQAAAMABAAAAwAIPEiWEYABAAho6EOBlEyEwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAALVAAAC1QAAAAYc3R0cwAAAAAAAAABAAAAAgAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAscAAAAOAAAAFHN0Y28AAAAAAAAAAQAAA2UAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMAAAAAhmcmVlAAAC3W1kYXQAAAKxBgX//63cRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MTYgZGVibG9jaz0xOi0zOi0zIGFuYWx5c2U9MHgzOjB4MTMzIG1lPXVtaCBzdWJtZT0xMCBwc3k9MSBwc3lfcmQ9Mi4wMDowLjcwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTI0IGNocm9tYV9tZT0xIHRyZWxsaXM9MiA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tNCB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz04IGJfcHlyYW1pZD0yIGJfYWRhcHQ9MiBiX2JpYXM9MCBkaXJlY3Q9MyB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD02MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTUxLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjIwAIAAAAAOZYiBAAM5z/7Ad4FLRK0AAAAKQZoILYgxnP+rgA==';

type Sentinel = { release(): Promise<void>; released?: boolean; addEventListener?: (t: string, f: () => void) => void };
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };

function hasApi(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as WakeLockNav).wakeLock?.request;
}

// ------------------------------------------------------------------ fallback video

let video: HTMLVideoElement | null = null;

function startVideo(): void {
  try {
    if (typeof document === 'undefined') return;
    if (!video) {
      const v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('muted', '');
      v.setAttribute('aria-hidden', 'true');
      v.muted = true;
      v.loop = true;
      v.src = SILENT_MP4;
      Object.assign(v.style, {
        position: 'fixed',
        width: '1px',
        height: '1px',
        opacity: '0.01',
        pointerEvents: 'none',
        left: '0',
        top: '0',
      });
      video = v;
    }
    if (!video.isConnected) document.body?.appendChild(video);
    const p = video.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
}

function stopVideo(): void {
  try {
    video?.pause?.();
    video?.remove();
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ hook

/** CONTRACT: keep the screen awake while `active` is true (re-acquires on visibility change). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    let disposed = false;
    let sentinel: Sentinel | null = null;
    let requesting = false;
    const api = hasApi();

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      if (!api) {
        startVideo();
        return;
      }
      if (requesting || (sentinel && !sentinel.released)) return;
      requesting = true;
      try {
        const s = await (navigator as WakeLockNav).wakeLock!.request('screen');
        if (disposed) {
          s.release().catch(() => {});
        } else {
          sentinel = s;
          s.addEventListener?.('release', () => {
            if (sentinel === s) sentinel = null;
          });
        }
      } catch {
        // Denied (low battery, not visible, permissions policy) — try again on next visibility change.
      } finally {
        requesting = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        try {
          sentinel.release().catch(() => {});
        } catch {
          /* ignore */
        }
        sentinel = null;
      }
      if (!api) stopVideo();
    };
  }, [active]);
}
