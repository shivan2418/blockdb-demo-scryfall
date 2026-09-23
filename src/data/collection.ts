/**
 * The generated collection key, isolated here because it carries the bulk
 * file's timestamp — re-running `static-shard build` on a newer Scryfall dump
 * changes it, and this is the only line that has to follow.
 */
export const COLLECTION = "default-cards-20260721211623";

/**
 * When Scryfall generated the bulk file, read back out of the key's
 * `YYYYMMDDhhmmss` suffix (UTC), so the credit line can't drift from the data.
 */
export function datasetDate(collection: string = COLLECTION): Date | undefined {
  const match = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(collection);
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number, number, number, number, number, number,
  ];
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}
