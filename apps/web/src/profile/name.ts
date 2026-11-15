// Explorer name rules (opening sequence, bible §21). Pure functions, no DOM: unit-tested in
// tests/name.test.ts. The name is saved only in this browser and never sent anywhere.

export type NameCheck = { ok: true; name: string; patch: string } | { ok: false; reason: "short" | "long" | "chars" | "digits" | "rude"; message: string };

export const NAME_MIN = 2;
export const NAME_MAX = 12;

/** friendly space nicknames for "Random name" ("Nova" and look-alikes are left out on purpose) */
export const RANDOM_NAMES = ["Comet", "Orbit", "Pebble", "Starling", "Luna", "Rocket", "Meteor", "Juno", "Atlas", "Sky", "Pixel", "Ember", "Cosmo"];

export const MESSAGES = {
  short: "Type at least 2 letters, or tap Random name.",
  long: "That's a long one. Use 12 letters or fewer.",
  chars: "Use letters, numbers, spaces or hyphens.",
  digits: "Add some letters, too.",
  rude: "Let's pick a different name.",
} as const;

// A small local block list (English plus common Filipino/Tagalog), stored in a light ROT13 so the
// source file does not read as a list of swear words. Checked on a squashed form of the name:
// lower case, accents removed, spaces/dots/hyphens/underscores dropped, 3→e 1→i 0→o 4→a 5→s 7→t @→a $→s.
const ROT = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
// substrings (distinctive, 4+ letters)
const BLOCK = ["shpx", "fuvg", "ovgpu", "nffubyr", "chffl", "phag", "fyhg", "juber", "onfgneq", "avttre", "avttn", "ergneq", "jnax", "gjng", "cravf", "intvan", "cbea", "uvgyre", "qvyqb", "obbo", "chgnatvan", "gnatvan", "chgnat", "xnagbg", "gnzbq", "ovyng", "chxv", "gnenagnqb", "tntb", "oheng", "wnxby", "yvobt", "cnxlh", "cnxlbh"].map(ROT);
// whole words only (short ones that also sit inside ordinary names: Hancock, grape, Taehyung)
const BLOCK_WORDS = new Set(["nff", "gvg", "qvpx", "pbpx", "encr", "xvyy", "anmv", "frk", "snt", "chgn", "obob", "gnatn", "gnr", "xvxv", "fhfb", "hyby", "ohnat", "hgbat", "gvgv"].map(ROT));

export function squash(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[\s._\-*]+/g, "");
}

export function isRude(raw: string): boolean {
  const s = squash(raw);
  if (!s) return false;
  if (BLOCK.some((w) => w.length >= 3 && s.includes(w))) return true;
  const words = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[\s\-]+/);
  return words.some((w) => BLOCK_WORDS.has(squash(w))) || BLOCK_WORDS.has(s);
}

/** letters (any script, accents, ñ), numbers, spaces and hyphens */
const ALLOWED = /^[\p{L}\p{M}\p{N} \-]+$/u;

export function checkName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, " ");
  const len = [...name].length;
  if (len < NAME_MIN) return { ok: false, reason: "short", message: MESSAGES.short };
  if (len > NAME_MAX) return { ok: false, reason: "long", message: MESSAGES.long };
  if (!ALLOWED.test(name)) return { ok: false, reason: "chars", message: MESSAGES.chars };
  if (/^[\p{N} \-]+$/u.test(name)) return { ok: false, reason: "digits", message: MESSAGES.digits };
  if (isRude(name)) return { ok: false, reason: "rude", message: MESSAGES.rude };
  return { ok: true, name, patch: name.toLocaleUpperCase() };
}

export function randomName(not?: string): string {
  const pool = RANDOM_NAMES.filter((n) => n !== not);
  return pool[Math.floor(Math.random() * pool.length)];
}
