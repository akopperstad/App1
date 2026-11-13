import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required accessible label. */
  label: string;
  variant?: 'plain' | 'filled';
  size?: number;
}

export function IconButton({ icon, label, variant = 'plain', size = 22, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={['ui-iconbtn', `ui-iconbtn--${variant}`, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
