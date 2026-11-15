// Overlap check for every screen at 1366x768, 1920x1080 and 390x844 (needs `npm run dev`).
//   node tools/overlap_qa.mjs [outDir] [--only=cover,dashboard] [--sizes=laptop,mobile]
// Screenshots + overlaps.json go to outDir (default docs/audit/v46/overlap). Exit code 1 if any screen
// has overlapping text/controls or a control clipped by the window.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
if (process.argv.includes("--missions")) { process.argv.push("--overlap"); await import("./mission_qa.mjs"); process.exit(process.exitCode ?? 0); }

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) ?? "docs/audit/v46/overlap";
const r = spawnSync(process.execPath, ["tools/screens.mjs", out, "--overlap", ...args.filter((a) => a.startsWith("--"))], { stdio: "inherit" });
if (r.status) process.exit(r.status);
const report = JSON.parse(readFileSync(`${out}/report.json`, "utf8"));
let bad = 0;
for (const [k, v] of Object.entries(report)) {
  const o = v.overlaps ?? [];
  if (o.length) {
    bad++;
    console.log(`\n✗ ${k}`);
    for (const x of o.slice(0, 12)) console.log(x.type === "overlap" ? `   ${x.a}  ×  ${x.b}  (${x.area.join("x")})` : `   clipped ${x.a} ${x.box.join(",")}`);
  }
  if (v.errors?.length) console.log(`  ! ${k} errors: ${v.errors.slice(0, 3).join(" | ")}`);
}
console.log(bad ? `\n${bad} screen(s) with overlaps` : "\nno overlaps");
process.exit(bad ? 1 : 0);
