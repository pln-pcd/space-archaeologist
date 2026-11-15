export type Fact = { kind: "fact"; text: string; sourceId: string };
export type Imagine = { kind: "imagine"; text: string };
export type Line = Fact | Imagine;
export type Position = [number, number, number];
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type Component = {
  id: string;
  name: Fact;
  hotspotPosition: Position;
  clue: Fact;
  function: Fact;
};
export type Artifact = {
  id: string;
  name: Fact;
  modelRef: string;
  spawnPosition: Position;
  discoveryHint: Imagine;
  leftBehindReason: {
    category: "science" | "operation" | "weight" | "message";
    fact: Fact;
  };
  originalMission: Fact;
  purpose: Fact;
  significance: Fact;
  summary: Fact;
  components: Component[];
  cluesRequired: number;
  activity: "laser" | "seismic" | "message" | "landing";
  activityFact?: Fact;
  photo: {
    src: string;
    caption: Fact;
    credit: Fact;
    sourceId: string;
    license: "public-domain";
  };
  evidence: { id: string; slot: string; fact: Fact }[];
};
export type Question = {
  id: string;
  format: "pick" | "match" | "select" | "order";
  prompt: Fact;
  options: { id: string; label: Fact }[];
  answer: string[];
  explanation: Fact;
};
export type MissionDefinition = {
  schemaVersion: 1;
  meta: {
    id: string;
    title: string;
    location: Fact;
    difficulty: string;
    framing: Imagine[];
    briefing: Imagine[];
    estimatedMinutes: [number, number];
  };
  storyShots: { id: string; cameraRef: string; lines: Line[] }[];
  artifacts: Artifact[];
  evidenceSlots: { id: string; label: string }[];
  reconstruction: {
    summary: Fact;
    prompt: string;
    modelRef: string;
    stages: { id: string; name: Fact; function: Fact }[];
    timeline: { id: string; fact: Fact }[];
    hints: Line[];
  };
  discovery: Fact[];
  challenge: Question[];
  rewards: { badge: string; points: number; rank: string };
};
export type MissionState = {
  version: 1;
  missionId: string;
  step: Step;
  storyStage: number;
  artifactId: string | null;
  scanned: string[];
  clues: Record<string, string[]>;
  activities: string[];
  evidence: Record<string, string[]>;
  records: string[];
  completedSteps: Step[];
  assembled: boolean;
  labels: string[];
  timeline: string[];
  reconstructionDone: boolean;
  /** v7.5: the Rock Box game has been played (a required step of the mission path) */
  fieldDone?: boolean;
  discoveryIndex: number;
  questionIndex: number;
  questionParts: string[];
  attempts: Record<string, number>;
  firstTries: number;
  hints: number;
  hintLevel: number;
  challengeDone: boolean;
  stars: number;
  points: number;
  archive: string[];
  notes: Record<string, string>;
  rewarded: boolean;
  feedback: string;
  storageWarning?: boolean;
};
export type MissionCommand =
  | {
      type: "next" | "explore" | "assemble" | "hint" | "stamp" | "replay-reset" | "fieldDone";
    }
  | {
      type:
        "investigate" | "scan" | "clue" | "activity" | "timeline" | "answer";
      id: string;
    }
  | { type: "match"; card: string; slot: string }
  | { type: "label"; stage: string; answer: string }
  | { type: "note"; id: string; text: string };
