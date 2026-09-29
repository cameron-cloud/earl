#!/usr/bin/env node
// Keeps Earl's version in one place. tauri.conf.json reads its version from
// package.json ("version": "../package.json"), and this script copies that
// version into the files Tauri does not read it from:
//
//   package.json, package-lock.json   - the source of truth and its lock
//   src-tauri/Cargo.toml              - [package] version of the app crate
//   src-tauri/Cargo.lock              - the app crate's lock entry
//
// Usage:
//   node scripts/bump-version.mjs 2.0.0              set every file to 2.0.0
//   node scripts/bump-version.mjs 2.0.0-preview.17   prereleases are fine (NSIS)
//   node scripts/bump-version.mjs --check            exit 1 if any file disagrees
//
// Self test (LF and CRLF checkouts): node --test scripts/bump-version.selftest.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  packageJson: join(root, "package.json"),
  packageLock: join(root, "package-lock.json"),
  cargoToml: join(root, "src-tauri", "Cargo.toml"),
  cargoLock: join(root, "src-tauri", "Cargo.lock"),
};

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
// Every pattern accepts LF and CRLF line endings. The repo has no
// .gitattributes, and Git for Windows (including the windows-latest runner)
// defaults to core.autocrlf=true, so a Windows checkout has CRLF files.
// [package] header, then any lines up to the first version key in that table.
const CARGO_TOML_VERSION =
  /(^\[package\][ \t]*\r?\n(?:(?!\[)[^\r\n]*\r?\n)*?version\s*=\s*")([^"]+)(")/m;
const CARGO_LOCK_VERSION = /(\[\[package\]\]\r?\nname = "earl"\r?\nversion = ")([^"]+)(")/;

const read = (path) => readFileSync(path, "utf8");

function readJson(path) {
  const text = read(path);
  const indent = /^[ \t]+(?=")/m.exec(text)?.[0] ?? "  ";
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { data: JSON.parse(text), indent, eol };
}

// Writes with the file's own line endings, so a bump on a CRLF checkout
// changes only the version lines. JSON.stringify escapes newlines inside
// strings, so every raw newline in its output is a line break.
function writeJson(path, { data, indent, eol }) {
  writeFileSync(path, `${JSON.stringify(data, null, indent).replace(/\n/g, eol)}${eol}`);
}

function matchOrThrow(regex, text, what) {
  const match = regex.exec(text);
  if (!match) throw new Error(`could not find the version in ${what}`);
  return match;
}

function currentVersions() {
  const lock = readJson(files.packageLock).data;
  return {
    "package.json": readJson(files.packageJson).data.version,
    "package-lock.json": lock.version,
    'package-lock.json packages[""]': lock.packages?.[""]?.version,
    "src-tauri/Cargo.toml": matchOrThrow(
      CARGO_TOML_VERSION,
      read(files.cargoToml),
      "Cargo.toml",
    )[2],
    "src-tauri/Cargo.lock": matchOrThrow(
      CARGO_LOCK_VERSION,
      read(files.cargoLock),
      "Cargo.lock",
    )[2],
  };
}

function check() {
  const versions = currentVersions();
  const expected = versions["package.json"];
  const wrong = Object.entries(versions).filter(([, version]) => version !== expected);
  if (wrong.length > 0) {
    for (const [file, version] of wrong) {
      console.error(`${file} has ${version}, package.json has ${expected}`);
    }
    console.error("Run: node scripts/bump-version.mjs <version>");
    return 1;
  }
  console.log(`All version fields agree: ${expected}`);
  return 0;
}

function bump(version) {
  if (!SEMVER.test(version)) {
    console.error(`Not a semver version: ${version}`);
    return 1;
  }

  const pkg = readJson(files.packageJson);
  pkg.data.version = version;

  const lock = readJson(files.packageLock);
  lock.data.version = version;
  if (lock.data.packages?.[""]) lock.data.packages[""].version = version;

  const cargoToml = read(files.cargoToml);
  matchOrThrow(CARGO_TOML_VERSION, cargoToml, "Cargo.toml");
  const cargoLock = read(files.cargoLock);
  matchOrThrow(CARGO_LOCK_VERSION, cargoLock, "Cargo.lock");

  // Every file is read and matched before any is written, so a failure
  // never leaves the versions half bumped.
  writeJson(files.packageJson, pkg);
  writeJson(files.packageLock, lock);
  writeFileSync(files.cargoToml, cargoToml.replace(CARGO_TOML_VERSION, `$1${version}$3`));
  writeFileSync(files.cargoLock, cargoLock.replace(CARGO_LOCK_VERSION, `$1${version}$3`));

  console.log(`Version set to ${version}`);
  return check();
}

const arg = process.argv[2];
if (!arg || arg === "--help" || arg === "-h") {
  console.log("Usage: node scripts/bump-version.mjs <version> | --check");
  process.exitCode = arg ? 0 : 1;
} else {
  try {
    process.exitCode = arg === "--check" ? check() : bump(arg);
  } catch (error) {
    console.error(`bump-version: ${error.message}`);
    process.exitCode = 1;
  }
}
