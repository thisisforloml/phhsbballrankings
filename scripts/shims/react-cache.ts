export function cache<T extends (...args: unknown[]) => unknown>(fn: T): T {
  return fn;
}
