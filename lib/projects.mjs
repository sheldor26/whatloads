/**
 * Turn --projects "a,b,c" into real directories, without ever discovering a
 * project on our own. whatloads must not crawl the filesystem for this
 * (DECISIONS.md D-0006 rules out ever printing a number nobody asked for).
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export function resolveProjectDirs(raw, cwd) {
  if (!raw) return { valid: [], invalid: [] };
  const valid = [];
  const invalid = [];
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const p = resolve(cwd, part);
    const isDir = existsSync(p) && statSync(p).isDirectory();
    (isDir ? valid : invalid).push(part);
  }
  return { valid, invalid };
}
