import { useId } from 'react';

interface SelectProps<T extends string> {
  label: string;
  /** `''` shows the placeholder option. */
  value: T | '';
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Native, labelled select: keyboard-accessible with no extra work. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="whitespace-nowrap text-slate-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) onChange(next.value);
        }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-wait disabled:bg-slate-50"
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
