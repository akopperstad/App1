import type { ReactNode } from 'react';

function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconPlay = ({ size }: P) => (
  <Svg size={size}>
    <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconPause = ({ size }: P) => (
  <Svg size={size}>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.4" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.4" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconPrev = ({ size }: P) => (
  <Svg size={size}>
    <path d="M18 5.5v13L8.5 12 18 5.5Z" fill="currentColor" />
    <path d="M6 5v14" />
  </Svg>
);
export const IconNext = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 5.5v13L15.5 12 6 5.5Z" fill="currentColor" />
    <path d="M18 5v14" />
  </Svg>
);
export const IconReset = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4v4.5H8" />
  </Svg>
);
export const IconBack = ({ size }: P) => (
  <Svg size={size}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const IconExpand = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
export const IconShrink = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);
export const IconFlag = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" fill="currentColor" fillOpacity={0.25} />
  </Svg>
);
export const IconCheck = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
);
export const IconUndo = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);
export const IconPlus = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconStop = ({ size }: P) => (
  <Svg size={size}>
    <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconRepeat = ({ size }: P) => (
  <Svg size={size}>
    <path d="M17 2.5l3 3-3 3" />
    <path d="M4 11.5v-1a5 5 0 0 1 5-5h11" />
    <path d="M7 21.5l-3-3 3-3" />
    <path d="M20 12.5v1a5 5 0 0 1-5 5H4" />
  </Svg>
);
export const IconBookmark = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 3.5h12v17l-6-4-6 4v-17Z" />
  </Svg>
);
export const IconHome = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3.5 11L12 4l8.5 7" />
    <path d="M6 9.5V20h12V9.5" />
  </Svg>
);
