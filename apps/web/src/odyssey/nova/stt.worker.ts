// On-device speech-to-text (new-flow prompt §7d): transformers.js (Apache-2.0) running a small English
// Whisper model in this worker. WebGPU if the browser has it, otherwise WebAssembly. The model loads
// only when the microphone is first used; audio never leaves the device.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// the ONNX runtime's own files ship with the game (bundled as assets), never fetched from a CDN
import ortMjs from "../../../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url";
import ortWasm from "../../../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url";
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm } as never;
env.allowLocalModels = false;

type In = { type: "load"; model: string; webgpu: boolean } | { type: "run"; id: number; audio: Float32Array };
let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let device = "wasm";

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data;
  const post = (x: unknown) => (self as unknown as Worker).postMessage(x);
  if (m.type === "load") {
    device = m.webgpu ? "webgpu" : "wasm";
    const make = pipeline as unknown as (task: string, model: string, o: unknown) => Promise<AutomaticSpeechRecognitionPipeline>;
    asr ??= make("automatic-speech-recognition", m.model, {
      device: device as "webgpu" | "wasm",
      dtype: device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === "progress") post({ type: "progress", file: p.file, progress: p.progress ?? 0 });
      },
    });
    try {
      await asr;
      post({ type: "ready", device });
    } catch (err) {
      asr = null;
      post({ type: "error", error: String(err) });
    }
    return;
  }
  if (m.type === "run") {
    try {
      const p = await asr!;
      const t0 = performance.now();
      const out = (await p(m.audio, { language: undefined, chunk_length_s: 15 } as never)) as { text: string };
      post({ type: "text", id: m.id, text: out.text.trim(), ms: Math.round(performance.now() - t0), device });
    } catch (err) {
      post({ type: "text", id: m.id, text: "", error: String(err) });
    }
  }
};
