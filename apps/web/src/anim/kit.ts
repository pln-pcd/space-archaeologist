/**
 * Homeward animation kit: small, bouncy, springy motion.
 * Timing rules: most motions 0.12–0.4 s, ease-out with a tiny overshoot. Reduced motion
 * removes sway, bobbing and overshoot (see `motion.reduced`).
 */

/** Global motion preferences, set by the app from settings. */
export const motion = { reduced: false };
/** Scale for decorative motion (sway, bob, overshoot). 0 when reduced motion is on. */
export const life = () => (motion.reduced ? 0 : 1);
/**
 * Idle decoration in the base (spinning props, swaying mobiles, orbiting moons). Kept at 0: in a calm
 * base only things that mean something move (the next storybook, the characters, doors, the glove).
 */
export const ambient = () => 0;

/** A damped spring (semi-implicit Euler). Stiffness ~120–260, damping ~10–20 feels toy-like. */
export class Spring {
  x: number;
  v = 0;
  constructor(x = 0) {
    this.x = x;
  }
  step(target: number, dt: number, stiffness = 180, damping = 14) {
    if (motion.reduced) {
      // no overshoot: critically damped, quick
      this.x += (target - this.x) * Math.min(1, dt * 14);
      this.v = 0;
      return this.x;
    }
    const a = (target - this.x) * stiffness - this.v * damping;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
  kick(v: number) {
    if (!motion.reduced) this.v += v;
  }
}

/** Frame-rate independent exponential approach (no overshoot). */
export const damp = (cur: number, target: number, lambda: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/**
 * Squash & stretch: a spring on "squash amount". Positive = squashed (wide and short),
 * negative = stretched (tall and thin). Volume is roughly kept.
 */
export class SquashStretch {
  private s = new Spring(0);
  /** land: quick squash · start: small stretch · stop: tiny squash · pop: bigger stretch then settle */
  trigger(kind: "land" | "start" | "stop" | "pop") {
    const k = { land: 9, start: -6, stop: 4, pop: -11 }[kind];
    this.s.kick(k);
  }
  /** Returns [scaleX, scaleY, scaleZ]. Defaults reach ~0.9 Y / 1.08 X for ~120 ms on land. */
  step(dt: number): [number, number, number] {
    const v = this.s.step(0, dt, 260, 16);
    const y = 1 - v * 0.11;
    const xz = 1 + v * 0.085;
    return [xz, y, xz];
  }
}

/** Follow-through for antennas, tassels and hanging lamps: lags behind the parent's motion. */
export class FollowThrough {
  private sx = new Spring(0);
  private sz = new Spring(0);
  private px = 0;
  private pz = 0;
  /** Feed the parent's world position; returns tilt angles [x, z] in radians. */
  step(x: number, z: number, dt: number, amount = 0.6): [number, number] {
    const vx = dt > 0 ? (x - this.px) / dt : 0;
    const vz = dt > 0 ? (z - this.pz) / dt : 0;
    this.px = x;
    this.pz = z;
    const k = amount * life();
    return [this.sx.step(vz * 0.08 * k, dt, 90, 7), this.sz.step(-vx * 0.08 * k, dt, 90, 7)];
  }
}

/** Idle life: breathing, blinks every few seconds, an occasional glance. Deterministic per seed. */
export function idle(t: number, seed = 0) {
  const k = life();
  const breathe = Math.sin(t * 2.1 + seed) * 0.5 + 0.5;
  // blink: a 120 ms close roughly every 3.2–4.6 s
  const period = 3.2 + ((seed * 7.3) % 1.4);
  const ph = (t + seed * 1.7) % period;
  const blink = ph < 0.12 ? 1 - Math.sin((ph / 0.12) * Math.PI) : 1;
  const glance = Math.sin(t * 0.37 + seed) * 0.35 * k;
  return { breathe: breathe * k, blink, glance };
}

/** Crossfaded state weights (~0.15 s). */
export class StateBlend<S extends string> {
  w: Record<string, number> = {};
  constructor(public current: S) {
    this.w[current] = 1;
  }
  set(s: S) {
    this.current = s;
  }
  step(dt: number, fade = 0.15) {
    const k = 1 - Math.exp(-dt / (fade / 3));
    for (const key of Object.keys(this.w)) this.w[key] += ((key === this.current ? 1 : 0) - this.w[key]) * k;
    if (!(this.current in this.w)) this.w[this.current] = k;
    return this.w;
  }
  weight(s: S) {
    return this.w[s] ?? 0;
  }
}

/** Ease-out with a tiny overshoot, for one-shot pops (t in 0..1). */
export const popEase = (t: number) => {
  if (motion.reduced) return Math.min(1, Math.max(0, t));
  const c1 = 1.4,
    c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
/** A hump 0→1→0 over 0..1. */
export const hump = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI));
