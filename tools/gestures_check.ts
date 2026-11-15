// npm run gestures:check
// Replays landmark sequences through the real feature + verb code and prints hits and false
// triggers per verb (bible §5: target ≥ 95% hits, < 1 false trigger per idle minute).
// Local dev tool only. Never part of a build.
//
// Inputs:
//  1. synthetic sequences from tools/gesture_synth.ts (always)
//  2. real recordings in tools/gesture-recordings/*.json, saved from the F9 debug overlay.
//     Format: { label: VerbId | "idle", aspect, frames: TrackFrame[] }
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { computeFeatures } from "../apps/web/src/input/features.ts";
import { HandSmoother } from "../apps/web/src/input/smoothing.ts";
import { VerbCore, toScreen } from "../apps/web/src/input/verbs.ts";
import { VERBS, type IntentName, type TrackFrame, type VerbId } from "../apps/web/src/input/types.ts";
import { FIST, OPEN, RELAXED, rand, render, reseed, type HandTrack, type Key, type Place, type Pose } from "./gesture_synth.ts";

const DISCRETE: Partial<Record<VerbId, IntentName>> = {
  pinch: "pinchStart",
  grab: "grab",
  palmHold: "palmHold",
  wave: "wave",
  swipe: "swipe",
  push: "push",
  frame: "frame",
  thumbsUp: "thumbsUp",
  fistStamp: "fistStamp",
  dial: "dial",
  steer: "steer",
  pilot: "pilot",
};
const isHit = (name: IntentName, payload: Record<string, unknown>) =>
  name === "palmHold" ? payload.done === true : name === "steer" ? payload.active === true && Math.abs(payload.value as number) > 0.3 : name === "dial" ? Math.abs(payload.delta as number) > 0 : name === "pilot" ? payload.active === true : true;

type Clip = { label: VerbId | "idle"; frames: TrackFrame[]; source: string };

function run(clip: Clip, enabled: VerbId[]) {
  const core = new VerbCore();
  core.setEnabled(enabled);
  // same landmark smoothing as the live engine
  const smoother = new HandSmoother();
  const counts: Record<string, number> = {};
  let firstHitAt = -1;
  for (const fr of clip.frames) {
    const hands = smoother.apply(fr.hands, fr.t);
    const feats = hands.map((h) => computeFeatures(h, fr.aspect));
    const p = feats[0] ? toScreen(feats[0].anchor, fr.aspect, 0.6) : { x: 0.5, y: 0.5 };
    const outs = core.step(fr.t, feats, { x: p.x * 1440, y: p.y * 900, visible: feats.length > 0 });
    for (const o of outs) {
      const verb = (Object.keys(DISCRETE) as VerbId[]).find((v) => DISCRETE[v] === o.name);
      if (!verb || !isHit(o.name, o.payload as Record<string, unknown>)) continue;
      counts[verb] = (counts[verb] ?? 0) + 1;
      if (verb === clip.label && firstHitAt < 0) firstHitAt = fr.t;
    }
  }
  return { counts, firstHitAt };
}

// ---------------- synthetic clips ----------------
const at = (x: number, y: number, size = 0.2, roll = 0, back = false): Place => ({ x, y, size, roll, back });
const jit = (v: number, a: number) => v + (rand() - 0.5) * 2 * a;
const k = (t: number, pose: Pose, p: Place, gesture?: string): Key => ({ t, pose, at: p, gesture });

function synthClips(n = 20): Clip[] {
  const clips: Clip[] = [];
  for (let i = 0; i < n; i++) {
    reseed(1000 + i);
    const x = jit(0.5, 0.12),
      y = jit(0.5, 0.1),
      s = jit(0.2, 0.05),
      r = jit(0, 0.15);
    const R = (tracks: HandTrack[], ms: number): TrackFrame[] => render(tracks, ms, { dropout: 0.03 });
    const one = (keys: Key[]) => [{ hand: "Right" as const, keys }];
    const pinchPose: Pose = { curl: [0.2, 0.35, 0.15, 0.2, 0.25], pinch: 1 };
    clips.push({ label: "pinch", source: "synthetic", frames: R(one([k(0, RELAXED, at(x, y, s, r)), k(500, OPEN, at(x, y, s, r)), k(650, pinchPose, at(x, y, s, r)), k(1150, pinchPose, at(x + 0.05, y, s, r)), k(1400, OPEN, at(x + 0.05, y, s, r)), k(1800, OPEN, at(x + 0.05, y, s, r))]), 1800) });
    clips.push({ label: "grab", source: "synthetic", frames: R(one([k(0, OPEN, at(x, y, s, r)), k(400, OPEN, at(x, y, s, r)), k(600, FIST, at(x, y, s, r), "Closed_Fist"), k(1200, FIST, at(x + 0.1, y, s, r), "Closed_Fist"), k(1400, OPEN, at(x + 0.1, y, s, r), "Open_Palm"), k(1700, OPEN, at(x + 0.1, y, s, r))]), 1700) });
    clips.push({ label: "palmHold", source: "synthetic", frames: R(one([k(0, RELAXED, at(x, y, s, r)), k(300, OPEN, at(x, y, s, r), "Open_Palm"), k(2000, OPEN, at(x, y, s, r), "Open_Palm")]), 2000) });
    const amp = (0.85 + rand() * 0.4) * s;
    const wk: Key[] = [k(0, OPEN, at(x, y, s, r))];
    for (let j = 1; j <= 5; j++) wk.push(k(j * 230, OPEN, at(x + (j % 2 ? amp : -amp) * 0.56, y, s, r + (j % 2 ? 0.2 : -0.2))));
    wk.push(k(1400, OPEN, at(x, y, s, r)));
    clips.push({ label: "wave", source: "synthetic", frames: R(one(wk), 1400) });
    const dir = rand() < 0.5 ? -1 : 1;
    clips.push({ label: "swipe", source: "synthetic", frames: R(one([k(0, RELAXED, at(x - dir * 0.15, y, s, r)), k(400, RELAXED, at(x - dir * 0.15, y, s, r)), k(620, RELAXED, at(x + dir * 0.25, y, s, r)), k(1100, RELAXED, at(x + dir * 0.25, y, s, r))]), 1100) });
    clips.push({ label: "push", source: "synthetic", frames: R(one([k(0, OPEN, at(x, y, s * 0.9, r)), k(400, OPEN, at(x, y, s * 0.9, r)), k(700, OPEN, at(x, y + 0.02, s * 1.25, r)), k(1100, OPEN, at(x, y + 0.02, s * 1.25, r))]), 1100) });
    const L: Pose = { curl: [0, 0, 0.95, 0.95, 0.95], lThumb: true };
    clips.push({ label: "frame", source: "synthetic", frames: R(one([k(0, RELAXED, at(x, y, s, r)), k(300, L, at(x, y, s, r)), k(1200, L, at(x, y, s, r))]), 1200) });
    const TU: Pose = { curl: [0, 0.95, 0.97, 0.97, 0.95], thumbUp: true };
    clips.push({ label: "thumbsUp", source: "synthetic", frames: R(one([k(0, RELAXED, at(x, y, s, r)), k(300, TU, at(x, y, s, r), "Thumb_Up"), k(1200, TU, at(x, y, s, r), "Thumb_Up")]), 1200) });
    clips.push({ label: "fistStamp", source: "synthetic", frames: R(one([k(0, FIST, at(x, y - 0.12, s, r), "Closed_Fist"), k(400, FIST, at(x, y - 0.12, s, r), "Closed_Fist"), k(620, FIST, at(x, y + 0.14, s, r), "Closed_Fist"), k(1000, FIST, at(x, y + 0.14, s, r), "Closed_Fist")]), 1000) });
    clips.push({ label: "dial", source: "synthetic", frames: R(one([k(0, OPEN, at(x, y, s, r)), k(300, pinchPose, at(x, y, s, r)), k(500, pinchPose, at(x, y, s, r)), k(1100, pinchPose, at(x, y, s, r + 0.9)), k(1300, OPEN, at(x, y, s, r + 0.9))]), 1300) });
    clips.push({
      label: "steer",
      source: "synthetic",
      frames: R(
        [
          { hand: "Left", keys: [k(0, FIST, at(0.32, 0.5, s, 0), "Closed_Fist"), k(400, FIST, at(0.32, 0.5, s, 0), "Closed_Fist"), k(900, FIST, at(0.33, 0.38, s, 0), "Closed_Fist")] },
          { hand: "Right", keys: [k(0, FIST, at(0.68, 0.5, s, 0), "Closed_Fist"), k(400, FIST, at(0.68, 0.5, s, 0), "Closed_Fist"), k(900, FIST, at(0.67, 0.62, s, 0), "Closed_Fist")] },
        ],
        900,
      ),
    });
    clips.push({ label: "pilot", source: "synthetic", frames: R(one([k(0, OPEN, at(x, 0.35, s, 0.3)), k(800, OPEN, at(x, 0.65, s, -0.3))]), 800) });
  }
  return clips;
}

/** Idle: a kid sitting in front of the laptop, hands drifting, scratching, resting, leaving frame. */
function idleClip(minutes: number, seedBase: number): Clip {
  reseed(seedBase);
  const keys: Key[] = [];
  let t = 0;
  const poses: Pose[] = [RELAXED, { curl: [0.4, 0.5, 0.55, 0.6, 0.6] }, { curl: [0.2, 0.2, 0.3, 0.35, 0.4] }, { curl: [0.6, 0.7, 0.75, 0.75, 0.7] }];
  let x = 0.5,
    y = 0.6;
  const tracks: HandTrack[] = [];
  while (t < minutes * 60000) {
    const dur = 700 + rand() * 2200;
    if (rand() < 0.15) {
      // hand leaves the frame for a while
      if (keys.length) tracks.push({ hand: "Right", keys: keys.splice(0) });
      t += 1500 + rand() * 4000;
      continue;
    }
    x = Math.max(0.2, Math.min(0.8, x + (rand() - 0.5) * 0.18));
    y = Math.max(0.35, Math.min(0.85, y + (rand() - 0.5) * 0.12));
    const pose = poses[Math.floor(rand() * poses.length)];
    keys.push(k(t, pose, at(x, y, 0.15 + rand() * 0.08, (rand() - 0.5) * 0.7, rand() < 0.5)));
    t += dur;
  }
  if (keys.length) tracks.push({ hand: "Right", keys });
  return { label: "idle", source: "synthetic", frames: render(tracks, minutes * 60000, { dropout: 0.04 }) };
}

function loadReal(): Clip[] {
  const dir = new URL("./gesture-recordings/", import.meta.url);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const j = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      return { label: j.label, frames: j.frames, source: f } as Clip;
    });
}

// ---------------- report ----------------
const clips = [...synthClips(), ...loadReal()];
const rows: Record<string, { trials: number; hits: number; cross: number; latency: number[] }> = {};
for (const c of clips.filter((c) => c.label !== "idle")) {
  const enabled: VerbId[] = c.label === "wave" || c.label === "swipe" ? ["wave", "swipe"] : c.label === "dial" ? ["pinch", "dial"] : c.label === "push" ? ["push", "palmHold"] : c.label === "grab" ? ["grab", "pinch"] : [c.label as VerbId];
  const r = run(c, enabled);
  const key = `${c.label}${c.source === "synthetic" ? "" : " (real)"}`;
  const row = (rows[key] ??= { trials: 0, hits: 0, cross: 0, latency: [] });
  row.trials++;
  if ((r.counts[c.label] ?? 0) > 0) row.hits++;
  for (const [v, n] of Object.entries(r.counts)) if (v !== c.label && !(c.label === "dial" && v === "pinch") && !(c.label === "grab" && v === "pinch")) row.cross += n;
}

const idleMinutes = 10;
const idleCounts: Record<string, number> = {};
for (let i = 0; i < 2; i++) {
  const c = idleClip(idleMinutes / 2, 777 + i);
  const r = run(c, VERBS.filter((v) => v !== "pointer" && v !== "pilot" && v !== "steer" && v !== "dial"));
  for (const [v, n] of Object.entries(r.counts)) idleCounts[v] = (idleCounts[v] ?? 0) + n;
}
for (const c of clips.filter((c) => c.label === "idle")) {
  const mins = (c.frames.at(-1)!.t - c.frames[0].t) / 60000;
  const r = run(c, VERBS.filter((v) => v !== "pointer"));
  console.log(`real idle ${c.source}: ${JSON.stringify(r.counts)} over ${mins.toFixed(1)} min`);
}

console.log("\nStar Gloves check — synthetic hands (20 trials per verb, jitter + 3% dropouts)\n");
console.log("verb          hits     rate   cross-talk");
let allOk = true;
for (const [v, r] of Object.entries(rows)) {
  const rate = r.hits / r.trials;
  if (rate < 0.95) allOk = false;
  console.log(`${v.padEnd(13)} ${String(r.hits).padStart(2)}/${String(r.trials).padEnd(4)} ${(rate * 100).toFixed(0).padStart(4)}%   ${r.cross}`);
}
console.log(`\nIdle false triggers over ${idleMinutes} synthetic minutes (all discrete verbs enabled at once):`);
let falseTotal = 0;
for (const v of Object.keys(DISCRETE)) {
  const n = idleCounts[v] ?? 0;
  falseTotal += n;
  if (n) console.log(`  ${v.padEnd(10)} ${n}  (${(n / idleMinutes).toFixed(2)}/min)`);
}
console.log(`  total      ${falseTotal}  (${(falseTotal / idleMinutes).toFixed(2)}/min)  target < 1/min per verb`);
console.log(allOk ? "\nAll verbs ≥ 95% on synthetic data." : "\nSome verbs below 95% on synthetic data.");
console.log(`Real recordings found: ${clips.filter((c) => c.source !== "synthetic").length} (record more with F9 → Record).`);

// ---- v8: pointing must never be a fist; finger counting is strict (1-4 only, never 5) ----
{
  const POINT: Pose = { curl: [0.85, 0.02, 0.95, 0.95, 0.95] };
  const tuck = (up: number): Pose => ({ curl: [0.85, ...[0, 1, 2, 3].map((i) => (i < up ? 0.02 : 0.95))] as Pose["curl"] });
  const FIVE: Pose = { curl: [0, 0.02, 0.02, 0.03, 0.04], lThumb: true };
  const THREE_T: Pose = { curl: [0, 0.02, 0.02, 0.95, 0.95], lThumb: true };
  let pointGrabs = 0, pointRuns = 0;
  const countRows: Record<string, { ok: number; n: number }> = {};
  for (let i = 0; i < 20; i++) {
    reseed(5000 + i);
    const x = jit(0.5, 0.1), y = jit(0.5, 0.1), s = jit(0.2, 0.04), r = jit(0, 0.12);
    const R = (keys: Key[], ms: number) => render([{ hand: "Right", keys }], ms, { dropout: 0.03 });
    // open hand → pointing, moving around: no grab may fire
    pointRuns++;
    const pr = run({ label: "idle", source: "synthetic", frames: R([k(0, OPEN, at(x, y, s, r)), k(300, OPEN, at(x, y, s, r)), k(500, POINT, at(x, y, s, r), "Pointing_Up"), k(1200, POINT, at(x + 0.12, y - 0.05, s, r), "Pointing_Up"), k(1900, POINT, at(x - 0.1, y + 0.06, s, r), "Pointing_Up")], 1900) }, ["grab", "pinch", "pointer"]);
    if ((pr.counts.grab ?? 0) > 0) pointGrabs++;
    const cases: [string, Pose, number, string?][] = [["1", tuck(1), 1], ["2", tuck(2), 2], ["3", tuck(3), 3], ["4", tuck(4), 4], ["thumb+2", THREE_T, 3], ["5 (open)", FIVE, 0, "Open_Palm"]];
    for (const [name, pose, want, label] of cases) {
      const core = new VerbCore();
      core.setEnabled(["count"]);
      const sm = new HandSmoother();
      let picked = 0;
      for (const f of R([k(0, RELAXED, at(x, y, s, r)), k(250, pose, at(x, y, s, r), label), k(1800, pose, at(x, y, s, r), label)], 1800)) {
        const feats = sm.apply(f.hands, f.t).map((h) => computeFeatures(h, f.aspect));
        for (const o of core.step(f.t, feats, { x: 0, y: 0, visible: true })) if (o.name === "fingers" && (o.payload as { done: boolean }).done) picked = (o.payload as { count: number }).count;
      }
      const row = (countRows[name] ??= { ok: 0, n: 0 });
      row.n++;
      if (picked === want) row.ok++;
    }
  }
  console.log(`\nv8 pointing → grab false triggers: ${pointGrabs}/${pointRuns} (want 0)`);
  console.log("v8 finger counting (want = picked):");
  for (const [name, r] of Object.entries(countRows)) console.log(`  ${name.padEnd(10)} ${r.ok}/${r.n}`);
}
