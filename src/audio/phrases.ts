import type { Segment } from '../engine/types';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Short spoken phrase for entering a segment. Kept to a couple of words. */
export function segmentPhrase(seg: Segment): string {
  const label = (seg.label || '').trim();
  const detail = (seg.detail || '').trim();
  const lower = label.toLowerCase();

  if (seg.kind === 'prep') return 'Get ready';
  if (seg.kind === 'rest') return label || 'Rest';

  // EMOM / E2MOM / E90s: "Round 4" (+ movement).
  if (seg.round && (label === 'EMOM' || /^E\d+(MOM|s)$/.test(label))) {
    return detail ? `Round ${seg.round}. ${detail}` : `Round ${seg.round}`;
  }
  // Death by: "15 burpees".
  if (lower === 'death by') return detail || (seg.round ? `Round ${seg.round}` : 'Go');
  // Interval / Tabata work.
  if (lower === 'work') {
    if (detail) return `Work. ${detail}`;
    if (seg.round && seg.totalRounds && seg.totalRounds > 1) {
      if (seg.round === seg.totalRounds && (!seg.totalSets || seg.set === seg.totalSets)) return 'Last round';
      return `Round ${seg.round} of ${seg.totalRounds}`;
    }
    return 'Work';
  }
  if (lower === 'amrap') {
    return seg.totalSets && seg.totalSets > 1 && seg.set ? `AMRAP ${seg.set}. Go` : 'Go';
  }
  if (lower === 'for time' || lower === 'countdown' || lower === 'stopwatch') return 'Go';
  // Custom steps: the user's own label.
  return detail ? `${label}. ${detail}` : label || 'Go';
}

export function minutePhrase(minutesRemaining: number | null, minutesElapsed: number): string {
  if (minutesRemaining !== null) {
    return minutesRemaining === 1 ? 'One minute remaining' : `${plural(minutesRemaining, 'minute')} remaining`;
  }
  return plural(minutesElapsed, 'minute');
}
