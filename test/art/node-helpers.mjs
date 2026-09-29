// Node file-system helpers for the art tests. The repo has no @types/node (and adding it is a
// new dependency), so tests reach Node APIs through this typed module instead.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const join = (...parts) => path.join(...parts);
export const readText = (file) => fs.readFileSync(file, "utf8");
export const readBytes = (file) => new Uint8Array(fs.readFileSync(file));
export const exists = (file) => fs.existsSync(file);
export const mkdirp = (dir) => fs.mkdirSync(dir, { recursive: true });
export const makeTempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
export const removeDir = (dir) => fs.rmSync(dir, { recursive: true, force: true });
export const envFlag = (name) => Boolean(process.env[name]);

export function writeBytes(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

export function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
/** Sorted names of the plain files directly in `dir` (not folders). */
export const listFiles = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();

export function symlink(target, file) {
  fs.symlinkSync(target, file);
}

/** Runs a Node script with this Node binary and returns its exit status and output. */
export function runNode(args, cwd) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
