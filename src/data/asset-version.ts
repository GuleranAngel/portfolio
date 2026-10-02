// Adds ?v=<content hash> to a file in public/, read at build time.
// The hash changes only when the file changes, so browsers can cache it for a long time
// and still pick up a new version the moment it is deployed.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map<string, string>();
export function versioned(publicPath: string): string {
  let v = cache.get(publicPath);
  if (!v) {
    v = createHash('sha1').update(readFileSync(join(process.cwd(), 'public', publicPath))).digest('hex').slice(0, 8);
    cache.set(publicPath, v);
  }
  return `${publicPath}?v=${v}`;
}
