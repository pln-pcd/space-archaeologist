// Self-host MediaPipe (bible §5 step 3) so Star Gloves work offline at the venue.
// Copies the WASM runtime from node_modules and downloads any missing model files.
// Runs automatically before `npm run dev` / `npm run build`; safe to re-run.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
const pkg = "node_modules/@mediapipe/tasks-vision/wasm";
const wasmOut = "apps/web/public/mediapipe/wasm";
const modelOut = "apps/web/public/models";
mkdirSync(wasmOut, { recursive: true });
mkdirSync(modelOut, { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm", "vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"]) {
  const src = `${pkg}/${f}`,
    dst = `${wasmOut}/${f}`;
  if (!existsSync(src)) {
    console.warn(`⚠ missing ${src} (run npm install)`);
    continue;
  }
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst);
}
const MODELS = {
  "gesture_recognizer.task": "gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
  "selfie_segmenter.tflite": "image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
  "blaze_face_short_range.tflite": "face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
};
for (const [name, path] of Object.entries(MODELS)) {
  const dst = `${modelOut}/${name}`;
  if (existsSync(dst) && statSync(dst).size > 1000) continue;
  const url = `https://storage.googleapis.com/mediapipe-models/${path}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}`);
    writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
    console.log(`downloaded ${name}`);
  } catch (e) {
    console.warn(`⚠ could not download ${name} (${e.message}). Put it in ${modelOut}/ by hand: ${url}`);
  }
}
