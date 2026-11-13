import { describe, expect, it } from 'vitest';
import { formatClock, formatClockString, formatDuration, mmss } from './format';

const up = (ms: number) => formatClock(ms, { roundUp: true }).main;
const down = (ms: number) => formatClock(ms).main;

describe('formatClock: countdown (round up)', () => {
  it('rounds up to the next whole second', () => {
    expect(up(0)).toBe('0:00');
    expect(up(1)).toBe('0:01');
    expect(up(999)).toBe('0:01');
    expect(up(1000)).toBe('0:01');
    expect(up(2999)).toBe('0:03');
    expect(up(3000)).toBe('0:03');
    expect(up(3001)).toBe('0:04');
    expect(up(59_999)).toBe('1:00');
    expect(up(60_001)).toBe('1:01');
  });
  it('negative clamps to 0:00 (never "-0")', () => {
    expect(up(-5)).toBe('0:00');
    expect(down(-5)).toBe('0:00');
  });
  it('tolerates float noise', () => {
    expect(up(3000.0000001)).toBe('0:03');
    expect(up(2000 + 1e-10)).toBe('0:02');
  });
  it('round-up with tenths ceils to the tenth and keeps digits consistent', () => {
    expect(formatClockString(2_999, { roundUp: true, tenths: true })).toBe('0:03.0');
    expect(formatClockString(2_901, { roundUp: true, tenths: true })).toBe('0:03.0');
    expect(formatClockString(2_900, { roundUp: true, tenths: true })).toBe('0:02.9');
    expect(formatClockString(0, { roundUp: true, tenths: true })).toBe('0:00.0');
  });
});

describe('formatClock: count-up (floor)', () => {
  it('floors to whole seconds', () => {
    expect(down(0)).toBe('0:00');
    expect(down(999)).toBe('0:00');
    expect(down(1000)).toBe('0:01');
    expect(down(59_999)).toBe('0:59');
    expect(down(61_000)).toBe('1:01');
    expect(down(12 * 60_000 + 4_000)).toBe('12:04');
  });
  it('tenths', () => {
    expect(formatClock(0, { tenths: true })).toEqual({ main: '0:00', tenths: '0' });
    expect(formatClock(99, { tenths: true })).toEqual({ main: '0:00', tenths: '0' });
    expect(formatClock(100, { tenths: true })).toEqual({ main: '0:00', tenths: '1' });
    expect(formatClock(83_456, { tenths: true })).toEqual({ main: '1:23', tenths: '4' });
    expect(formatClock(59_999, { tenths: true })).toEqual({ main: '0:59', tenths: '9' });
    expect(formatClockString(83_456, { tenths: true })).toBe('1:23.4');
    expect(formatClockString(83_456)).toBe('1:23');
    expect(formatClock(83_456).tenths).toBeUndefined();
  });
  it('fractional ms', () => {
    // float noise just under a boundary (e.g. 1999.9999999 from summed ms) snaps to the boundary
    expect(formatClockString(1999.9999999, { tenths: true })).toBe('0:02.0');
    expect(formatClockString(1999.5, { tenths: true })).toBe('0:01.9');
  });
});

describe('formatClock: hours', () => {
  it('h:mm:ss above one hour', () => {
    expect(down(3600_000)).toBe('1:00:00');
    expect(down(3661_000)).toBe('1:01:01');
    expect(down(3599_999)).toBe('59:59');
    expect(up(3599_001)).toBe('1:00:00');
    expect(down(10 * 3600_000 + 5 * 60_000 + 9_000)).toBe('10:05:09');
    expect(formatClockString(3661_250, { tenths: true })).toBe('1:01:01.2');
  });
});

describe('formatDuration', () => {
  it('compact durations', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-3)).toBe('0s');
    expect(formatDuration(20)).toBe('20s');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(720)).toBe('12 min');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
  it('rounds before splitting (no "60s" / "1m 60s")', () => {
    expect(formatDuration(59.6)).toBe('1 min');
    expect(formatDuration(119.7)).toBe('2 min');
    expect(formatDuration(0.4)).toBe('0s');
  });
});

describe('mmss', () => {
  it('formats and rounds safely', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(65)).toBe('1:05');
    expect(mmss(59.6)).toBe('1:00');
    expect(mmss(600)).toBe('10:00');
  });
});
