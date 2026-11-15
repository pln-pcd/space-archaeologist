// Speech-to-text benchmark across models (needs `npm run dev` with the server).
// node tools/stt_bench.mjs [model,model…] [--wasm]  → docs/audit/new-flow/stt-bench.json
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const models = (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "onnx-community/whisper-tiny.en,onnx-community/whisper-base.en,onnx-community/moonshine-tiny-ONNX").split(",");
const wasm = process.argv.includes("--wasm");
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const out = [];
for (const m of models) {
  const p = await (await b.newContext()).newPage();
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:5173/dev/stt?model=${encodeURIComponent(m)}${wasm ? "&wasm" : ""}`);
  try {
    await p.waitForFunction(() => window.__stt, null, { timeout: 900000, polling: 2000 });
    const r = await p.evaluate(() => window.__stt);
    const log = await p.locator("pre").innerText();
    r.ready = log.split("\n").find((l) => l.startsWith("ready")) ?? "";
    r.totalSeconds = Math.round((Date.now() - t0) / 1000);
    out.push(r);
    console.log(m, "WER", r.wer, "exact", r.exact + "/" + r.n, "ms/clip", r.msPerClip, r.ready);
  } catch (e) {
    console.log(m, "failed", e.message.split("\n")[0], (await p.locator("pre").innerText().catch(() => "")).slice(-300));
  }
  await p.close();
}
writeFileSync(`docs/audit/new-flow/stt-bench${wasm ? "-wasm" : ""}.json`, JSON.stringify(out, null, 1));
await b.close();
