// One command for the final video: HyperFrames check, picture render, sound mix, mux, .srt.
//   node video/render.mjs            (expects video/build.mjs to have run)
// Writes docs/submission/local/Space_Archaeologist_Demo.mp4 and .srt, and video/build/render.log.
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const FFDIR = process.env.FFMPEG_DIR || "C:/Users/Admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin";
const env = { ...process.env, PATH: `${FFDIR};${process.env.PATH}`, FFMPEG: `${FFDIR}/ffmpeg.exe` };
const LOG = join(ROOT, "video/build/render.log");
const OUT = join(ROOT, "docs/submission/local");
mkdirSync(OUT, { recursive: true });
writeFileSync(LOG, `start ${new Date().toISOString()}\n`);
const log = (s) => appendFileSync(LOG, s + "\n");
const step = (label, cmd, args, cwd) => {
  log(`== ${label} ${new Date().toISOString()}`);
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", shell: true, maxBuffer: 1 << 28 });
  log((r.stdout || "").slice(-4000));
  log((r.stderr || "").slice(-4000));
  log(`== ${label} exit ${r.status}`);
  if (r.status !== 0) throw new Error(`${label} failed`);
};
try {
  const picture = join(ROOT, "video/build/picture.mp4");
  step("render", "npx", ["hyperframes", "render", "-o", JSON.stringify(picture), "--quality", "delivery", "--fps", "30", "--browser-gpu", "--quiet"], join(ROOT, "video/hf"));
  const final = join(OUT, "Space_Archaeologist_Demo.mp4");
  step("mix", "node", ["video/mix.mjs", JSON.stringify(picture), JSON.stringify(final)], ROOT);
  copyFileSync(join(ROOT, "video/build/captions.srt"), join(OUT, "Space_Archaeologist_Demo.srt"));
  log(`DONE ${new Date().toISOString()}`);
} catch (e) {
  log(`FAILED ${e.message}`);
}
