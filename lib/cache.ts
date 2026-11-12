import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".cache");

// Development-only response cache so repeated briefs do not spend API credits.
// Delete .cache/ to refresh. Production calls go straight to the providers.
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production") return load();

  const file = path.join(
    CACHE_DIR,
    `${createHash("sha256").update(key).digest("hex")}.json`,
  );

  try {
    const cachedValue = JSON.parse(await readFile(file, "utf8")) as T;
    // Ignore stale empty-list entries written before empty results were skipped.
    if (!Array.isArray(cachedValue) || cachedValue.length > 0) return cachedValue;
  } catch {
    // No cache entry yet.
  }

  const value = await load();
  // Empty lists are usually transient provider misses. Caching one would make
  // a temporary empty result permanent for that query.
  if (Array.isArray(value) && value.length === 0) return value;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value));
  return value;
}
