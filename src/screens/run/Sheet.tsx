import type { ReactNode } from 'react';
import { Sheet as UiSheet } from '../../components/ui';

/**
 * Run-screen confirm sheet. Thin wrapper over the shared UI-kit sheet so the
 * run screen's dialogs look and behave exactly like the rest of the app
 * (bottom sheet on phones, centred dialog on wide screens, Esc / backdrop closes,
 * focus trap, `[data-autofocus]` focus, animated close).
 */
export function Sheet({
  title,
  children,
  onClose,
  open = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** Keep the sheet mounted and toggle this, so closing can animate out. */
  open?: boolean;
}) {
  return (
    <UiSheet open={open} onClose={onClose} title={title}>
      <div className="run-sheet">{children}</div>
    </UiSheet>
  );
}
