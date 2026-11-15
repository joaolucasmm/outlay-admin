interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "Meals active". */
  label: string;
  disabled?: boolean;
}

/** An on/off toggle (`role="switch"`), operable with Space and Enter like any button. */
export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className="group inline-flex items-center gap-2 rounded-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span aria-hidden="true" className={checked ? 'text-slate-900' : 'text-slate-500'}>
        {checked ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}
