import type { ReactNode } from "react";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  dark?: boolean;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  dark = false,
  className = ""
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex p-1 ${dark ? "border border-white/20 bg-white/10" : "border border-line-500 bg-paper-500"} ${className}`}
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-4 py-1.5 text-sm font-black transition ${
              active
                ? dark
                  ? "bg-gold-500 text-court-900"
                  : "bg-court-900 text-white"
                : dark
                  ? "text-white/75 hover:text-white"
                  : "text-court-600 hover:text-court-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
