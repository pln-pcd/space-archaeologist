import { useSyncExternalStore } from "react";
import { intents } from "../input/bus";
import { MISSION_SAVE_KEY } from "./constants";
import { deepLink, newMission, reduceMission } from "./MissionRunner";
import type { MissionCommand, MissionDefinition, MissionState } from "./types";

export function restoreMission(
  m: MissionDefinition,
  raw: unknown,
): MissionState {
  const fresh = newMission(m);
  if (!raw || typeof raw !== "object") return fresh;
  const r = raw as MissionState;
  if (
    r.version !== 1 ||
    r.missionId !== m.meta.id ||
    !Number.isInteger(r.step) ||
    r.step < 4 ||
    r.step > 12
  )
    return fresh;
  // Reject partial/corrupted records, rather than crashing a child into an incomplete step.
  for (const key of [
    "scanned",
    "activities",
    "records",
    "completedSteps",
    "labels",
    "timeline",
    "questionParts",
    "archive",
  ] as const)
    if (
      !Array.isArray(r[key]) ||
      !r[key].every(
        (x) => typeof x === (key === "completedSteps" ? "number" : "string"),
      )
    )
      return fresh;
  for (const key of ["clues", "evidence", "notes", "attempts"] as const)
    if (!r[key] || typeof r[key] !== "object" || Array.isArray(r[key]))
      return fresh;
  if (
    Object.values(r.clues).some((x) => !Array.isArray(x)) ||
    Object.values(r.evidence).some((x) => !Array.isArray(x))
  )
    return fresh;
  for (const key of [
    "storyStage",
    "discoveryIndex",
    "questionIndex",
    "firstTries",
    "hints",
    "hintLevel",
    "stars",
    "points",
  ] as const)
    if (!Number.isFinite(r[key]) || r[key] < 0) return fresh;
  if (
    r.questionIndex > m.challenge.length ||
    r.discoveryIndex >= m.discovery.length ||
    r.storyStage > 5
  )
    return fresh;
  const ids = new Set(m.artifacts.map((a) => a.id));
  if (r.artifactId !== null && !ids.has(r.artifactId)) return fresh;
  if ((r.step === 6 || r.step === 7) && !r.artifactId) return fresh;
  return {
    ...fresh,
    ...r,
    notes: Object.fromEntries(
      Object.entries(r.notes)
        .filter(([id, text]) => ids.has(id) && typeof text === "string")
        .map(([id, text]) => [id, text.slice(0, 240)]),
    ),
    feedback: "",
    storageWarning: false,
  };
}
const sessions = new Map<string, MissionSession>();
class MissionSession {
  state: MissionState;
  listeners = new Set<() => void>();
  constructor(readonly mission: MissionDefinition) {
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(MISSION_SAVE_KEY) ?? "{}")[
        mission.meta.id
      ];
    } catch {
      /* fresh start */
    }
    this.state = restoreMission(mission, saved);
    intents.on("missionAction", ({ missionId, command }) => {
      if (missionId !== mission.meta.id) return;
      const next = reduceMission(mission, this.state, command);
      if (next !== this.state) {
        this.state = next;
        this.save();
      }
    });
  }
  save() {
    try {
      const all = JSON.parse(localStorage.getItem(MISSION_SAVE_KEY) ?? "{}");
      localStorage.setItem(
        MISSION_SAVE_KEY,
        JSON.stringify({ ...all, [this.mission.meta.id]: this.state }),
      );
    } catch {
      this.state = { ...this.state, storageWarning: true };
    }
    this.listeners.forEach((f) => f());
  }
  enter(step?: number, artifact?: string | null) {
    this.state = deepLink(this.mission, this.state, step, artifact);
    this.save();
  }
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  snapshot = () => this.state;
}
export function sessionFor(m: MissionDefinition) {
  if (!sessions.has(m.meta.id)) sessions.set(m.meta.id, new MissionSession(m));
  return sessions.get(m.meta.id)!;
}
export function useMission(m: MissionDefinition) {
  const session = sessionFor(m);
  return useSyncExternalStore(session.subscribe, session.snapshot);
}
export function command(
  m: MissionDefinition,
  command: MissionCommand,
  source = intents.lastSource,
) {
  intents.emit("missionAction", { missionId: m.meta.id, command }, source);
}
export function resetMissions() {
  localStorage.removeItem(MISSION_SAVE_KEY);
  for (const s of sessions.values()) {
    s.state = newMission(s.mission);
    s.listeners.forEach((f) => f());
  }
}
