import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'back'
  | 'play'
  | 'pause'
  | 'settings'
  | 'history'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'star'
  | 'close'
  | 'more'
  | 'chevronRight'
  | 'chevronUp'
  | 'chevronDown'
  | 'copy'
  | 'check'
  | 'repeat'
  | 'edit'
  | 'bolt'
  | 'flag'
  | 'volume'
  | 'timer'
  | 'save'
  | 'flame'
  | 'calendar'
  | 'pulse'
  | 'trophy'
  | 'share'
  | 'sparkle'
  | 'bell'
  | 'music'
  | 'mode-amrap'
  | 'mode-emom'
  | 'mode-fortime'
  | 'mode-tabata'
  | 'mode-interval'
  | 'mode-deathby'
  | 'mode-custom'
  | 'mode-countdown'
  | 'mode-stopwatch';

const paths: Record<IconName, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  play: <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.4-1.51 1z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronUp: <path d="M5 15l7-7 7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  repeat: (
    <>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6" />
    </>
  ),
  save: (
    <>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
    </>
  ),
  flame: (
    <path d="M12 22c4 0 7-2.7 7-6.8 0-3.6-2.4-6-4.3-8.2-.4 2-1.4 3.2-2.7 3.7.3-3.2-1-6.2-3.5-8.2.2 3.6-2.2 5.7-3.6 8C3.9 12.1 5 14 5 15.2 5 19.3 8 22 12 22z" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  pulse: <path d="M2.5 12h4l2.5-6.5 5 13 2.5-6.5h5" />,
  share: (
    <>
      <path d="M12 3.5v11.5" />
      <path d="M8 7l4-3.5L16 7" />
      <path d="M8.5 10.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11" />
      <path d="M12 14v3.5M8.5 20.5h7M9.5 20.5l.5-3h4l.5 3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l10-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,

  /* ---- mode glyphs: one distinctive mark per timer ---- */
  // AMRAP — infinity: keep going, as many rounds as possible.
  'mode-amrap': (
    <path d="M12 12c-1.9-2.6-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.6-1.4 5.5-4zm0 0c1.9 2.6 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.6 1.4-5.5 4z" />
  ),
  // EMOM — a dial with the minute hand on the top of the minute.
  'mode-emom': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V6.5" />
      <path d="M12 12l3.2 1.8" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      <path d="M12 1.8v1.4" />
    </>
  ),
  // For Time — a stopwatch with speed lines.
  'mode-fortime': (
    <>
      <circle cx="14.5" cy="13.5" r="7" />
      <path d="M14.5 10v3.5l2 1.5M12.5 3.5h4M14.5 3.5v3" />
      <path d="M2 10.5h4M3 14h2.5M2 17.5h4.5" />
    </>
  ),
  // Tabata — alternating tall / short bars (20 on, 10 off).
  'mode-tabata': <path d="M4 19.5V6M8 19.5V13M12 19.5V6M16 19.5V13M20 19.5V6" />,
  // Intervals — a square wave.
  'mode-interval': <path d="M2 16.5h3.5V7.5h6v9h3v-9h6v9H22" />,
  // Death By — a staircase that keeps climbing.
  'mode-deathby': (
    <>
      <path d="M3 20.5h4.5V16H12v-4.5h4.5V7H21" />
      <path d="M17.5 3.5H21V7" />
    </>
  ),
  // Custom — stacked blocks of different lengths.
  'mode-custom': (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1.6" />
      <rect x="3" y="10.5" width="11" height="4.5" rx="1.6" />
      <rect x="3" y="17" width="14.5" height="3.5" rx="1.6" />
    </>
  ),
  // Countdown — hourglass.
  'mode-countdown': (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9" />
      <path d="M9.5 18.5h5" />
    </>
  ),
  // Stopwatch — classic stopwatch with crown.
  'mode-stopwatch': (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.2 6.8l1.6-1.6" />
    </>
  ),
};

/** Glyph for a timer mode ("amrap" → "mode-amrap"). */
export function modeIcon(mode: string): IconName {
  const name = `mode-${mode}` as IconName;
  return name in paths ? name : 'timer';
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Accessible label; when omitted the icon is decorative. */
  label?: string;
}

export function Icon({ name, size = 22, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
