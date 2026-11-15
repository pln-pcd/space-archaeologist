import { describe, expect, it } from "vitest";
import moon from "../apps/web/src/content/missions/moon-001.json";
import {
  defineMission,
  validateMission,
} from "../apps/web/src/missions/schema";
import {
  newMission,
  reduceMission,
} from "../apps/web/src/missions/MissionRunner";
import type { MissionCommand } from "../apps/web/src/missions/types";

const m = defineMission(moon);
describe("mission content provenance", () => {
  it("validates every mission JSON against the same provenance contract", () => {
    const all = import.meta.glob("../apps/web/src/content/missions/*.json", {
      eager: true,
      import: "default",
    });
    for (const value of Object.values(all))
      expect(validateMission(value)).toEqual([]);
  });
  it("sources every factual string, limits copy and validates all references", () =>
    expect(validateMission(moon)).toEqual([]));
  it("fails when a factual string loses its sourceId", () => {
    const bad = structuredClone(moon);
    delete (bad.artifacts[0].components[0].clue as { sourceId?: string })
      .sourceId;
    expect(validateMission(bad).join(" ")).toContain(
      "missing verified sourceId",
    );
  });
  it("rejects unverified sources and unclassified copy", () => {
    const bad = structuredClone(moon);
    bad.discovery[0].sourceId = "not-verified";
    (bad.meta.framing[0] as { kind: string }).kind = "unknown";
    expect(validateMission(bad).length).toBeGreaterThan(1);
  });
  it("rejects facts replaced with plain strings or entirely missing", () => {
    const bad = structuredClone(moon) as unknown as {
      artifacts: Record<string, unknown>[];
    };
    bad.artifacts[0].purpose = "An unsourced factual sentence.";
    delete bad.artifacts[0].significance;
    expect(validateMission(bad).join(" ")).toMatch(/expected object/);
    expect(validateMission(bad).join(" ")).toMatch(/missing significance/);
  });
  it("keeps the mission's narrator clips synchronized with JSON copy", () => {
    const clips = import.meta.glob(
      "../apps/web/public/audio/vo/missions/*/manifest.json",
      { eager: true, import: "default" },
    ) as Record<string, Record<string, { text: string; duration: number }>>;
    const manifest = Object.values(clips)[0];
    for (const shot of m.storyShots)
      shot.lines.forEach((line, i) => {
        expect(manifest[`${shot.id}-${i}`].text).toBe(line.text);
        expect(manifest[`${shot.id}-${i}`].duration).toBeGreaterThan(0);
      });
  });
});
describe("mission progression", () => {
  it("gates evidence, preserves gentle retries, and awards once", () => {
    let s = newMission(m);
    const act = (c: MissionCommand) => {
      s = reduceMission(m, s, c);
    };
    for (let i = 0; i < 4; i++) act({ type: "next" });
    expect(s.step).toBe(5);
    for (const a of m.artifacts) {
      act({ type: "investigate", id: a.id });
      act({ type: "next" });
      expect(s.step).toBe(6);
      act({ type: "clue", id: a.components[0].id });
      expect(s.clues[a.id]).toBeUndefined();
      act({ type: "scan", id: a.id });
      for (const c of a.components) act({ type: "clue", id: c.id });
      act({ type: "activity", id: a.id });
      act({ type: "next" });
      expect(s.step).toBe(7);
      act({ type: "match", card: a.evidence[0].id, slot: "photo" });
      expect(s.evidence[a.id]).toBeUndefined();
      for (const card of a.evidence)
        act({ type: "match", card: card.id, slot: card.slot });
      for (const part of a.components.slice(0, 2))
        act({ type: "match", card: `part:${part.id}`, slot: `job:${part.id}` });
      act({ type: "next" });
    }
    // v7.7: every find studied (each with its quiz); the Rock Box (fieldDone) gates the badge,
    // and the mission then goes straight to the badge (no rebuild, discovery or report)
    expect(s.step).toBe(5);
    act({ type: "next" });
    expect(s.step).toBe(5);
    act({ type: "fieldDone" });
    act({ type: "next" });
    expect(s.step).toBe(11);
    act({ type: "stamp" });
    expect(s.step).toBe(12);
    expect(s.stars).toBe(3);
    expect(s.archive.length).toBe(m.artifacts.length);
    const points = s.points;
    act({ type: "stamp" });
    expect(s.points).toBe(points);
    act({
      type: "note",
      id: m.artifacts[0].id,
      text: "My favorite discovery.",
    });
    expect(s.notes[m.artifacts[0].id]).toBe("My favorite discovery.");
  });
  it("allows Nova to complete a hard reconstruction with three hints", () => {
    let s = { ...newMission(m), step: 8 as const };
    for (let i = 0; i < 5; i++)
      s = reduceMission(m, s, { type: "hint" }) as typeof s;
    expect(s.reconstructionDone).toBe(true);
    expect(s.hints).toBe(5);
  });
});
