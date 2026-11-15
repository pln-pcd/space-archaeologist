// The overlap check, run inside the page (page.evaluate(findOverlaps)). Self-contained: no imports.
// Finds pairs of visible interactive or text elements whose boxes overlap, plus elements clipped by the
// viewport. Rules:
//  - interactive = button, a[href], input, select, textarea, [role=button]; text = an element with its
//    own non-blank text (boxes measured from the text itself with a Range, so padding does not count)
//  - a parent and its own child never count as overlapping
//  - when a dialog is open, only elements inside dialogs are checked (the rest is behind a scrim)
//  - elements (or ancestors) with data-qa-free are skipped (decorative or deliberately layered)
//  - overlaps under 6 px in either direction are ignored (outlines, shadows, anti-aliasing)
export function findOverlaps() {
  const MIN = 6;
  // A scroll panel clips its children. Measure the visible part, so an offscreen setting
  // cannot falsely overlap the fixed Done button. This also handles nested scroll panels.
  const visibleRect = (el, rect = el.getBoundingClientRect()) => {
    let { left, top, right, bottom } = rect;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { left = Math.max(left, r.left); right = Math.min(right, r.right); }
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
    }
    return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  };
  const vis = (el) => {
    if (el.closest("[aria-hidden='true'],[data-qa-free]")) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
    }
    const r = visibleRect(el);
    return r.width > 2 && r.height > 2;
  };
  const dialogs = [...document.querySelectorAll("[role='dialog'],[aria-modal='true']")].filter(vis);
  const inScope = (el) => !dialogs.length || dialogs.some((d) => d.contains(el));
  const label = (el) => {
    const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const cls = typeof el.className === "string" ? el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} "${t}"`;
  };
  const items = [];
  const interactive = document.querySelectorAll("button, a[href], input, select, textarea, [role='button']");
  for (const el of interactive) if (vis(el) && inScope(el)) items.push({ el, r: visibleRect(el), kind: "control" });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || el.closest("button, a[href], [role='button'], script, style, canvas, svg")) continue;
    seen.add(el);
    if (!vis(el) || !inScope(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = visibleRect(el, range.getBoundingClientRect());
    if (r.width > 2 && r.height > 2) items.push({ el, r, kind: "text" });
  }
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    // clipped by the window
    const W = innerWidth, H = innerHeight;
    if (a.r.left < -1 || a.r.top < -1 || a.r.right > W + 1 || a.r.bottom > H + 1) {
      const sc = a.el.closest("[data-qa-scroll], .od-scroll");
      if (!sc) out.push({ type: "clipped", a: label(a.el), box: [a.r.left, a.r.top, a.r.right, a.r.bottom].map(Math.round) });
    }
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > MIN && h > MIN) out.push({ type: "overlap", a: label(a.el), b: label(b.el), area: [Math.round(w), Math.round(h)] });
    }
  }
  return out;
}
