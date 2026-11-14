import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';

// Safari doesn't focus buttons on tap, so also remember the last pressed element.
let lastPressed: Element | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => (lastPressed = e.target as Element), true);
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Optional footer (actions), pinned to the bottom of the sheet. */
  footer?: ReactNode;
}

/** Exit animation length — keep in sync with `.ui-sheet-root.is-closing` in ui.css. */
const CLOSE_MS = 220;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Bottom sheet on mobile, centred dialog on wider screens. Closing animates
 * out (slide down / fade) before unmounting — instantly with reduced motion.
 * While it animates out the sheet is inert (aria-hidden, no pointer events)
 * and keeps showing what it showed when it was open.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const closing = shown && !open;
  const last = useRef({ title, children, footer });
  if (open) last.current = { title, children, footer };

  useEffect(() => {
    if (!closing) return;
    if (reducedMotion()) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(false), CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Inherit the accent colour of whatever opened the sheet (sheets are portalled).
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const active = document.activeElement;
    const opener = active && active !== document.body ? active : lastPressed;
    const accent = opener ? getComputedStyle(opener).getPropertyValue('--accent').trim() : '';
    if (accent) panel.current.style.setProperty('--accent', accent);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      const target =
        panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
      target?.focus();
    }, 30);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!shown) return null;
  const view = open ? { title, children, footer } : last.current;

  return createPortal(
    <div className={`ui-sheet-root${closing ? ' is-closing' : ''}`} aria-hidden={closing || undefined}>
      <div className="ui-sheet-backdrop" onClick={closing ? undefined : onClose} />
      <div
        ref={panel}
        className="ui-sheet"
        role="dialog"
        aria-modal={closing ? undefined : true}
        aria-labelledby={view.title ? titleId : undefined}
        tabIndex={-1}
      >
        <div className="ui-sheet__grabber" aria-hidden />
        {view.title && (
          <div className="ui-sheet__head">
            <h2 id={titleId} className="ui-sheet__title">
              {view.title}
            </h2>
            <IconButton icon="close" label={t('common.close')} variant="filled" size={18} onClick={onClose} />
          </div>
        )}
        <div className="ui-sheet__body">{view.children}</div>
        {view.footer && <div className="ui-sheet__foot">{view.footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface ActionItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
}

/** List of actions inside a sheet (iOS action-sheet style). */
export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <div className="ui-actions" role="menu">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className={`ui-actions__item${it.danger ? ' is-danger' : ''}`}
          onClick={it.onSelect}
        >
          {it.icon && <ActionIcon name={it.icon} />}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function ActionIcon({ name }: { name: IconName }) {
  return (
    <span className="ui-actions__icon">
      <Icon name={name} size={20} />
    </span>
  );
}
