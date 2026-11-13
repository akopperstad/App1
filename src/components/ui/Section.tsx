import type { ReactNode } from 'react';

export interface SectionProps {
  title?: ReactNode;
  /** Right-aligned element in the section header (e.g. a link button). */
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Render children without the card background (for custom layouts). */
  plain?: boolean;
}

/** Grouped section: small caps header + rounded card of rows. */
export function Section({ title, action, footer, children, className, plain }: SectionProps) {
  return (
    <section className={['ui-section', className].filter(Boolean).join(' ')}>
      {(title || action) && (
        <div className="ui-section__head">
          {title && <h2 className="ui-section__title">{title}</h2>}
          {action}
        </div>
      )}
      <div className={plain ? 'ui-section__plain' : 'ui-card'}>{children}</div>
      {footer && <p className="ui-section__foot">{footer}</p>}
    </section>
  );
}

export interface RowProps {
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  /** Stack control below the label (for wide controls like segmented). */
  stacked?: boolean;
  htmlFor?: string;
  icon?: ReactNode;
}

/** Field row: label (+ hint) on the left, control on the right. */
export function Row({ label, hint, children, stacked, htmlFor, icon }: RowProps) {
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div className={`ui-row${stacked ? ' ui-row--stacked' : ''}`}>
      {icon && <span className="ui-row__icon">{icon}</span>}
      <Label className="ui-row__text" {...(htmlFor ? { htmlFor } : {})}>
        <span className="ui-row__label">{label}</span>
        {hint && <span className="ui-row__hint">{hint}</span>}
      </Label>
      {children && <div className="ui-row__control">{children}</div>}
    </div>
  );
}
