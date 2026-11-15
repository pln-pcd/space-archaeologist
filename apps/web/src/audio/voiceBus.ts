// One voice at a time (v4.6 §7): Nova, the chapter narration and the story film all claim the bus
// before they speak; a new claim stops whatever was talking. No two voice lines ever overlap.
let stopCurrent: (() => void) | null = null;

/** take the voice channel; returns a release function for when this line ends by itself */
export function claimVoice(stop: () => void): () => void {
  if (stopCurrent && stopCurrent !== stop) {
    const prev = stopCurrent;
    stopCurrent = null;
    try {
      prev();
    } catch {
      /* already stopped */
    }
  }
  stopCurrent = stop;
  return () => {
    if (stopCurrent === stop) stopCurrent = null;
  };
}
