// Review sheets: one frame every 2 seconds of the final video, 30 per sheet, with timecodes.
//   node video/sheets.mjs [video.mp4] [outdir]
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const FF = process.env.FFMPEG || "ffmpeg";
const src = process.argv[2] || "docs/submission/local/Space_Archaeologist_Demo.mp4";
const out = process.argv[3] || "video/build/review";
mkdirSync(out, { recursive: true });
const probe = spawnSync(FF, ["-hide_banner", "-i", src], { encoding: "utf8" }).stderr;
const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
const dur = +m[1] * 3600 + +m[2] * 60 + +m[3];
const per = 60; // seconds per sheet (30 frames at 1 every 2 s)
for (let k = 0; k * per < dur; k++) {
  spawnSync(FF, ["-v", "error", "-y", "-ss", String(k * per), "-t", String(per), "-i", src, "-vf", `fps=1/2,scale=480:-1,drawtext=text='%{pts\\:hms\\:${k * per}}':x=6:y=6:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=5x6`, "-frames:v", "1", `${out}/sheet_${k}.jpg`], { stdio: "ignore" });
  console.log(`${out}/sheet_${k}.jpg  (${k * per} s to ${Math.min(dur, (k + 1) * per).toFixed(0)} s)`);
}
