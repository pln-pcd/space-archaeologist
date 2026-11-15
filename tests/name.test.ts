import { describe, expect, it } from "vitest";
import { checkName, isRude, randomName, RANDOM_NAMES } from "../apps/web/src/profile/name";

describe("explorer name", () => {
  it("accepts friendly names", () => {
    for (const n of ["Mia", "Jo", "Comet", "Luna-2", "Star Fox", "Kai 7", "ABCDEFGHIJKL"]) expect(checkName(n).ok, n).toBe(true);
  });
  it("accepts accents and ñ", () => {
    for (const n of ["Niño", "Zoë", "José", "Peñafiel", "Ånne", "Élodie"]) expect(checkName(n).ok, n).toBe(true);
  });
  it("trims and collapses spaces, and makes an upper-case patch", () => {
    const r = checkName("  star   fox ");
    expect(r.ok && r.name).toBe("star fox");
    expect(r.ok && r.patch).toBe("STAR FOX");
    const n = checkName("niño");
    expect(n.ok && n.patch).toBe("NIÑO");
  });
  it("rejects too short and empty", () => {
    for (const n of ["", " ", "A", " b "]) expect(checkName(n)).toMatchObject({ ok: false, reason: "short" });
  });
  it("rejects too long", () => {
    expect(checkName("ABCDEFGHIJKLM")).toMatchObject({ ok: false, reason: "long" });
  });
  it("rejects numbers only", () => {
    for (const n of ["12", "007", "4 2", "1-2"]) expect(checkName(n)).toMatchObject({ ok: false, reason: "digits" });
  });
  it("rejects other characters", () => {
    for (const n of ["hi!", "a@b", "<b>", "x_y", "emoji😀"]) expect(checkName(n).ok, n).toBe(false);
  });
  it("blocks rude words, including spaced and number-swapped versions", () => {
    for (const n of ["shit", "S h i t", "sh1t", "b1tch", "f-u-c-k", "PUTANGINA", "put4ng", "g a g o", "tanga", "Bobo", "t.a.n.g.a", "5h1t"]) {
      expect(isRude(n), n).toBe(true);
      expect(checkName(n).ok, n).toBe(false);
    }
  });
  it("does not block innocent names that contain short sub-words", () => {
    for (const n of ["Cassidy", "Titus", "Ashley", "Glass", "Basil", "Hancock", "Grape", "Taehyung", "Sussex", "Killian", "Tanya"]) expect(isRude(n), n).toBe(false);
  });
  it("random names are valid and never Nova", () => {
    for (let i = 0; i < 40; i++) {
      const n = randomName();
      expect(checkName(n).ok).toBe(true);
      expect(n.toLowerCase()).not.toContain("nova");
    }
    expect(RANDOM_NAMES).not.toContain("Nova-Kid");
  });
});
