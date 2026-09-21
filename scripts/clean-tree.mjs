/**
 * Refuse to publish a package built from anything but a commit.
 *
 * npm packs the working directory, so an uncommitted change ships to the
 * registry while being absent from the repository people read (MISTAKES.md
 * M-0003). This runs as prepublishOnly, where a non-zero exit stops npm.
 */

import { execFileSync } from 'node:child_process';

const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();

if (dirty) {
  console.error('\nRefusing to publish: the working tree is not clean.\n');
  console.error(dirty.split('\n').map((l) => `  ${l}`).join('\n'));
  console.error('\nnpm packs these files as they are on disk, so they would reach the registry');
  console.error('without being in the repository. Commit them, then publish.\n');
  process.exit(1);
}
