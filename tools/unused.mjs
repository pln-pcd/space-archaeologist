// Local check: which source files and public assets nothing reaches any more.
//   node tools/unused.mjs            prints unreachable src files (from main.tsx + the HyperFrames entry)
//   node tools/unused.mjs --assets   also lists public/ folders whose files are never referenced by src
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, extname } from "node:path";

const SRC = resolve("apps/web/src");
const PUB = resolve("apps/web/public");
const ENTRIES = [join(SRC, "main.tsx"), join(SRC, "scenes/shared/hfEntry.tsx")];
const EXT = ["", ".ts", ".tsx", ".js", ".mjs", ".css", ".json", "/index.ts", "/index.tsx"];

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const all = walk(SRC).filter((f) => /\.(tsx?|css|json|mjs|js)$/.test(f) && !/\.test\.|\.d\.ts$/.test(f));
const seen = new Set();
const rx = /(?:import|export)\s[^"'`]*?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|new URL\(\s*["']([^"']+)["']|@import\s+["']([^"']+)["']/g;
const visit = (f) => {
  if (seen.has(f) || !existsSync(f)) return;
  seen.add(f);
  if (!/\.(tsx?|css|mjs|js)$/.test(f)) return;
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(rx)) {
    const spec = (m[1] || m[2] || m[3] || m[4]).split("?")[0];
    if (!spec.startsWith(".")) continue;
    const base = resolve(dirname(f), spec);
    const hit = EXT.map((e) => base + e).find((c) => existsSync(c) && statSync(c).isFile());
    if (hit) visit(hit);
  }
};
ENTRIES.forEach(visit);
const unused = all.filter((f) => !seen.has(f));
let bytes = 0;
for (const f of unused) bytes += statSync(f).size;
console.log(`unreachable src files: ${unused.length} (${Math.round(bytes / 1024)} KB)`);
for (const f of unused) console.log("  " + relative(process.cwd(), f));

if (process.argv.includes("--assets")) {
  const code = [...seen].filter((f) => /\.(tsx?|css|json)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  const html = existsSync("apps/web/index.html") ? readFileSync("apps/web/index.html", "utf8") : "";
  const sw = existsSync(join(PUB, "sw.js")) ? readFileSync(join(PUB, "sw.js"), "utf8") : "";
  const hay = code + html + sw;
  console.log("\npublic folders (size, referenced?):");
  const dirs = (d, depth) => readdirSync(d).filter((x) => statSync(join(d, x)).isDirectory()).flatMap((x) => (depth > 1 ? [join(d, x), ...dirs(join(d, x), depth - 1)] : [join(d, x)]));
  for (const d of dirs(PUB, 3)) {
    const files = walk(d);
    const size = files.reduce((a, f) => a + statSync(f).size, 0);
    const rel = "/" + relative(PUB, d).replace(/\\/g, "/");
    const used = hay.includes(rel + "/") || hay.includes(rel.slice(1) + "/") || files.some((f) => hay.includes(relative(PUB, f).replace(/\\/g, "/").split("/").pop()));
    if (size > 200 * 1024) console.log(`  ${used ? "used  " : "UNUSED"} ${String(Math.round(size / 1024)).padStart(7)} KB  ${rel}`);
  }
}
