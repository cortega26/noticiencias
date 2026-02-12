import path from "path";
import fs from "fs";

const ROOT = path.resolve(process.cwd());

export function safeResolve(input: string): string {
  const resolved = path.resolve(ROOT, input);

  if (!resolved.startsWith(ROOT)) {
    throw new Error("Path traversal attempt");
  }

  return resolved;
}

export function safeRead(file: string): string {
  return fs.readFileSync(safeResolve(file), "utf8");
}

export function safeReadDir(dir: string): string[] {
    return fs.readdirSync(safeResolve(dir));
}

// Add other fs methods if needed by codebase, but sticking to prompt's core + readdir (common)
