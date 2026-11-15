// The playable missions (new flow): one scene player per mission. The app (odyssey/OdysseyApp.tsx)
// opens a player from the dashboard; the player calls onClose(true) after the passport stamp.
// Sealed chapters 3–5 have no player and are never enterable.
import { lazy, type ComponentType } from "react";

export const CHAPTER_PLAYERS: Record<string, ComponentType<{ startIndex?: number; onClose: (done?: boolean) => void }>> = {
  eagle: lazy(() => import("../story/ch1/Ch1Player")),
  opportunity: lazy(() => import("../story/ch2/Ch2Player")),
};
