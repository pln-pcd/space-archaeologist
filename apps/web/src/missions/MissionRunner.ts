import { isRude } from "../profile/name";
import type {
  MissionCommand,
  MissionDefinition,
  MissionState,
  Step,
} from "./types";

const add = <T>(xs: T[], x: T): T[] => (xs.includes(x) ? xs : [...xs, x]);
export const LOOP = [
  "Welcome",
  "Your explorer",
  "Starship",
  "Story",
  "Explore",
  "Investigate",
  "Evidence",
  "Reconstruct",
  "Discover",
  "Report",
  "Celebrate",
  "Archive",
];
export function newMission(m: MissionDefinition): MissionState {
  return {
    version: 1,
    missionId: m.meta.id,
    step: 4,
    storyStage: 0,
    artifactId: null,
    scanned: [],
    clues: {},
    activities: [],
    evidence: {},
    records: [],
    completedSteps: [],
    assembled: false,
    labels: [],
    timeline: [],
    reconstructionDone: false,
    discoveryIndex: 0,
    questionIndex: 0,
    questionParts: [],
    attempts: {},
    firstTries: 0,
    hints: 0,
    hintLevel: 0,
    challengeDone: false,
    stars: 0,
    points: 0,
    archive: [],
    notes: {},
    rewarded: false,
    feedback: "",
  };
}
const stepTo = (s: MissionState, step: Step): MissionState => ({
  ...s,
  step,
  completedSteps: add(s.completedSteps, s.step),
  feedback: "",
  hintLevel: 0,
});
/** Pure state machine. UI and input adapters can only send commands through the Intent Bus. */
export function reduceMission(
  m: MissionDefinition,
  s: MissionState,
  c: MissionCommand,
): MissionState {
  const a = m.artifacts.find((a) => a.id === s.artifactId);
  const clues = a ? (s.clues[a.id] ?? []) : [];
  if (c.type === "fieldDone") return { ...s, fieldDone: true };
  if (c.type === "note") {
    if (!s.archive.includes(c.id)) return s;
    const text = c.text
      .normalize("NFKC")
      .replace(/[<>\u0000-\u001f]/g, "")
      .slice(0, 240);
    return isRude(text)
      ? { ...s, feedback: "Try kind words for your archive note." }
      : {
          ...s,
          notes: { ...s.notes, [c.id]: text },
          feedback: "Note saved on this device.",
        };
  }
  if (
    c.type === "investigate" &&
    s.step === 5 &&
    m.artifacts.some((a) => a.id === c.id)
  )
    return { ...stepTo(s, 6), artifactId: c.id };
  if (c.type === "scan" && s.step === 6 && a && c.id === a.id)
    return {
      ...s,
      scanned: add(s.scanned, a.id),
      feedback: "Scan complete. Look for glowing clues.",
    };
  if (
    c.type === "clue" &&
    s.step === 6 &&
    a &&
    s.scanned.includes(a.id) &&
    a.components.some((x) => x.id === c.id)
  )
    return {
      ...s,
      clues: { ...s.clues, [a.id]: add(clues, c.id) },
      feedback: "Clue found! Into your evidence pouch.",
    };
  if (c.type === "activity" && s.step === 6 && a && c.id === a.id)
    return {
      ...s,
      activities: add(s.activities, a.id),
      feedback: "Discovery recorded. Your evidence is ready.",
    };
  if (c.type === "explore" && (s.step === 6 || s.step === 7))
    return stepTo(s, 5);
  if (c.type === "match" && s.step === 7 && a) {
    if (c.card.startsWith("part:")) {
      const id = c.card.slice(5);
      if (!a.components.slice(0, 2).some((part) => part.id === id)) return s;
      if (c.slot !== `job:${id}`)
        return { ...s, feedback: "Almost. Which job matches that component?" };
      return {
        ...s,
        evidence: {
          ...s.evidence,
          [a.id]: add(s.evidence[a.id] ?? [], `pair:${id}`),
        },
        feedback: "That component has its job!",
      };
    }
    const card = a.evidence.find((x) => x.id === c.card);
    if (!card || !m.evidenceSlots.some((slot) => slot.id === c.slot)) return s;
    if (card.slot !== c.slot)
      return {
        ...s,
        feedback: "Almost. Read the clue, then try another place.",
      };
    return {
      ...s,
      evidence: { ...s.evidence, [a.id]: add(s.evidence[a.id] ?? [], card.id) },
      feedback: "Pinned! These clues belong together.",
    };
  }
  if (c.type === "assemble" && s.step === 8)
    return {
      ...s,
      assembled: true,
      feedback: "Magnetic snap! Both stages are together.",
    };
  if (c.type === "label" && s.step === 8 && s.assembled)
    return c.stage === c.answer
      ? {
          ...s,
          labels: add(s.labels, c.stage),
          feedback: "That stage has its job.",
        }
      : { ...s, feedback: "Try the other stage. Nova can help." };
  if (
    c.type === "timeline" &&
    s.step === 8 &&
    s.labels.length === m.reconstruction.stages.length
  ) {
    if (m.reconstruction.timeline[s.timeline.length]?.id !== c.id)
      return {
        ...s,
        feedback: "What happened just before that? Try another card.",
      };
    const timeline = add(s.timeline, c.id);
    return {
      ...s,
      timeline,
      reconstructionDone: timeline.length === m.reconstruction.timeline.length,
      feedback: "One more piece of the journey restored.",
    };
  }
  if (c.type === "hint") {
    const level = Math.min(3, s.hintLevel + 1);
    let ns = { ...s, hintLevel: level, hints: s.hints + 1 };
    if (level === 3 && s.step === 8) {
      if (!s.assembled) ns.assembled = true;
      else if (s.labels.length < m.reconstruction.stages.length)
        ns.labels = m.reconstruction.stages.map((x) => x.id);
      else {
        ns.timeline = m.reconstruction.timeline.map((x) => x.id);
        ns.reconstructionDone = true;
      }
    }
    if (level === 3 && s.step === 7 && a)
      ns.evidence = {
        ...s.evidence,
        [a.id]: [
          ...a.evidence.map((x) => x.id),
          ...a.components.slice(0, 2).map((x) => `pair:${x.id}`),
        ],
      };
    if (level === 3 && s.step === 10) {
      const q = m.challenge[s.questionIndex];
      if (q)
        return reduceMission(
          m,
          { ...ns, questionParts: q.answer.slice(0, -1) },
          { type: "answer", id: q.answer.at(-1)! },
        );
    }
    return {
      ...ns,
      feedback:
        level === 1
          ? "Look closely. Which clues tell the same story?"
          : level === 2
            ? "Follow the highlighted card. Take your time."
            : "Let's do this one together.",
    };
  }
  if (c.type === "answer" && s.step === 10 && !s.challengeDone) {
    const q = m.challenge[s.questionIndex];
    if (!q || !q.options.some((x) => x.id === c.id)) return s;
    const attempt = s.attempts[q.id] ?? 0;
    if (q.answer[s.questionParts.length] !== c.id)
      return {
        ...s,
        attempts: { ...s.attempts, [q.id]: attempt + 1 },
        feedback: q.explanation.text,
      };
    const parts = [...s.questionParts, c.id];
    if (parts.length < q.answer.length)
      return {
        ...s,
        questionParts: parts,
        feedback: "That piece fits. Choose the next one.",
      };
    const questionIndex = s.questionIndex + 1;
    return {
      ...s,
      questionIndex,
      questionParts: [],
      firstTries: s.firstTries + (attempt === 0 ? 1 : 0),
      challengeDone: questionIndex === m.challenge.length,
      hintLevel: 0,
      feedback: "Report received! Every discovery helps.",
    };
  }
  if (c.type === "stamp" && s.step === 11 && s.challengeDone)
    return {
      ...stepTo(s, 12),
      rewarded: true,
      archive: m.artifacts.map((a) => a.id),
      points: m.rewards.points,
      stars:
        s.hints === 0 && s.firstTries === m.challenge.length
          ? 3
          : s.hints <= 4 && s.firstTries >= Math.ceil(m.challenge.length / 2)
            ? 2
            : 1,
    };
  if (c.type !== "next") return s;
  // v7.1 story: 0 = the story film (HyperFrames scene), 1 = the real NASA footage (Armstrong's
  // first steps), 2 = "your turn" launch lever, then explore
  if (s.step === 4)
    return s.storyStage < 2
      ? { ...s, storyStage: s.storyStage + 1 }
      : stepTo(s, 5);
  if (s.step === 5 && s.records.length === m.artifacts.length && s.fieldDone)
    return stepTo(s, 8);
  if (
    s.step === 6 &&
    a &&
    clues.length >= a.cluesRequired &&
    s.activities.includes(a.id)
  )
    return stepTo(s, 7);
  if (
    s.step === 7 &&
    a &&
    a.evidence.every((c) => s.evidence[a.id]?.includes(c.id)) &&
    a.components
      .slice(0, 2)
      .every((c) => s.evidence[a.id]?.includes(`pair:${c.id}`))
  ) {
    const ns = { ...s, records: add(s.records, a.id) };
    return stepTo(ns, ns.records.length === m.artifacts.length && ns.fieldDone ? 8 : 5);
  }
  if (s.step === 8 && s.reconstructionDone) return stepTo(s, 9);
  if (s.step === 9)
    return s.discoveryIndex < m.discovery.length - 1
      ? { ...s, discoveryIndex: s.discoveryIndex + 1 }
      : stepTo(s, 10);
  if (s.step === 10 && s.challengeDone) return stepTo(s, 11);
  return s;
}

/** Dev entry points never award artifacts or points. Normal play resumes the stored boundary. */
export function deepLink(
  m: MissionDefinition,
  s: MissionState,
  step?: number,
  artifact?: string | null,
): MissionState {
  const a = m.artifacts.find((a) => a.id === artifact);
  if (a) return { ...s, step: 6, artifactId: a.id };
  if (!step || step < 4 || step > 12) return s;
  return {
    ...s,
    ...(step === 4 ? { storyStage: 0 } : {}),
    step: step as Step,
    artifactId:
      step === 6 || step === 7
        ? (s.artifactId ?? m.artifacts[0].id)
        : s.artifactId,
  };
}
