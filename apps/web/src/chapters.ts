import type { Progress } from "./store";
import { stories, type Story } from "./storyData";

/** Every storybook is one chapter of the ship's voyage, in story order. */
export const chapters = stories;

/** Bible §0: only Ch1 (Moon) and Ch2 (Mars) are playable. Ch3–5 are sealed teasers. */
export const PLAYABLE = 2;
export const isSealed = (index: number) => index >= PLAYABLE;

/** Both playable chapters are open from the start (players may begin on Mars). */
export function furthestChapter(_progress?: Progress) {
  return PLAYABLE - 1;
}

/** Chapter the ship is currently parked at (only changes the view out of the windows). */
export function currentChapter(progress: Progress) {
  return Math.min(progress.chapter ?? 0, furthestChapter(progress));
}

export type ChapterState = "done" | "here" | "ready" | "locked";

export function chapterState(progress: Progress, index: number): ChapterState {
  if (isSealed(index)) return "locked";
  if (progress.completed.includes(chapters[index].id)) return "done";
  return index === currentChapter(progress) ? "here" : "ready";
}

/** Every playable storybook opens at any time; sealed ones never do. */
export function canOpen(_progress: Progress, story: Story) {
  return !isSealed(chapters.indexOf(story));
}

/** What the player could do next: the first unfinished storybook (any order is fine). */
export function nextStep(progress: Progress) {
  const open = chapters.slice(0, PLAYABLE);
  const todo = open.find((c) => !progress.completed.includes(c.id));
  if (!todo) return { kind: "done" as const, story: chapters[currentChapter(progress)] };
  return { kind: "read" as const, story: todo };
}
