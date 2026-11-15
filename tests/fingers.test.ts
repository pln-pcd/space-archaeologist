// v7.6 finger counting (the evidence quiz): 1 to 4 straight fingers held still pick A to D.
// Synthetic hands (tools/gesture_synth.ts) run through the real features + verb core.
import { describe, expect, it } from "vitest";
import { render, OPEN, type Pose } from "../tools/gesture_synth";
import { computeFeatures } from "../apps/web/src/input/features";
import { VerbCore } from "../apps/web/src/input/verbs";

const at = { x: 0.5, y: 0.75, size: 0.2, roll: 0 };
const pose = (straight: number): Pose => ({
  // thumb tucked; index..pinky straight for the first `straight` fingers, curled after
  curl: [0.85, ...[0, 1, 2, 3].map((i) => (i < straight ? 0.02 : 0.95))] as Pose["curl"],
});
function run(p: Pose, ms = 1200) {
  const core = new VerbCore();
  core.setEnabled(["count", "pointer"]);
  const frames = render([{ hand: "Right", keys: [{ t: 0, pose: p, at }, { t: ms, pose: p, at }] }], ms, { dropout: 0, jitter: 0.0008 });
  const picks: number[] = [];
  for (const fr of frames) {
    const feats = fr.hands.map((h) => computeFeatures(h, fr.aspect));
    for (const o of core.step(fr.t, feats, { x: 700, y: 400, visible: feats.length > 0 }))
      if (o.name === "fingers" && (o.payload as { done: boolean }).done) picks.push((o.payload as { count: number }).count);
  }
  return picks;
}

describe("finger counting", () => {
  for (const n of [1, 2, 3, 4]) it(`${n} finger${n > 1 ? "s" : ""} held picks ${"ABCD"[n - 1]} exactly once`, () => expect(run(pose(n))).toEqual([n]));
  it("an open hand with the thumb out still counts four", () => expect(run(OPEN)).toEqual([4]));
  it("a fist picks nothing", () => expect(run(pose(0))).toEqual([]));
  it("a quick flash picks nothing", () => expect(run(pose(2), 400)).toEqual([]));
});
