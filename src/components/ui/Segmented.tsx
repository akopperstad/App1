import { useRef } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string | number> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}

/** Segmented control implemented as an accessible radiogroup. */
export function Segmented<T extends string | number>({ value, options, onChange, label, size = 'md' }: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (d: number) => {
    const n = (idx + d + options.length) % options.length;
    onChange(options[n].value);
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>('button');
    btns?.[n]?.focus();
  };

  return (
    <div
      ref={ref}
      className={`ui-seg ui-seg--${size}`}
      role="radiogroup"
      aria-label={label}
      style={{ ['--seg-n' as string]: options.length, ['--seg-i' as string]: idx }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <span className="ui-seg__thumb" aria-hidden />
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === idx ? 0 : -1}
          className={`ui-seg__opt${i === idx ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
