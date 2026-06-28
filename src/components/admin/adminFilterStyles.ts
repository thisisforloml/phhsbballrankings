export function adminFilterChipClassName(active: boolean) {
  return `rounded-sm border px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] transition ${active ? "border-navy-900 bg-navy-900 text-white" : "border-surface-300 bg-white text-ink-700 hover:border-orange-400 hover:text-orange-700"}`;
}

export function adminFilterChipCountClassName(active: boolean) {
  return active ? "text-white/70" : "text-ink-400";
}
