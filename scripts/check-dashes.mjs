#!/usr/bin/env node
// Fails when any tracked text file contains an en dash (U+2013) or an em dash (U+2014).
// Project writing rule: use a plain " - " instead. Binary files are skipped.
//
// Usage: node scripts/check-dashes.mjs   (or: npm run check:dashes)

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The characters this check forbids, written as escapes so this file passes its own check. */
export const FORBIDDEN = new Map([
  ["\u2013", "en dash (U+2013)"],
  ["\u2014", "em dash (U+2014)"],
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".icns",
  ".bmp",
  ".docx",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".wav",
  ".mp3",
  ".ogg",
  ".exe",
  ".dll",
]);

/**
 * Finds every forbidden dash in a text.
 * @param {string} text
 * @returns {{ line: number, column: number, name: string }[]} 1-based positions
 */
export function findDashes(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const name = FORBIDDEN.get(line[j]);
      if (name) hits.push({ line: i + 1, column: j + 1, name });
    }
  }
  return hits;
}

/**
 * True when the path or its bytes look binary (known extension, or a NUL byte in the first 8 KiB).
 * @param {string} path
 * @param {Buffer} bytes
 */
export function isBinary(path, bytes) {
  const dot = path.lastIndexOf(".");
  if (dot !== -1 && BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase())) return true;
  return bytes.subarray(0, 8192).includes(0);
}

/** Lists the files git tracks, relative to the repo root. */
function trackedFiles(root) {
  const out = execFileSync("git", ["ls-files", "-z", "--cached"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean);
}

function main() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  let scanned = 0;
  let offenders = 0;
  for (const file of trackedFiles(root)) {
    let bytes;
    try {
      bytes = readFileSync(resolve(root, file));
    } catch (e) {
      if (e?.code === "ENOENT") continue; // tracked but deleted in the working tree
      throw e;
    }
    if (isBinary(file, bytes)) continue;
    scanned++;
    for (const hit of findDashes(bytes.toString("utf8"))) {
      offenders++;
      console.error(`${file}:${hit.line}:${hit.column}: ${hit.name}, use a plain " - " instead`);
    }
  }
  if (scanned === 0) {
    console.error("check-dashes: git tracks no readable text files here, so nothing was checked.");
    process.exit(1);
  }
  if (offenders > 0) {
    console.error(`check-dashes: ${offenders} forbidden dash(es) found in ${scanned} text files.`);
    process.exit(1);
  }
  console.log(`check-dashes: ${scanned} tracked text files, no en or em dashes.`);
}

// Compares real paths, so running the script through a symlink or a non-canonical path still
// scans instead of exiting 0 without checking anything.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
