import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { useNav } from '../../nav';
import { IconButton } from './Button';

export interface TopBarProps {
  title?: ReactNode;
  /** Show back button (default true). */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

/** Sticky, safe-area aware top bar with back button, centred title and right slot. */
export function TopBar({ title, back = true, onBack, right }: TopBarProps) {
  const nav = useNav();
  const { t } = useT();
  return (
    <header className="ui-topbar">
      <div className="ui-topbar__inner">
        <div className="ui-topbar__side">
          {back && <IconButton icon="back" label={t('common.back')} onClick={onBack ?? nav.back} />}
        </div>
        <h1 className="ui-topbar__title">{title}</h1>
        <div className="ui-topbar__side ui-topbar__side--right">{right}</div>
      </div>
    </header>
  );
}
