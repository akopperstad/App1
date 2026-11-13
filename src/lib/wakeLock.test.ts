import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './wakeLock';

function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'wakeLock');
  setVisibility('visible');
});

describe('useWakeLock', () => {
  it('acquires while active, re-acquires after the page was hidden, releases when inactive', async () => {
    const sentinels: { released: boolean; release: () => Promise<void>; fire?: () => void }[] = [];
    const request = vi.fn(async () => {
      const s = {
        released: false,
        fire: undefined as undefined | (() => void),
        release: async () => {
          s.released = true;
          s.fire?.();
        },
        addEventListener: (_t: string, f: () => void) => {
          s.fire = f;
        },
      };
      sentinels.push(s);
      return s;
    });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });

    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    // The browser drops the lock when hidden; we must take it again when visible.
    await act(async () => {
      sentinels[0].released = true;
      sentinels[0].fire?.();
      setVisibility('hidden');
      setVisibility('visible');
    });
    expect(request).toHaveBeenCalledTimes(2);

    rerender({ on: false });
    await act(async () => {});
    expect(sentinels[1].released).toBe(true);
    setVisibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('fallback video is removed from the DOM when inactive / unmounted', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const { rerender, unmount } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    expect(document.querySelectorAll('video')).toHaveLength(1);
    rerender({ on: false });
    expect(document.querySelectorAll('video')).toHaveLength(0);
    rerender({ on: true });
    rerender({ on: true });
    expect(document.querySelectorAll('video')).toHaveLength(1);
    unmount();
    expect(document.querySelectorAll('video')).toHaveLength(0);
    expect(play).toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
  });
});
