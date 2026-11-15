// ONE shared camera stream for everything (gestures now, Memory Catch later). Bible §5 step 1.
// Frames are only ever shown live; nothing is saved or sent anywhere (bible §10 privacy).
import { useInput, type CamStatus } from "./store";

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let users = 0;
let starting: Promise<HTMLVideoElement> | null = null;

function errorStatus(e: unknown): CamStatus {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "missing";
  return "error";
}

export function getVideo() {
  return video;
}
export function getStream() {
  return stream;
}

/** Start (or share) the camera. Resolves with a playing <video>; rejects with a CamStatus. */
export function acquireCamera(): Promise<HTMLVideoElement> {
  // bible §5 (Chapter 1 rebuild): hand tracking lives only in post-story mini-games
  if (useInput.getState().handScenes === 0) {
    const w = window as unknown as { __cameraGuard?: number };
    w.__cameraGuard = (w.__cameraGuard ?? 0) + 1;
    if (import.meta.env.DEV) console.error("[camera-guard] the camera was requested outside a mini-game");
  }
  users++;
  if (video && stream?.active) return Promise.resolve(video);
  if (starting) return starting;
  const set = useInput.getState().set;
  if (!navigator.mediaDevices?.getUserMedia) {
    users--;
    set({ camera: "unsupported" });
    return Promise.reject("unsupported");
  }
  set({ camera: "asking" });
  starting = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30, max: 30 }, facingMode: "user" },
      });
    } catch (e) {
      // some cameras refuse 960×540: try plain defaults once before giving up
      const st = errorStatus(e);
      if (st === "missing" || st === "error") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (e2) {
          throw errorStatus(e2);
        }
      } else throw st;
    }
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.setAttribute("aria-hidden", "true");
    // keep it in the document (invisible) so the browser decodes frames and
    // requestVideoFrameCallback fires reliably
    Object.assign(v.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none", zIndex: "-1" });
    document.body.appendChild(v);
    v.srcObject = stream;
    await v.play().catch(() => {});
    if (!v.videoWidth) await new Promise<void>((r) => v.addEventListener("loadeddata", () => r(), { once: true }));
    video = v;
    const track = stream.getVideoTracks()[0];
    track.addEventListener("ended", () => {
      // unplugged or taken by another app
      useInput.getState().set({ camera: "missing" });
      stream = null;
      video = null;
    });
    set({ camera: "on", resolution: `${v.videoWidth}×${v.videoHeight}` });
    return v;
  })()
    .catch((st: CamStatus) => {
      users = Math.max(0, users - 1);
      set({ camera: typeof st === "string" ? st : "error" });
      throw st;
    })
    .finally(() => {
      starting = null;
    });
  return starting;
}

export function releaseCamera(force = false) {
  users = force ? 0 : Math.max(0, users - 1);
  if (users > 0) return;
  stream?.getTracks().forEach((t) => t.stop());
  video?.remove();
  stream = null;
  video = null;
  useInput.getState().set({ camera: "off", resolution: "" });
}

/** Drop to 640×360 when inference can't keep up (bible §5 step 1). */
export async function downgradeCamera() {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({ width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30, max: 30 } });
    const s = track.getSettings();
    useInput.getState().set({ resolution: `${s.width}×${s.height}` });
    return true;
  } catch {
    return false;
  }
}

/** Average brightness 0..255 of a tiny copy of the frame, for the Hand Coach "find light" tip. */
const probe = typeof document !== "undefined" ? document.createElement("canvas") : null;
export function frameBrightness(): number {
  if (!video || !probe) return 255;
  probe.width = 32;
  probe.height = 18;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 255;
  ctx.drawImage(video, 0, 0, 32, 18);
  const d = ctx.getImageData(0, 0, 32, 18).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  return sum / (d.length / 4);
}
