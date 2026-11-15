// The two story films (new-flow prompt §8b): ten shots each, the SAME narration lines, facts and
// durations as before (the narration timeline: public/audio/vo/<ch>/durations.json). The schedule is a
// pure function of those durations, so the live game and the HyperFrames composition agree exactly.
import ch1Dur from "../../../public/audio/vo/ch1/durations.json";
import ch2Dur from "../../../public/audio/vo/ch2/durations.json";

export type Seam = "cut" | "wipe" | "iris" | "dust" | "match";
export type ShotDef = { id: string; lines: string[]; seam: Seam };
export type LineSlot = { id: string; start: number; dur: number };
export type ShotSlot = { id: string; index: number; start: number; end: number; lines: LineSlot[]; seamIn: Seam };
export type Storyline = { id: string; shots: ShotSlot[]; lines: LineSlot[]; duration: number };

/** gap after each line, lead-in before the first, hold after the last (seconds) */
export const GAP = 0.75;
const LEAD = 1.0;
const TAIL = 1.6;
/** a shot is never shorter than this, so it can hold ≥ 2.5 s after its move settles */
const MIN_SHOT = 5.2;

export const CH1_SHOTS: ShotDef[] = [
  { id: "landed", lines: ["e01"], seam: "cut" },
  { id: "first-step", lines: ["e02"], seam: "wipe" },
  { id: "hop", lines: ["e03"], seam: "match" },
  { id: "bootprint", lines: ["e04"], seam: "wipe" },
  { id: "columbia", lines: ["e05", "e06"], seam: "wipe" },
  { id: "flag-rocks", lines: ["e07", "e08"], seam: "wipe" },
  { id: "experiments", lines: ["e09", "e10", "e11"], seam: "wipe" },
  { id: "plaque", lines: ["e12", "e13"], seam: "match" },
  { id: "liftoff", lines: ["e14", "e15", "e16", "e17", "e18"], seam: "wipe" },
  { id: "today", lines: ["e19", "e20", "e21"], seam: "wipe" },
];

export const CH2_SHOTS: ShotDef[] = [
  { id: "crater", lines: ["m-story-01"], seam: "cut" },
  { id: "blueberries", lines: ["m-story-02", "m-story-03"], seam: "wipe" },
  { id: "sea", lines: ["m-story-04", "m-story-05"], seam: "wipe" },
  { id: "power", lines: ["m-story-06", "m-story-07"], seam: "wipe" },
  { id: "stuck", lines: ["m-story-08", "m-story-09"], seam: "dust" },
  { id: "marathon", lines: ["m-story-10", "m-story-11"], seam: "wipe" },
  { id: "endeavour", lines: ["m-story-12"], seam: "match" },
  { id: "storm", lines: ["m-story-13", "m-story-14"], seam: "dust" },
  { id: "messages", lines: ["m-story-15", "m-story-16"], seam: "wipe" },
  { id: "rest", lines: ["m-story-17", "m-story-18"], seam: "wipe" },
];

export function build(id: Storyline["id"], defs: ShotDef[], dur: Record<string, number>): Storyline {
  let t = LEAD;
  const shots: ShotSlot[] = [];
  const lines: LineSlot[] = [];
  defs.forEach((d, i) => {
    const start = i === 0 ? 0 : t;
    const ls = d.lines.map((l) => {
      const slot = { id: l, start: t, dur: dur[l] ?? 4 };
      t += slot.dur + GAP;
      return slot;
    });
    lines.push(...ls);
    let end = t + (i === defs.length - 1 ? TAIL - GAP : 0);
    if (end - start < MIN_SHOT) {
      t += MIN_SHOT - (end - start);
      end = t;
    }
    shots.push({ id: d.id, index: i, start, end, lines: ls, seamIn: d.seam });
  });
  return { id, shots, lines, duration: Math.round(shots[shots.length - 1].end * 100) / 100 };
}

export const CH1_STORY = build("ch1-story", CH1_SHOTS, (ch1Dur as { lines: Record<string, number> }).lines);
export const CH2_STORY = build("ch2-story", CH2_SHOTS, (ch2Dur as { lines: Record<string, number> }).lines);

/** which shot is on screen at time t, its local time, and the seam veil (0..1, peak at the cut) */
export function at(s: Storyline, t: number) {
  const i = Math.max(0, s.shots.findIndex((x) => t < x.end) === -1 ? s.shots.length - 1 : s.shots.findIndex((x) => t < x.end));
  const shot = s.shots[i];
  const local = t - shot.start;
  const len = shot.end - shot.start;
  // a 0.9 s seam centred on each cut: the veil closes over the end of one shot and opens on the next
  const HALF = 0.45;
  let veil = 0;
  let seam: Seam = "cut";
  if (i > 0 && local < HALF) {
    veil = 1 - local / HALF;
    seam = shot.seamIn;
  } else if (i < s.shots.length - 1 && len - local < HALF) {
    veil = 1 - (len - local) / HALF;
    seam = s.shots[i + 1].seamIn;
  }
  const line = s.lines.find((l) => t >= l.start && t < l.start + l.dur + GAP * 0.6);
  return { shot, index: i, local, len, k: Math.min(1, local / len), veil, seam, line };
}
