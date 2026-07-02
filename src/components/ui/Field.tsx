import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlBase =
  "min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 transition placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/40 disabled:cursor-not-allowed disabled:bg-neutral-50";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, error, children, className = "" }: FieldProps) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium text-neutral-700 ${className}`}>
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="text-xs font-normal text-neutral-400">{hint}</span> : null}
      {error ? <span className="text-xs font-normal text-danger-600">{error}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlBase} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlBase} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlBase} min-h-28 resize-y ${className}`} {...rest} />;
}
