// Cutscene pipeline (bible §22 H, docs/design/ANIMATION_PIPELINE.md).
//   node scripts/cutscene.mjs build                 build the scene bundle, sync it (+ GSAP) into every composition
//   node scripts/cutscene.mjs lint <id>             hyperframes lint + check
//   node scripts/cutscene.mjs snapshot <id> [t,…]   PNG frames (default 0,10,25,50,75,90,100 %)
//   node scripts/cutscene.mjs preview <id>          the HyperFrames studio preview
//   node scripts/cutscene.mjs render <id> [--kid=all|maya,…] [--rm] [--res=720|1080]
//        → apps/web/public/media/cutscenes/<id>/<kid>[-rm][-720].mp4 (muted, H.264, CRF 20, +faststart)
// Telemetry stays off. The WinGet FFmpeg goes first on PATH (an old 2013 ffmpeg shadows it here).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const HF = join(ROOT, "hyperframes");
const OUT = join(ROOT, "apps/web/public/media/stories");
const FFDIR = join(process.env.LOCALAPPDATA ?? "", "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin");
const env = { ...process.env, DO_NOT_TRACK: "1", HYPERFRAMES_NO_TELEMETRY: "1", PATH: `${FFDIR};${process.env.PATH}` };
const KIDS = ["computer"];
const ACCENT = {};
const comps = () => readdirSync(HF).filter((d) => !d.startsWith("_") && existsSync(join(HF, d, "index.html")));
const hf = (args, cwd) => spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["hyperframes", ...args], { cwd, env, stdio: "inherit", shell: true });
const [cmd, id, ...rest] = process.argv.slice(2);
const flag = (k, d) => rest.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? (rest.includes(`--${k}`) ? "1" : d);

if (cmd === "build") {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build", "--config", "hyperframes/_shared/vite.config.mjs"], { stdio: "inherit", env, shell: true });
  for (const c of comps()) {
    const a = join(HF, c, "assets");
    mkdirSync(a, { recursive: true });
    copyFileSync(join(HF, "_shared/dist/scenes.js"), join(a, "scenes.js"));
    copyFileSync(join(ROOT, "node_modules/gsap/dist/gsap.min.js"), join(a, "gsap.min.js"));
    if (!existsSync(join(HF, c, "hyperframes.json"))) writeFileSync(join(HF, c, "hyperframes.json"), JSON.stringify({ paths: { assets: "assets" }, media: { autoProxy: true } }, null, 2));
    if (!existsSync(join(HF, c, "meta.json"))) writeFileSync(join(HF, c, "meta.json"), JSON.stringify({ id: c, name: c }, null, 2));
    console.log("synced", c);
  }
} else if (cmd === "lint") {
  const r1 = hf(["lint"], join(HF, id));
  const r2 = hf(["check", "--json"], join(HF, id));
  process.exit(r1.status || r2.status || 0);
} else if (cmd === "snapshot") {
  const dur = +readFileSync(join(HF, id, "index.html"), "utf8").match(/data-composition-id="[^"]+"[^>]*data-duration="([\d.]+)"/)[1];
  const at = (rest[0] && !rest[0].startsWith("--") ? rest[0].split(",").map(Number) : [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999].map((k) => +(k * dur).toFixed(2))).join(",");
  // snapshot uses the composition's default variables (per-kid looks come from renders)
  mkdirSync(join(ROOT, "docs/audit/hyperframes", id), { recursive: true });
  process.exit(hf(["snapshot", "--at", at, "--browser-gpu", "--no-end", "-o", JSON.stringify(join(ROOT, "docs/audit/hyperframes", id))], join(HF, id)).status ?? 0);
} else if (cmd === "preview") {
  hf(["preview"], join(HF, id));
} else if (cmd === "render") {
  const kids = (flag("kid", "all") === "all" ? KIDS : flag("kid").split(",")).filter(Boolean);
  const rm = !!flag("rm");
  const res = flag("res", "1080");
  mkdirSync(join(OUT, id), { recursive: true });
  const report = [];
  for (const k of kids) {
    const file = join(OUT, `${id}${rm ? "-rm" : ""}${res === "720" ? "-720" : ""}.mp4`);
    const vars = JSON.stringify({ reducedMotion: rm, device: res === "720" ? "phone" : "computer" });
    const t0 = Date.now();
    // variables go through a file (shells strip quotes from inline JSON)
    const vf0 = join(HF, id, ".hyperframes", `vars-${k}${rm ? "-rm" : ""}.json`);
    mkdirSync(join(HF, id, ".hyperframes"), { recursive: true });
    writeFileSync(vf0, vars);
    const r = hf(["render", "--quality", "looks", "--crf", "20", "--fps", "30", "--browser-gpu", "--variables-file", JSON.stringify(vf0), "-o", JSON.stringify(file)], join(HF, id));
    if (r.status) process.exit(r.status);
    // muted, H.264, +faststart; scaled to 720p for phones
    const tmp = file.replace(/\.mp4$/, ".tmp.mp4");
    const vf = res === "720" ? ["-vf", "scale=1280:720:flags=lanczos"] : [];
    execFileSync(join(FFDIR, "ffmpeg.exe"), ["-v", "error", "-y", "-i", file, "-an", ...vf, "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp]);
    copyFileSync(tmp, file);
    rmSync(tmp, { force: true });
    if (res === "720" && /^ch[12]-story$/.test(id)) {
      const voiceDir = id.startsWith("ch1") ? "ch1" : "ch2";
      const narration = JSON.parse(readFileSync(join(ROOT, "apps/web/public/audio/vo", voiceDir, "durations.json"), "utf8")).lines;
      writeFileSync(file.replace(/\.mp4$/, ".json"), JSON.stringify({ narration: JSON.stringify(narration) }));
    }
    report.push({ file: file.replace(ROOT, "."), seconds: (Date.now() - t0) / 1000, kB: Math.round(statSync(file).size / 1024) });
  }
  console.log(JSON.stringify(report, null, 1));
} else {
  console.log("usage: node scripts/cutscene.mjs build | lint <id> | snapshot <id> | preview <id> | render <id> [--kid=…] [--rm] [--res=720]");
}
