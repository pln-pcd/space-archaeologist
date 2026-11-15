// Prune CSS rules whose selectors only target classes that no source file uses any more (removed
// screens from earlier versions). Conservative: a selector is dead only if it names a class that appears
// nowhere in apps/web/src (TS/TSX/HTML strings, template literals, class lists) or index.html. Rules
// without classes (elements, :root, html[data-*]), @keyframes and @font-face are always kept.
//   node tools/css_prune.mjs            report per file
//   node tools/css_prune.mjs --write    rewrite the files
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

const SRC = "apps/web/src";
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const files = walk(SRC);
const code = files.filter((f) => /\.(tsx?|mjs|js|html|json)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n") + readFileSync("apps/web/index.html", "utf8");
// classes built in templates (`from-${side}`) keep every class with that prefix
const prefixes = [...new Set([...code.matchAll(/([A-Za-z_][\w-]*-)\$\{/g)].map((m) => m[1]))];
// every word-ish token in code counts as a possible class name (covers clsx strings and templates)
const tokens = new Set(code.match(/[A-Za-z_][\w-]*/g));
const cssFiles = files.filter((f) => f.endsWith(".css"));
const write = process.argv.includes("--write");
let totalBefore = 0;
let totalAfter = 0;
for (const f of cssFiles) {
  const src = readFileSync(f, "utf8");
  const root = postcss.parse(src);
  let removed = 0;
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes/i.test(rule.parent.name)) return;
    const keep = rule.selectors.filter((sel) => {
      const classes = [...sel.replace(/:(?:not|is|where|has)\([^)]*\)/g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
      return classes.every((c) => tokens.has(c) || prefixes.some((p) => c.startsWith(p)));
    });
    if (keep.length === rule.selectors.length) return;
    removed++;
    if (keep.length) rule.selectors = keep;
    else rule.remove();
  });
  root.walkAtRules((a) => {
    if (/media|supports|layer/.test(a.name) && a.nodes && a.nodes.length === 0) a.remove();
  });
  const out = root.toString();
  totalBefore += src.length;
  totalAfter += out.length;
  if (removed) console.log(`${f}: ${removed} rules trimmed, ${Math.round(src.length / 1024)} KB → ${Math.round(out.length / 1024)} KB`);
  if (write && removed) writeFileSync(f, out);
}
console.log(`total CSS ${Math.round(totalBefore / 1024)} KB → ${Math.round(totalAfter / 1024)} KB${write ? " (written)" : " (dry run)"}`);
