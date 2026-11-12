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
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    // No cache entry yet.
  }

  const value = await load();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value));
  return value;
}
