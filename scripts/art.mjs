#!/usr/bin/env node
// Earl art pipeline CLI (plan D19, docs/ART.md).
//   node scripts/art.mjs import [--inbox <dir>] [--profile v1-faithful|smooth] [--keep]
//   node scripts/art.mjs build | check | status | templates | shots   [--root <dir>]
//   node scripts/art.mjs shots --json   (also prints every finished prompt as JSON, docs/ART.md)
import fs from "node:fs";
import path from "node:path";
import {
  PATHS,
  build,
  checkProject,
  computeAll,
  coverage,
  coverageLine,
  importInbox,
  loadDoc,
  promptCatalog,
  regenerateDoc,
  renderContactSheet,
  renderShotlist,
  stringifyDoc,
  writeIfChanged,
  writePng,
  writeTemplates,
} from "./art/lib/index.mjs";

// Flags that never take a value, so they cannot swallow the argument after them.
const SWITCHES = new Set(["keep", "quiet", "json"]);

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      const takesValue = !SWITCHES.has(k) && argv[i + 1] && !argv[i + 1].startsWith("--");
      flags[k] = v ?? (takesValue ? argv[++i] : true);
    } else rest.push(a);
  }
  return { cmd: rest[0], flags };
}

const { cmd, flags } = parseArgs(process.argv.slice(2));
const root = path.resolve(flags.root || process.cwd());
const quiet = Boolean(flags.quiet);
const log = (...a) => {
  if (!quiet) console.log(...a);
};

function writeContact(all) {
  const file = path.join(root, PATHS.out, "contact.png");
  writePng(file, renderContactSheet(all, { title: `earl art: ${coverageLine(coverage(all))}` }));
  return path.relative(root, file);
}

function printStatus(all, onlyIds = null) {
  const byTier = new Map();
  for (const f of all.frames) {
    if (onlyIds && !onlyIds.has(f.id)) continue;
    const key = f.tier;
    if (!byTier.has(key)) byTier.set(key, new Map());
    const shots = byTier.get(key);
    if (!shots.has(f.shot.id)) shots.set(f.shot.id, []);
    const r = all.results.get(f.id);
    const label = r.final ? "FINAL" : r.status;
    const codes = r.issues.length
      ? ` (${r.issues.map((i) => `${i.level} ${i.code}`).join(", ")})`
      : "";
    shots.get(f.shot.id).push(`${String(f.n).padStart(2, "0")} ${label}${codes}`);
  }
  for (const tier of [...byTier.keys()].sort()) {
    console.log(`\n${tier}`);
    for (const [shot, parts] of byTier.get(tier))
      console.log(`  ${shot.padEnd(26)} ${parts.join("  ")}`);
  }
}

function printCoverage(all) {
  const c = coverage(all);
  console.log(`\nCoverage: ${coverageLine(c)} (masters ${c.master}, missing ${c.missing})`);
  for (const t of Object.keys(c.tiers).sort()) {
    const x = c.tiers[t];
    console.log(
      `  ${t}: final ${x.final}/${x.total}, master ${x.master}, placeholder ${x.placeholder}, missing ${x.missing}`,
    );
  }
}

async function main() {
  switch (cmd) {
    case "shots": {
      const file = path.join(root, PATHS.shots);
      const prev = fs.existsSync(file) ? loadDoc(root) : null;
      const doc = regenerateDoc(root, prev);
      const a = writeIfChanged(file, stringifyDoc(doc));
      const b = writeIfChanged(path.join(root, PATHS.shotlist), renderShotlist(doc));
      if (flags.json) {
        // Wait for the flush: process.exit right after a write cuts a piped stdout short.
        const text = `${JSON.stringify(promptCatalog(doc), null, 2)}\n`;
        await new Promise((resolve) => process.stdout.write(text, resolve));
        return 0;
      }
      const frames = doc.shots.reduce((s, x) => s + x.frames, 0);
      log(
        `art:shots: ${doc.shots.length} shots, ${frames} frames${a || b ? " (updated)" : " (unchanged)"}`,
      );
      return 0;
    }
    case "build": {
      const { all } = build(root);
      log(`art:build: ${PATHS.gen} and ${PATHS.atlas}/ written. ${coverageLine(coverage(all))}`);
      return 0;
    }
    case "import": {
      const inbox = path.resolve(root, flags.inbox || PATHS.inbox);
      const { outcomes, archived } = await importInbox(root, {
        inbox,
        profile: typeof flags.profile === "string" ? flags.profile : null,
        keep: Boolean(flags.keep),
        log,
      });
      const { all } = build(root);
      for (const o of outcomes) {
        const r = all.results.get(o.id);
        const status = !o.ok ? "ERR" : r ? r.status : "?";
        const detail = !o.ok
          ? o.error
          : [
              ...(o.warn || []),
              ...(r ? r.issues.map((i) => `${i.level} ${i.code}: ${i.msg}`) : []),
            ].join("; ");
        console.log(
          `  ${status.padEnd(11)} ${o.id.padEnd(28)} <- ${o.file}${detail ? `  ${detail}` : ""}`,
        );
      }
      if (archived.length)
        console.log(
          `Moved ${archived.length} imported raw(s) to ${path.join(inbox, "imported")} (--keep leaves them in place)`,
        );
      if (outcomes.length) console.log(`Contact sheet: ${writeContact(all)}`);
      printCoverage(all);
      return outcomes.some((o) => !o.ok) ? 1 : 0;
    }
    case "check": {
      const all = computeAll(root);
      const errors = checkProject(root, all);
      let frameErrors = 0;
      for (const f of all.frames) {
        const r = all.results.get(f.id);
        for (const i of r.issues) {
          if (r.source === "placeholder") continue;
          if (i.level === "ERR") frameErrors++;
          console.log(`  ${i.level.padEnd(4)} ${f.id}: ${i.msg}`);
        }
      }
      const phNotes = [...all.results.values()].filter(
        (r) => r.source === "placeholder" && r.issues.length,
      );
      if (phNotes.length)
        console.log(
          `  note: ${phNotes.length} placeholder frame(s) carry v1/April lint (${[...new Set(phNotes.flatMap((r) => r.issues.map((i) => i.code)))].join(", ")}); placeholders never fail the check`,
        );
      for (const e of errors) console.log(`  ERR  ${e}`);
      console.log(`Contact sheet: ${writeContact(all)}`);
      printCoverage(all);
      const failed = errors.length + frameErrors;
      console.log(failed ? `art:check: FAILED (${failed} error(s))` : "art:check: OK");
      return failed ? 1 : 0;
    }
    case "status": {
      const all = computeAll(root);
      printStatus(all);
      printCoverage(all);
      return 0;
    }
    case "templates": {
      const n = writeTemplates(root);
      log(`art:templates: ${n} template(s) in ${PATHS.templates}/`);
      return 0;
    }
    default:
      console.error(
        "usage: node scripts/art.mjs <import|build|check|status|templates|shots> [--root dir] [--json] [--inbox dir] [--profile v1-faithful|smooth] [--keep]",
      );
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`art ${cmd}: ${e.message}`);
    process.exit(1);
  },
);
