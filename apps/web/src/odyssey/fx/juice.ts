// Juice (v4.6 §10): small, cheap DOM effects shared by every screen. All are skipped in reduced motion
// (?reduceMotion=1, the setting, or the OS preference) and on touch-only devices where they'd be noise.
//   - a star burst when any game button is pressed (kit Buttons burst themselves)
//   - a soft sparkle trail behind the cursor while it is over something you can click
//   - stampThunk(): the passport stamp lands with a short screen shake
import { burst } from "../ui/kit";
import { motion } from "../../anim/kit";

const BUTTONS = ".chunky, .tilt-btn, .od-ask, .od-icon-label, .ob-choice, .od-round, .od-start-pill, .od-gear, .k-mic";

let installed = false;
export function installJuice() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  addEventListener(
    "click",
    (e) => {
      if (motion.reduced) return;
      const t = (e.target as HTMLElement | null)?.closest?.(BUTTONS) as HTMLElement | null;
      if (!t || t.closest(".k-btn")) return;
      if (e.clientX || e.clientY) burst(e.clientX, e.clientY, 6);
      else {
        const r = t.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 6);
      }
    },
    true,
  );
  if (!matchMedia("(pointer: fine)").matches) return;
  let last = 0;
  let live = 0;
  addEventListener(
    "pointermove",
    (e) => {
      if (motion.reduced || live > 14) return;
      const now = performance.now();
      if (now - last < 55) return;
      const over = (e.target as HTMLElement | null)?.closest?.(`${BUTTONS}, .k-btn, button`);
      if (!over) return;
      last = now;
      live++;
      const s = document.createElement("i");
      s.className = "od-sparkle";
      s.style.left = `${e.clientX + (Math.random() - 0.5) * 10}px`;
      s.style.top = `${e.clientY + (Math.random() - 0.5) * 10}px`;
      document.body.appendChild(s);
      setTimeout(() => (s.remove(), live--), 650);
    },
    { passive: true },
  );
}

/** the passport stamp lands: a short, small screen shake (one shake, never a strobe) */
export function stampThunk() {
  if (motion.reduced) return;
  const el = document.querySelector(".od-app") as HTMLElement | null;
  if (!el) return;
  el.classList.remove("od-shake");
  void el.offsetWidth;
  el.classList.add("od-shake");
  setTimeout(() => el.classList.remove("od-shake"), 420);
}
