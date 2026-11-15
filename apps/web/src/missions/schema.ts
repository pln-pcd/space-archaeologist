import sourceData from "../content/sources.json";
import type { MissionDefinition } from "./types";
import { validateShape } from "./shape";

const sources = new Map(sourceData.sources.map((s) => [s.id, s]));
const words = (s: string) => s.trim().split(/\s+/).length;
/** Validate before registering any future mission. Factual copy is always a Fact object. */
export function validateMission(value: unknown): string[] {
  const shapeErrors = validateShape(value);
  const errors: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    const obj = v as Record<string, unknown>;
    if ("text" in obj) {
      if (obj.kind !== "fact" && obj.kind !== "imagine")
        errors.push(`${path}: unclassified copy`);
      if (
        obj.kind === "fact" &&
        (typeof obj.sourceId !== "string" ||
          sources.get(obj.sourceId)?.status !== "verified")
      )
        errors.push(`${path}: missing verified sourceId`);
      if (typeof obj.text !== "string" || words(obj.text) > 15)
        errors.push(`${path}: dialogue exceeds 15 words`);
    }
    Object.entries(obj).forEach(([k, x]) => walk(x, `${path}.${k}`));
  };
  walk(value, "mission");
  if (shapeErrors.length) return [...errors, ...shapeErrors];
  const m = value as MissionDefinition;
  if (m?.schemaVersion !== 1 || !m.meta?.id || !m.artifacts?.length)
    return [...errors, "invalid mission structure"];
  const ids = new Set<string>();
  for (const a of m.artifacts) {
    if (ids.has(a.id)) errors.push(`duplicate artifact ${a.id}`);
    ids.add(a.id);
    if (a.activity === "laser" && !a.activityFact)
      errors.push(`missing sourced activity fact ${a.id}`);
    if (a.cluesRequired < 1 || a.cluesRequired > a.components.length)
      errors.push(`invalid clue threshold ${a.id}`);
    if (
      a.spawnPosition.length !== 3 ||
      a.components.some((c) => c.hotspotPosition.length !== 3)
    )
      errors.push(`invalid position ${a.id}`);
    if (
      a.photo.license !== "public-domain" ||
      !a.photo.src.startsWith("/media/")
    )
      errors.push(`nonlocal/unlicensed photo ${a.id}`);
    if (sources.get(a.photo.sourceId)?.status !== "verified")
      errors.push(`unsourced photo ${a.id}`);
    for (const c of a.evidence)
      if (!m.evidenceSlots.some((s) => s.id === c.slot))
        errors.push(`unknown evidence slot ${c.slot}`);
    if (
      a.evidence.length !== m.evidenceSlots.length ||
      new Set(a.evidence.map((c) => c.slot)).size !== a.evidence.length
    )
      errors.push(`incomplete evidence ${a.id}`);
  }
  for (const q of m.challenge) {
    if (words(q.prompt.text) > 12)
      errors.push(`quiz exceeds 12 words: ${q.id}`);
    if (
      !q.answer.length ||
      q.answer.some((id) => !q.options.some((o) => o.id === id))
    )
      errors.push(`invalid answer ${q.id}`);
  }
  return errors;
}
export function defineMission(value: unknown): MissionDefinition {
  const errors = validateMission(value);
  if (errors.length) throw new Error(errors.join("\n"));
  return value as MissionDefinition;
}
