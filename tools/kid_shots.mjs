// Local check: the four kids from /dev/kids. Turnarounds (front, 3/4, side, back), expressions close-up,
// and the suit. Output: docs/audit/cute/kids/*.png (+ K1..K4 sheets next to the reference sheets, which
// stay outside the repo in /tmp/refs/kids and are composited only into the audit image).
// Usage: node tools/kid_shots.mjs [turn,expr,suit,compare]
import { chromium } from "@playwright/test";
import { mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const want = new Set((process.argv[2] || "turn,expr,suit,compare").split(","));
const OUT = "docs/audit/cute/kids";
mkdirSync(OUT, { recursive: true });
const FF = `${process.env.LOCALAPPDATA}/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe`;
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1600, height: 700 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
const at = async (q, file) => {
  await p.goto("http://127.0.0.1:5173/dev/kids?" + q);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${file}.png` });
};
if (want.has("turn")) {
  for (const v of ["front", "three", "side", "back"]) await at(`view=${v}`, `turn-${v}`);
  await p.setViewportSize({ width: 400, height: 700 });
  for (const k of ["maya", "leo", "amara", "migo"]) for (const v of ["front", "three", "side", "back"]) await at(`kid=${k}&view=${v}`, `one-${k}-${v}`);
  await p.setViewportSize({ width: 1600, height: 700 });
}
if (want.has("expr")) {
  await p.setViewportSize({ width: 600, height: 520 });
  for (const k of ["maya", "leo", "amara", "migo"]) for (const e of ["neutral", "happy", "curious", "surprised", "determined", "sleepy"]) await at(`kid=${k}&expr=${e}&close=1`, `expr-${k}-${e}`);
  await p.setViewportSize({ width: 1600, height: 700 });
}
if (want.has("suit")) {
  await at("view=front&suit=1", "suit-front");
  await at("view=front&suit=1&helmet=1", "suit-helmet");
}
await b.close();
if (want.has("compare")) {
  // per kid: its reference sheet (outside the repo) above our front / 3/4 / side / back
  const ids = ["maya", "leo", "amara", "migo"];
  mkdirSync("docs/audit/cute", { recursive: true });
  for (let i = 0; i < 4; i++) {
    const ref = `/tmp/refs/kids/ref_K${i + 1}.jpg`;
    const have = existsSync("C:" + ref) || existsSync(ref);
    const crops = ["front", "three", "side", "back"].map((v) => ["-i", `${OUT}/one-${ids[i]}-${v}.png`]).flat();
    const f = ["front", "three", "side", "back"].map((_, k) => `[${k + (have ? 1 : 0)}]crop=300:525:50:90[c${k}]`).join(";");
    const row = `${f};[c0][c1][c2][c3]hstack=inputs=4[row]`;
    const args = have ? ["-i", "C:" + ref, ...crops, "-filter_complex", `[0]scale=1200:-2[ref];${row};[ref][row]vstack=inputs=2`] : [...crops, "-filter_complex", row.replace(/\[row\]$/, "")];
    execFileSync(FF, ["-v", "error", "-y", ...args, "-frames:v", "1", `docs/audit/cute/K${i + 1}.png`]);
  }
}
console.log(errs.length ? errs : "ok");
