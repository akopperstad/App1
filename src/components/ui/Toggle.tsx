export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}

/** iOS-style switch (role="switch"). */
export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`ui-toggle${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-toggle__knob" />
    </button>
  );
}
