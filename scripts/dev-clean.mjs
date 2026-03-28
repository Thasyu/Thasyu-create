import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

const lockFile = path.join(process.cwd(), ".next", "dev", "lock");

try {
  if (existsSync(lockFile)) {
    await rm(lockFile, { force: true });
  }
  console.log("Next dev cleanup complete.");
} catch {
  console.log("Next dev cleanup complete.");
}
