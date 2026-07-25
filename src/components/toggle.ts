/** Adds or removes one value from a multi-select filter, dropping the key when it empties. */
export function toggleValue<T>(values: T[] | undefined, value: T): T[] | undefined {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return next.length ? next : undefined;
}
