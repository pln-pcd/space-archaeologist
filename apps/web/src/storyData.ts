import content from "../../../shared/content.json";
export const stories = content.stories;
export type Story = (typeof stories)[number];
export const facts = content.facts as Record<
  string,
  { text: string; source: string }
>;
export const sources = content.sources as Record<
  string,
  { title: string; url: string; retrieved: string; status: string }
>;
export const storySteps = [
  "A signal in the quiet",
  "How the mission began",
  "Your turn at the controls",
  "What we discovered",
  "A memory to keep",
];
