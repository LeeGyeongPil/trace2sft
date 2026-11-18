import { createHash } from 'node:crypto';
import type { Candidate, ChatMessage } from './types.js';

function canonical(m: ChatMessage): string {
  // Only the normalized fields count; provider extras such as finish_reason are ignored.
  return JSON.stringify([
    m.role,
    m.content,
    (m.tool_calls ?? []).map((tc) => [tc.id, tc.function.name, tc.function.arguments]),
    m.tool_call_id ?? null,
  ]);
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface DedupeResult {
  kept: Candidate[];
  dropped: { candidate: Candidate; reason: 'prefix_of_longer' | 'exact_duplicate' }[];
}

/**
 * Remove exact duplicates (the first in input order wins) and conversations that are
 * a strict prefix of a longer conversation in the same group.
 */
export function dedupe(candidates: Candidate[]): DedupeResult {
  const hashes = candidates.map((c) => c.messages.map((m) => sha(canonical(m))));
  const dropped: DedupeResult['dropped'] = [];
  const dropIdx = new Set<number>();

  const firstByFull = new Map<string, number>();
  candidates.forEach((c, i) => {
    const key = (hashes[i] as string[]).join(',');
    if (firstByFull.has(key)) {
      dropIdx.add(i);
      dropped.push({ candidate: c, reason: 'exact_duplicate' });
    } else {
      firstByFull.set(key, i);
    }
  });

  // Bucket by group and first message so the quadratic check stays small.
  const buckets = new Map<string, number[]>();
  candidates.forEach((c, i) => {
    if (dropIdx.has(i)) return;
    const key = `${c.group}\u0000${(hashes[i] as string[])[0] ?? ''}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  });
  for (const idxs of buckets.values()) {
    if (idxs.length < 2) continue;
    for (const i of idxs) {
      const hi = hashes[i] as string[];
      const isPrefix = idxs.some((j) => {
        const hj = hashes[j] as string[];
        return hj.length > hi.length && hi.every((h, k) => h === hj[k]);
      });
      if (isPrefix) {
        dropIdx.add(i);
        dropped.push({ candidate: candidates[i] as Candidate, reason: 'prefix_of_longer' });
      }
    }
  }

  return { kept: candidates.filter((_, i) => !dropIdx.has(i)), dropped };
}
