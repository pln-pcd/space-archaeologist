// Aim assist (bible §4: targets ≥ 96 px, snap within ~80 px). Anything clickable can register;
// the glove cursor is magnetised toward the nearest one inside its radius.
import { useEffect, type RefObject } from "react";

type Target = { id: string; get: () => { x: number; y: number; r?: number } | null; radius: number };
const targets = new Map<string, Target>();
let seq = 0;

export function registerInteractable(get: Target["get"], opts: { radius?: number; id?: string } = {}) {
  const id = opts.id ?? `t${++seq}`;
  targets.set(id, { id, get, radius: opts.radius ?? 80 });
  return () => void targets.delete(id);
}

/** DOM helper: register an element's centre while mounted. */
export function useInteractable(ref: RefObject<HTMLElement | null>, opts: { radius?: number; id?: string; active?: boolean } = {}) {
  const { radius, id, active = true } = opts;
  useEffect(() => {
    if (!active) return;
    return registerInteractable(
      () => {
        const el = ref.current;
        if (!el || !el.isConnected) return null;
        const r = el.getBoundingClientRect();
        if (!r.width) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 };
      },
      { radius, id },
    );
  }, [ref, radius, id, active]);
}

/** Nearest target within its snap radius (measured from its edge for big targets). */
export function nearestTarget(x: number, y: number): { id: string; x: number; y: number; d: number } | null {
  let best: { id: string; x: number; y: number; d: number } | null = null;
  for (const t of targets.values()) {
    const p = t.get();
    if (!p) continue;
    const d = Math.max(0, Math.hypot(p.x - x, p.y - y) - (p.r ?? 0) * 0.5);
    if (d <= t.radius && (!best || d < best.d)) best = { id: t.id, x: p.x, y: p.y, d };
  }
  return best;
}
