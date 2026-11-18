import { createHash } from 'node:crypto';

/** True when this conversation group belongs to the validation split. */
export function isValidGroup(group: string, seed: string, ratio: number): boolean {
  if (ratio <= 0) return false;
  const digest = createHash('sha256').update(`${seed}\u0000${group}`).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000 < ratio;
}

/** Split items by group so a conversation group never lands on both sides. */
export function splitByGroup<T extends { group: string }>(
  items: T[],
  ratio: number,
  seed: string,
): { train: T[]; valid: T[] } {
  const train: T[] = [];
  const valid: T[] = [];
  for (const item of items) (isValidGroup(item.group, seed, ratio) ? valid : train).push(item);
  return { train, valid };
}
