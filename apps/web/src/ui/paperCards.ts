// Stacked paper cards (bible §6 MASTER) paint their light card and rotated shadow card as
// ::after / ::before layers, which need a positioned card. Most cards are already absolute or
// fixed; a static one would let its layers escape to an ancestor. This watcher gives exactly the
// static ones `position: relative` when they mount, so no real layout is ever overridden.
const CARDS = ".station-panel, .discover-card, .results-card, .sealed-card, .exit-card, .secret-card, .clue-card, .catch-q, .subtitle, .quest-card, .quest-badge, .sm-card, .boarding-pass, .grown-panel, .game-toast, .paper-toast, .first-steps, .ch-title, .ch-home, .paper-card, .academy .bubble";

function fix(el: Element) {
  const all = [...(el.matches?.(CARDS) ? [el] : []), ...el.querySelectorAll(CARDS)];
  for (const c of all) {
    const h = c as HTMLElement;
    if (getComputedStyle(h).position === "static") h.style.position = "relative";
  }
}

export function watchPaperCards() {
  if (typeof document === "undefined") return;
  fix(document.body);
  new MutationObserver((list) => {
    for (const m of list) m.addedNodes.forEach((n) => n.nodeType === 1 && fix(n as Element));
  }).observe(document.body, { childList: true, subtree: true });
}
